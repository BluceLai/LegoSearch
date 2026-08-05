export function organizeResults({ results, platformIds, sort }) {
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
    .map((group) => ({ ...group, results: sortResults(group.results, sort) }))
    .sort((left, right) => {
      if (sort === "platform") {
        return left.platformName.localeCompare(right.platformName, "zh-Hant");
      }

      return (preferredOrder.get(left.platformId) ?? Number.MAX_SAFE_INTEGER)
        - (preferredOrder.get(right.platformId) ?? Number.MAX_SAFE_INTEGER);
    });
}

function sortResults(results, sort) {
  return [...results].sort((left, right) => {
    if (left.price === null && right.price === null) return 0;
    if (left.price === null) return 1;
    if (right.price === null) return -1;

    return sort === "price-desc" ? right.price - left.price : left.price - right.price;
  });
}
