import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export function createPriceHistoryRepository({
  filePath,
  now = () => new Date(),
  timeZone = "Asia/Taipei"
}) {
  let pending = Promise.resolve();

  return {
    async record(search) {
      const snapshot = createDailySnapshot(search, now(), timeZone);
      if (!snapshot) {
        return;
      }

      const write = pending.then(async () => {
        const entries = await readEntries(filePath);
        const index = entries.findIndex((entry) => (
          entry.setNumber === snapshot.setNumber && entry.date === snapshot.date
        ));

        if (index >= 0) {
          entries[index] = snapshot;
        } else {
          entries.push(snapshot);
        }

        await writeEntries(filePath, entries);
      });

      pending = write.catch(() => {});
      return write;
    },

    async list() {
      await pending;
      const entries = await readEntries(filePath);
      return groupBySet(entries);
    }
  };
}

function createDailySnapshot(search, searchedAt, timeZone) {
  const setNumber = String(search?.query || "").match(/\b(\d{4,6})\b/)?.[1];
  const platforms = summarizePlatforms(search?.results || []);

  if (!setNumber || !platforms.length) {
    return null;
  }

  return {
    setNumber,
    query: search.query,
    date: formatDate(searchedAt, timeZone),
    searchedAt: searchedAt.toISOString(),
    platforms
  };
}

function summarizePlatforms(results) {
  const pricesByPlatform = new Map();

  for (const result of results) {
    if (!Number.isFinite(result.price)) {
      continue;
    }

    const existing = pricesByPlatform.get(result.platformId) || {
      platformId: result.platformId,
      platformName: result.platformName,
      prices: []
    };
    existing.prices.push(result.price);
    pricesByPlatform.set(result.platformId, existing);
  }

  return [...pricesByPlatform.values()].map((platform) => ({
    platformId: platform.platformId,
    platformName: platform.platformName,
    lowestPrice: Math.min(...platform.prices),
    highestPrice: Math.max(...platform.prices)
  }));
}

async function readEntries(filePath) {
  try {
    const data = JSON.parse(await readFile(filePath, "utf8"));
    return Array.isArray(data.entries) ? data.entries : [];
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) {
      return [];
    }

    throw error;
  }
}

async function writeEntries(filePath, entries) {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify({ entries }, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

function groupBySet(entries) {
  const bySet = new Map();

  for (const entry of entries) {
    const group = bySet.get(entry.setNumber) || {
      setNumber: entry.setNumber,
      query: entry.query,
      dates: []
    };
    group.dates.push({
      date: entry.date,
      searchedAt: entry.searchedAt,
      platforms: entry.platforms
    });
    bySet.set(entry.setNumber, group);
  }

  return [...bySet.values()]
    .map((group) => ({
      ...group,
      dates: group.dates.sort((left, right) => right.date.localeCompare(left.date))
    }))
    .sort((left, right) => right.dates[0].date.localeCompare(left.dates[0].date));
}

function formatDate(value, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}
