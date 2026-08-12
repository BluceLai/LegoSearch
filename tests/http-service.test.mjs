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

test("GET /api/coupang/damaged-box stores the latest no-thumbnail offers", async () => {
  const calls = [];
  const stored = [];
  const { baseUrl, close } = await startTestServer({
    coupangDamagedBoxSearcher: async (input) => {
      calls.push(input);
      return [{
        title: "LEGO 43015",
        normalPrice: 1959,
        damagedPrice: 1852,
        listPrice: 2799,
        url: "https://www.tw.coupang.com/products/43015",
        imageUrl: null
      }];
    },
    coupangDamagedBoxSnapshotRepository: {
      async save(snapshot) {
        stored.push(snapshot);
      },
      async get() {
        return null;
      }
    }
  });

  try {
    const response = await fetch(baseUrl + "/api/coupang/damaged-box?images=1");

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [{ query: "LEGO" }]);
    assert.deepEqual(await response.json(), {
      query: "LEGO",
      results: [{
        title: "LEGO 43015",
        normalPrice: 1959,
        damagedPrice: 1852,
        listPrice: 2799,
        url: "https://www.tw.coupang.com/products/43015",
        imageUrl: null
      }]
    });
    assert.deepEqual(stored, [{
      query: "LEGO",
      results: [{
        title: "LEGO 43015",
        normalPrice: 1959,
        damagedPrice: 1852,
        listPrice: 2799,
        url: "https://www.tw.coupang.com/products/43015",
        imageUrl: null
      }]
    }]);
  } finally {
    await close();
  }
});

test("GET /api/coupang/damaged-box/latest returns the last successful search only", async () => {
  const snapshot = {
    query: "LEGO",
    searchedAt: "2026-08-12T04:00:00.000Z",
    results: [{ title: "LEGO 60500", normalPrice: 625, damagedPrice: 624, listPrice: 999 }]
  };
  const { baseUrl, close } = await startTestServer({
    coupangDamagedBoxSnapshotRepository: {
      async save() {},
      async get() {
        return snapshot;
      }
    }
  });

  try {
    const response = await fetch(baseUrl + "/api/coupang/damaged-box/latest");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { snapshot });
  } finally {
    await close();
  }
});

test("records a completed search and returns grouped daily price history", async () => {
  const recorded = [];
  const history = [{
    setNumber: "10305",
    query: "LEGO 10305",
    dates: [{
      date: "2026-08-05",
      searchedAt: "2026-08-05T04:00:00.000Z",
      platforms: [{ platformId: "momo", platformName: "MOMO", lowestPrice: 11999, highestPrice: 12999 }]
    }]
  }];
  const { baseUrl, close } = await startTestServer({
    aggregator: {
      async search() {
        return {
          query: "LEGO 10305",
          platformIds: ["momo"],
          searchedAt: "2026-08-05T04:00:00.000Z",
          results: [{ platformId: "momo", platformName: "MOMO", price: 11999 }],
          errors: []
        };
      }
    },
    historyRepository: {
      async record(search) {
        recorded.push(search);
      },
      async list() {
        return history;
      }
    }
  });

  try {
    const searchResponse = await fetch(`${baseUrl}/api/search?q=10305&platforms=momo`);
    const historyResponse = await fetch(`${baseUrl}/api/history`);

    assert.equal(searchResponse.status, 200);
    assert.deepEqual(recorded.map((search) => search.query), ["LEGO 10305"]);
    assert.equal(historyResponse.status, 200);
    assert.deepEqual(await historyResponse.json(), { history });
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
    iopenVerifier: options.iopenVerifier,
    coupangDamagedBoxSearcher: options.coupangDamagedBoxSearcher,
    historyRepository: options.historyRepository,
    coupangDamagedBoxSnapshotRepository: options.coupangDamagedBoxSnapshotRepository
  }));

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}
