import assert from "node:assert/strict";
import test from "node:test";
import { createCoupangDamagedBoxSearcher } from "../src/infrastructure/coupang-damaged-box-search.mjs";

test("follows a product offer list and keeps only its damaged-box offer", async () => {
  const contextOptions = [];
  const pages = [
    pageThatEvaluates([{
      title: "LEGO Lionel Messi 43015",
      url: "/products/43015",
      imageUrl: "https://image.example/43015.jpg"
    }]),
    pageThatEvaluates("/products/43015/item/43015/offerList?totalCount=2"),
    pageThatWaitsForOfferRows({
      normalPrice: 1950,
      damagedPrice: 1852,
      damagedQuantity: null,
      listPrice: 2799
    })
  ];
  const search = createCoupangDamagedBoxSearcher({
    schedule: (work) => work(),
    createContext: async (options) => {
      contextOptions.push(options);
      return {
        async newPage() {
          return pages.shift();
        },
        async close() {}
      };
    }
  });

  const results = await search({ query: "43015" });

  assert.deepEqual(contextOptions, [{
    profileName: "coupang-damaged-box-browser-profile-v2",
    headless: false
  }]);
  assert.deepEqual(results, [{
    title: "LEGO Lionel Messi 43015",
    normalPrice: 1950,
    damagedPrice: 1852,
    damagedQuantity: null,
    listPrice: 2799,
    url: "https://www.tw.coupang.com/products/43015",
    imageUrl: null
  }]);
});

test("uses the normal offer row rather than reusing the damaged-box row", async () => {
  const pages = [
    pageThatEvaluates([{
      title: "LEGO Lionel Messi 43015",
      url: "/products/43015",
      imageUrl: null
    }]),
    pageThatEvaluates("/products/43015/item/43015/offerList?totalCount=2"),
    pageThatEvaluatesDocumentText(
      "47% $2,799 $1,673 $1,473 \u6298\u6263\u5f8c\u50f9\u683c \u514d\u904b \u76d2\u640d\u798f\u5229\u54c1 \u2013 \u5168\u65b0\u672a\u958b\u5c01 "
      + "35% $2,799 $2,150 $1,819 \u6298\u6263\u5f8c\u50f9\u683c \u514d\u904b \u7576\u524d\u5546\u54c1 \u5168\u65b0\u5546\u54c1"
    )
  ];
  const search = createCoupangDamagedBoxSearcher({
    schedule: (work) => work(),
    createContext: async () => ({
      async newPage() {
        return pages.shift();
      },
      async close() {}
    })
  });

  const [result] = await search({ query: "43015" });

  assert.equal(result.damagedPrice, 1673);
  assert.equal(result.normalPrice, 1819);
});

test("uses the candidate item link to open its offer list directly", async () => {
  const pages = [
    pageThatEvaluates([{
      title: "LEGO Lionel Messi 43015",
      url: "/products/LEGO-Lionel-Messi-43015-678789109301333?itemId=678789109399637&vendorItemId=678789109268542",
      imageUrl: null
    }]),
    pageThatEvaluatesDocumentText(
      "47% $2,799 $1,673 $1,473 \u6298\u6263\u5f8c\u50f9\u683c \u514d\u904b \u76d2\u640d\u798f\u5229\u54c1 \u2013 \u5168\u65b0\u672a\u958b\u5c01 "
      + "35% $2,799 $2,150 $1,819 \u6298\u6263\u5f8c\u50f9\u683c \u514d\u904b \u7576\u524d\u5546\u54c1 \u5168\u65b0\u5546\u54c1"
    )
  ];
  const search = createCoupangDamagedBoxSearcher({
    schedule: (work) => work(),
    createContext: async () => ({
      async newPage() {
        return pages.shift();
      },
      async close() {}
    })
  });

  const [result] = await search({ query: "43015" });

  assert.equal(result.normalPrice, 1819);
  assert.equal(result.damagedPrice, 1673);
});

function pageThatEvaluates(result) {
  return {
    async goto() {},
    async route() {},
    async waitForSelector() {},
    async evaluate() {
      return result;
    },
    async close() {}
  };
}

function pageThatWaitsForOfferRows(result) {
  let ready = false;

  return {
    async goto() {},
    async route() {},
    async waitForFunction() {
      ready = true;
    },
    async evaluate() {
      return ready ? result : null;
    },
    async close() {}
  };
}

function pageThatEvaluatesDocumentText(text) {
  return {
    async goto() {},
    async route() {},
    async waitForFunction() {},
    async evaluate(pageFunction) {
      return Function("document", "return (" + pageFunction.toString() + ")();")({
        body: { innerText: text }
      });
    },
    async close() {}
  };
}
