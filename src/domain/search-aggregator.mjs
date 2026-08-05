import { getPlatform } from "./platform-catalog.mjs";
import { parseSearchQuery } from "./search-query.mjs";
import { createSearchLinkResult } from "./search-result.mjs";

const accessoryIndicators = [
  /\bled\b/i,
  /\u71c8\u7d44/,
  /\u5c55\u793a\u76d2/,
  /\u58d3\u514b\u529b/,
  /\u8aaa\u660e\u66f8/,
  /\u6563\u4ef6/,
  /\u66ff\u63db\u96f6\u4ef6/,
  /\b(?:instruction|manual|display case)\b/i
];

export function createSearchAggregator({
  clients,
  resolveLegoSet = async () => null,
  now = () => new Date()
}) {
  return {
    async search(input) {
      const query = parseSearchQuery(input);
      const searchedAt = now().toISOString();
      const modelNumbers = findModelNumbers(query.text);
      const marketplaceSearches = Promise.all(
        query.platformIds.map((platformId) => searchOnePlatform({
          platformId,
          query,
          clients,
          searchedAt
        }))
      );
      const legoSet = await resolveOfficialLegoSet(modelNumbers[0], resolveLegoSet);
      const settled = await marketplaceSearches;
      const expandedResults = await searchOfficialSetNames({
        settled,
        legoSet,
        modelNumbers,
        clients,
        searchedAt
      });

      return {
        query: query.text,
        platformIds: query.platformIds,
        searchedAt,
        officialPrices: legoSet?.officialPrices || [],
        officialReferenceTwd: legoSet?.officialReferenceTwd ?? null,
        results: settled
          .flatMap((item) => filterPlatformResults({
            ...item,
            results: [...item.results, ...(expandedResults.get(item.platform.id) || [])]
          }, modelNumbers, legoSet))
          .sort(compareResults),
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
      return { platform, query, searchedAt, results, error: null };
    }

    return {
      platform,
      query,
      searchedAt,
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
      platform,
      query,
      searchedAt,
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

function filterPlatformResults({ platform, query, searchedAt, results }, modelNumbers, legoSet) {
  const matchingResults = filterModelMatches(results, modelNumbers, legoSet);

  if (matchingResults.length) {
    return uniqueResults(matchingResults);
  }

  return [createSearchLinkResult({
    platform,
    query: query.text,
    fetchedAt: searchedAt,
    notice: "No exact model match in parsed results."
  })];
}

async function searchOfficialSetNames({ settled, legoSet, modelNumbers, clients, searchedAt }) {
  const names = Array.isArray(legoSet?.names) ? legoSet.names : [];
  if (!names.length) {
    return new Map();
  }

  const platformsToExpand = settled.filter((item) => {
    const client = clients[item.platform.id];
    const hasExactMatch = filterModelMatches(item.results, modelNumbers, legoSet)
      .some((result) => result.source !== "search-link");
    return client && !item.error && !hasExactMatch;
  });

  const searches = await Promise.all(platformsToExpand.flatMap((item) => names.map(async (name) => {
    try {
      const results = await clients[item.platform.id]({
        query: `LEGO ${name}`,
        platform: item.platform,
        searchedAt
      });
      return { platformId: item.platform.id, results };
    } catch {
      return { platformId: item.platform.id, results: [] };
    }
  })));

  return searches.reduce((byPlatform, search) => {
    byPlatform.set(search.platformId, [
      ...(byPlatform.get(search.platformId) || []),
      ...search.results
    ]);
    return byPlatform;
  }, new Map());
}

async function resolveOfficialLegoSet(setNumber, resolveLegoSet) {
  if (!setNumber) {
    return null;
  }

  try {
    return await resolveLegoSet(setNumber);
  } catch {
    return null;
  }
}

function filterModelMatches(results, modelNumbers, legoSet) {
  if (!modelNumbers.length) {
    return results;
  }

  return results.filter((result) => {
    if (result.source === "search-link") {
      return true;
    }

    if (hasAccessoryIndicator(result.title)) {
      return false;
    }

    return modelNumbers.some((modelNumber) => hasExactModelNumber(result.title, modelNumber))
      || hasOfficialSetName(result.title, legoSet?.names);
  });
}

function findModelNumbers(queryText) {
  return queryText.match(/\d{4,6}/g) || [];
}

function hasExactModelNumber(title, modelNumber) {
  const pattern = new RegExp(`(^|[^A-Za-z0-9])${modelNumber}(?![A-Za-z0-9])`, "i");
  return pattern.test(title);
}

function hasOfficialSetName(title, names) {
  const normalizedTitle = normalizeName(title);

  return Array.isArray(names) && names.some((name) => {
    const normalizedName = normalizeName(name);
    return normalizedName.length >= 5 && normalizedTitle.includes(normalizedName);
  });
}

function normalizeName(value) {
  return String(value || "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function hasAccessoryIndicator(title) {
  return accessoryIndicators.some((indicator) => indicator.test(title));
}

function uniqueResults(results) {
  const seen = new Set();

  return results.filter((result) => {
    const key = `${result.platformId}:${result.source}:${result.url}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
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
