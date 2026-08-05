import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createPriceHistoryRepository } from "../src/infrastructure/price-history-repository.mjs";

test("keeps one daily platform price range and adds a new entry on the following day", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lego-search-history-"));
  let now = new Date("2026-08-05T04:00:00.000Z");
  const history = createPriceHistoryRepository({
    filePath: join(directory, "price-history.json"),
    now: () => now
  });

  try {
    await history.record(searchSnapshot({ momoPrices: [12999, 11999], pchomePrices: [12500] }));
    now = new Date("2026-08-05T12:00:00.000Z");
    await history.record(searchSnapshot({ momoPrices: [11888, 13200], pchomePrices: [12222] }));
    now = new Date("2026-08-06T04:00:00.000Z");
    await history.record(searchSnapshot({ momoPrices: [11777], pchomePrices: [12111, 12999] }));

    assert.deepEqual(await history.list(), [{
      setNumber: "10305",
      query: "LEGO 10305",
      dates: [
        {
          date: "2026-08-06",
          searchedAt: "2026-08-06T04:00:00.000Z",
          platforms: [
            { platformId: "momo", platformName: "MOMO", lowestPrice: 11777, highestPrice: 11777 },
            { platformId: "pchome", platformName: "PChome", lowestPrice: 12111, highestPrice: 12999 }
          ]
        },
        {
          date: "2026-08-05",
          searchedAt: "2026-08-05T12:00:00.000Z",
          platforms: [
            { platformId: "momo", platformName: "MOMO", lowestPrice: 11888, highestPrice: 13200 },
            { platformId: "pchome", platformName: "PChome", lowestPrice: 12222, highestPrice: 12222 }
          ]
        }
      ]
    }]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function searchSnapshot({ momoPrices, pchomePrices }) {
  return {
    query: "LEGO 10305",
    searchedAt: "2026-08-05T04:00:00.000Z",
    results: [
      ...momoPrices.map((price) => ({ platformId: "momo", platformName: "MOMO", price })),
      ...pchomePrices.map((price) => ({ platformId: "pchome", platformName: "PChome", price }))
    ]
  };
}
