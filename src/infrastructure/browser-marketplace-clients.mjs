import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createMarketplaceResult } from "../domain/search-result.mjs";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const browserProfileDir = join(projectRoot, "data", "marketplace-browser-profile");
const edgeCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];

export function createBrowserMarketplaceClients({ createContext = createEdgeContext } = {}) {
  const schedule = createBrowserSearchQueue();

  return {
    iopen: createBrowserClient("iopen", createContext, schedule),
    coupang: createBrowserClient("coupang", createContext, schedule)
  };
}

function createBrowserClient(platformId, createContext, schedule) {
  return async function searchWithBrowser({ query, platform, searchedAt }) {
    return schedule(async () => {
      const context = await createContext();

      try {
        const page = await context.newPage();
        await page.goto(platform.buildSearchUrl(query), {
          waitUntil: "domcontentloaded",
          timeout: 45_000
        });
        if (platformId === "iopen"
          && typeof page.url === "function"
          && page.url().includes("validate.perfdrive.com")) {
          throw new Error("iOPEN Mall\u76ee\u524d\u8981\u6c42\u5e73\u53f0\u9a57\u8b49\uff0c\u5df2\u4fdd\u7559\u641c\u5c0b\u9023\u7d50\u3002");
        }
        try {
          await page.waitForSelector(productLinkSelector(platformId), { timeout: 30_000 });
        } catch {
          throw new Error(`${platform.name}\u7121\u6cd5\u53d6\u5f97\u53ef\u89e3\u6790\u5546\u54c1\u3002`);
        }
        const products = await page.evaluate(extractVisibleProducts, { platformId });

        return products.map((product) => createMarketplaceResult({
          platform,
          ...product,
          url: absoluteUrl(product.url, platform.homepage),
          source: "browser",
          fetchedAt: searchedAt
        })).filter((product) => product.title && product.price !== null);
      } finally {
        await context.close();
      }
    });
  };
}

function createBrowserSearchQueue() {
  let pending = Promise.resolve();

  return function schedule(work) {
    const search = pending.then(work, work);
    pending = search.catch(() => {});
    return search;
  };
}

async function createEdgeContext() {
  await mkdir(browserProfileDir, { recursive: true });
  const { chromium } = await import("playwright-core");
  const executablePath = edgeCandidates.find((candidate) => existsSync(candidate));

  if (!executablePath) {
    throw new Error("\u627e\u4e0d\u5230 Microsoft Edge\uff0c\u7121\u6cd5\u4f7f\u7528\u700f\u89bd\u5668\u64f7\u53d6\u3002");
  }

  return chromium.launchPersistentContext(browserProfileDir, {
    executablePath,
    headless: false,
    args: ["--start-minimized", "--window-position=-32000,-32000"],
    viewport: { width: 1440, height: 1000 }
  });
}

function productLinkSelector(platformId) {
  if (platformId === "coupang") {
    return 'a[href*="/products/"]';
  }

  return 'ul.gh_SearchBox > li a[href*="action=product_detail"]';
}

function extractVisibleProducts({ platformId }) {
  const cleanText = (value) => String(value).replace(/\s+/g, " ").trim();
  const toPrice = (value) => {
    const price = Number.parseInt(String(value).replace(/[^\d]/g, ""), 10);
    return Number.isFinite(price) ? price : null;
  };
  const priceFromProductText = (text) => {
    const promotion = text.match(/(?:\u9996\u8cfc\u6298\u6263\u50f9|\u6298\u6263\u5f8c\u50f9|\u4fc3\u92b7\u50f9|\u7279\u50f9|\u552e\u50f9|\u50f9\u683c)\s*\$?\s*([0-9,]+)(?:\s+\d+%\s*\$?\s*([0-9,]+))?/);
    const value = promotion?.[2] || promotion?.[1];

    if (value) {
      return toPrice(value);
    }

    const prices = [...text.matchAll(/(?:NT\$|NT\s?\$|TWD|\$)\s*([0-9][0-9,]*)/gi)]
      .map((match) => toPrice(match[1]))
      .filter((price) => price !== null && price >= 50);
    return prices.at(-1) ?? null;
  };

  if (platformId === "iopen") {
    const seen = new Set();

    return [...document.querySelectorAll("ul.gh_SearchBox > li")].map((card) => {
      const image = card.querySelector('a[href*="action=product_detail"] img');
      const link = image?.closest("a") || card.querySelector('a[href*="action=product_detail"]');
      const title = cleanText(image?.alt || link?.textContent || "");
      const url = link?.getAttribute("href") || "";
      const key = `${title}:${url}`;
      const price = toPrice((card.innerText || "").match(/\$\s*([0-9][0-9,]*)/)?.[1]);

      if (!title || !url || price === null || seen.has(key)) {
        return null;
      }

      seen.add(key);
      return {
        title,
        price,
        url,
        imageUrl: image?.currentSrc || image?.src || null
      };
    }).filter(Boolean);
  }

  const links = [...document.querySelectorAll(platformId === "coupang"
    ? 'a[href*="/products/"]'
    : 'a[href*="/product/"]')];
  const seen = new Set();

  return links.map((link) => {
    const text = cleanText(link.innerText || link.textContent || "");
    const image = link.querySelector("img");
    const title = cleanText(image?.alt || link.getAttribute("aria-label") || text);
    const url = link.getAttribute("href") || "";
    const key = `${title}:${url}`;

    if (!title || !url || seen.has(key)) {
      return null;
    }

    seen.add(key);
    return {
      title,
      price: priceFromProductText(text),
      url,
      imageUrl: image?.currentSrc || image?.src || null
    };
  }).filter(Boolean);
}

function absoluteUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}
