import {
  pgTable,
  serial,
  varchar,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * 1. Food Items Catalog
 * Master catalog of dishes available in the canteen.
 */
export const foodItems = pgTable("food_items", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 60 }).notNull(), // 'Snacks', 'Breakfast', 'Lunch', 'Beverages'
  price: numeric("price", { precision: 10, scale: 2 }).notNull(), // Monetary values using numeric/decimal, never float
  imageUrl: text("image_url"),
  isVeg: boolean("is_veg").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 2. Daily Inventory
 * Partitioned per business date to ensure strict separation between:
 * - Total canteen batch
 * - Online allocation (reserved for pre-orders)
 * - Protected walk-in allocation = (total_stock - online_stock)
 * Same-day uniqueness constraint enforces only one record per food item per date.
 */
export const dailyInventory = pgTable(
  "daily_inventory",
  {
    id: serial("id").primaryKey(),
    foodItemId: integer("food_item_id")
      .references(() => foodItems.id, { onDelete: "cascade" })
      .notNull(),
    date: date("date").notNull(), // 'YYYY-MM-DD'
    totalStock: integer("total_stock").notNull(), // e.g. 500
    onlineStock: integer("online_stock").notNull(), // e.g. 250
    soldOnline: integer("sold_online").default(0).notNull(),
    isOnlineClosed: boolean("is_online_closed").default(false).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("daily_inv_item_date_idx").on(table.foodItemId, table.date),
    index("daily_inv_date_idx").on(table.date),
  ]
);

/**
 * 3. Inventory Holds (10-Minute Concurrency Lock)
 * Solves the race condition where multiple customers try to check out the last items.
 * Temporarily locks inventory while customer completes payment.
 * Automatically releases if hold expires without successful payment.
 */
export const inventoryHolds = pgTable(
  "inventory_holds",
  {
    id: serial("id").primaryKey(),
    holdSessionId: varchar("hold_session_id", { length: 64 }).notNull(), // UUID or client checkout session
    foodItemId: integer("food_item_id")
      .references(() => foodItems.id, { onDelete: "cascade" })
      .notNull(),
    date: date("date").notNull(),
    quantity: integer("quantity").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    status: varchar("status", { length: 20 }).default("ACTIVE").notNull(), // 'ACTIVE', 'CONVERTED', 'RELEASED', 'EXPIRED'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("hold_session_idx").on(table.holdSessionId),
    index("hold_item_date_status_idx").on(table.foodItemId, table.date, table.status),
    index("hold_expires_idx").on(table.expiresAt),
  ]
);

/**
 * 4. Orders
 * High-integrity state machine:
 * PENDING -> PAID -> READY -> SERVED (or CANCELLED / EXPIRED / PAYMENT_FAILED)
 * Zero-login: The customer is identified by order_code and secure QR token.
 */
export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderCode: varchar("order_code", { length: 24 }).notNull().unique(), // Human readable pickup code e.g. QP-2026-8941
    customerName: varchar("customer_name", { length: 80 }).default("Student Guest"),
    customerPhone: varchar("customer_phone", { length: 20 }),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
    status: varchar("status", { length: 24 }).default("PENDING").notNull(),
    paymentMethod: varchar("payment_method", { length: 30 }).default("UPI").notNull(),
    paymentRef: varchar("payment_ref", { length: 120 }),
    orderDate: date("order_date").notNull(), // Must match current canteen business day
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    servedAt: timestamp("served_at", { withTimezone: true }),
    staffNotes: text("staff_notes"),
  },
  (table) => [
    index("orders_order_date_idx").on(table.orderDate),
    index("orders_status_idx").on(table.status),
    index("orders_code_idx").on(table.orderCode),
  ]
);

/**
 * 5. Order Items
 * Line items for each placed order with snapshot unit price.
 */
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .references(() => orders.id, { onDelete: "cascade" })
    .notNull(),
  foodItemId: integer("food_item_id")
    .references(() => foodItems.id, { onDelete: "restrict" })
    .notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
});

/**
 * 6. QR Tokens
 * The cryptographically secure pickup credential.
 * Notice: We ONLY store the SHA-256 token_hash in PostgreSQL.
 * The raw token is ONLY delivered to the student in their offline QR code/receipt.
 * When staff scans, server hashes the scanned input and compares.
 */
export const qrTokens = pgTable(
  "qr_tokens",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .references(() => orders.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(), // SHA-256 hex string
    used: boolean("used").default(false).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    scannedBy: varchar("scanned_by", { length: 60 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("qr_tokens_hash_idx").on(table.tokenHash),
    index("qr_tokens_order_idx").on(table.orderId),
  ]
);

/**
 * 7. Canteen Staff / System Settings
 * For staff portal authentication (PIN-based zero-fuss canteen counter mode)
 */
export const staffSettings = pgTable("staff_settings", {
  id: serial("id").primaryKey(),
  canteenName: varchar("canteen_name", { length: 120 }).default("Campus Central Canteen").notNull(),
  counterPinHash: varchar("counter_pin_hash", { length: 64 }).default("1234").notNull(), // Default PIN 1234 for staff access
  operatingHours: varchar("operating_hours", { length: 100 }).default("8:00 AM - 6:00 PM").notNull(),
  onlineOrderingActive: boolean("online_ordering_active").default(true).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations for relational Drizzle queries
export const foodItemsRelations = relations(foodItems, ({ many }) => ({
  dailyInventories: many(dailyInventory),
  orderItems: many(orderItems),
  holds: many(inventoryHolds),
}));

export const dailyInventoryRelations = relations(dailyInventory, ({ one }) => ({
  foodItem: one(foodItems, {
    fields: [dailyInventory.foodItemId],
    references: [foodItems.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  qrToken: one(qrTokens, {
    fields: [orders.id],
    references: [qrTokens.orderId],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  foodItem: one(foodItems, {
    fields: [orderItems.foodItemId],
    references: [foodItems.id],
  }),
}));

export const qrTokensRelations = relations(qrTokens, ({ one }) => ({
  order: one(orders, {
    fields: [qrTokens.orderId],
    references: [orders.id],
  }),
}));
