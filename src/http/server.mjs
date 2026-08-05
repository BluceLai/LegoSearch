import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSearchAggregator } from "../domain/search-aggregator.mjs";
import { createMarketplaceClients } from "../infrastructure/marketplace-clients.mjs";
import { createOfficialLegoSetResolver } from "../infrastructure/official-lego-set-resolver.mjs";
import { createRequestHandler } from "./app.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "..", "public");
const port = Number(readOption("port") || process.env.PORT || 5178);

const aggregator = createSearchAggregator({
  clients: createMarketplaceClients(),
  resolveLegoSet: createOfficialLegoSetResolver()
});

const server = createServer(createRequestHandler({ aggregator, publicDir }));

server.listen(port, () => {
  console.log(`LegoSearch running at http://localhost:${port}`);
});

function readOption(name) {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) {
    return inline.slice(name.length + 3);
  }

  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}
