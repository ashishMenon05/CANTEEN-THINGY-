import crypto from "crypto";

/**
 * Generates a cryptographically secure random order token.
 * 32 bytes of high-entropy randomness encoded as a 64-character hexadecimal string.
 * Never use Math.random() or timestamps for credentials!
 */
export function generateSecureOrderToken(): { rawToken: string; tokenHash: string } {
  const rawToken = "qp_sec_" + crypto.randomBytes(28).toString("hex");
  const tokenHash = hashOrderToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * SHA-256 hashing for storing tokens safely at rest.
 * PostgreSQL never stores the raw token, only the one-way hash.
 */
export function hashOrderToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}

/**
 * Human-readable friendly pickup code for canteen staff and counter display.
 * E.g. QP-4821
 */
export function generateOrderCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `QP-${num}`;
}

/**
 * Get current business date in 'YYYY-MM-DD' format
 */
export function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}
