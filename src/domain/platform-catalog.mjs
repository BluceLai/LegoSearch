const platformDefinitions = [
  {
    id: "iopen",
    name: "iOPEN Mall",
    homepage: "https://mall.iopenmall.tw",
    searchPath: "/iopen/index.php",
    searchParam: "prod_keyword",
    fixedParams: { action: "store_product_search" }
  },
  {
    id: "momo",
    name: "MOMO",
    homepage: "https://www.momoshop.com.tw",
    searchPath: "/search/searchShop.jsp",
    searchParam: "keyword",
    fixedParams: { searchType: "1" }
  },
  {
    id: "pchome",
    name: "PChome",
    homepage: "https://24h.pchome.com.tw",
    searchPath: "/search/",
    searchParam: "q"
  },
  {
    id: "coupang",
    name: "\u9177\u6f8e",
    homepage: "https://www.tw.coupang.com",
    searchPath: "/search",
    searchParam: "q"
  }
];

export function listPlatforms() {
  return platformDefinitions.map(toPublicPlatform);
}

export function listPlatformIds() {
  return platformDefinitions.map((platform) => platform.id);
}

export function getPlatform(id) {
  const platform = platformDefinitions.find((item) => item.id === id);
  if (!platform) {
    throw new Error(`Unknown platform: ${id}`);
  }

  return toPublicPlatform(platform);
}

function toPublicPlatform(platform) {
  return {
    id: platform.id,
    name: platform.name,
    homepage: platform.homepage,
    buildSearchUrl: (keyword) => buildSearchUrl(platform, keyword)
  };
}

function buildSearchUrl(platform, keyword) {
  const url = new URL(platform.searchPath, platform.homepage);
  url.searchParams.set(platform.searchParam, keyword);

  for (const [key, value] of Object.entries(platform.fixedParams || {})) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}
