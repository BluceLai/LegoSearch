import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createRequestHandler } from "../src/http/app.mjs";

test("GET /api/platforms returns supported marketplace metadata", async () => {
  const { baseUrl, close } = await startTestServer();

  try {
    const response = await fetch(`${baseUrl}/api/platforms`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(
      body.platforms.map((platform) => platform.id),
      ["iopen", "momo", "pchome", "coupang"]
    );
  } finally {
    await close();
  }
});

test("GET /api/search delegates to the aggregator and returns JSON", async () => {
  const calls = [];
  const { baseUrl, close } = await startTestServer({
    aggregator: {
      async search(input) {
        calls.push(input);
        return {
          query: "LEGO 10305",
          platformIds: ["pchome"],
          searchedAt: "2026-08-04T00:00:00.000Z",
          results: [],
          errors: []
        };
      }
    }
  });

  try {
    const response = await fetch(`${baseUrl}/api/search?q=LEGO+10305&platforms=pchome`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [{ text: "LEGO 10305", platforms: "pchome" }]);
    assert.deepEqual(body, {
      query: "LEGO 10305",
      platformIds: ["pchome"],
      searchedAt: "2026-08-04T00:00:00.000Z",
      results: [],
      errors: []
    });
  } finally {
    await close();
  }
});

test("serves browser modules with a JavaScript content type", async () => {
  const { baseUrl, close } = await startTestServer({
    publicDir: new URL("../public/", import.meta.url)
  });

  try {
    const response = await fetch(`${baseUrl}/result-organization.mjs`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/javascript/);
  } finally {
    await close();
  }
});

test("POST /api/platforms/iopen/verify opens the verification window", async () => {
  const calls = [];
  const { baseUrl, close } = await startTestServer({
    iopenVerifier: {
      async open() {
        calls.push("open");
      }
    }
  });

  try {
    const response = await fetch(`${baseUrl}/api/platforms/iopen/verify`, { method: "POST" });

    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { status: "opened" });
    assert.deepEqual(calls, ["open"]);
  } finally {
    await close();
  }
});

async function startTestServer(options = {}) {
  const server = createServer(createRequestHandler({
    aggregator: options.aggregator || {
      async search() {
        return { query: "", platformIds: [], searchedAt: "", results: [], errors: [] };
      }
    },
    publicDir: options.publicDir || new URL(".", import.meta.url),
    iopenVerifier: options.iopenVerifier
  }));

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}
