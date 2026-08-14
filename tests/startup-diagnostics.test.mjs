import assert from "node:assert/strict";
import test from "node:test";
import { appendStartupLog } from "../desktop/startup-diagnostics.mjs";

test("records the startup phase and the underlying error in the portable LOG directory", async () => {
  const written = [];
  const logPath = await appendStartupLog({
    logDir: "C:/LegoSearch/LOG",
    phase: "main-window",
    error: new Error("Window creation failed"),
    makeDirectory: async (path, options) => written.push({ type: "mkdir", path, options }),
    append: async (path, content, encoding) => written.push({ type: "append", path, content, encoding }),
    now: () => new Date("2026-08-14T02:55:00.000Z")
  });

  assert.match(logPath, /LegoSearch[\\/]LOG[\\/]startup\.log$/);
  assert.deepEqual(written[0], {
    type: "mkdir",
    path: "C:/LegoSearch/LOG",
    options: { recursive: true }
  });
  assert.match(written[1].content, /2026-08-14T02:55:00.000Z \[main-window\] Window creation failed/);
  assert.match(written[1].content, /Error: Window creation failed/);
  assert.equal(written[1].encoding, "utf8");
});
