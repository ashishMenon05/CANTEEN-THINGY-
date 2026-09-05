import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { staffSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { badRequest, readJson, rateLimit, tooManyRequests } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(req, "staff-auth", 5, 60_000);
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const body = await readJson<{ pin?: unknown }>(req, 2_000);
    const { pin } = body;
    if (typeof pin !== "string" || !/^\d{4,8}$/.test(pin)) {
      return badRequest("A 4-8 digit staff PIN is required.");
    }

    const [settings] = await db.select().from(staffSettings).limit(1);
    const validPin = settings?.counterPinHash || (process.env.NODE_ENV === "production" ? "" : "1234");

    if (validPin && pin === validPin) {
      return NextResponse.json({
        success: true,
        authenticated: true,
        staffRole: "Counter Lead",
        canteenName: settings?.canteenName ?? "Campus Central Canteen",
      });
    }

    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        error: "Incorrect staff counter PIN.",
      },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
