import assert from "node:assert/strict";
import test from "node:test";
import { createSearchAggregator } from "../src/domain/search-aggregator.mjs";

test("searches selected platforms and sorts priced results before search links", async () => {
  const aggregator = createSearchAggregator({
    clients: {
      momo: async () => [
        result({ platformId: "momo", title: "MOMO 10305 expensive", price: 2200 })
      ],
      pchome: async () => [
        result({ platformId: "pchome", title: "PChome 10305 cheap", price: 1190 }),
        result({ platformId: "pchome", title: "PChome 10305 link", price: null, source: "search-link" })
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
      ["pchome", "PChome 10305 cheap", 1190],
      ["momo", "MOMO 10305 expensive", 2200],
      ["pchome", "PChome 10305 link", null]
    ]
  );
  assert.deepEqual(response.errors, []);
});

test("turns platform failures into fallback search-link results", async () => {
  const aggregator = createSearchAggregator({
    clients: {
      iopen: async () => {
        throw new Error("HTTP 403");
      }
    }
  });

  const response = await aggregator.search({
    text: "LEGO 75367",
    platforms: "iopen"
  });

  assert.deepEqual(response.errors, [
    {
      platformId: "iopen",
      platformName: "iOPEN Mall",
      message: "HTTP 403"
    }
  ]);
  assert.equal(response.results.length, 1);
  assert.equal(response.results[0].platformId, "iopen");
  assert.equal(response.results[0].source, "search-link");
  assert.equal(response.results[0].price, null);
  assert.equal(response.results[0].url, "https://mall.iopenmall.tw/iopen/index.php?prod_keyword=LEGO+75367&action=store_product_search");
});

test("returns completed marketplace lists when other marketplaces do not respond", async () => {
  const aggregator = createSearchAggregator({
    clients: {
      iopen: async () => new Promise(() => {}),
      pchome: async () => new Promise(() => {}),
      momo: async () => [
        result({ platformId: "momo", title: "MOMO 10305 Lion Knights Castle", price: 10999 })
      ]
    },
    marketplaceSearchTimeoutMs: 5
  });

  const response = await aggregator.search({
    text: "10305",
    platforms: "iopen,momo,pchome"
  });

  assert.deepEqual(
    response.results.map((item) => [item.platformId, item.source, item.price]),
    [
      ["momo", "marketplace", 10999],
      ["iopen", "search-link", null],
      ["pchome", "search-link", null]
    ]
  );
  assert.deepEqual(response.errors, [
    {
      platformId: "iopen",
      platformName: "iOPEN Mall",
      message: "iOPEN Mall 搜尋逾時。"
    },
    {
      platformId: "pchome",
      platformName: "PChome",
      message: "PChome 搜尋逾時。"
    }
  ]);
});

test("keeps only exact model-number matches while retaining platform search links", async () => {
  const aggregator = createSearchAggregator({
    clients: {
      pchome: async () => [
        result({ platformId: "pchome", title: "LEGO 10305 Lion Knights Castle", price: 12999 }),
        result({ platformId: "pchome", title: "LEGO 10300 Back to the Future", price: 6399 }),
        result({ platformId: "pchome", title: "LEGO 103050 accessory", price: 399 }),
        result({
          platformId: "pchome",
          title: "Search LEGO 10305 on PChome",
          price: null,
          source: "search-link"
        })
      ]
    }
  });

  const response = await aggregator.search({
    text: "LEGO 10305",
    platforms: "pchome"
  });

  assert.deepEqual(
    response.results.map((item) => item.title),
    ["LEGO 10305 Lion Knights Castle", "Search LEGO 10305 on PChome"]
  );
});

test("filters browser-sourced results with the same exact model rule", async () => {
  const aggregator = createSearchAggregator({
    clients: {
      coupang: async () => [
        result({
          platformId: "coupang",
          title: "LEGO \u57ce\u5e02\u7cfb\u5217 \u6a02\u9ad8\u8ca8\u8eca 60500",
          price: 625,
          source: "browser"
        }),
        result({
          platformId: "coupang",
          title: "LEGO \u57ce\u5e02\u7cfb\u5217 \u98db\u6a5f\u4f5c\u696d\u8eca 60505",
          price: 1599,
          source: "browser"
        })
      ]
    }
  });

  const response = await aggregator.search({ text: "60500", platforms: "coupang" });

  assert.deepEqual(response.results.map((item) => [item.title, item.source]), [[
    "LEGO \u57ce\u5e02\u7cfb\u5217 \u6a02\u9ad8\u8ca8\u8eca 60500",
    "browser"
  ]]);
});

test("keeps products matching official LEGO set names when their model number is omitted", async () => {
  const resolverCalls = [];
  const aggregator = createSearchAggregator({
    clients: {
      pchome: async () => [
        result({ platformId: "pchome", title: "LEGO Icons \u7345\u5b50\u9a0e\u58eb\u7684\u57ce\u5821", price: 12999 }),
        result({
          platformId: "pchome",
          title: "LEGO Icons Lion Knights Castle",
          price: 13999,
          url: "https://example.com/lion-knights-castle"
        }),
        result({ platformId: "pchome", title: "\u7345\u5b50\u9a0e\u58eb\u7684\u57ce\u5821 LED \u71c8\u7d44", price: 899 }),
        result({ platformId: "pchome", title: "LEGO 10300 Back to the Future", price: 6399 }),
        result({
          platformId: "pchome",
          title: "Search LEGO 10305 on PChome",
          price: null,
          source: "search-link"
        })
      ]
    },
    resolveLegoSet: async (setNumber) => {
      resolverCalls.push(setNumber);
      return {
        setNumber,
        names: ["Lion Knights' Castle", "\u7345\u5b50\u9a0e\u58eb\u7684\u57ce\u5821"]
      };
    }
  });

  const response = await aggregator.search({
    text: "10305",
    platforms: "pchome"
  });

  assert.deepEqual(resolverCalls, ["10305"]);
  assert.deepEqual(
    response.results.map((item) => item.title),
    [
      "LEGO Icons \u7345\u5b50\u9a0e\u58eb\u7684\u57ce\u5821",
      "LEGO Icons Lion Knights Castle",
      "Search LEGO 10305 on PChome"
    ]
  );
});

test("returns a platform search link when parsed products have no exact set match", async () => {
  const aggregator = createSearchAggregator({
    clients: {
      pchome: async () => [
        result({ platformId: "pchome", title: "LEGO 10300 Back to the Future", price: 6399 })
      ]
    }
  });

  const response = await aggregator.search({
    text: "10305",
    platforms: "pchome"
  });

  assert.deepEqual(
    response.results.map((item) => [item.source, item.title, item.price]),
    [["search-link", "\u524d\u5f80 PChome \u641c\u5c0b\u300cLEGO 10305\u300d", null]]
  );
});

test("starts marketplace searches while the official set lookup is pending", async () => {
  let marketplaceStarted = false;
  let resolveSetLookup;
  const aggregator = createSearchAggregator({
    clients: {
      pchome: async () => {
        marketplaceStarted = true;
        return [result({ platformId: "pchome", title: "LEGO 10305 Lion Knights Castle", price: 12999 })];
      }
    },
    resolveLegoSet: () => new Promise((resolve) => {
      resolveSetLookup = resolve;
    })
  });

  const search = aggregator.search({ text: "10305", platforms: "pchome" });
  await Promise.resolve();

  assert.equal(marketplaceStarted, true);
  resolveSetLookup(null);
  await search;
});

test("searches official set names when the model-number query has no exact match", async () => {
  const requestedQueries = [];
  const aggregator = createSearchAggregator({
    clients: {
      pchome: async ({ query }) => {
        requestedQueries.push(query);
        if (query === "LEGO Lion Knights' Castle") {
          return [result({
            platformId: "pchome",
            title: "LEGO Icons Lion Knights Castle",
            price: 12999
          })];
        }

        return [result({ platformId: "pchome", title: "LEGO 10300 Back to the Future", price: 6399 })];
      }
    },
    resolveLegoSet: async () => ({
      setNumber: "10305",
      names: ["Lion Knights' Castle", "\u7345\u5b50\u9a0e\u58eb\u7684\u57ce\u5821"]
    })
  });

  const response = await aggregator.search({ text: "10305", platforms: "pchome" });

  assert.deepEqual(
    response.results.map((item) => item.title),
    ["LEGO Icons Lion Knights Castle"]
  );
  assert.deepEqual(
    new Set(requestedQueries),
    new Set(["LEGO 10305", "LEGO Lion Knights' Castle", "LEGO \u7345\u5b50\u9a0e\u58eb\u7684\u57ce\u5821"])
  );
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
