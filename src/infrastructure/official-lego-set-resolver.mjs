const localePaths = ["zh-tw", "en-us"];
const officialPriceLocales = [
  { locale: "zh-tw", currency: "TWD" },
  { locale: "en-us", currency: "USD" },
  { locale: "en-de", currency: "EUR" }
];
const fixedExchangeRate = 40;

export function createOfficialLegoSetResolver({
  fetchImpl = fetch,
  fetchProductPages = null,
  maxEntries = 200
} = {}) {
  const cache = new Map();
  const inFlight = new Map();

  return async function resolveLegoSet(setNumber) {
    if (!/^\d{4,6}$/.test(setNumber)) {
      return null;
    }

    if (cache.has(setNumber)) {
      return cache.get(setNumber);
    }

    if (!inFlight.has(setNumber)) {
      inFlight.set(setNumber, fetchOfficialSet({ setNumber, fetchImpl, fetchProductPages }));
    }

    try {
      const set = await inFlight.get(setNumber);
      if (set) {
        cache.set(setNumber, set);
        while (cache.size > maxEntries) {
          cache.delete(cache.keys().next().value);
        }
      }
      return set;
    } finally {
      inFlight.delete(setNumber);
    }
  };
}

async function fetchOfficialSet({ setNumber, fetchImpl, fetchProductPages }) {
  const names = [];

  const setNames = await Promise.all(
    localePaths.map((locale) => fetchSetName({ locale, setNumber, fetchImpl }))
  );

  for (const name of setNames) {
    if (name && !names.includes(name)) {
      names.push(name);
    }
  }

  if (!names.length) {
    return null;
  }

  const englishName = setNames[localePaths.indexOf("en-us")];
  const productSlug = productSlugFor(englishName);
  const priceRequests = productSlug
    ? officialPriceLocales.map((priceLocale) => ({
      ...priceLocale,
      url: `https://www.lego.com/${priceLocale.locale}/product/${productSlug}-${setNumber}`
    }))
    : [];
  const directPrices = await Promise.all(priceRequests.map((request) => fetchOfficialPrice({
    ...request,
    fetchImpl
  })));
  const missingRequests = priceRequests.filter((_, index) => !directPrices[index]);
  const renderedPages = missingRequests.length && fetchProductPages
    ? await fetchProductPages(missingRequests.map((request) => request.url))
    : new Map();
  const officialPrices = priceRequests.map((request, index) => {
    const directPrice = directPrices[index];
    if (directPrice) {
      return directPrice;
    }

    return priceFromHtml({
      ...request,
      html: renderedPages.get(request.url)
    });
  }).filter(Boolean);

  return {
    setNumber,
    names,
    officialPrices,
    officialReferenceTwd: selectReferencePrice(officialPrices)?.convertedTwd ?? null
  };
}

async function fetchSetName({ locale, setNumber, fetchImpl }) {
  const url = `https://www.lego.com/${locale}/service/building-instructions/${setNumber}`;

  try {
    const response = await fetchImpl(url, {
      headers: { "user-agent": "LegoSearch/0.2" },
      signal: AbortSignal.timeout(3500)
    });

    if (!response.ok) {
      return null;
    }

    return extractHeading(await response.text());
  } catch {
    return null;
  }
}

async function fetchOfficialPrice({ url, currency, fetchImpl }) {
  try {
    const response = await fetchImpl(url, {
      headers: { "user-agent": "LegoSearch/0.2" },
      signal: AbortSignal.timeout(3500)
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    if (isBotChallenge(html)) {
      return null;
    }

    return priceFromHtml({ url, currency, html });
  } catch {
    return null;
  }
}

function priceFromHtml({ url, currency, html }) {
  if (!html || isBotChallenge(html)) {
    return null;
  }

  const amount = extractOfficialPrice(html, currency);
  if (amount === null) {
    return null;
  }

  return {
    currency,
    amount,
    convertedTwd: currency === "TWD" ? amount : Math.round(amount * fixedExchangeRate),
    url
  };
}

function extractHeading(html) {
  const heading = String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  return heading ? cleanText(heading) : null;
}

function productSlugFor(name) {
  return cleanText(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function extractOfficialPrice(html, currency) {
  const text = cleanText(html);
  const match = currency === "TWD"
    ? text.match(/(?:NT\$|TWD|NTD)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i)
    : currency === "EUR"
      ? text.match(/(?:€\s*([0-9][0-9.,]*)|([0-9][0-9.,]*)\s*€)/)
      : text.match(/\$\s*([0-9][0-9,]*(?:\.\d{1,2})?)/);
  const value = match?.[1] || match?.[2];

  if (!value) {
    return null;
  }

  const normalized = currency === "EUR" && value.includes(",") && value.lastIndexOf(",") > value.lastIndexOf(".")
    ? value.replace(/\./g, "").replace(",", ".")
    : value.replace(/,/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function selectReferencePrice(prices) {
  return ["TWD", "USD", "EUR"].map((currency) => (
    prices.find((price) => price.currency === currency)
  )).find(Boolean) || null;
}

function isBotChallenge(html) {
  return /just a moment|challenge-platform|cf-chl-/i.test(String(html));
}

function cleanText(value) {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/\s+/g, " ")
    .trim();
}
