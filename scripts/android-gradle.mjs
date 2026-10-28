import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const task = process.argv[2];
if (!["assembleDebug", "bundleRelease"].includes(task)) throw new Error("Choose assembleDebug or bundleRelease.");
const windows = process.platform === "win32";
const result = spawnSync(windows ? "gradlew.bat" : "./gradlew", [task], {
  cwd: fileURLToPath(new URL("../android/", import.meta.url)),
  stdio: "inherit",
  shell: windows,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
