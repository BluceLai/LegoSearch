import assert from "node:assert/strict";
import test from "node:test";
import { getPlatform, listPlatforms } from "../src/domain/platform-catalog.mjs";

test("lists the Taiwan marketplaces supported by the product", () => {
  assert.deepEqual(
    listPlatforms().map((platform) => [platform.id, platform.name]),
    [
      ["shopee", "\u8766\u76ae"],
      ["momo", "MOMO"],
      ["pchome", "PChome"],
      ["coupang", "\u9177\u6f8e"]
    ]
  );
});

test("builds official marketplace search URLs for a keyword", () => {
  assert.equal(
    getPlatform("shopee").buildSearchUrl("LEGO 10305"),
    "https://shopee.tw/search?keyword=LEGO+10305"
  );

  assert.equal(
    getPlatform("momo").buildSearchUrl("LEGO 10305"),
    "https://www.momoshop.com.tw/search/searchShop.jsp?keyword=LEGO+10305&searchType=1"
  );

  assert.equal(
    getPlatform("pchome").buildSearchUrl("LEGO 10305"),
    "https://24h.pchome.com.tw/search/?q=LEGO+10305"
  );

  assert.equal(
    getPlatform("coupang").buildSearchUrl("LEGO 10305"),
    "https://www.tw.coupang.com/search?q=LEGO+10305"
  );
});

test("throws for unknown platform ids", () => {
  assert.throws(() => getPlatform("unknown"), /Unknown platform/);
});
