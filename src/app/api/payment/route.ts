import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { generateSecureOrderToken, getTodayDateString } from "@/lib/qpass";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { orderId, holdSessionId, paymentSimulationMode = "SUCCESS", upiProvider = "PhonePe/GPay UPI" } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, error: "orderId is required" }, { status: 400 });
    }

    const today = getTodayDateString();

    await client.query("BEGIN");

    // 1. Fetch the order with row lock
    const orderRes = await client.query(
      `SELECT id, order_code, customer_name, total_amount, status, order_date, expires_at 
       FROM orders 
       WHERE id = $1 
       FOR UPDATE`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    const order = orderRes.rows[0];

    // Verify order date is today
    const orderDateStr = new Date(order.order_date).toISOString().slice(0, 10);
    if (orderDateStr !== today) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, error: "This order belongs to a previous business date and cannot be paid." },
        { status: 400 }
      );
    }

    // Check if order is already paid
    if (order.status === "PAID" || order.status === "READY" || order.status === "SERVED") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, error: `Order is already in ${order.status} state.` },
        { status: 400 }
      );
    }

    if (order.status !== "PENDING") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, error: `Order cannot be paid in ${order.status} state.` },
        { status: 400 }
      );
    }

    // Check if simulated payment failed
    if (paymentSimulationMode === "FAIL") {
      await client.query(
        "UPDATE orders SET status = 'PAYMENT_FAILED' WHERE id = $1",
        [orderId]
      );
      if (holdSessionId) {
        await client.query(
          "UPDATE inventory_holds SET status = 'RELEASED' WHERE hold_session_id = $1",
          [holdSessionId]
        );
      }
      await client.query("COMMIT");
      return NextResponse.json(
        { success: false, error: "UPI payment declined by issuing bank or user cancelled." },
        { status: 402 }
      );
    }

    // Server-side payment verification succeeded
    const paymentRef = `UPI/REF/${Date.now()}/${Math.floor(100000 + Math.random() * 900000)}`;

    // 2. Fetch order items to commit inventory from hold -> sold_online
    const itemsRes = await client.query(
      "SELECT food_item_id, quantity FROM order_items WHERE order_id = $1",
      [orderId]
    );

    for (const item of itemsRes.rows) {
      // Increment sold_online in daily_inventory
      await client.query(
        `UPDATE daily_inventory 
         SET sold_online = sold_online + $1, updated_at = NOW() 
         WHERE food_item_id = $2 AND date = $3`,
        [item.quantity, item.food_item_id, today]
      );
    }

    // 3. Mark holds as CONVERTED so they don't get double counted or expired
    if (holdSessionId) {
      await client.query(
        "UPDATE inventory_holds SET status = 'CONVERTED' WHERE hold_session_id = $1",
        [holdSessionId]
      );
    }

    // 4. Update order status to PAID
    await client.query(
      `UPDATE orders 
       SET status = 'PAID', payment_ref = $1, payment_method = $2 
       WHERE id = $3`,
      [paymentRef, upiProvider, orderId]
    );

    // 5. Generate cryptographically secure random token (32 bytes = 64 hex characters)
    const { rawToken, tokenHash } = generateSecureOrderToken();

    // 6. Save SHA-256 hash in PostgreSQL qr_tokens table
    // (Never save rawToken in the database!)
    await client.query(
      `INSERT INTO qr_tokens (order_id, token_hash, used) 
       VALUES ($1, $2, false)
       ON CONFLICT (order_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, used = false`,
      [orderId, tokenHash]
    );

    await client.query("COMMIT");

    // Retrieve order items with names for the receipt
    const receiptItemsRes = await client.query(
      `SELECT f.name, oi.quantity, oi.unit_price, oi.subtotal 
       FROM order_items oi
       JOIN food_items f ON oi.food_item_id = f.id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    // Notice: We return the rawToken to the client ONCE so they can render and save their offline QR receipt.
    // The database only knows the SHA-256 hash.
    return NextResponse.json({
      success: true,
      message: "Payment verified successfully. Order confirmed!",
      order: {
        id: order.id,
        orderCode: order.order_code,
        customerName: order.customer_name,
        totalAmount: Number(order.total_amount),
        status: "PAID",
        paymentRef,
        paymentMethod: upiProvider,
        orderDate: today,
        items: receiptItemsRes.rows.map((r) => ({
          name: r.name,
          quantity: Number(r.quantity),
          unitPrice: Number(r.unit_price),
          subtotal: Number(r.subtotal),
        })),
      },
      pickupCredential: {
        rawToken, // The opaque unguessable token encoded in QR code
        note: "Store this receipt offline. Present this QR at the canteen counter for fast pickup without internet or login.",
      },
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Payment processing error:", error);
    return NextResponse.json(
      { success: false, error: error?.message ?? "Payment processing failed" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
