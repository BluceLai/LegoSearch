import assert from "node:assert/strict";
import test from "node:test";
import { createSearchAggregator } from "../src/domain/search-aggregator.mjs";

test("searches selected platforms and sorts priced results before search links", async () => {
  const aggregator = createSearchAggregator({
    clients: {
      momo: async () => [
        result({ platformId: "momo", title: "MOMO expensive", price: 2200 })
      ],
      pchome: async () => [
        result({ platformId: "pchome", title: "PChome cheap", price: 1190 }),
        result({ platformId: "pchome", title: "PChome link", price: null, source: "search-link" })
      ]
    }
  });

  const response = await aggregator.search({
    text: "  LEGO 10305 ",
    platforms: "momo,pchome"
  });

  assert.equal(response.query, "LEGO 10305");
  assert.deepEqual(response.platformIds, ["momo", "pchome"]);
  assert.deepEqual(
    response.results.map((item) => [item.platformId, item.title, item.price]),
    [
      ["pchome", "PChome cheap", 1190],
      ["momo", "MOMO expensive", 2200],
      ["pchome", "PChome link", null]
    ]
  );
  assert.deepEqual(response.errors, []);
});

test("turns platform failures into fallback search-link results", async () => {
  const aggregator = createSearchAggregator({
    clients: {
      shopee: async () => {
        throw new Error("HTTP 403");
      }
    }
  });

  const response = await aggregator.search({
    text: "LEGO 75367",
    platforms: "shopee"
  });

  assert.deepEqual(response.errors, [
    {
      platformId: "shopee",
      platformName: "\u8766\u76ae",
      message: "HTTP 403"
    }
  ]);
  assert.equal(response.results.length, 1);
  assert.equal(response.results[0].platformId, "shopee");
  assert.equal(response.results[0].source, "search-link");
  assert.equal(response.results[0].price, null);
  assert.equal(response.results[0].url, "https://shopee.tw/search?keyword=LEGO+75367");
});

function result(overrides) {
  return {
    platformId: "momo",
    platformName: "MOMO",
    title: "Product",
    price: 1000,
    currency: "TWD",
    url: "https://example.com",
    imageUrl: null,
    source: "marketplace",
    fetchedAt: "2026-08-04T00:00:00.000Z",
    ...overrides
  };
}
