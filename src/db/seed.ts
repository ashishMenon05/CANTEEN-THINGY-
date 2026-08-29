import { db, pool } from "./index";
import { foodItems, dailyInventory, staffSettings, orders, orderItems, qrTokens } from "./schema";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";

export async function seedDatabase() {
  console.log("Checking database seed...");

  // Check if staffSettings exists
  const existingSettings = await db.select().from(staffSettings).limit(1);
  if (existingSettings.length === 0) {
    await db.insert(staffSettings).values({
      canteenName: "Campus Central Canteen (Block A)",
      counterPinHash: "1234",
      operatingHours: "8:00 AM - 5:30 PM",
      onlineOrderingActive: true,
    });
    console.log("Initialized staff settings.");
  }

  // Check if foodItems exist
  const existingItems = await db.select().from(foodItems).limit(1);
  const today = new Date().toISOString().slice(0, 10);

  if (existingItems.length === 0) {
    console.log("Inserting default food items catalog...");
    const items = await db
      .insert(foodItems)
      .values([
        {
          name: "Crispy Veg Puff",
          description: "Golden flaky layered pastry filled with spicy masala potato & green peas.",
          category: "Snacks",
          price: "20.00",
          imageUrl: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80",
          isVeg: true,
          isActive: true,
        },
        {
          name: "Paneer Kathi Roll",
          description: "Marinated grilled cottage cheese cubes wrapped in whole wheat paratha with mint relish.",
          category: "Snacks",
          price: "65.00",
          imageUrl: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80",
          isVeg: true,
          isActive: true,
        },
        {
          name: "Butter Masala Dosa",
          description: "Crispy fermented crepe stuffed with spiced mashed potatoes, served with fresh coconut chutney & sambar.",
          category: "Breakfast",
          price: "50.00",
          imageUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80",
          isVeg: true,
          isActive: true,
        },
        {
          name: "Hot Samosa Pav Duo",
          description: "Pair of freshly fried spiced potato samosas tucked inside warm butter-toasted ladi pavs with dry garlic chutney.",
          category: "Snacks",
          price: "35.00",
          imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80",
          isVeg: true,
          isActive: true,
        },
        {
          name: "Iced Cold Coffee",
          description: "Rich blended espresso shot with chilled creamy milk, turbinado sugar, and chocolate drizzle.",
          category: "Beverages",
          price: "40.00",
          imageUrl: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&auto=format&fit=crop&q=80",
          isVeg: true,
          isActive: true,
        },
        {
          name: "Chicken Keema Puff",
          description: "Flaky puff pastry stuffed with slow-cooked minced chicken, aromatic garam masala, and fresh cilantro.",
          category: "Snacks",
          price: "45.00",
          imageUrl: "https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=600&auto=format&fit=crop&q=80",
          isVeg: false,
          isActive: true,
        },
        {
          name: "Special Executive Veg Thali",
          description: "Complete nutritious lunch: 2 Butter rotis, Jeera rice, Dal tadka, Shahi paneer, seasonal veg, and gulab jamun.",
          category: "Lunch",
          price: "90.00",
          imageUrl: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=600&auto=format&fit=crop&q=80",
          isVeg: true,
          isActive: true,
        },
        {
          name: "Cutting Masala Chai",
          description: "Authentic double-boiled tea infused with fresh crushed ginger, green cardamom, and lemongrass.",
          category: "Beverages",
          price: "15.00",
          imageUrl: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80",
          isVeg: true,
          isActive: true,
        },
      ])
      .returning();

    // Now seed daily inventory for today
    for (const item of items) {
      // Default stock allocations: 500 total, 250 online, 250 walk-in
      const total = item.name.includes("Puff") ? 500 : item.category === "Beverages" ? 300 : 150;
      const online = Math.floor(total * 0.5); // 50% online allocation

      await db.insert(dailyInventory).values({
        foodItemId: item.id,
        date: today,
        totalStock: total,
        onlineStock: online,
        soldOnline: 0,
        isOnlineClosed: false,
      });
    }
    console.log("Seeded initial items and inventory allocations.");

    // Create 1 demonstration sample paid order so the scanner & pickup demo has an immediate live example
    const sampleItem = items[0]; // Veg Puff
    const sampleTokenRaw = "qpass_demo_token_" + crypto.randomBytes(16).toString("hex");
    const sampleTokenHash = crypto.createHash("sha256").update(sampleTokenRaw).digest("hex");

    const [sampleOrder] = await db
      .insert(orders)
      .values({
        orderCode: "QP-2026-DEMO1",
        customerName: "Aarav Sharma (ME Dept)",
        customerPhone: "+91 9876543210",
        totalAmount: "40.00",
        status: "PAID",
        paymentMethod: "UPI",
        paymentRef: "UPI/TXN/2026/894172",
        orderDate: today,
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // Valid for 6 hours today
      })
      .returning();

    await db.insert(orderItems).values({
      orderId: sampleOrder.id,
      foodItemId: sampleItem.id,
      quantity: 2,
      unitPrice: "20.00",
      subtotal: "40.00",
    });

    await db.insert(qrTokens).values({
      orderId: sampleOrder.id,
      tokenHash: sampleTokenHash,
      used: false,
    });

    // Update sold online for sample
    await db
      .update(dailyInventory)
      .set({ soldOnline: sql`sold_online + 2` })
      .where(eq(dailyInventory.foodItemId, sampleItem.id));

    console.log("Sample order created. Sample token:", sampleTokenRaw);
  } else {
    // Make sure today's date has daily_inventory entries
    const items = await db.select().from(foodItems);
    console.log("Raw items received by seedDatabase:", JSON.stringify(items));
    for (const item of items) {
      try {
        const existingInv = await db
          .select()
          .from(dailyInventory)
          .where(sql`${dailyInventory.foodItemId} = ${item.id} AND ${dailyInventory.date} = ${today}`)
          .limit(1);

        if (existingInv.length === 0) {
          const total = item.name.includes("Puff") ? 500 : item.category === "Beverages" ? 300 : 150;
          const online = Math.floor(total * 0.5);

          await db.insert(dailyInventory).values({
            foodItemId: item.id,
            date: today,
            totalStock: total,
            onlineStock: online,
            soldOnline: 0,
            isOnlineClosed: false,
          });
        }
      } catch (err: any) {
        console.error("Error checking/inserting inventory for item:", JSON.stringify(item), "today:", today);
        console.error("Stack trace:", err.stack || err);
        throw err;
      }
    }
  }
}
