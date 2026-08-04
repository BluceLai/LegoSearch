export function createMarketplaceResult({
  platform,
  title,
  price,
  url,
  imageUrl = null,
  currency = "TWD",
  source = "marketplace",
  fetchedAt,
  notice
}) {
  return {
    platformId: platform.id,
    platformName: platform.name,
    title,
    price,
    currency,
    url,
    imageUrl,
    source,
    notice,
    fetchedAt
  };
}

export function createSearchLinkResult({ platform, query, fetchedAt, notice }) {
  return createMarketplaceResult({
    platform,
    title: `\u524d\u5f80 ${platform.name} \u641c\u5c0b\u300c${query}\u300d`,
    price: null,
    url: platform.buildSearchUrl(query),
    source: "search-link",
    fetchedAt,
    notice
  });
}
