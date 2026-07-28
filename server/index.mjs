import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { readCache, writeCache } from "./cache.mjs";
import { platformSummaries, platforms, searchPlatform } from "./platforms.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const port = Number(process.env.PORT || 5178);
const cacheTtlMs = Number(process.env.CACHE_TTL_MS || 30 * 60 * 1000);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload, null, 2));
}

async function serveStatic(requestUrl, response) {
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = normalize(join(publicDir, pathname));

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-cache"
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

function selectedPlatforms(platformParam) {
  if (!platformParam) {
    return platforms;
  }

  const requested = new Set(platformParam.split(",").map((item) => item.trim()).filter(Boolean));
  return platforms.filter((platform) => requested.has(platform.id));
}

async function handleSearch(requestUrl, response) {
  const query = (requestUrl.searchParams.get("q") || "").trim();
  const refresh = requestUrl.searchParams.get("refresh") === "1";
  const selected = selectedPlatforms(requestUrl.searchParams.get("platforms"));

  if (!query) {
    sendJson(response, 400, { error: "請輸入搜尋關鍵字。" });
    return;
  }

  if (!selected.length) {
    sendJson(response, 400, { error: "沒有符合的平台。" });
    return;
  }

  const cacheKey = JSON.stringify({
    query: query.toLowerCase(),
    platforms: selected.map((platform) => platform.id).sort()
  });

  if (!refresh) {
    const cached = readCache(cacheKey, cacheTtlMs);
    if (cached) {
      sendJson(response, 200, {
        ...cached.payload,
        cached: true,
        cacheAgeSeconds: Math.round(cached.ageMs / 1000),
        expiresAt: new Date(cached.createdAt + cacheTtlMs).toISOString()
      });
      return;
    }
  }

  const settled = await Promise.all(selected.map((platform) => searchPlatform(platform, query)));
  const errors = settled.flatMap((entry) => entry.error ? [entry.error] : []);
  const results = settled
    .flatMap((entry) => entry.results)
    .sort((a, b) => {
      if (a.price === null && b.price === null) return a.platform.localeCompare(b.platform, "zh-Hant");
      if (a.price === null) return 1;
      if (b.price === null) return -1;
      return a.price - b.price;
    });

  const payload = {
    query,
    cached: false,
    fetchedAt: new Date().toISOString(),
    platforms: selected.map((platform) => platform.id),
    results,
    errors
  };

  writeCache(cacheKey, payload);
  sendJson(response, 200, payload);
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  try {
    if (requestUrl.pathname === "/api/platforms") {
      sendJson(response, 200, { platforms: platformSummaries() });
      return;
    }

    if (requestUrl.pathname === "/api/search") {
      await handleSearch(requestUrl, response);
      return;
    }

    await serveStatic(requestUrl, response);
  } catch (error) {
    sendJson(response, 500, {
      error: "伺服器發生錯誤。",
      detail: error.message
    });
  }
});

server.listen(port, () => {
  console.log(`LegoSearch is running at http://localhost:${port}`);
});
