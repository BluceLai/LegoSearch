import assert from "node:assert/strict";
import test from "node:test";
import { createOfficialLegoPriceBrowserFetcher } from "../src/infrastructure/official-lego-price-browser.mjs";

test("reads the official product price element instead of promotional amounts", async () => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    body: { innerText: "Free gift with purchase of $130 or more. $399.99" },
    querySelector(selector) {
      return selector === '[data-test="product-price-display-price"]'
        ? { textContent: "$399.99" }
        : null;
    }
  };

  try {
    const fetchProductPages = createOfficialLegoPriceBrowserFetcher({
      schedule: async (work) => work(),
      createContext: async () => ({
        async newPage() {
          return {
            async goto() {},
            async evaluate(pageFunction) {
              return Function(`return (${pageFunction.toString()})`)()();
            }
          };
        },
        async close() {}
      })
    });

    const pages = await fetchProductPages(["https://www.lego.com/en-us/product/lion-knights-castle-10305"]);

    assert.equal(pages.get("https://www.lego.com/en-us/product/lion-knights-castle-10305"), "$399.99");
  } finally {
    globalThis.document = originalDocument;
  }
});

test("does not use unrelated currency amounts when the product price element is absent", async () => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    body: { innerText: "Delivery from EUR 20. Free returns." },
    querySelector() {
      return null;
    }
  };

  try {
    const fetchProductPages = createOfficialLegoPriceBrowserFetcher({
      schedule: async (work) => work(),
      createContext: async () => ({
        async newPage() {
          return {
            async goto() {},
            async evaluate(pageFunction) {
              return Function(`return (${pageFunction.toString()})`)()();
            }
          };
        },
        async close() {}
      })
    });

    const pages = await fetchProductPages(["https://www.lego.com/en-de/product/lion-knights-castle-10305"]);

    assert.equal(pages.get("https://www.lego.com/en-de/product/lion-knights-castle-10305"), "");
  } finally {
    globalThis.document = originalDocument;
  }
});
