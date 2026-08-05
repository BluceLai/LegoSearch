import {
  createMarketplaceEdgeContext,
  scheduleMarketplaceBrowserWork
} from "./marketplace-edge.mjs";

export function createOfficialLegoPriceBrowserFetcher({
  createContext = createMarketplaceEdgeContext,
  schedule = null
} = {}) {
  return async function fetchProductPages(urls) {
    const scheduleWork = schedule || ((work) => scheduleMarketplaceBrowserWork("official-lego-browser-profile", work));

    return scheduleWork(async () => {
      const context = await createContext({ profileName: "official-lego-browser-profile" });
      const pages = new Map();

      try {
        const renderedPages = await Promise.all(urls.map(async (url) => {
          const page = await context.newPage();
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
          if (typeof page.waitForTimeout === "function") {
            await page.waitForTimeout(1200);
          }
          const text = await page.evaluate(() => (
            document.querySelector('[data-test="product-price-display-price"]')?.textContent?.trim()
            || document.body?.innerText
            || ""
          ));
          await page.close?.();
          return [url, text];
        }));
        renderedPages.forEach(([url, text]) => pages.set(url, text));

        return pages;
      } finally {
        await context.close();
      }
    });
  };
}
