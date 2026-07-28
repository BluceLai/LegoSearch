import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "data", "cache.sqlite");

mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS search_cache (
    cache_key TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

const getStatement = db.prepare(`
  SELECT payload, created_at
  FROM search_cache
  WHERE cache_key = ?
`);

const setStatement = db.prepare(`
  INSERT INTO search_cache (cache_key, payload, created_at)
  VALUES (?, ?, ?)
  ON CONFLICT(cache_key) DO UPDATE SET
    payload = excluded.payload,
    created_at = excluded.created_at
`);

export function readCache(cacheKey, ttlMs) {
  const row = getStatement.get(cacheKey);
  if (!row) {
    return null;
  }

  const ageMs = Date.now() - Number(row.created_at);
  if (ageMs > ttlMs) {
    return null;
  }

  return {
    payload: JSON.parse(row.payload),
    createdAt: Number(row.created_at),
    ageMs
  };
}

export function writeCache(cacheKey, payload) {
  setStatement.run(cacheKey, JSON.stringify(payload), Date.now());
}
