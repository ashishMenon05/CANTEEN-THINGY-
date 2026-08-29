import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { generateOrderCode, getTodayDateString } from "@/lib/qpass";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { holdSessionId, customerName, customerPhone, paymentMethod = "UPI" } = body;

    if (!holdSessionId) {
      return NextResponse.json({ success: false, error: "holdSessionId is required" }, { status: 400 });
    }

    const today = getTodayDateString();

    await client.query("BEGIN");

    // 1. Fetch active holds for this session
    const holdsRes = await client.query(
      `SELECT h.id, h.food_item_id, h.quantity, h.expires_at, f.name, f.price 
       FROM inventory_holds h
       JOIN food_items f ON h.food_item_id = f.id 
       WHERE h.hold_session_id = $1 AND h.status = 'ACTIVE' AND h.date = $2`,
      [holdSessionId, today]
    );

    if (holdsRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          error: "No active inventory hold found. Your 10-minute hold may have expired. Please re-select items.",
        },
        { status: 410 }
      );
    }

    // Check if any hold expired
    const now = new Date();
    for (const hold of holdsRes.rows) {
      if (new Date(hold.expires_at) <= now) {
        await client.query(
          "UPDATE inventory_holds SET status = 'EXPIRED' WHERE hold_session_id = $1",
          [holdSessionId]
        );
        await client.query("ROLLBACK");
        return NextResponse.json(
          { success: false, error: "Your 10-minute reservation hold has expired." },
          { status: 410 }
        );
      }
    }

    // 2. Compute order total
    let totalAmount = 0;
    const itemsData = holdsRes.rows.map((row) => {
      const price = Number(row.price);
      const subtotal = price * Number(row.quantity);
      totalAmount += subtotal;
      return {
        foodItemId: row.food_item_id,
        name: row.name,
        quantity: Number(row.quantity),
        unitPrice: price,
        subtotal,
      };
    });

    const orderCode = generateOrderCode();
    // Order expires end of today's business shift (e.g. 6 hours from now)
    const orderExpiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);

    // 3. Insert order with PENDING status
    const orderRes = await client.query(
      `INSERT INTO orders (order_code, customer_name, customer_phone, total_amount, status, payment_method, order_date, expires_at) 
       VALUES ($1, $2, $3, $4, 'PENDING', $5, $6, $7) 
       RETURNING id, order_code, total_amount, status, order_date, created_at, expires_at`,
      [
        orderCode,
        customerName?.trim() || "Student Guest",
        customerPhone?.trim() || null,
        totalAmount.toFixed(2),
        paymentMethod,
        today,
        orderExpiresAt.toISOString(),
      ]
    );

    const order = orderRes.rows[0];

    // 4. Insert order items
    for (const item of itemsData) {
      await client.query(
        `INSERT INTO order_items (order_id, food_item_id, quantity, unit_price, subtotal) 
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.foodItemId, item.quantity, item.unitPrice.toFixed(2), item.subtotal.toFixed(2)]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderCode: order.order_code,
        customerName: customerName || "Student Guest",
        customerPhone: customerPhone || null,
        totalAmount: Number(order.total_amount),
        status: order.status,
        orderDate: order.order_date,
        items: itemsData,
        expiresAt: order.expires_at,
        holdSessionId,
      },
      message: "Order created in PENDING state. Complete payment to generate pickup QR token.",
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Order creation error:", error);
    return NextResponse.json(
      { success: false, error: error?.message ?? "Order creation failed" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// Retrieve an order or lookup orders
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderCode = searchParams.get("orderCode");
    const orderId = searchParams.get("orderId");

    if (!orderCode && !orderId) {
      // List recent orders for display
      const list = await pool.query(
        `SELECT o.id, o.order_code, o.customer_name, o.total_amount, o.status, o.created_at, o.order_date,
                COALESCE(json_agg(json_build_object('name', f.name, 'quantity', oi.quantity, 'subtotal', oi.subtotal)) FILTER (WHERE f.name IS NOT NULL), '[]') as items
         FROM orders o
         LEFT JOIN order_items oi ON o.id = oi.order_id
         LEFT JOIN food_items f ON oi.food_item_id = f.id
         GROUP BY o.id
         ORDER BY o.created_at DESC 
         LIMIT 20`
      );
      return NextResponse.json({ success: true, orders: list.rows });
    }

    const orderRes = await pool.query(
      `SELECT o.*, 
              COALESCE(json_agg(json_build_object('foodItemId', f.id, 'name', f.name, 'quantity', oi.quantity, 'unitPrice', oi.unit_price, 'subtotal', oi.subtotal)) FILTER (WHERE f.name IS NOT NULL), '[]') as items,
              qt.used as qr_used, qt.used_at as qr_used_at
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN food_items f ON oi.food_item_id = f.id
       LEFT JOIN qr_tokens qt ON o.id = qt.order_id
       WHERE ${orderCode ? "o.order_code = $1" : "o.id = $1"}
       GROUP BY o.id, qt.used, qt.used_at`,
      [orderCode || orderId]
    );

    if (orderRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, order: orderRes.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message ?? "Query failed" }, { status: 500 });
  }
}
