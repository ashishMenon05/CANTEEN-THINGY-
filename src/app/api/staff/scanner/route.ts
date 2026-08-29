import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { hashOrderToken, getTodayDateString } from "@/lib/qpass";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const rawTokenInput = body.token?.trim();
    const scannedBy = body.staffName?.trim() || "Canteen Pickup Counter 1";

    if (!rawTokenInput) {
      return NextResponse.json(
        {
          success: false,
          code: "MISSING_TOKEN",
          error: "No token provided. Please scan a valid Q-Pass QR code.",
        },
        { status: 400 }
      );
    }

    const today = getTodayDateString();

    // 1. Hash the raw token presented by the staff scanner
    const calculatedHash = hashOrderToken(rawTokenInput);

    await client.query("BEGIN");

    // 2. Look up the token in PostgreSQL using FOR UPDATE to prevent double-scan race conditions
    const tokenRes = await client.query(
      `SELECT qt.id as qr_token_id, qt.order_id, qt.token_hash, qt.used, qt.used_at, qt.scanned_by,
              o.id as order_id, o.order_code, o.customer_name, o.customer_phone, o.total_amount, o.status, o.order_date, o.created_at
       FROM qr_tokens qt
       JOIN orders o ON qt.order_id = o.id
       WHERE qt.token_hash = $1
       FOR UPDATE OF qt`,
      [calculatedHash]
    );

    // Case 1: Token hash not found in database
    if (tokenRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_TOKEN",
          error: "Invalid QR Code! This token does not exist in the canteen system.",
          details: "Potential counterfeit or unauthenticated token.",
        },
        { status: 404 }
      );
    }

    const orderRow = tokenRes.rows[0];

    // Case 2: Token already used / redeemed
    if (orderRow.used) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          code: "ALREADY_USED",
          error: `ALREADY REDEEMED! Order ${orderRow.order_code} was already served at ${new Date(orderRow.used_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`,
          orderCode: orderRow.order_code,
          customerName: orderRow.customer_name,
          previouslyServedAt: orderRow.used_at,
          scannedBy: orderRow.scanned_by,
        },
        { status: 409 }
      );
    }

    // Case 3: Same-Day business date restriction
    const orderDateStr = new Date(orderRow.order_date).toISOString().slice(0, 10);
    if (orderDateStr !== today) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          code: "DATE_MISMATCH",
          error: `EXPIRED DATE! Order was booked for ${orderDateStr}. Cannot redeem past-day orders today (${today}).`,
          orderCode: orderRow.order_code,
        },
        { status: 400 }
      );
    }

    // Case 4: Order status check (Must be PAID or READY)
    if (orderRow.status === "CANCELLED" || orderRow.status === "EXPIRED" || orderRow.status === "PAYMENT_FAILED") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          code: "ORDER_NOT_VALID",
          error: `Cannot serve order with status ${orderRow.status}.`,
          orderCode: orderRow.order_code,
        },
        { status: 400 }
      );
    }

    if (orderRow.status === "PENDING") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          code: "PAYMENT_PENDING",
          error: "Payment has not been completed for this order.",
          orderCode: orderRow.order_code,
        },
        { status: 402 }
      );
    }

    // 3. Atomically mark QR token as used
    const now = new Date();
    await client.query(
      `UPDATE qr_tokens 
       SET used = true, used_at = $1, scanned_by = $2 
       WHERE id = $3`,
      [now.toISOString(), scannedBy, orderRow.qr_token_id]
    );

    // 4. Update order status to SERVED
    await client.query(
      `UPDATE orders 
       SET status = 'SERVED', served_at = $1 
       WHERE id = $2`,
      [now.toISOString(), orderRow.order_id]
    );

    // 5. Fetch line items to display to canteen staff for assembly
    const itemsRes = await client.query(
      `SELECT f.name, oi.quantity, oi.unit_price, oi.subtotal 
       FROM order_items oi
       JOIN food_items f ON oi.food_item_id = f.id
       WHERE oi.order_id = $1`,
      [orderRow.order_id]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      code: "SUCCESS_REDEEMED",
      message: `Verified & Redeemed! Order #${orderRow.order_code} handed over.`,
      order: {
        id: orderRow.order_id,
        orderCode: orderRow.order_code,
        customerName: orderRow.customer_name,
        customerPhone: orderRow.customer_phone,
        totalAmount: Number(orderRow.total_amount),
        status: "SERVED",
        servedAt: now.toISOString(),
        scannedBy,
        items: itemsRes.rows.map((r) => ({
          name: r.name,
          quantity: Number(r.quantity),
          unitPrice: Number(r.unit_price),
          subtotal: Number(r.subtotal),
        })),
      },
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Staff scanner error:", error);
    return NextResponse.json(
      { success: false, error: error?.message ?? "Scanner validation failed" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
