import assert from "node:assert/strict";
import test from "node:test";
import { createBrowserMarketplaceClients } from "../src/infrastructure/browser-marketplace-clients.mjs";
import { getPlatform } from "../src/domain/platform-catalog.mjs";
import { createMarketplaceClients } from "../src/infrastructure/marketplace-clients.mjs";

test("reads visible Coupang product cards with the discounted price", async () => {
  const clients = createBrowserMarketplaceClients({
    createContext: async () => ({
      async newPage() {
        return {
          async goto() {},
          async waitForSelector() {},
          async evaluate() {
            return [{
              title: "LEGO 城市系列 樂高貨車 The LEGO Van 60500",
              price: 625,
              url: "/products/lego-60500",
              imageUrl: "https://image.example/60500.jpg"
            }];
          }
        };
      },
      async close() {}
    })
  });

  const results = await clients.coupang({
    query: "LEGO 60500",
    platform: getPlatform("coupang"),
    searchedAt: "2026-08-05T00:00:00.000Z"
  });

  assert.deepEqual(results, [{
    platformId: "coupang",
    platformName: "\u9177\u6f8e",
    title: "LEGO \u57ce\u5e02\u7cfb\u5217 \u6a02\u9ad8\u8ca8\u8eca The LEGO Van 60500",
    price: 625,
    currency: "TWD",
    url: "https://www.tw.coupang.com/products/lego-60500",
    imageUrl: "https://image.example/60500.jpg",
    source: "browser",
    notice: undefined,
    fetchedAt: "2026-08-05T00:00:00.000Z"
  }]);
});

test("runs the visible-card extractor in the isolated browser page", async () => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    querySelectorAll() {
      return [{
        innerText: "LEGO \u57ce\u5e02\u7cfb\u5217 \u6a02\u9ad8\u8ca8\u8eca 60500 \u9996\u8cfc\u6298\u6263\u50f9 $999 37% $625",
        textContent: "",
        querySelector() {
          return {
            alt: "LEGO \u57ce\u5e02\u7cfb\u5217 \u6a02\u9ad8\u8ca8\u8eca 60500",
            currentSrc: "",
            src: "https://image.example/60500.jpg"
          };
        },
        getAttribute(name) {
          return name === "href" ? "/products/lego-60500" : null;
        }
      }];
    }
  };

  try {
    const clients = createBrowserMarketplaceClients({
      createContext: async () => ({
        async newPage() {
          return {
            async goto() {},
            async waitForSelector() {},
            async evaluate(pageFunction, argument) {
              return Function(`return (${pageFunction.toString()})`)()(argument);
            }
          };
        },
        async close() {}
      })
    });

    const [result] = await clients.coupang({
      query: "LEGO 60500",
      platform: getPlatform("coupang"),
      searchedAt: "2026-08-05T00:00:00.000Z"
    });

    assert.equal(result.price, 625);
    assert.equal(result.title, "LEGO \u57ce\u5e02\u7cfb\u5217 \u6a02\u9ad8\u8ca8\u8eca 60500");
  } finally {
    globalThis.document = originalDocument;
  }
});

test("reads the first iOPEN Mall product-card price", async () => {
  const originalDocument = globalThis.document;
  const link = {
    getAttribute(name) {
      return name === "href" ? "/034630/index.php?action=product_detail&prod_no=P3463013635745" : null;
    }
  };
  const image = {
    alt: "\u6a02\u9ad8 LEGO 60500 \u6a02\u9ad8 \u8ca8\u8eca",
    currentSrc: "",
    src: "https://image.example/60500.jpg",
    closest() {
      return link;
    }
  };
  globalThis.document = {
    querySelectorAll(selector) {
      if (selector === "ul.gh_SearchBox > li") {
        return [{
          innerText: "\u6a02\u9ad8 LEGO 60500 \u6a02\u9ad8 \u8ca8\u8eca\n$698\n$1,049",
          querySelector(cardSelector) {
            return cardSelector.endsWith(" img") ? image : link;
          }
        }];
      }

      return [];
    }
  };

  try {
    const clients = createBrowserMarketplaceClients({
      createContext: async () => browserContextThatEvaluatesPageFunction()
    });
    const [result] = await clients.iopen({
      query: "LEGO 60500",
      platform: getPlatform("iopen"),
      searchedAt: "2026-08-05T00:00:00.000Z"
    });

    assert.equal(result.title, "\u6a02\u9ad8 LEGO 60500 \u6a02\u9ad8 \u8ca8\u8eca");
    assert.equal(result.price, 698);
    assert.equal(result.source, "browser");
  } finally {
    globalThis.document = originalDocument;
  }
});

test("uses the matching browser client when a direct Coupang request is blocked", async () => {
  const calls = [];
  const clients = createMarketplaceClients({
    fetchImpl: async () => ({ ok: false, status: 403 }),
    browserClients: {
      coupang: async (input) => {
        calls.push(input.query);
        return ["browser product"];
      }
    }
  });

  const results = await clients.coupang({
    query: "LEGO 60500",
    platform: getPlatform("coupang"),
    searchedAt: "2026-08-05T00:00:00.000Z"
  });

  assert.deepEqual(calls, ["LEGO 60500"]);
  assert.deepEqual(results, ["browser product"]);
});

function browserContextThatEvaluatesPageFunction() {
  return {
    async newPage() {
      return {
        async goto() {},
        async waitForSelector() {},
        async evaluate(pageFunction, argument) {
          return Function(`return (${pageFunction.toString()})`)()(argument);
        }
      };
    },
    async close() {}
  };
}

test("serializes browser searches that share the Edge profile", async () => {
  let activeContexts = 0;
  let highestActiveContexts = 0;
  const clients = createBrowserMarketplaceClients({
    createContext: async () => {
      activeContexts += 1;
      highestActiveContexts = Math.max(highestActiveContexts, activeContexts);
      return {
        async newPage() {
          return {
            async goto() {},
            async waitForSelector() {},
            async evaluate() {
              return [];
            }
          };
        },
        async close() {
          activeContexts -= 1;
        }
      };
    }
  });
  const input = {
    query: "LEGO 60500",
    searchedAt: "2026-08-05T00:00:00.000Z"
  };

  await Promise.all([
    clients.iopen({ ...input, platform: getPlatform("iopen") }),
    clients.coupang({ ...input, platform: getPlatform("coupang") })
  ]);

  assert.equal(highestActiveContexts, 1);
});

test("reports a concise iOPEN Mall message when visible browser products are unavailable", async () => {
  const clients = createBrowserMarketplaceClients({
    createContext: async () => ({
      async newPage() {
        return {
          async goto() {},
          async waitForSelector() {
            throw new Error("page.waitForSelector internal detail");
          }
        };
      },
      async close() {}
    })
  });

  await assert.rejects(
    clients.iopen({
      query: "LEGO 60500",
      platform: getPlatform("iopen"),
      searchedAt: "2026-08-05T00:00:00.000Z"
    }),
    /iOPEN Mall\u7121\u6cd5\u53d6\u5f97\u53ef\u89e3\u6790\u5546\u54c1/
  );
});

test("reports iOPEN Mall verification without waiting for a product card", async () => {
  const clients = createBrowserMarketplaceClients({
    createContext: async () => ({
      async newPage() {
        return {
          async goto() {},
          url() {
            return "https://validate.perfdrive.com/captcha";
          },
          async waitForSelector() {
            throw new Error("should not wait for a CAPTCHA page");
          }
        };
      },
      async close() {}
    })
  });

  await assert.rejects(
    clients.iopen({
      query: "LEGO 60500",
      platform: getPlatform("iopen"),
      searchedAt: "2026-08-05T00:00:00.000Z"
    }),
    /iOPEN Mall\u76ee\u524d\u8981\u6c42\u5e73\u53f0\u9a57\u8b49/
  );
});
