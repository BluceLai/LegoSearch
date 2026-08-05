import { createMarketplaceResult } from "../domain/search-result.mjs";

export function createMarketplaceClients({ fetchImpl = fetch, browserClients = {} } = {}) {
  const directClients = {
    iopen: browserClients.iopen || createHtmlClient(fetchImpl),
    momo: createHtmlClient(fetchImpl),
    coupang: createHtmlClient(fetchImpl),
    pchome: createPchomeClient(fetchImpl)
  };

  return Object.fromEntries(Object.entries(directClients).map(([platformId, client]) => [
    platformId,
    withBrowserFallback(client, browserClients[platformId])
  ]));
}

function withBrowserFallback(client, browserClient) {
  if (!browserClient) {
    return client;
  }

  return async function searchMarketplace(input) {
    try {
      return await client(input);
    } catch (error) {
      if (!String(error.message).includes("HTTP 403")) {
        throw error;
      }

      return browserClient(input);
    }
  };
}

function createPchomeClient(fetchImpl) {
  return async function searchPchome({ query, platform, searchedAt }) {
    const url = new URL("https://ecshweb.pchome.com.tw/search/v3.3/all/results");
    url.searchParams.set("q", query);
    url.searchParams.set("page", "1");
    url.searchParams.set("sort", "sale/dc");

    const response = await fetchWithBrowserHeaders(fetchImpl, url, "application/json");

    if (!response.ok) {
      throw new Error(`PChome HTTP ${response.status}`);
    }

    const payload = await response.json();
    const products = Array.isArray(payload.prods) ? payload.prods : [];

    return products.slice(0, 20).map((product) => createMarketplaceResult({
      platform,
      title: cleanText(product.name || product.describe || "PChome product"),
      price: toPrice(product.price),
      url: product.Id ? `https://24h.pchome.com.tw/prod/${product.Id}` : platform.buildSearchUrl(query),
      imageUrl: imageUrl(product),
      fetchedAt: searchedAt
    })).filter((product) => product.title && product.price !== null);
  };
}

function createHtmlClient(fetchImpl) {
  return async function searchHtmlMarketplace({ query, platform, searchedAt }) {
    const searchUrl = platform.buildSearchUrl(query);
    const response = await fetchWithBrowserHeaders(fetchImpl, searchUrl, "text/html");
    if (!response.ok) {
      throw new Error(`${platform.name} HTTP ${response.status}`);
    }

    const html = await response.text();
    const jsonLdResults = extractJsonLdProducts({ html, platform, searchUrl, searchedAt });
    if (jsonLdResults.length) {
      return jsonLdResults.slice(0, 20);
    }

    return extractLoosePriceLinks({ html, platform, searchUrl, searchedAt }).slice(0, 20);
  };
}

function extractJsonLdProducts({ html, platform, searchUrl, searchedAt }) {
  const products = [];
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  for (const script of scripts) {
    try {
      collectProducts(JSON.parse(decodeEntities(script[1])), products);
    } catch {
      // Marketplace pages often contain malformed JSON-LD. Keep scanning.
    }
  }

  return products.map((product) => {
    const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
    const image = Array.isArray(product.image) ? product.image[0] : product.image;
    return createMarketplaceResult({
      platform,
      title: cleanText(product.name || ""),
      price: toPrice(offer?.price ?? product.price),
      url: absoluteUrl(product.url || offer?.url || searchUrl, searchUrl),
      imageUrl: image ? absoluteUrl(image, searchUrl) : null,
      fetchedAt: searchedAt
    });
  }).filter((product) => product.title && product.price !== null);
}

function collectProducts(value, products) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectProducts(item, products));
    return;
  }

  const type = value["@type"];
  const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
  if (isProduct) {
    products.push(value);
  }

  Object.values(value).forEach((item) => collectProducts(item, products));
}

function extractLoosePriceLinks({ html, platform, searchUrl, searchedAt }) {
  const links = html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{20,1200}?)<\/a>/gi);
  const results = [];
  const seen = new Set();

  for (const link of links) {
    const text = cleanText(stripTags(link[2]));
    const price = toPrice(text.match(/(?:NT\$|NT|TWD|\$)\s*([0-9,]{2,8})/i)?.[1]);
    const title = cleanText(text.replace(/(?:NT\$|NT|TWD|\$)\s*[0-9,]+.*/i, ""));
    const url = absoluteUrl(link[1], searchUrl);
    const key = `${title}:${price}:${url}`;

    if (!title || price === null || seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(createMarketplaceResult({
      platform,
      title,
      price,
      url,
      fetchedAt: searchedAt
    }));
  }

  return results;
}

function cleanText(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function toPrice(value) {
  const price = Number.parseInt(String(value).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(price) ? price : null;
}

function imageUrl(product) {
  const path = product.picS || product.picB || product.pic;
  if (!path) {
    return null;
  }

  if (String(path).startsWith("http")) {
    return path;
  }

  return `https://cs-a.ecimg.tw${path}`;
}

function fetchWithBrowserHeaders(fetchImpl, url, accept) {
  return fetchImpl(url, {
    headers: {
      "accept": accept,
      "accept-language": "zh-TW,zh;q=0.9,en;q=0.7",
      "cache-control": "no-cache",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 LegoSearch/0.2"
    }
  });
}

function absoluteUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function stripTags(value) {
  return decodeEntities(String(value))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeEntities(value) {
  return String(value)
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
