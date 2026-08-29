import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { foodItems, dailyInventory, inventoryHolds, staffSettings } from "@/db/schema";
import { eq, sql, and, gte } from "drizzle-orm";
import { getTodayDateString } from "@/lib/qpass";
import { seedDatabase } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await seedDatabase();
    const today = getTodayDateString();

    // 1. Housekeeping: Expire any holds whose timer has passed
    await db
      .update(inventoryHolds)
      .set({ status: "EXPIRED" })
      .where(
        and(
          eq(inventoryHolds.status, "ACTIVE"),
          sql`${inventoryHolds.expiresAt} <= NOW()`
        )
      );

    // 2. Fetch staff settings for global online ordering status
    const [settings] = await db.select().from(staffSettings).limit(1);

    // 3. Fetch food items with today's inventory
    const items = await db
      .select({
        id: foodItems.id,
        name: foodItems.name,
        description: foodItems.description,
        category: foodItems.category,
        price: foodItems.price,
        imageUrl: foodItems.imageUrl,
        isVeg: foodItems.isVeg,
        isActive: foodItems.isActive,
        inventoryId: dailyInventory.id,
        date: dailyInventory.date,
        totalStock: dailyInventory.totalStock,
        onlineStock: dailyInventory.onlineStock,
        soldOnline: dailyInventory.soldOnline,
        isOnlineClosed: dailyInventory.isOnlineClosed,
      })
      .from(foodItems)
      .leftJoin(
        dailyInventory,
        and(
          eq(dailyInventory.foodItemId, foodItems.id),
          eq(dailyInventory.date, today)
        )
      )
      .where(eq(foodItems.isActive, true));

    // 4. Calculate active holds per item
    const activeHoldsResult = await db.execute(
      sql`SELECT food_item_id, COALESCE(SUM(quantity), 0) as held_count 
          FROM inventory_holds 
          WHERE status = 'ACTIVE' AND expires_at > NOW() AND date = ${today} 
          GROUP BY food_item_id`
    );

    const holdsMap: Record<number, number> = {};
    for (const row of (activeHoldsResult as any).rows || []) {
      holdsMap[Number(row.food_item_id)] = Number(row.held_count);
    }

    const responseItems = items.map((item) => {
      const total = item.totalStock ?? 0;
      const onlineAllocated = item.onlineStock ?? 0;
      const sold = item.soldOnline ?? 0;
      const held = holdsMap[item.id] ?? 0;
      
      // Protected walk-in allocation is always total - online
      const walkinProtected = Math.max(0, total - onlineAllocated);
      
      // Real-time available online stock
      const availableOnline = Math.max(0, onlineAllocated - sold - held);

      const isClosed = (item.isOnlineClosed ?? false) || !(settings?.onlineOrderingActive ?? true);

      let status = "AVAILABLE";
      if (isClosed) {
        status = "ONLINE_CLOSED";
      } else if (availableOnline <= 0) {
        status = "SOLD_OUT";
      } else if (availableOnline <= 10) {
        status = "FEW_LEFT";
      }

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        price: Number(item.price),
        imageUrl: item.imageUrl,
        isVeg: item.isVeg,
        inventory: {
          id: item.inventoryId,
          date: today,
          totalStock: total,
          onlineStock: onlineAllocated,
          soldOnline: sold,
          heldQuantity: held,
          walkinProtectedStock: walkinProtected,
          availableOnline: availableOnline,
          isOnlineClosed: isClosed,
          status,
        },
      };
    });

    return NextResponse.json({
      success: true,
      businessDate: today,
      onlineOrderingActive: settings?.onlineOrderingActive ?? true,
      canteenName: settings?.canteenName ?? "Campus Central Canteen",
      items: responseItems,
    });
  } catch (error: any) {
    console.error("Failed to fetch inventory:", error);
    return NextResponse.json(
      { success: false, error: error?.message ?? "Inventory lookup failed" },
      { status: 500 }
    );
  }
}

// Staff inventory adjustment
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { foodItemId, onlineStock, totalStock, isOnlineClosed, globalOnlineActive } = body;
    const today = getTodayDateString();

    if (globalOnlineActive !== undefined) {
      await db
        .update(staffSettings)
        .set({ onlineOrderingActive: Boolean(globalOnlineActive), updatedAt: new Date() })
        .where(eq(staffSettings.id, 1));
      return NextResponse.json({ success: true, message: "Global online status updated" });
    }

    if (!foodItemId) {
      return NextResponse.json({ success: false, error: "foodItemId is required" }, { status: 400 });
    }

    // Fetch current daily inventory
    const [curr] = await db
      .select()
      .from(dailyInventory)
      .where(and(eq(dailyInventory.foodItemId, foodItemId), eq(dailyInventory.date, today)))
      .limit(1);

    if (!curr) {
      return NextResponse.json({ success: false, error: "Inventory record for today not found" }, { status: 404 });
    }

    const newOnline = onlineStock !== undefined ? Number(onlineStock) : curr.onlineStock;
    const newTotal = totalStock !== undefined ? Number(totalStock) : curr.totalStock;

    // Safety rule 1: onlineStock cannot be less than already sold online!
    if (newOnline < curr.soldOnline) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot reduce online stock below already sold amount (${curr.soldOnline} units already sold).`,
        },
        { status: 400 }
      );
    }

    // Safety rule 2: onlineStock cannot exceed totalStock
    if (newOnline > newTotal) {
      return NextResponse.json(
        {
          success: false,
          error: `Online allocation (${newOnline}) cannot exceed total stock (${newTotal}).`,
        },
        { status: 400 }
      );
    }

    await db
      .update(dailyInventory)
      .set({
        onlineStock: newOnline,
        totalStock: newTotal,
        isOnlineClosed: isOnlineClosed !== undefined ? Boolean(isOnlineClosed) : curr.isOnlineClosed,
        updatedAt: new Date(),
      })
      .where(and(eq(dailyInventory.foodItemId, foodItemId), eq(dailyInventory.date, today)));

    return NextResponse.json({
      success: true,
      message: "Inventory updated successfully",
      updated: {
        foodItemId,
        totalStock: newTotal,
        onlineStock: newOnline,
        walkinProtected: newTotal - newOnline,
        soldOnline: curr.soldOnline,
        isOnlineClosed: isOnlineClosed !== undefined ? Boolean(isOnlineClosed) : curr.isOnlineClosed,
      },
    });
  } catch (error: any) {
    console.error("Error updating inventory:", error);
    return NextResponse.json({ success: false, error: error?.message ?? "Update failed" }, { status: 500 });
  }
}
