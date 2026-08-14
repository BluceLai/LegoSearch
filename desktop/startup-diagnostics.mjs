import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export async function appendStartupLog({
  logDir,
  phase,
  error = null,
  makeDirectory = mkdir,
  append = appendFile,
  now = () => new Date()
}) {
  const logPath = join(logDir, "startup.log");
  const message = error?.message || "Startup step completed";
  const stack = error?.stack ? `\n${error.stack}` : "";
  const entry = `${now().toISOString()} [${phase}] ${message}${stack}\n`;

  await makeDirectory(logDir, { recursive: true });
  await append(logPath, entry, "utf8");
  return logPath;
}
