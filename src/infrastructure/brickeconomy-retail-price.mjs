import {
  createMarketplaceEdgeContext,
  scheduleMarketplaceBrowserWork
} from "./marketplace-edge.mjs";

const homepage = "https://www.brickeconomy.com/";

export function createBrickEconomyRetailPriceResolver({
  createContext = createMarketplaceEdgeContext,
  schedule = null
} = {}) {
  return async function resolveRetailPrice(setNumber) {
    if (!/^\d{4,6}$/.test(setNumber)) {
      return null;
    }

    const scheduleWork = schedule || ((work) => scheduleMarketplaceBrowserWork("brickeconomy-browser-profile", work));

    try {
      return await scheduleWork(async () => {
        const context = await createContext({ profileName: "brickeconomy-browser-profile" });

        try {
          const page = await context.newPage();
          await page.goto(`https://www.brickeconomy.com/search?query=${encodeURIComponent(setNumber)}`, {
            waitUntil: "domcontentloaded",
            timeout: 45_000
          });
          await page.waitForTimeout?.(1200);
          const result = await page.evaluate(extractRetailPrice, setNumber);
          await page.close?.();

          if (!result || result.challenge || !Number.isFinite(result.amount) || !result.href) {
            return null;
          }

          return {
            amount: result.amount,
            currency: "USD",
            source: "brickeconomy",
            url: new URL(result.href, homepage).toString()
          };
        } finally {
          await context.close();
        }
      });
    } catch {
      return null;
    }
  };
}

function extractRetailPrice(setNumber) {
  const pageText = `${document.title || ""} ${document.body?.innerText || ""}`;
  if (/just a moment|verify you are human|enable javascript and cookies/i.test(pageText)) {
    return { challenge: true };
  }

  const link = document.querySelector(`a[href^="/set/${setNumber}-1/"]`);
  const cardText = link?.closest("tr")?.innerText || "";
  const retail = cardText.match(/\bRetail\s*\$\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i)?.[1];
  const amount = Number(retail?.replace(/,/g, ""));

  return Number.isFinite(amount) ? {
    amount,
    href: link.getAttribute("href")
  } : null;
}
