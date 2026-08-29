import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { mockPool, mockDb, isMockActive, activateMock } from "./mockDb";

const databaseUrl = process.env.DATABASE_URL;

let realPool: any;
let realDb: any;

try {
  if (!databaseUrl) {
    console.warn("DATABASE_URL is missing. Falling back to local in-memory Mock Database.");
    activateMock();
  } else {
    realPool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    realDb = drizzle(realPool, { schema });

    // Probe connection in background
    realPool.query("SELECT 1").catch((err: any) => {
      console.warn("PostgreSQL connection failed. Falling back to local in-memory Mock Database:", err.message);
      activateMock();
    });
  }
} catch (err: any) {
  console.warn("PostgreSQL initialization failed. Falling back to local in-memory Mock Database:", err.message);
  activateMock();
}

export const pool = {
  connect: async () => {
    if (isMockActive() || !realPool) return mockPool.connect();
    try {
      return await realPool.connect();
    } catch (err) {
      activateMock();
      return mockPool.connect();
    }
  },
  query: async (text: string, values?: any[]) => {
    if (isMockActive() || !realPool) return mockPool.query(text, values);
    try {
      return await realPool.query(text, values);
    } catch (err) {
      activateMock();
      return mockPool.query(text, values);
    }
  },
  on: (event: string, callback: Function) => {
    if (!isMockActive() && realPool) {
      realPool.on(event, callback);
    }
  }
} as unknown as Pool;

export const db = new Proxy({} as any, {
  get(target, prop) {
    const activeDb = (isMockActive() || !realDb) ? mockDb : realDb;
    return activeDb[prop];
  }
}) as NodePgDatabase<typeof schema>;

export { schema };
