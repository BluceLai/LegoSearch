import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { listPlatforms } from "../domain/platform-catalog.mjs";
import { ValidationError } from "../domain/errors.mjs";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

export function createRequestHandler({ aggregator, publicDir }) {
  return async function requestHandler(request, response) {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    try {
      if (url.pathname === "/api/platforms") {
        sendJson(response, 200, {
          platforms: listPlatforms().map(({ id, name, homepage }) => ({ id, name, homepage }))
        });
        return;
      }

      if (url.pathname === "/api/search") {
        const payload = await aggregator.search({
          text: url.searchParams.get("q") || "",
          platforms: url.searchParams.get("platforms") || undefined
        });
        sendJson(response, 200, payload);
        return;
      }

      await serveStatic({ url, response, publicDir });
    } catch (error) {
      sendJson(response, error instanceof ValidationError ? error.statusCode : 500, {
        error: error.message
      });
    }
  };
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

async function serveStatic({ url, response, publicDir }) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const root = normalize(publicDir instanceof URL ? fileURLToPath(publicDir) : publicDir);
  const filePath = normalize(join(root, pathname));

  if (!filePath.startsWith(root)) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
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
