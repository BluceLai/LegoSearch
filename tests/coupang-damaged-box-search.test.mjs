import assert from "node:assert/strict";
import test from "node:test";
import { createCoupangDamagedBoxSearcher } from "../src/infrastructure/coupang-damaged-box-search.mjs";

test("searches Coupang for LEGO damaged-box offers and reads all displayed prices", async () => {
  const originalDocument = globalThis.document;
  const navigatedUrls = [];
  const contextOptions = [];
  const routePatterns = [];
  globalThis.document = {
    querySelectorAll(selector) {
      assert.equal(selector, 'a[href*="/products/"]');
      return [{
        innerText: "LEGO \u904b\u52d5\u4e3b\u984c Lionel Messi 43015 \u6298\u6263\u5f8c\u50f9\u683c $2,799 7\u6298 $1,959 \u76d2\u640d\u798f\u5229\u54c1 - \u5168\u65b0\u672a\u958b\u5c01 $1,852 \u50c5\u5269 2\u4ef6\uff0c\u8981\u8cb7\u8981\u5feb!",
        querySelector() {
          return {
            alt: "LEGO Lionel Messi 43015",
            currentSrc: "",
            src: "https://image.example/43015.jpg"
          };
        },
        getAttribute(name) {
          return name === "href" ? "/products/43015" : null;
        }
      }];
    }
  };

  try {
    const search = createCoupangDamagedBoxSearcher({
      schedule: (work) => work(),
      createContext: async (options) => {
        contextOptions.push(options);
        return {
        async newPage() {
          return {
            async goto(url) {
              navigatedUrls.push(url);
            },
            async route(pattern) {
              routePatterns.push(pattern);
            },
            async waitForSelector() {},
            async evaluate(pageFunction) {
              return Function(`return (${pageFunction.toString()})`)()();
            }
          };
        },
        async close() {}
      };
      }
    });

    const results = await search({ query: "43015", includeImages: true });
    const listResults = await search({ query: "43015" });

    assert.deepEqual(navigatedUrls, [
      "https://www.tw.coupang.com/search?q=LEGO+43015+%E7%9B%92%E6%90%8D",
      "https://www.tw.coupang.com/search?q=LEGO+43015+%E7%9B%92%E6%90%8D"
    ]);
    assert.deepEqual(contextOptions, [
      { profileName: "coupang-browser-profile", headless: true },
      { profileName: "coupang-browser-profile", headless: true }
    ]);
    assert.deepEqual(routePatterns, ["**/*"]);
    assert.deepEqual(results, [{
      title: "LEGO Lionel Messi 43015",
      normalPrice: 1959,
      damagedPrice: 1852,
      damagedQuantity: 2,
      listPrice: 2799,
      url: "https://www.tw.coupang.com/products/43015",
      imageUrl: "https://image.example/43015.jpg"
    }]);
    assert.deepEqual(listResults.map((item) => item.imageUrl), [null]);
  } finally {
    globalThis.document = originalDocument;
  }
});
