import { NextRequest, NextResponse } from "next/server";

const requestCounts = new Map<string, { count: number; resetAt: number }>();

export async function readJson<T>(request: NextRequest, maxBytes = 32_000): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxBytes) {
    throw new Error("Request body is too large.");
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    throw new Error("Request body is too large.");
  }

  if (!raw.trim()) {
    throw new Error("Request body is required.");
  }

  return JSON.parse(raw) as T;
}

export function rateLimit(request: NextRequest, key: string, limit: number, windowMs: number) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  const bucketKey = `${key}:${address}`;
  const now = Date.now();
  const current = requestCounts.get(bucketKey);

  if (!current || current.resetAt <= now) {
    requestCounts.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  current.count += 1;
  if (current.count <= limit) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { success: false, error: "Too many requests. Please try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

export function badRequest(error: string) {
  return NextResponse.json({ success: false, error }, { status: 400 });
}
