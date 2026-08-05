const sourceUrl = "https://rate.bot.com.tw/xrt?Lang=zh-TW";
const trackedCurrencies = ["USD"];

export function createTaiwanBankExchangeRateResolver({
  fetchImpl = fetch,
  now = () => Date.now(),
  cacheDurationMs = 24 * 60 * 60 * 1000
} = {}) {
  let cached = null;
  let cacheExpiresAt = 0;
  let inFlight = null;

  return async function resolveExchangeRates() {
    if (cached && now() < cacheExpiresAt) {
      return cached;
    }

    if (!inFlight) {
      inFlight = fetchExchangeRates({ fetchImpl });
    }

    try {
      const rates = await inFlight;
      if (rates) {
        cached = rates;
        cacheExpiresAt = now() + cacheDurationMs;
      }
      return rates;
    } finally {
      inFlight = null;
    }
  };
}

async function fetchExchangeRates({ fetchImpl }) {
  try {
    const response = await fetchImpl(sourceUrl, {
      headers: { "user-agent": "LegoSearch/0.2" },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const rates = Object.fromEntries(trackedCurrencies.map((currency) => [
      currency,
      extractSpotSellingRate(html, currency)
    ]).filter(([, rate]) => rate !== null));

    return Object.keys(rates).length
      ? { rates, quotedAt: extractQuotedAt(html), sourceUrl }
      : null;
  } catch {
    return null;
  }
}

function extractSpotSellingRate(html, currency) {
  const row = (String(html).match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [])
    .find((candidate) => new RegExp(`\\b${currency}\\b`, "i").test(cleanText(candidate)));
  const values = row
    ? [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((cell) => cleanText(cell[1]))
      .map(Number)
      .filter(Number.isFinite)
    : [];
  const spotSellingRate = values[3];

  return Number.isFinite(spotSellingRate) ? spotSellingRate : null;
}

function extractQuotedAt(html) {
  const text = cleanText(html);
  return text.match(/\u724c\u50f9\u6700\u65b0\u639b\u724c\u6642\u9593\s*[\uff1a:]\s*([0-9/: ]+)/)?.[1]?.trim() || null;
}

function cleanText(value) {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
