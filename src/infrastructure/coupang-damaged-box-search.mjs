import { getPlatform } from "../domain/platform-catalog.mjs";
import {
  createMarketplaceEdgeContext,
  scheduleMarketplaceBrowserWork
} from "./marketplace-edge.mjs";
import { absoluteMarketplaceUrl } from "./marketplace-url.mjs";

const coupangProfileName = "coupang-browser-profile";

export function createCoupangDamagedBoxSearcher({
  createContext = createMarketplaceEdgeContext,
  schedule = (work) => scheduleMarketplaceBrowserWork(coupangProfileName, work)
} = {}) {
  return async function searchCoupangDamagedBox({ query, includeImages = false }) {
    return schedule(async () => {
      const context = await createContext({
        profileName: coupangProfileName,
        headless: true
      });

      try {
        const page = await context.newPage();
        const platform = getPlatform("coupang");
        if (!includeImages) {
          await page.route("**/*", (route) => route.request().resourceType() === "image"
            ? route.abort()
            : route.continue());
        }
        await page.goto(platform.buildSearchUrl(createDamagedBoxQuery(query)), {
          waitUntil: "domcontentloaded",
          timeout: 45_000
        });

        try {
          await page.waitForSelector('a[href*="/products/"]', { timeout: 30_000 });
        } catch {
          throw new Error("\u9177\u6f8e\u76d2\u640d\u641c\u5c0b\u7121\u6cd5\u53d6\u5f97\u53ef\u89e3\u6790\u5546\u54c1\u3002");
        }

        return (await page.evaluate(extractCoupangDamagedBoxProducts))
          .map((product) => ({
            ...product,
            imageUrl: includeImages ? product.imageUrl : null,
            url: absoluteMarketplaceUrl(product.url, platform.homepage)
          }));
      } finally {
        await context.close();
      }
    });
  };
}

function createDamagedBoxQuery(value) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  const terms = normalized ? normalized.split(" ") : [];

  if (!terms.some((term) => term.toLowerCase() === "lego")) {
    terms.unshift("LEGO");
  }
  if (!terms.includes("\u76d2\u640d")) {
    terms.push("\u76d2\u640d");
  }

  return terms.join(" ");
}

function extractCoupangDamagedBoxProducts() {
  const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const toPrice = (value) => {
    const price = Number.parseInt(String(value || "").replace(/[^\d]/g, ""), 10);
    return Number.isFinite(price) ? price : null;
  };
  const seen = new Set();

  return [...document.querySelectorAll('a[href*="/products/"]')].map((link) => {
    const text = cleanText(link.innerText || link.textContent);
    const image = link.querySelector("img");
    const title = cleanText(image?.alt || link.getAttribute("aria-label") || text);
    const url = link.getAttribute("href") || "";
    const priceMatch = text.match(/(?:\u9996\u8cfc\u6298\u6263\u50f9|\u6298\u6263\u5f8c\u50f9\u683c|\u4fc3\u92b7\u50f9|\u7279\u50f9|\u552e\u50f9|\u50f9\u683c)\s*\$?\s*([0-9][0-9,]*)(?:\s+\d+(?:\u6298|%)\s*\$?\s*([0-9][0-9,]*))?/);
    const damagedMatch = text.match(/\u76d2\u640d(?:\u798f\u5229\u54c1)?[\s\S]{0,80}?\$\s*([0-9][0-9,]*)/);
    const quantityMatch = text.match(/(?:\u50c5\u5269|\u5269\u9918)\s*(\d+)\s*\u4ef6/);
    const normalPrice = toPrice(priceMatch?.[2] || priceMatch?.[1]);
    const damagedPrice = toPrice(damagedMatch?.[1]);
    const listPrice = priceMatch?.[2] ? toPrice(priceMatch[1]) : null;
    const key = title + ":" + url;

    if (!title || !url || normalPrice === null || damagedPrice === null || seen.has(key)) {
      return null;
    }

    seen.add(key);
    return {
      title,
      normalPrice,
      damagedPrice,
      damagedQuantity: quantityMatch ? Number.parseInt(quantityMatch[1], 10) : null,
      listPrice,
      url,
      imageUrl: image?.currentSrc || image?.src || null
    };
  }).filter(Boolean);
}
