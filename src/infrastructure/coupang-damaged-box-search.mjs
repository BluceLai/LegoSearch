import { getPlatform } from "../domain/platform-catalog.mjs";
import {
  createMarketplaceEdgeContext,
  scheduleMarketplaceBrowserWork
} from "./marketplace-edge.mjs";
import { absoluteMarketplaceUrl } from "./marketplace-url.mjs";

const coupangProfileName = "coupang-damaged-box-browser-profile-v2";
const candidateLimit = 60;

export function createCoupangDamagedBoxSearcher({
  createContext = createMarketplaceEdgeContext,
  schedule = (work) => scheduleMarketplaceBrowserWork(coupangProfileName, work)
} = {}) {
  return async function searchCoupangDamagedBox({ query, includeImages = false }) {
    return schedule(async () => {
      const context = await createContext({
        profileName: coupangProfileName,
        headless: false
      });

      try {
        const platform = getPlatform("coupang");
        const candidates = (await findCandidates({
          context,
          searchUrl: platform.buildSearchUrl(createDamagedBoxQuery(query)),
          includeImages
        })).map((candidate) => ({
          ...candidate,
          url: absoluteMarketplaceUrl(candidate.url, platform.homepage)
        }));
        const results = [];

        for (const candidate of selectCandidates(candidates, query).slice(0, candidateLimit)) {
          const offer = await findDamagedBoxOffer({
            context,
            candidate,
            includeImages
          });

          if (offer) {
            results.push(offer);
          }
        }

        return results;
      } finally {
        await context.close();
      }
    });
  };
}

async function findCandidates({ context, searchUrl, includeImages }) {
  const page = await context.newPage();

  try {
    await configurePage(page, includeImages);
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45_000
    });

    try {
      await page.waitForSelector('a[href*="/products/"]', { timeout: 30_000 });
    } catch {
      throw new Error("\u9177\u6f8e\u76d2\u640d\u641c\u5c0b\u7121\u6cd5\u53d6\u5f97\u5019\u9078\u5546\u54c1\u3002");
    }

    return await page.evaluate(extractCoupangCandidates);
  } finally {
    await page.close();
  }
}

async function findDamagedBoxOffer({ context, candidate, includeImages }) {
  let detailPage;
  try {
    const directOfferUrl = createOfferListUrl(candidate.url);
    if (directOfferUrl) {
      return await readDamagedBoxOffer({
        context,
        candidate,
        includeImages,
        offerUrl: directOfferUrl
      });
    }

    detailPage = await context.newPage();
    await configurePage(detailPage, includeImages);
    await detailPage.goto(candidate.url, {
      waitUntil: "domcontentloaded",
      timeout: 30_000
    });
    await waitForOfferListLink(detailPage);
    const offerPath = await detailPage.evaluate(extractOfferListPath);

    if (!offerPath) {
      return null;
    }

    return await readDamagedBoxOffer({
      context,
      candidate,
      includeImages,
      offerUrl: absoluteMarketplaceUrl(offerPath, candidate.url)
    });
  } catch {
    return null;
  } finally {
    await detailPage?.close();
  }
}

async function readDamagedBoxOffer({ context, candidate, includeImages, offerUrl }) {
  const offerPage = await context.newPage();

  try {
    await configurePage(offerPage, includeImages);
    await offerPage.goto(offerUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000
    });
    await waitForOfferRows(offerPage);
    const prices = await offerPage.evaluate(extractDamagedOfferPrices);

    return prices ? {
      title: candidate.title,
      ...prices,
      url: candidate.url,
      imageUrl: includeImages ? candidate.imageUrl : null
    } : null;
  } finally {
    await offerPage.close();
  }
}

async function configurePage(page, includeImages) {
  if (!includeImages) {
    await page.route("**/*", (route) => route.request().resourceType() === "image"
      ? route.abort()
      : route.continue());
  }
}

async function waitForOfferListLink(page) {
  if (typeof page.waitForFunction !== "function") {
    return;
  }

  try {
    await page.waitForFunction(
      () => Boolean(document.querySelector('a[href*="/offerList"]')),
      undefined,
      { timeout: 10_000 }
    );
  } catch {}
}

async function waitForOfferRows(page) {
  if (typeof page.waitForFunction !== "function") {
    return;
  }

  try {
    await page.waitForFunction(
      () => {
        const text = document.body?.innerText || "";
        return text.includes("盒損福利品") && text.includes("當前商品");
      },
      undefined,
      { timeout: 10_000 }
    );
  } catch {}
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

function createOfferListUrl(candidateUrl) {
  const url = new URL(candidateUrl);
  const productId = url.pathname.match(/-(\d+)$/)?.[1];
  const itemId = url.searchParams.get("itemId");
  const vendorItemId = url.searchParams.get("vendorItemId");

  if (!productId || !itemId || !vendorItemId) {
    return null;
  }

  const offerUrl = new URL("/products/" + productId + "/item/" + itemId + "/offerList", url.origin);
  offerUrl.searchParams.set("vendorItemId", vendorItemId);
  offerUrl.searchParams.set("totalCount", "2");
  return offerUrl.toString();
}

function selectCandidates(candidates, query) {
  const modelNumber = String(query || "").match(/\b\d{4,}\b/)?.[0];

  return modelNumber
    ? candidates.filter((candidate) => candidate.title.includes(modelNumber))
    : candidates;
}

function extractCoupangCandidates() {
  const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const seen = new Set();

  return [...document.querySelectorAll('a[href*="/products/"]')].map((link) => {
    const image = link.querySelector("img");
    const title = cleanText(image?.alt || link.getAttribute("aria-label") || link.textContent);
    const url = link.getAttribute("href") || "";
    const key = title + ":" + url;

    if (!title || !url || seen.has(key)) {
      return null;
    }

    seen.add(key);
    return {
      title,
      url,
      imageUrl: image?.currentSrc || image?.src || null
    };
  }).filter(Boolean);
}

function extractOfferListPath() {
  const link = [...document.querySelectorAll('a[href*="/offerList"]')]
    .find((item) => item.textContent.includes("\u5176\u4ed6"));
  return link?.getAttribute("href") || null;
}

function extractDamagedOfferPrices() {
  const toPrice = (value) => {
    const price = Number.parseInt(String(value || "").replace(/[^\d]/g, ""), 10);
    return Number.isFinite(price) ? price : null;
  };
  const text = String(document.body?.innerText || "").replace(/\s+/g, " ").trim();
  const damagedRows = [...text.matchAll(/(?:\d+)%\s*\$([0-9][0-9,]*)\s*\$([0-9][0-9,]*)\s*\$([0-9][0-9,]*)[\s\S]{0,240}?\u76d2\u640d\u798f\u5229\u54c1/g)];
  const normalRows = [...text.matchAll(/(?:\d+)%\s*\$([0-9][0-9,]*)\s*\$([0-9][0-9,]*)\s*\$([0-9][0-9,]*)(?:(?!\u76d2\u640d\u798f\u5229\u54c1)[\s\S]){0,240}?\u7576\u524d\u5546\u54c1/g)];
  const damagedRow = damagedRows.at(-1);
  const normalRow = normalRows.at(-1);

  if (!damagedRow || !normalRow) {
    return null;
  }

  return {
    normalPrice: toPrice(normalRow[3]),
    damagedPrice: toPrice(damagedRow[2]),
    damagedQuantity: null,
    listPrice: toPrice(damagedRow[1])
  };
}
