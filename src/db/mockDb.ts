import crypto from "crypto";
import fs from "fs";
import path from "path";

const MOCK_DB_PATH = process.env.QPASS_MOCK_DB_PATH || path.join(process.cwd(), "src", "db", "mockdb.json");

export interface MockFoodItem {
  id: number;
  name: string;
  description: string;
  category: string;
  price: string;
  imageUrl: string;
  isVeg: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface MockDailyInventory {
  id: number;
  foodItemId: number;
  date: string;
  totalStock: number;
  onlineStock: number;
  soldOnline: number;
  isOnlineClosed: boolean;
  updatedAt: string;
}

export interface MockOrder {
  id: number;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  totalAmount: string;
  status: string;
  paymentMethod: string;
  paymentRef: string;
  orderDate: string;
  createdAt: string;
  expiresAt: string;
  servedAt: string | null;
  staffNotes: string | null;
}

export interface MockOrderItem {
  id: number;
  orderId: number;
  foodItemId: number;
  quantity: number;
  unitPrice: string;
  subtotal: string;
}

export interface MockQrToken {
  id: number;
  orderId: number;
  tokenHash: string;
  used: boolean;
  usedAt: string | null;
  scannedBy: string | null;
  createdAt: string;
}

export interface MockHold {
  id: number;
  holdSessionId: string;
  foodItemId: number;
  date: string;
  quantity: number;
  expiresAt: string;
  status: string;
  createdAt: string;
}

const defaultStaffSettings = {
  id: 1,
  canteenName: "Campus Central Canteen (Block A)",
  counterPinHash: "1234",
  operatingHours: "8:00 AM - 5:30 PM",
  onlineOrderingActive: true,
  updatedAt: new Date().toISOString()
};

const defaultFoodItems: MockFoodItem[] = [
  {
    id: 1,
    name: "Crispy Veg Puff",
    description: "Golden flaky layered pastry filled with spicy masala potato & green peas.",
    category: "Snacks",
    price: "20.00",
    imageUrl: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80",
    isVeg: true,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    name: "Paneer Kathi Roll",
    description: "Marinated grilled cottage cheese cubes wrapped in whole wheat paratha with mint relish.",
    category: "Snacks",
    price: "65.00",
    imageUrl: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80",
    isVeg: true,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 3,
    name: "Butter Masala Dosa",
    description: "Crispy fermented crepe stuffed with spiced mashed potatoes, served with fresh coconut chutney & sambar.",
    category: "Breakfast",
    price: "50.00",
    imageUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80",
    isVeg: true,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 4,
    name: "Hot Samosa Pav Duo",
    description: "Pair of freshly fried spiced potato samosas tucked inside warm butter-toasted ladi pavs with dry garlic chutney.",
    category: "Snacks",
    price: "35.00",
    imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80",
    isVeg: true,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 5,
    name: "Iced Cold Coffee",
    description: "Rich blended espresso shot with chilled creamy milk, turbinado sugar, and chocolate drizzle.",
    category: "Beverages",
    price: "40.00",
    imageUrl: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&auto=format&fit=crop&q=80",
    isVeg: true,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 6,
    name: "Chicken Keema Puff",
    description: "Flaky puff pastry stuffed with slow-cooked minced chicken, aromatic garam masala, and fresh cilantro.",
    category: "Snacks",
    price: "45.00",
    imageUrl: "https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=600&auto=format&fit=crop&q=80",
    isVeg: false,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 7,
    name: "Special Executive Veg Thali",
    description: "Complete nutritious lunch: 2 Butter rotis, Jeera rice, Dal tadka, Shahi paneer, seasonal veg, and gulab jamun.",
    category: "Lunch",
    price: "90.00",
    imageUrl: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=600&auto=format&fit=crop&q=80",
    isVeg: true,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 8,
    name: "Cutting Masala Chai",
    description: "Authentic double-boiled tea infused with fresh crushed ginger, green cardamom, and lemongrass.",
    category: "Beverages",
    price: "15.00",
    imageUrl: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80",
    isVeg: true,
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

const todayStr = new Date().toISOString().slice(0, 10);

const defaultDailyInventory: MockDailyInventory[] = defaultFoodItems.map((item, idx) => {
  const total = item.name.includes("Puff") ? 500 : item.category === "Beverages" ? 300 : 150;
  return {
    id: idx + 1,
    foodItemId: item.id,
    date: todayStr,
    totalStock: total,
    onlineStock: Math.floor(total * 0.5),
    soldOnline: 0,
    isOnlineClosed: false,
    updatedAt: new Date().toISOString()
  };
});

function getInitialData() {
  const sampleTokenRaw = "qpass_demo_token_seed_placeholder_hash";
  const sampleTokenHash = crypto.createHash("sha256").update(sampleTokenRaw).digest("hex");

  const sampleOrder = {
    id: 1,
    orderCode: "QP-2026-DEMO1",
    customerName: "Aarav Sharma (ME Dept)",
    customerPhone: "+91 9876543210",
    totalAmount: "40.00",
    status: "PAID",
    paymentMethod: "UPI",
    paymentRef: "UPI/TXN/2026/894172",
    orderDate: todayStr,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    servedAt: null,
    staffNotes: null
  };

  const sampleOrderItem = {
    id: 1,
    orderId: 1,
    foodItemId: 1,
    quantity: 2,
    unitPrice: "20.00",
    subtotal: "40.00"
  };

  const sampleQrToken = {
    id: 1,
    orderId: 1,
    tokenHash: sampleTokenHash,
    used: false,
    usedAt: null,
    scannedBy: null,
    createdAt: new Date().toISOString()
  };

  const dailyInvCopy = JSON.parse(JSON.stringify(defaultDailyInventory));
  const puffInv = dailyInvCopy.find((i: any) => i.foodItemId === 1);
  if (puffInv) {
    puffInv.soldOnline = 2;
  }

  return {
    mockActive: true,
    mockStaffSettings: defaultStaffSettings,
    mockFoodItems: defaultFoodItems,
    mockDailyInventory: dailyInvCopy,
    mockOrders: [sampleOrder],
    mockOrderItems: [sampleOrderItem],
    mockQrTokens: [sampleQrToken],
    mockHolds: []
  };
}

function readDb(): any {
  try {
    if (!fs.existsSync(MOCK_DB_PATH)) {
      const data = getInitialData();
      fs.mkdirSync(path.dirname(MOCK_DB_PATH), { recursive: true });
      fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(data, null, 2), "utf-8");
      return data;
    }
    const content = fs.readFileSync(MOCK_DB_PATH, "utf-8");
    return JSON.parse(content);
  } catch (e) {
    console.warn("Error reading mockdb.json, recreating...", e);
    const data = getInitialData();
    fs.mkdirSync(path.dirname(MOCK_DB_PATH), { recursive: true });
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(data, null, 2), "utf-8");
    return data;
  }
}

function writeDb(data: any) {
  try {
    fs.mkdirSync(path.dirname(MOCK_DB_PATH), { recursive: true });
    const tempPath = `${MOCK_DB_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tempPath, MOCK_DB_PATH);
  } catch (e) {
    console.error("Error writing mockdb.json", e);
  }
}

export function isMockActive() {
  const dbData = readDb();
  return dbData.mockActive === true;
}

export function activateMock() {
  const dbData = readDb();
  if (!dbData.mockActive) {
    console.log("In-Memory Mock Database is now ACTIVE.");
    dbData.mockActive = true;
    writeDb(dbData);
  }
}

function toDbRow(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  const res = { ...obj };
  const mappings: Record<string, string> = {
    imageUrl: "image_url",
    isVeg: "is_veg",
    isActive: "is_active",
    createdAt: "created_at",
    foodItemId: "food_item_id",
    totalStock: "total_stock",
    onlineStock: "online_stock",
    soldOnline: "sold_online",
    isOnlineClosed: "is_online_closed",
    updatedAt: "updated_at",
    orderCode: "order_code",
    customerName: "customer_name",
    customerPhone: "customer_phone",
    totalAmount: "total_amount",
    paymentMethod: "payment_method",
    paymentRef: "payment_ref",
    orderDate: "order_date",
    expiresAt: "expires_at",
    servedAt: "served_at",
    staffNotes: "staff_notes",
    orderId: "order_id",
    unitPrice: "unit_price",
    tokenHash: "token_hash",
    usedAt: "used_at",
    scannedBy: "scanned_by",
    holdSessionId: "hold_session_id",
    canteenName: "canteen_name",
    counterPinHash: "counter_pin_hash",
    operatingHours: "operating_hours",
    onlineOrderingActive: "online_ordering_active"
  };

  for (const [camel, snake] of Object.entries(mappings)) {
    if (obj[camel] !== undefined) {
      res[snake] = obj[camel];
    }
    if (obj[snake] !== undefined) {
      res[camel] = obj[snake];
    }
  }

  const dateFields = ["createdAt", "created_at", "updatedAt", "updated_at", "expiresAt", "expires_at", "servedAt", "served_at", "usedAt", "used_at"];
  for (const field of dateFields) {
    if (res[field] && typeof res[field] === "string") {
      res[field] = new Date(res[field]);
    }
  }

  return res;
}

export function runMockQuery(text: any, values?: any[]): { rows: any[]; rowCount?: number } {
  const dbData = readDb();
  const mockStaffSettings = dbData.mockStaffSettings;
  const mockFoodItems = dbData.mockFoodItems as MockFoodItem[];
  const mockDailyInventory = dbData.mockDailyInventory as MockDailyInventory[];
  const mockOrders = dbData.mockOrders as MockOrder[];
  const mockOrderItems = dbData.mockOrderItems as MockOrderItem[];
  const mockQrTokens = dbData.mockQrTokens as MockQrToken[];
  const mockHolds = dbData.mockHolds as MockHold[];

  let queryText = "";
  let vals: any[] = [];

  if (typeof text === "object" && text !== null) {
    queryText = text.text || "";
    vals = text.values || [];
  } else {
    queryText = text || "";
    vals = values || [];
  }

  const query = queryText.trim();
  let modified = false;
  let response: { rows: any[]; rowCount?: number } = { rows: [] };

  // 1. Diagnostics metadata
  if (query.includes("version()") && query.includes("current_database()")) {
    response = {
      rows: [{
        version: "PostgreSQL 16.2 on x86_64, compiled by Visual C++ build 1937, 64-bit (Mock database)",
        current_database: "app_db",
        current_user: "postgres"
      }]
    };
  }

  else if (query.includes("information_schema.tables")) {
    response = {
      rows: [
        { table_name: "food_items" },
        { table_name: "daily_inventory" },
        { table_name: "orders" },
        { table_name: "order_items" },
        { table_name: "qr_tokens" },
        { table_name: "inventory_holds" }
      ]
    };
  }

  // 2. Select from staff_settings
  else if (/select.*from "staff_settings"/i.test(query)) {
    response = { rows: [mockStaffSettings] };
  }

  // 3. Update staff_settings
  else if (/update "staff_settings" set "online_ordering_active"/i.test(query) || /UPDATE staff_settings SET online_ordering_active/i.test(query)) {
    const active = vals[0];
    mockStaffSettings.onlineOrderingActive = Boolean(active);
    mockStaffSettings.updatedAt = new Date().toISOString();
    modified = true;
    response = { rowCount: 1, rows: [] };
  }

  // 4. Joined select of food items and daily inventory
  else if (/from "food_items".*left join "daily_inventory"/i.test(query) || /from food_items.*left join daily_inventory/i.test(query)) {
    const rows = mockFoodItems.map(item => {
      const inv = mockDailyInventory.find(i => i.foodItemId === item.id) || {
        id: null,
        date: null,
        totalStock: 0,
        onlineStock: 0,
        soldOnline: 0,
        isOnlineClosed: false
      };
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        price: item.price,
        imageUrl: item.imageUrl,
        isVeg: item.isVeg,
        isActive: item.isActive,
        inventoryId: inv.id,
        date: inv.date,
        totalStock: inv.totalStock,
        onlineStock: inv.onlineStock,
        soldOnline: inv.soldOnline,
        isOnlineClosed: inv.isOnlineClosed
      };
    });
    response = { rows };
  }

  // 5. Select from food_items directly
  else if (/select.*from "food_items"/i.test(query) || /SELECT.*FROM food_items/i.test(query)) {
    response = { rows: mockFoodItems };
  }

  // 6. Select from daily_inventory
  else if (/select.*from "daily_inventory"/i.test(query) || /SELECT.*FROM daily_inventory/i.test(query)) {
    const foodItemIdIdx = query.indexOf("food_item_id = $");
    if (foodItemIdIdx !== -1 && vals.length > 0) {
      const foodItemId = Number(vals[0]);
      const row = mockDailyInventory.find(i => i.foodItemId === foodItemId);
      response = { rows: row ? [row] : [] };
    } else {
      response = { rows: mockDailyInventory };
    }
  }

  // 7. Select held count (COALESCE(SUM(quantity), 0))
  else if (/SELECT food_item_id, COALESCE\(SUM\(quantity\)/i.test(query)) {
    const now = new Date();
    const activeHolds = mockHolds.filter(h => h.status === "ACTIVE" && new Date(h.expiresAt) > now);
    const heldCounts = activeHolds.reduce((acc, h) => {
      acc[h.foodItemId] = (acc[h.foodItemId] || 0) + h.quantity;
      return acc;
    }, {} as Record<number, number>);

    const rows = Object.keys(heldCounts).map(id => ({
      food_item_id: Number(id),
      held_count: heldCounts[Number(id)]
    }));
    response = { rows };
  }

  // 8. Housekeeping: Update inventory_holds to EXPIRED
  else if (/update.*inventory_holds.*set.*status.*=.*EXPIRED/i.test(query)) {
    const now = new Date();
    let count = 0;
    mockHolds.forEach(h => {
      if (h.status === "ACTIVE" && new Date(h.expiresAt) <= now) {
        h.status = "EXPIRED";
        count++;
        modified = true;
      }
    });
    response = { rowCount: count, rows: [] };
  }

  // 9. Update inventory_holds to RELEASED for re-holding
  else if (/UPDATE.*inventory_holds.*SET.*status.*=.*RELEASED/i.test(query)) {
    const sessionId = vals[0];
    let count = 0;
    mockHolds.forEach(h => {
      if (h.holdSessionId === sessionId && h.status === "ACTIVE") {
        h.status = "RELEASED";
        count++;
        modified = true;
      }
    });
    response = { rowCount: count, rows: [] };
  }

  // 10. Insert into inventory_holds
  else if (/insert into "inventory_holds"/i.test(query) || /INSERT INTO inventory_holds/i.test(query)) {
    const newHold = {
      id: mockHolds.length + 1,
      holdSessionId: vals[0],
      foodItemId: Number(vals[1]),
      date: vals[2],
      quantity: Number(vals[3]),
      expiresAt: new Date(vals[4]).toISOString(),
      status: vals[5] || "ACTIVE",
      createdAt: new Date().toISOString()
    };
    mockHolds.push(newHold);
    modified = true;
    response = { rows: [{ id: newHold.id }] };
  }

  // 11. Insert into orders
  else if (/insert into "orders"/i.test(query) || /INSERT INTO orders/i.test(query)) {
    const newOrder = {
      id: mockOrders.length + 1,
      orderCode: vals[0],
      customerName: vals[1],
      customerPhone: vals[2],
      totalAmount: vals[3],
      status: vals[4],
      paymentMethod: vals[5],
      paymentRef: vals[6],
      orderDate: vals[7],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(vals[8]).toISOString(),
      servedAt: null,
      staffNotes: null
    };
    mockOrders.push(newOrder);
    modified = true;
    response = { rows: [newOrder] };
  }

  // 12. Insert into order_items
  else if (/insert into "order_items"/i.test(query) || /INSERT INTO order_items/i.test(query)) {
    const newItem = {
      id: mockOrderItems.length + 1,
      orderId: Number(vals[0]),
      foodItemId: Number(vals[1]),
      quantity: Number(vals[2]),
      unitPrice: vals[3],
      subtotal: vals[4]
    };
    mockOrderItems.push(newItem);
    modified = true;
    response = { rows: [newItem] };
  }

  // 13. Insert into qr_tokens
  else if (/insert into "qr_tokens"/i.test(query) || /INSERT INTO qr_tokens/i.test(query)) {
    const newToken = {
      id: mockQrTokens.length + 1,
      orderId: Number(vals[0]),
      tokenHash: vals[1],
      used: vals[2] !== undefined ? Boolean(vals[2]) : false,
      usedAt: null,
      scannedBy: null,
      createdAt: new Date().toISOString()
    };
    mockQrTokens.push(newToken);
    modified = true;
    response = { rows: [newToken] };
  }

  // 14. Increment sold_online in daily_inventory
  else if (/UPDATE.*daily_inventory.*SET.*sold_online.*=.*sold_online.*\+/i.test(query)) {
    const soldIncrement = Number(vals[0]);
    const foodItemId = Number(vals[1]);
    const row = mockDailyInventory.find(i => i.foodItemId === foodItemId);
    if (row) {
      row.soldOnline += soldIncrement;
      modified = true;
    }
    response = { rowCount: 1, rows: [] };
  }

  // 15. Update daily_inventory (staff adjustments)
  else if (/UPDATE.*daily_inventory.*SET.*online_stock/i.test(query)) {
    const onlineStock = Number(vals[0]);
    const totalStock = Number(vals[1]);
    const isOnlineClosed = Boolean(vals[2]);
    const foodItemId = Number(vals[4]);
    const row = mockDailyInventory.find(i => i.foodItemId === foodItemId);
    if (row) {
      row.onlineStock = onlineStock;
      row.totalStock = totalStock;
      row.isOnlineClosed = isOnlineClosed;
      row.updatedAt = new Date().toISOString();
      modified = true;
    }
    response = { rowCount: 1, rows: [] };
  }

  // 16. Select order + items by order_code (payment verification)
  else if (/FROM orders o.*JOIN order_items oi.*WHERE o.order_code = \$1/i.test(query)) {
    const orderCode = vals[0] || "";
    const order = mockOrders.find(o => o.orderCode === orderCode);
    if (!order) {
      response = { rows: [] };
    } else {
      const items = mockOrderItems
        .filter(oi => oi.orderId === order.id)
        .map(oi => {
          const foodItem = mockFoodItems.find(f => f.id === oi.foodItemId);
          return {
            foodItemId: oi.foodItemId,
            name: foodItem ? foodItem.name : "Unknown Item",
            quantity: oi.quantity,
            unitPrice: oi.unitPrice,
            subtotal: oi.subtotal
          };
        });
      response = {
        rows: [{
          id: order.id,
          total_amount: order.totalAmount,
          status: order.status,
          order_code: order.orderCode,
          items: items
        }]
      };
    }
  }

  // 17. Update order to PAID (payment completion)
  else if (/UPDATE orders SET status = 'PAID'/i.test(query)) {
    const paymentRef = vals[0];
    const orderId = Number(vals[1]);
    const order = mockOrders.find(o => o.id === orderId);
    if (order) {
      order.status = "PAID";
      order.paymentRef = paymentRef;
      modified = true;
    }
    response = { rowCount: 1, rows: [] };
  }

  // 18. Select orders queue for staff terminal
  else if (/SELECT o\.id, o\.order_code, o\.customer_name/i.test(query)) {
    const rows = mockOrders.map(order => {
      const token = mockQrTokens.find(t => t.orderId === order.id);
      const items = mockOrderItems
        .filter(oi => oi.orderId === order.id)
        .map(oi => {
          const foodItem = mockFoodItems.find(f => f.id === oi.foodItemId);
          return {
            foodItemId: oi.foodItemId,
            name: foodItem ? foodItem.name : "Unknown Item",
            quantity: oi.quantity,
            unitPrice: oi.unitPrice,
            subtotal: oi.subtotal
          };
        });
      
      return {
        id: order.id,
        order_code: order.orderCode,
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        total_amount: order.totalAmount,
        status: order.status,
        payment_method: order.paymentMethod,
        payment_ref: order.paymentRef,
        created_at: order.createdAt,
        expires_at: order.expiresAt,
        served_at: order.servedAt,
        qr_used: token ? token.used : false,
        qr_used_at: token ? token.usedAt : null,
        items: items
      };
    });
    response = { rows };
  }

  // 19. Update order status manually (staff actions)
  else if (/UPDATE orders SET status = \$1, served_at =/i.test(query)) {
    const status = vals[0];
    const orderId = Number(vals[1]);
    const order = mockOrders.find(o => o.id === orderId);
    if (order) {
      order.status = status;
      if (status === "SERVED") {
        order.servedAt = new Date().toISOString();
      }
      modified = true;
    }
    response = { rowCount: 1, rows: [] };
  }

  // 20. Scanner: Lookup QR token details
  else if (/FROM qr_tokens qt.*JOIN orders o/i.test(query)) {
    const hash = vals[0] || "";
    const token = mockQrTokens.find(t => t.tokenHash === hash);
    if (!token) {
      response = { rows: [] };
    } else {
      const order = mockOrders.find(o => o.id === token.orderId);
      if (!order) {
        response = { rows: [] };
      } else {
        response = {
          rows: [{
            id: token.id,
            order_id: token.orderId,
            used: token.used,
            used_at: token.usedAt,
            order_code: order.orderCode,
            status: order.status,
            served_at: order.servedAt
          }]
        };
      }
    }
  }

  // 21. Scanner: Redeem QR token
  else if (/UPDATE qr_tokens SET used = true/i.test(query)) {
    const scannedBy = vals[0];
    const tokenId = Number(vals[1]);
    const token = mockQrTokens.find(t => t.id === tokenId);
    if (token) {
      token.used = true;
      token.usedAt = new Date().toISOString();
      token.scannedBy = scannedBy;
      const order = mockOrders.find(o => o.id === token.orderId);
      if (order) {
        order.status = "SERVED";
        order.servedAt = new Date().toISOString();
      }
      modified = true;
    }
    response = { rowCount: 1, rows: [] };
  }

  else if (/UPDATE orders SET status = 'SERVED'/i.test(query)) {
    const orderId = Number(vals[0]);
    const order = mockOrders.find(o => o.id === orderId);
    if (order) {
      order.status = "SERVED";
      order.servedAt = new Date().toISOString();
      modified = true;
    }
    response = { rowCount: 1, rows: [] };
  }

  // Diagnostics counters
  else if (/SELECT count\(\*\) as count FROM food_items/i.test(query)) {
    response = { rows: [{ count: mockFoodItems.length }] };
  }
  else if (/SELECT count\(\*\) as count FROM daily_inventory/i.test(query)) {
    response = { rows: [{ count: mockDailyInventory.length }] };
  }
  else if (/SELECT count\(\*\) as count FROM orders/i.test(query)) {
    response = { rows: [{ count: mockOrders.length }] };
  }

  if (modified) {
    writeDb(dbData);
  }

  const isArrayMode = typeof text === "object" && text !== null && text.rowMode === "array";
  let fields: any[] = [];

  if (response && response.rows) {
    response.rows = response.rows.map(toDbRow);

    const selectMatch = queryText.match(/select\s+(.+?)\s+from/i);
    if (selectMatch) {
      const fieldParts = selectMatch[1].split(",");
      fields = fieldParts.map(f => {
        const parts = f.match(/"([^"]+)"/g);
        if (parts && parts.length > 0) {
          return { name: parts[parts.length - 1].replace(/"/g, "") };
        }
        return { name: f.trim() };
      });
    } else if (response.rows.length > 0) {
      fields = Object.keys(response.rows[0]).map(key => ({ name: key }));
    }

    if (isArrayMode) {
      response.rows = response.rows.map(row => {
        return fields.map(f => {
          const field = f.name;
          let val = row[field];
          if (val === undefined) {
            const cleanField = field.replace(/^[a-zA-Z0-9_]+?_/, "");
            val = row[cleanField];
            if (val === undefined) {
              const camel = cleanField.replace(/_([a-z])/g, (_: string, l: string) => l.toUpperCase());
              val = row[camel];
            }
          }
          return val !== undefined ? val : null;
        });
      });
    }
  }

  const fullResponse = {
    ...response,
    fields
  };

  console.log("Mock Query:", query);
  console.log("Mock Parameters:", vals);
  console.log("Mock Response rows:", JSON.stringify(fullResponse.rows));

  return fullResponse;
}

export const mockPool = {
  connect: async () => {
    return {
      query: async (text: any, values?: any[]) => {
        return runMockQuery(text, values);
      },
      release: () => {}
    };
  },
  query: async (text: any, values?: any[]) => {
    return runMockQuery(text, values);
  },
  on: () => {}
};

// Drizzle ORM mock configuration
import { drizzle } from "drizzle-orm/node-postgres";
export const mockDb = drizzle(mockPool as any);
