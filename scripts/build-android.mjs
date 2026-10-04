import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const serverUrl = process.env.CAPACITOR_SERVER_URL;
if (!serverUrl || !/^https?:\/\/[^/]+/i.test(serverUrl)) {
  console.error(
    "Set CAPACITOR_SERVER_URL to the reachable Q-Pass web address before building, e.g. http://192.168.1.20:3000.",
  );
  process.exit(1);
}

const isWindows = process.platform === "win32";
const sync = spawnSync(
  isWindows ? process.env.ComSpec ?? "cmd.exe" : "npx",
  isWindows
    ? ["/d", "/s", "/c", "npx cap sync android"]
    : ["cap", "sync", "android"],
  { stdio: "inherit" },
);
if (sync.error) throw sync.error;
if (sync.status !== 0) process.exit(sync.status ?? 1);

const build = spawnSync(
  isWindows ? process.env.ComSpec ?? "cmd.exe" : "./gradlew",
  isWindows ? ["/d", "/s", "/c", "gradlew.bat assembleDebug"] : ["assembleDebug"],
  {
    cwd: path.join(process.cwd(), "android"),
    stdio: "inherit",
  },
);
if (build.error) throw build.error;
process.exit(build.status ?? 1);
