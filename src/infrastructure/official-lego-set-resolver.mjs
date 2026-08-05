const localePaths = ["zh-tw", "en-us"];

export function createOfficialLegoSetResolver({ fetchImpl = fetch, maxEntries = 200 } = {}) {
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
      inFlight.set(setNumber, fetchOfficialSetNames({ setNumber, fetchImpl }));
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

async function fetchOfficialSetNames({ setNumber, fetchImpl }) {
  const names = [];

  const setNames = await Promise.all(
    localePaths.map((locale) => fetchSetName({ locale, setNumber, fetchImpl }))
  );

  for (const name of setNames) {
    if (name && !names.includes(name)) {
      names.push(name);
    }
  }

  return names.length ? { setNumber, names } : null;
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

function extractHeading(html) {
  const heading = String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  return heading ? cleanText(heading) : null;
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
