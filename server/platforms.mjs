import { fallbackSearchResult, fetchText, normalizeUrl, parsePrice, productsFromJsonLd, stripHtml } from "./scrape.mjs";

const DEFAULT_LIMIT = 16;

function encoded(query) {
  return encodeURIComponent(query.trim());
}

async function searchPchome(platform, query) {
  const apiUrl = `https://ecshweb.pchome.com.tw/search/v3.3/all/results?q=${encoded(query)}&page=1&sort=sale/dc`;
  const text = await fetchText(apiUrl);
  const data = JSON.parse(text);
  const products = Array.isArray(data.prods) ? data.prods : [];

  return products.slice(0, DEFAULT_LIMIT).map((product) => {
    const imagePath = product.picS || product.picB || product.pic;
    const image = imagePath
      ? normalizeUrl(imagePath.startsWith("http") ? imagePath : `https://cs-a.ecimg.tw${imagePath}`, apiUrl)
      : null;

    return {
      platform: platform.name,
      platformId: platform.id,
      title: stripHtml(product.name || product.describe || ""),
      price: parsePrice(product.price),
      currency: "TWD",
      url: product.Id ? `https://24h.pchome.com.tw/prod/${product.Id}` : platform.searchUrl(query),
      image,
      seller: "PChome 24h",
      source: "api",
      fetchedAt: new Date().toISOString()
    };
  }).filter((item) => item.title);
}

async function searchShopee(platform, query) {
  const apiUrl = `https://shopee.tw/api/v4/search/search_items?by=relevancy&keyword=${encoded(query)}&limit=${DEFAULT_LIMIT}&newest=0&order=desc&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2`;
  const text = await fetchText(apiUrl);
  const data = JSON.parse(text);
  const items = Array.isArray(data.items) ? data.items : [];

  return items.map((entry) => {
    const item = entry.item_basic || entry;
    const price = parseShopeePrice(item.price_min ?? item.price);
    const historical = parseShopeePrice(item.price_before_discount);
    const image = item.image
      ? `https://down-tw.img.susercontent.com/file/${item.image}`
      : null;

    return {
      platform: platform.name,
      platformId: platform.id,
      title: stripHtml(item.name || ""),
      price,
      originalPrice: historical && historical !== price ? historical : null,
      currency: "TWD",
      url: item.shopid && item.itemid
        ? `https://shopee.tw/product/${item.shopid}/${item.itemid}`
        : platform.searchUrl(query),
      image,
      seller: stripHtml(item.shop_name || ""),
      source: "api",
      fetchedAt: new Date().toISOString()
    };
  }).filter((item) => item.title);
}

function parseShopeePrice(value) {
  const price = parsePrice(value);
  if (!price) {
    return null;
  }

  return price > 100000 ? Math.round(price / 100000) : price;
}

async function searchHtmlPlatform(platform, query) {
  const searchUrl = platform.searchUrl(query);
  const html = await fetchText(searchUrl);
  const jsonLdProducts = productsFromJsonLd(html, platform, searchUrl, DEFAULT_LIMIT);

  if (jsonLdProducts.length) {
    return jsonLdProducts;
  }

  return parseLooseProductText(html, platform, searchUrl).slice(0, DEFAULT_LIMIT);
}

function parseLooseProductText(html, platform, searchUrl) {
  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{20,1200}?)<\/a>/gi)];
  const products = [];
  const seen = new Set();

  for (const anchor of anchors) {
    const body = anchor[2];
    const text = stripHtml(body);
    const price = parsePrice(text.match(/(?:NT\$|NT|TWD|\$)\s*([0-9,]{2,8})/i)?.[1]);

    if (!price || text.length < 8) {
      continue;
    }

    const title = text.replace(/(?:NT\$|NT|TWD|\$)\s*[0-9,]+.*/i, "").trim();
    const url = normalizeUrl(anchor[1], searchUrl);
    const key = `${platform.id}:${title}:${price}`;

    if (!title || !url || seen.has(key)) {
      continue;
    }

    seen.add(key);
    products.push({
      platform: platform.name,
      platformId: platform.id,
      title,
      price,
      currency: "TWD",
      url,
      image: null,
      seller: "",
      source: "html",
      fetchedAt: new Date().toISOString()
    });
  }

  return products;
}

export const platforms = [
  {
    id: "shopee",
    name: "蝦皮",
    homepage: "https://shopee.tw",
    searchUrl: (query) => `https://shopee.tw/search?keyword=${encoded(query)}`,
    search: searchShopee
  },
  {
    id: "momo",
    name: "MOMO",
    homepage: "https://www.momoshop.com.tw",
    searchUrl: (query) => `https://www.momoshop.com.tw/search/searchShop.jsp?keyword=${encoded(query)}&searchType=1`,
    search: searchHtmlPlatform
  },
  {
    id: "pc-home",
    name: "PChome",
    homepage: "https://24h.pchome.com.tw",
    searchUrl: (query) => `https://24h.pchome.com.tw/search/?q=${encoded(query)}`,
    search: searchPchome
  },
  {
    id: "coupang",
    name: "酷澎",
    homepage: "https://www.tw.coupang.com",
    searchUrl: (query) => `https://www.tw.coupang.com/np/search?q=${encoded(query)}`,
    search: searchHtmlPlatform
  }
];

export function platformSummaries() {
  return platforms.map(({ id, name, homepage }) => ({ id, name, homepage }));
}

export async function searchPlatform(platform, query) {
  try {
    const results = await platform.search(platform, query);
    if (!results.length) {
      return {
        results: [fallbackSearchResult(platform, query, "找不到可解析的商品價格。")],
        error: null
      };
    }

    return { results, error: null };
  } catch (error) {
    return {
      results: [fallbackSearchResult(platform, query, error.message)],
      error: {
        platform: platform.name,
        platformId: platform.id,
        message: error.message
      }
    };
  }
}
