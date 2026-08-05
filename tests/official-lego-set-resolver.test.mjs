import assert from "node:assert/strict";
import test from "node:test";
import { createOfficialLegoSetResolver } from "../src/infrastructure/official-lego-set-resolver.mjs";

test("resolves set names and prioritizes the Taiwan official price as the summary reference", async () => {
  const requestedUrls = [];
  const resolveLegoSet = createOfficialLegoSetResolver({
    resolveExchangeRates: async () => ({
      rates: { USD: 32.335, EUR: 37.44 },
      quotedAt: "2026/08/05 13:00",
      sourceUrl: "https://rate.bot.com.tw/xrt?Lang=zh-TW"
    }),
    fetchImpl: async (url) => {
      requestedUrls.push(String(url));
      return responseFor(url);
    }
  });

  const set = await resolveLegoSet("10305");

  assert.deepEqual(set, {
    setNumber: "10305",
    names: ["\u7345\u5b50\u9a0e\u58eb\u7684\u57ce\u5821", "Lion Knights' Castle"],
    officialPrices: [
      {
        currency: "TWD",
        amount: 12999,
        convertedTwd: 12999,
        url: "https://www.lego.com/zh-tw/product/lion-knights-castle-10305"
      },
      {
        currency: "USD",
        amount: 399.99,
        convertedTwd: 12934,
        exchangeRate: 32.335,
        url: "https://www.lego.com/en-us/product/lion-knights-castle-10305"
      },
      {
        currency: "EUR",
        amount: 399.99,
        convertedTwd: 14976,
        exchangeRate: 37.44,
        url: "https://www.lego.com/en-de/product/lion-knights-castle-10305"
      }
    ],
    officialReferenceTwd: 12999,
    exchangeRateInfo: {
      quotedAt: "2026/08/05 13:00",
      sourceUrl: "https://rate.bot.com.tw/xrt?Lang=zh-TW"
    }
  });
  assert.deepEqual(requestedUrls.sort(), [
    "https://www.lego.com/zh-tw/service/building-instructions/10305",
    "https://www.lego.com/en-us/service/building-instructions/10305",
    "https://www.lego.com/zh-tw/product/lion-knights-castle-10305",
    "https://www.lego.com/en-us/product/lion-knights-castle-10305",
    "https://www.lego.com/en-de/product/lion-knights-castle-10305"
  ].sort());
});

test("uses a Taiwan Bank USD rate when Taiwan pricing is unavailable", async () => {
  const resolveLegoSet = createOfficialLegoSetResolver({
    resolveExchangeRates: async () => ({ rates: { USD: 30 } }),
    fetchImpl: async (url) => responseFor(url, { taiwanPrice: null, usdPrice: 19.99, eurPrice: null })
  });

  const set = await resolveLegoSet("10305");

  assert.equal(set.officialReferenceTwd, 600);
  assert.deepEqual(set.officialPrices.map((price) => price.currency), ["USD"]);
});

test("reapplies the current exchange rate when returning a cached official set", async () => {
  let usdRate = 30;
  const resolveLegoSet = createOfficialLegoSetResolver({
    resolveExchangeRates: async () => ({ rates: { USD: usdRate } }),
    fetchImpl: async (url) => responseFor(url, { taiwanPrice: null, usdPrice: 20, eurPrice: null })
  });

  assert.equal((await resolveLegoSet("10305")).officialReferenceTwd, 600);
  usdRate = 31;
  assert.equal((await resolveLegoSet("10305")).officialReferenceTwd, 620);
});

test("uses browser-rendered official product pages when direct requests are blocked", async () => {
  const requestedPages = [];
  const resolveLegoSet = createOfficialLegoSetResolver({
    resolveExchangeRates: async () => ({ rates: { USD: 30, EUR: 35 } }),
    fetchImpl: async (url) => {
      if (String(url).includes("building-instructions")) {
        return responseFor(url, { taiwanPrice: null, usdPrice: null, eurPrice: null });
      }

      return { ok: false, text: async () => "" };
    },
    fetchProductPages: async (urls) => {
      requestedPages.push(...urls);
      return new Map([
        [urls.find((url) => url.includes("en-us")), "$29.99"],
        [urls.find((url) => url.includes("en-de")), "\u20ac24.99"]
      ]);
    }
  });

  const set = await resolveLegoSet("10305");

  assert.equal(requestedPages.length, 3);
  assert.equal(set.officialReferenceTwd, 900);
  assert.deepEqual(set.officialPrices.map((price) => price.currency), ["USD", "EUR"]);
});

test("does not cache an official lookup that returns no set names", async () => {
  let calls = 0;
  const resolveLegoSet = createOfficialLegoSetResolver({
    fetchImpl: async () => {
      calls += 1;
      return { ok: false, text: async () => "" };
    }
  });

  assert.equal(await resolveLegoSet("10305"), null);
  assert.equal(await resolveLegoSet("10305"), null);
  assert.equal(calls, 4);
});

test("evicts the oldest cached set name when the cache reaches its limit", async () => {
  let calls = 0;
  const resolveLegoSet = createOfficialLegoSetResolver({
    maxEntries: 1,
    fetchImpl: async (url) => {
      calls += 1;
      const setNumber = String(url).match(/(\d{4,6})$/)?.[1];
      return { ok: true, text: async () => `<h1>Set ${setNumber}</h1>` };
    }
  });

  await resolveLegoSet("10305");
  await resolveLegoSet("10306");
  await resolveLegoSet("10305");

  assert.equal(calls, 15);
});

function responseFor(url, { taiwanPrice = 12999, usdPrice = 399.99, eurPrice = 399.99 } = {}) {
  const value = String(url);
  const html = value.includes("building-instructions")
    ? (value.includes("zh-tw")
      ? '<h1 data-test="page-heading">\u7345\u5b50\u9a0e\u58eb\u7684\u57ce\u5821</h1>'
      : '<h1 data-test="page-heading">Lion Knights&#x27; Castle</h1>')
    : value.includes("zh-tw") && taiwanPrice
      ? `<main>NT$${taiwanPrice.toLocaleString("en-US")}</main>`
      : value.includes("en-us") && usdPrice
        ? `<main>$${usdPrice.toFixed(2)}</main>`
        : value.includes("en-de") && eurPrice
          ? `<main>\u20ac${eurPrice.toFixed(2)}</main>`
          : "<main>Out of stock</main>";

  return {
    ok: true,
    text: async () => html
  };
}
