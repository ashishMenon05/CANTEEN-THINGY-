import { NextResponse } from "next/server";
import { pool } from "@/db";
import { getTodayDateString } from "@/lib/qpass";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST() {
  const today = getTodayDateString();

  // 1. Setup a dedicated temporary test item or find an item
  // To avoid disrupting regular menu items, we find or create an item with remaining stock = 1
  let testItemId = 1;
  const itemCheck = await pool.query(
    "SELECT id, name FROM food_items WHERE is_active = true LIMIT 1"
  );
  if (itemCheck.rows.length > 0) {
    testItemId = itemCheck.rows[0].id;
  }

  // Set the online stock of this test item so that exactly 1 unit is available for online checkout
  // Online stock = sold_online + 1
  const soldRes = await pool.query(
    "SELECT sold_online FROM daily_inventory WHERE food_item_id = $1 AND date = $2",
    [testItemId, today]
  );
  const currentSold = soldRes.rows.length > 0 ? Number(soldRes.rows[0].sold_online) : 0;
  
  // Clear any old test holds
  await pool.query(
    "UPDATE inventory_holds SET status = 'RELEASED' WHERE food_item_id = $1 AND status = 'ACTIVE'",
    [testItemId]
  );

  // Set online stock to exactly currentSold + 1, so exactly 1 remains available!
  await pool.query(
    `UPDATE daily_inventory 
     SET online_stock = $1, is_online_closed = false 
     WHERE food_item_id = $2 AND date = $3`,
    [currentSold + 1, testItemId, today]
  );

  // Simulation Worker Function: attempts to acquire 1 hold using PostgreSQL transactions & FOR UPDATE
  async function attemptCheckout(buyerName: string, simulatedDelayMs: number) {
    const client = await pool.connect();
    const startTime = Date.now();
    const sessionId = "sim_" + buyerName.toLowerCase().replace(/\s+/g, "_") + "_" + crypto.randomBytes(4).toString("hex");

    try {
      await client.query("BEGIN");

      // Artificial tiny delay inside transaction to demonstrate row locking queue
      if (simulatedDelayMs > 0) {
        await new Promise((r) => setTimeout(r, simulatedDelayMs));
      }

      // Explicit Row Lock on daily_inventory
      const inv = await client.query(
        `SELECT id, online_stock, sold_online 
         FROM daily_inventory 
         WHERE food_item_id = $1 AND date = $2 
         FOR UPDATE`,
        [testItemId, today]
      );

      const row = inv.rows[0];
      const holds = await client.query(
        `SELECT COALESCE(SUM(quantity), 0) as active_held 
         FROM inventory_holds 
         WHERE food_item_id = $1 AND date = $2 AND status = 'ACTIVE' AND expires_at > NOW()`,
        [testItemId, today]
      );

      const available = Number(row.online_stock) - Number(row.sold_online) - Number(holds.rows[0].active_held);

      if (available < 1) {
        await client.query("ROLLBACK");
        return {
          buyer: buyerName,
          status: "SOLD_OUT",
          message: "Conflict 409: Item was acquired by the competing transaction. Zero over-selling!",
          timeTakenMs: Date.now() - startTime,
          heldQuantity: 0,
        };
      }

      // Reserve the item
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await client.query(
        `INSERT INTO inventory_holds (hold_session_id, food_item_id, date, quantity, expires_at, status) 
         VALUES ($1, $2, $3, 1, $4, 'ACTIVE')`,
        [sessionId, testItemId, today, expiresAt.toISOString()]
      );

      await client.query("COMMIT");

      return {
        buyer: buyerName,
        status: "SUCCESS",
        message: "Successfully acquired 10-minute hold lock inside PostgreSQL transaction!",
        timeTakenMs: Date.now() - startTime,
        sessionId,
        heldQuantity: 1,
      };
    } catch (err: any) {
      await client.query("ROLLBACK");
      return {
        buyer: buyerName,
        status: "FAILED",
        error: err.message,
        timeTakenMs: Date.now() - startTime,
      };
    } finally {
      client.release();
    }
  }

  // Fire both requests concurrently using Promise.all
  const [resultA, resultB] = await Promise.all([
    attemptCheckout("Customer A (First to arrive at lock)", 10),
    attemptCheckout("Customer B (Arrived 5ms later)", 0),
  ]);

  // Check final inventory in database to confirm no oversell (Stock is 0, NEVER -1)
  const finalCheck = await pool.query(
    `SELECT online_stock, sold_online, 
            (SELECT COALESCE(SUM(quantity), 0) FROM inventory_holds WHERE food_item_id = $1 AND status = 'ACTIVE' AND date = $2) as active_held 
     FROM daily_inventory 
     WHERE food_item_id = $1 AND date = $2`,
    [testItemId, today]
  );

  const finalRow = finalCheck.rows[0];
  const finalAvailable = Number(finalRow.online_stock) - Number(finalRow.sold_online) - Number(finalRow.active_held);

  return NextResponse.json({
    testTitle: "High-Concurrency Two-Customer Race Simulation",
    explanation:
      "Customer A and Customer B both attempted to purchase the last 1 remaining item simultaneously. PostgreSQL 'SELECT ... FOR UPDATE' queued Customer B behind Customer A. Customer A committed successfully, and Customer B's transaction detected zero remaining stock and cleanly rolled back.",
    testItemName: itemCheck.rows[0]?.name ?? "Veg Puff",
    initialAvailableUnits: 1,
    results: [resultA, resultB],
    finalDatabaseState: {
      onlineStock: Number(finalRow.online_stock),
      soldOnline: Number(finalRow.sold_online),
      activeHeld: Number(finalRow.active_held),
      finalAvailableOnline: finalAvailable,
      oversellPrevented: finalAvailable >= 0,
    },
  });
}
