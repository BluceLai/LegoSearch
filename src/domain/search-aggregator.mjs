import { getPlatform } from "./platform-catalog.mjs";
import { parseSearchQuery } from "./search-query.mjs";
import { createSearchLinkResult } from "./search-result.mjs";

export function createSearchAggregator({ clients, now = () => new Date() }) {
  return {
    async search(input) {
      const query = parseSearchQuery(input);
      const searchedAt = now().toISOString();
      const settled = await Promise.all(
        query.platformIds.map((platformId) => searchOnePlatform({ platformId, query, clients, searchedAt }))
      );

      return {
        query: query.text,
        platformIds: query.platformIds,
        searchedAt,
        results: settled.flatMap((item) => item.results).sort(compareResults),
        errors: settled.flatMap((item) => item.error ? [item.error] : [])
      };
    }
  };
}

async function searchOnePlatform({ platformId, query, clients, searchedAt }) {
  const platform = getPlatform(platformId);
  const client = clients[platformId];

  try {
    const results = client
      ? await client({ query: query.text, platform, searchedAt })
      : [];

    if (results.length) {
      return { results, error: null };
    }

    return {
      results: [createSearchLinkResult({
        platform,
        query: query.text,
        fetchedAt: searchedAt,
        notice: "No parsable marketplace results."
      })],
      error: null
    };
  } catch (error) {
    return {
      results: [createSearchLinkResult({
        platform,
        query: query.text,
        fetchedAt: searchedAt,
        notice: error.message
      })],
      error: {
        platformId: platform.id,
        platformName: platform.name,
        message: error.message
      }
    };
  }
}

function compareResults(a, b) {
  if (a.price === null && b.price === null) {
    return a.platformName.localeCompare(b.platformName, "zh-Hant");
  }

  if (a.price === null) {
    return 1;
  }

  if (b.price === null) {
    return -1;
  }

  return a.price - b.price;
}
