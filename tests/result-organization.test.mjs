import assert from "node:assert/strict";
import test from "node:test";
import { organizeResults } from "../public/result-organization.mjs";

test("groups results by the selected marketplace and sorts prices within each group", () => {
  const groups = organizeResults({
    platformIds: ["shopee", "coupang"],
    sort: "price-asc",
    results: [
      result({ platformId: "coupang", platformName: "\u9177\u6f8e", title: "Coupang 60500", price: 625 }),
      result({ platformId: "shopee", platformName: "\u8766\u76ae", title: "Shopee link", price: null }),
      result({ platformId: "coupang", platformName: "\u9177\u6f8e", title: "Coupang 60500 higher", price: 999 })
    ]
  });

  assert.deepEqual(groups.map((group) => [group.platformId, group.results.map((item) => item.title)]), [
    ["shopee", ["Shopee link"]],
    ["coupang", ["Coupang 60500", "Coupang 60500 higher"]]
  ]);
});

function result(overrides) {
  return {
    platformId: "momo",
    platformName: "MOMO",
    title: "Product",
    price: 1000,
    ...overrides
  };
}
