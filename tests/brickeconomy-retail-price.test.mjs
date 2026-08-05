import assert from "node:assert/strict";
import test from "node:test";
import { createBrickEconomyRetailPriceResolver } from "../src/infrastructure/brickeconomy-retail-price.mjs";

test("reads the exact set Retail price from a BrickEconomy search result", async () => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    querySelector(selector) {
      assert.equal(selector, 'a[href^="/set/10305-1/"]');
      return {
        getAttribute() {
          return "/set/10305-1/lego-lion-knights-castle";
        },
        closest() {
          return { innerText: "10305 Lion Knights' Castle\nRetail $399.99\nValue $558.63" };
        }
      };
    },
    body: { innerText: "Search Results for 10305" }
  };

  try {
    const resolveRetailPrice = createBrickEconomyRetailPriceResolver({
      schedule: async (work) => work(),
      createContext: async () => browserContextThatEvaluatesPageFunction()
    });

    assert.deepEqual(await resolveRetailPrice("10305"), {
      amount: 399.99,
      currency: "USD",
      source: "brickeconomy",
      url: "https://www.brickeconomy.com/set/10305-1/lego-lion-knights-castle"
    });
  } finally {
    globalThis.document = originalDocument;
  }
});

test("does not return a price when BrickEconomy requires verification", async () => {
  const resolveRetailPrice = createBrickEconomyRetailPriceResolver({
    schedule: async (work) => work(),
    createContext: async () => ({
      async newPage() {
        return {
          async goto() {},
          async waitForTimeout() {},
          async evaluate() {
            return { challenge: true };
          }
        };
      },
      async close() {}
    })
  });

  assert.equal(await resolveRetailPrice("10305"), null);
});

function browserContextThatEvaluatesPageFunction() {
  return {
    async newPage() {
      return {
        async goto() {},
        async waitForTimeout() {},
        async evaluate(pageFunction, argument) {
          return Function(`return (${pageFunction.toString()})`)()(argument);
        }
      };
    },
    async close() {}
  };
}
