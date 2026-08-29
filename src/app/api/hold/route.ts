import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { getTodayDateString } from "@/lib/qpass";
import crypto from "crypto";

export const dynamic = "force-dynamic";

interface HoldItemRequest {
  foodItemId: number;
  quantity: number;
}

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const items: HoldItemRequest[] = body.items;
    const existingSessionId: string | undefined = body.holdSessionId;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "Items array is required" }, { status: 400 });
    }

    const today = getTodayDateString();
    const holdSessionId = existingSessionId || "hold_" + crypto.randomBytes(16).toString("hex");
    const HOLD_DURATION_MINUTES = 10;
    const expiresAt = new Date(Date.now() + HOLD_DURATION_MINUTES * 60 * 1000);

    // BEGIN PostgreSQL Transaction for Atomic Row-Locked Reservation
    await client.query("BEGIN");

    // Clean up any existing active holds for this session if re-holding
    if (existingSessionId) {
      await client.query(
        "UPDATE inventory_holds SET status = 'RELEASED' WHERE hold_session_id = $1 AND status = 'ACTIVE'",
        [existingSessionId]
      );
    }

    // Process each item with SELECT ... FOR UPDATE to avoid race conditions
    for (const item of items) {
      if (!item.foodItemId || item.quantity <= 0) {
        throw new Error("Invalid item or quantity");
      }

      // 1. Lock the inventory row for this food item today
      const invRes = await client.query(
        `SELECT id, online_stock, sold_online, is_online_closed 
         FROM daily_inventory 
         WHERE food_item_id = $1 AND date = $2 
         FOR UPDATE`,
        [item.foodItemId, today]
      );

      if (invRes.rows.length === 0) {
        throw new Error(`Item #${item.foodItemId} is not scheduled in today's canteen menu.`);
      }

      const row = invRes.rows[0];
      if (row.is_online_closed) {
        throw new Error(`Online ordering is currently closed for item #${item.foodItemId}.`);
      }

      // 2. Count current active holds for this item
      const holdsRes = await client.query(
        `SELECT COALESCE(SUM(quantity), 0) as active_held 
         FROM inventory_holds 
         WHERE food_item_id = $1 AND date = $2 AND status = 'ACTIVE' AND expires_at > NOW()`,
        [item.foodItemId, today]
      );

      const activeHeld = Number(holdsRes.rows[0].active_held);
      const availableOnline = Number(row.online_stock) - Number(row.sold_online) - activeHeld;

      if (availableOnline < item.quantity) {
        // Rollback transaction immediately on insufficient stock
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            success: false,
            error: `Sold out! Only ${Math.max(0, availableOnline)} units remain available for item #${item.foodItemId}.`,
            itemAvailable: Math.max(0, availableOnline),
          },
          { status: 409 }
        );
      }

      // 3. Insert temporary hold record
      await client.query(
        `INSERT INTO inventory_holds (hold_session_id, food_item_id, date, quantity, expires_at, status) 
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE')`,
        [holdSessionId, item.foodItemId, today, item.quantity, expiresAt.toISOString()]
      );
    }

    // All items successfully reserved — Commit transaction
    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      holdSessionId,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: HOLD_DURATION_MINUTES * 60,
      message: `Stock reserved for ${HOLD_DURATION_MINUTES} minutes. Complete payment to secure order.`,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Hold transaction error:", error);
    return NextResponse.json(
      { success: false, error: error?.message ?? "Failed to acquire inventory hold" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const holdSessionId = searchParams.get("holdSessionId");

    if (!holdSessionId) {
      return NextResponse.json({ success: false, error: "holdSessionId is required" }, { status: 400 });
    }

    await pool.query(
      "UPDATE inventory_holds SET status = 'RELEASED' WHERE hold_session_id = $1 AND status = 'ACTIVE'",
      [holdSessionId]
    );

    return NextResponse.json({ success: true, message: "Inventory hold released back to available pool." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message ?? "Release failed" }, { status: 500 });
  }
}
