import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getTodayDateString } from "@/lib/qpass";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const today = getTodayDateString();

    const ordersRes = await pool.query(
      `SELECT o.id, o.order_code, o.customer_name, o.customer_phone, o.total_amount, o.status,
              o.payment_method, o.payment_ref, o.created_at, o.expires_at, o.served_at,
              qt.used as qr_used, qt.used_at as qr_used_at,
              COALESCE(
                json_agg(
                  json_build_object(
                    'foodItemId', f.id,
                    'name', f.name,
                    'quantity', oi.quantity,
                    'unitPrice', oi.unit_price,
                    'subtotal', oi.subtotal
                  )
                ) FILTER (WHERE f.id IS NOT NULL), '[]'
              ) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN food_items f ON oi.food_item_id = f.id
       LEFT JOIN qr_tokens qt ON o.id = qt.order_id
       WHERE o.order_date = $1
       GROUP BY o.id, qt.used, qt.used_at
       ORDER BY o.created_at DESC`,
      [today]
    );

    // Calculate metrics
    let totalRevenue = 0;
    let pendingCount = 0;
    let paidCount = 0;
    let readyCount = 0;
    let servedCount = 0;

    for (const ord of ordersRes.rows) {
      if (ord.status === "PAID" || ord.status === "READY" || ord.status === "SERVED") {
        totalRevenue += Number(ord.total_amount);
      }
      if (ord.status === "PENDING") pendingCount++;
      if (ord.status === "PAID") paidCount++;
      if (ord.status === "READY") readyCount++;
      if (ord.status === "SERVED") servedCount++;
    }

    return NextResponse.json({
      success: true,
      businessDate: today,
      metrics: {
        totalOrdersToday: ordersRes.rows.length,
        totalRevenue: totalRevenue.toFixed(2),
        pendingCount,
        paidCount,
        readyCount,
        servedCount,
      },
      orders: ordersRes.rows,
    });
  } catch (error: any) {
    console.error("Staff orders error:", error);
    return NextResponse.json({ success: false, error: error?.message ?? "Query failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json({ success: false, error: "orderId and status are required" }, { status: 400 });
    }

    const allowedStatuses = ["PAID", "READY", "SERVED", "CANCELLED"];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid target status" }, { status: 400 });
    }

    await pool.query(
      "UPDATE orders SET status = $1, served_at = CASE WHEN $1 = 'SERVED' THEN NOW() ELSE served_at END WHERE id = $2",
      [status, orderId]
    );

    return NextResponse.json({ success: true, message: `Order updated to ${status}` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message ?? "Update failed" }, { status: 500 });
  }
}
