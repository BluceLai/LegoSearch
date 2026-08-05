import assert from "node:assert/strict";
import test from "node:test";
import { organizeResults } from "../public/result-organization.mjs";

test("groups results by the selected marketplace and sorts prices within each group", () => {
  const groups = organizeResults({
    platformIds: ["iopen", "coupang"],
    sort: "price-asc",
    results: [
      result({ platformId: "coupang", platformName: "\u9177\u6f8e", title: "Coupang 60500", price: 625 }),
      result({ platformId: "iopen", platformName: "iOPEN Mall", title: "iOPEN Mall link", price: null }),
      result({ platformId: "coupang", platformName: "\u9177\u6f8e", title: "Coupang 60500 higher", price: 999 })
    ]
  });

  assert.deepEqual(groups.map((group) => [group.platformId, group.results.map((item) => item.title)]), [
    ["iopen", ["iOPEN Mall link"]],
    ["coupang", ["Coupang 60500", "Coupang 60500 higher"]]
  ]);
  assert.equal(groups[0].lowestResult, null);
  assert.equal(groups[1].lowestResult.title, "Coupang 60500");
});

test("keeps the platform summary on the lowest price when detail results sort high to low", () => {
  const [group] = organizeResults({
    platformIds: ["iopen"],
    sort: "price-desc",
    results: [
      result({ platformId: "iopen", platformName: "iOPEN Mall", title: "Low", price: 659 }),
      result({ platformId: "iopen", platformName: "iOPEN Mall", title: "High", price: 840 })
    ]
  });

  assert.equal(group.results[0].title, "High");
  assert.equal(group.lowestResult.title, "Low");
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
