import assert from "node:assert/strict";
import test from "node:test";
import { createTaiwanBankExchangeRateResolver } from "../src/infrastructure/taiwan-bank-exchange-rate.mjs";

test("reads the Taiwan Bank spot selling rate for USD", async () => {
  const resolveRates = createTaiwanBankExchangeRateResolver({
    fetchImpl: async () => ({ ok: true, text: async () => exchangeRateHtml() })
  });

  assert.deepEqual(await resolveRates(), {
    rates: { USD: 32.335 },
    quotedAt: "2026/08/05 13:00",
    sourceUrl: "https://rate.bot.com.tw/xrt?Lang=zh-TW"
  });
});

test("caches the Taiwan Bank rate response within the configured interval", async () => {
  let calls = 0;
  const resolveRates = createTaiwanBankExchangeRateResolver({
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, text: async () => exchangeRateHtml() };
    }
  });

  await resolveRates();
  await resolveRates();

  assert.equal(calls, 1);
});

function exchangeRateHtml() {
  return `
    <p>牌價最新掛牌時間：<span>2026/08/05 13:00</span></p>
    <table>
      <tr><td>美金 (USD)</td><td>31.885</td><td>32.555</td><td>32.235</td><td>32.335</td></tr>
      <tr><td>歐元 (EUR)</td><td>36.42</td><td>37.76</td><td>37.04</td><td>37.44</td></tr>
    </table>
  `;
}
