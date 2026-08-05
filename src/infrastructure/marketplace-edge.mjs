import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const browserProfileDir = join(projectRoot, "data", "marketplace-browser-profile");
const edgeCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];

export async function ensureMarketplaceBrowserProfile() {
  await mkdir(browserProfileDir, { recursive: true });
  return browserProfileDir;
}

export function findMarketplaceEdgeExecutable() {
  return edgeCandidates.find((candidate) => existsSync(candidate));
}
