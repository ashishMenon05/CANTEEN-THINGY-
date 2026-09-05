import { NextRequest, NextResponse } from "next/server";
import { readJson, rateLimit, tooManyRequests } from "@/lib/api";

export const dynamic = "force-dynamic";

interface MentorRequest {
  question?: unknown;
  systemStatus?: unknown;
}

interface MentorResponse {
  answer: string;
  source: "provider" | "local";
  model?: string;
}

function localAnswer(question: string, systemStatus: unknown): string {
  const normalized = question.toLowerCase();
  const status = typeof systemStatus === "object" && systemStatus !== null
    ? JSON.stringify(systemStatus)
    : "No live diagnostic payload was supplied.";

  if (normalized.includes("inventory") || normalized.includes("stock")) {
    return "Inventory is protected by daily online allocation, sold quantities, active ten-minute holds, and row-level transactions. Check /api/inventory for the current availability. Diagnostic context: " + status;
  }
  if (normalized.includes("payment") || normalized.includes("order")) {
    return "Orders are created as PENDING, then payment converts the hold to sold inventory and creates a hashed QR credential. A failed payment releases the hold. Diagnostic context: " + status;
  }
  if (normalized.includes("security") || normalized.includes("secure")) {
    return "The backend uses server-side QR token hashing, bounded request bodies, rate limits on sensitive endpoints, and database transactions. Production should also configure a real DATABASE_URL and a non-default staff PIN. Diagnostic context: " + status;
  }

  return "I can help inspect inventory, orders, payments, QR pickup, or backend security. Ask about one of those areas and include the latest Mentor diagnostics when available. Diagnostic context: " + status;
}

async function providerAnswer(question: string, systemStatus: unknown): Promise<MentorResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const endpoint = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content: "You are the Q-Pass canteen backend mentor. Give concise, practical engineering diagnostics. Never claim an action happened unless the supplied status proves it.",
          },
          {
            role: "user",
            content: `Question: ${question}\nLive diagnostic context: ${JSON.stringify(systemStatus ?? {})}`,
          },
        ],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const answer = data.choices?.[0]?.message?.content?.trim();
    return answer ? { answer, source: "provider", model } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(request, "mentor-ask", 20, 60_000);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  try {
    const body = await readJson<MentorRequest>(request, 12_000);
    if (typeof body.question !== "string" || body.question.trim().length < 3 || body.question.length > 1_000) {
      return NextResponse.json({ success: false, error: "Question must be between 3 and 1,000 characters." }, { status: 400 });
    }

    const question = body.question.trim();
    const providerResult = await providerAnswer(question, body.systemStatus);
    const result: MentorResponse = providerResult ?? {
      answer: localAnswer(question, body.systemStatus),
      source: "local",
    };

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mentor request failed.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
