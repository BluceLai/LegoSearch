import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSearchAggregator } from "../domain/search-aggregator.mjs";
import { createBrowserMarketplaceClients } from "../infrastructure/browser-marketplace-clients.mjs";
import { createBrickEconomyRetailPriceResolver } from "../infrastructure/brickeconomy-retail-price.mjs";
import { createIopenVerificationLauncher } from "../infrastructure/iopen-verifier.mjs";
import { createMarketplaceClients } from "../infrastructure/marketplace-clients.mjs";
import { createOfficialLegoPriceBrowserFetcher } from "../infrastructure/official-lego-price-browser.mjs";
import { createOfficialLegoSetResolver } from "../infrastructure/official-lego-set-resolver.mjs";
import { createTaiwanBankExchangeRateResolver } from "../infrastructure/taiwan-bank-exchange-rate.mjs";
import { createRequestHandler } from "./app.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "..", "public");

export async function startLegoSearchServer({ port = 5178, host = "127.0.0.1" } = {}) {
  const server = createLegoSearchServer();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  return {
    server,
    port: typeof address === "object" && address ? address.port : port
  };
}

export function createLegoSearchServer() {
  const aggregator = createSearchAggregator({
    clients: createMarketplaceClients({
      browserClients: createBrowserMarketplaceClients()
    }),
    resolveLegoSet: createOfficialLegoSetResolver({
      fetchProductPages: createOfficialLegoPriceBrowserFetcher(),
      resolveBrickEconomyRetailPrice: createBrickEconomyRetailPriceResolver(),
      resolveExchangeRates: createTaiwanBankExchangeRateResolver()
    })
  });

  return createServer(createRequestHandler({
    aggregator,
    publicDir,
    iopenVerifier: createIopenVerificationLauncher()
  }));
}

if (isDirectRun()) {
  const port = Number(readOption("port") ?? process.env.PORT ?? 5178);
  const running = await startLegoSearchServer({ port });
  console.log(`LegoSearch running at http://localhost:${running.port}`);
}

function readOption(name) {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) {
    return inline.slice(name.length + 3);
  }

  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

function isDirectRun() {
  return Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}
