export function organizeResults({ results, platformIds, sort, officialReferenceTwd = null }) {
  const groups = new Map();

  for (const result of results) {
    const existing = groups.get(result.platformId) || {
      platformId: result.platformId,
      platformName: result.platformName,
      results: []
    };
    existing.results.push(result);
    groups.set(result.platformId, existing);
  }

  const preferredOrder = new Map(platformIds.map((platformId, index) => [platformId, index]));

  return [...groups.values()]
    .map((group) => {
      const sortedResults = sortResults(group.results, sort);

      return {
        ...group,
        results: sortedResults,
        lowestResult: findLowestPricedResult(sortedResults, officialReferenceTwd)
      };
    })
    .sort((left, right) => {
      if (sort === "platform") {
        return left.platformName.localeCompare(right.platformName, "zh-Hant");
      }

      return (preferredOrder.get(left.platformId) ?? Number.MAX_SAFE_INTEGER)
        - (preferredOrder.get(right.platformId) ?? Number.MAX_SAFE_INTEGER);
    });
}

function findLowestPricedResult(results, officialReferenceTwd) {
  const minimumEligiblePrice = Number.isFinite(officialReferenceTwd)
    ? officialReferenceTwd * 0.3
    : null;

  return results.reduce((lowest, result) => {
    if (result.price === null
      || (minimumEligiblePrice !== null && result.price < minimumEligiblePrice)
      || (lowest && lowest.price <= result.price)) {
      return lowest;
    }

    return result;
  }, null);
}

function sortResults(results, sort) {
  return [...results].sort((left, right) => {
    if (left.price === null && right.price === null) return 0;
    if (left.price === null) return 1;
    if (right.price === null) return -1;

    return sort === "price-desc" ? right.price - left.price : left.price - right.price;
  });
}
