export function stripHtml(value = "") {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function parsePrice(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  const normalized = String(value)
    .replace(/[,\s]/g, "")
    .replace(/[^\d.]/g, "");

  if (!normalized) {
    return null;
  }

  const price = Number.parseFloat(normalized);
  return Number.isFinite(price) ? Math.round(price) : null;
}

export function normalizeUrl(url, baseUrl) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

export async function fetchText(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "accept": "text/html,application/json;q=0.9,*/*;q=0.8",
        "accept-language": "zh-TW,zh;q=0.9,en;q=0.7",
        "cache-control": "no-cache",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 LegoSearch/0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function collectJsonLd(value, products = []) {
  if (!value) {
    return products;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLd(item, products);
    }
    return products;
  }

  if (typeof value !== "object") {
    return products;
  }

  const type = value["@type"];
  const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
  if (isProduct) {
    products.push(value);
  }

  for (const child of Object.values(value)) {
    if (child && typeof child === "object") {
      collectJsonLd(child, products);
    }
  }

  return products;
}

export function extractJsonLdProducts(html) {
  const matches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const products = [];

  for (const match of matches) {
    const rawJson = stripHtml(match[1]);
    if (!rawJson) {
      continue;
    }

    try {
      collectJsonLd(JSON.parse(rawJson), products);
    } catch {
      // Some commerce pages include malformed JSON-LD. Ignore and continue.
    }
  }

  return products;
}

export function productsFromJsonLd(html, platform, searchUrl, limit = 12) {
  return extractJsonLdProducts(html)
    .map((product) => {
      const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      const image = Array.isArray(product.image) ? product.image[0] : product.image;
      const price = parsePrice(offer?.price ?? product.price);

      return {
        platform: platform.name,
        platformId: platform.id,
        title: stripHtml(product.name || ""),
        price,
        currency: offer?.priceCurrency || "TWD",
        url: normalizeUrl(product.url || offer?.url, searchUrl) || searchUrl,
        image: normalizeUrl(image, searchUrl),
        seller: stripHtml(product.brand?.name || product.brand || ""),
        source: "json-ld",
        fetchedAt: new Date().toISOString()
      };
    })
    .filter((item) => item.title && item.price)
    .slice(0, limit);
}

export function fallbackSearchResult(platform, query, reason) {
  const searchUrl = platform.searchUrl(query);

  return {
    platform: platform.name,
    platformId: platform.id,
    title: `前往 ${platform.name} 搜尋「${query}」`,
    price: null,
    currency: "TWD",
    url: searchUrl,
    image: null,
    seller: "",
    source: "search-link",
    notice: reason || "平台未回傳可解析的價格資料，保留搜尋連結。",
    fetchedAt: new Date().toISOString()
  };
}
