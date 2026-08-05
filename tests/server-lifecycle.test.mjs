import assert from "node:assert/strict";
import test from "node:test";
import { startLegoSearchServer } from "../src/http/server.mjs";

test("starts a local server on an ephemeral port for desktop use", async () => {
  const running = await startLegoSearchServer({ port: 0 });

  try {
    const response = await fetch(`http://127.0.0.1:${running.port}/api/platforms`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.platforms.map((platform) => platform.id), ["iopen", "momo", "pchome", "coupang"]);
  } finally {
    await new Promise((resolve, reject) => {
      running.server.close((error) => error ? reject(error) : resolve());
    });
  }
});
