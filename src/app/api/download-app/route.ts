import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const apkPath = path.join(process.cwd(), "public", "downloads", "Q-Pass-debug.apk");
  const apk = await readFile(apkPath);

  return new Response(new Uint8Array(apk), {
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="Q-Pass-debug.apk"',
      "Content-Length": String(apk.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
