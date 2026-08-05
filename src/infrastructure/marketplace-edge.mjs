import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const dataDir = process.env.LEGO_SEARCH_DATA_DIR || join(projectRoot, "data");
const defaultProfileName = "marketplace-browser-profile";
const edgeCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];
const queuedBrowserWorkByProfile = new Map();

export async function ensureMarketplaceBrowserProfile(profileName = defaultProfileName) {
  const browserProfileDir = join(dataDir, profileName);
  await mkdir(browserProfileDir, { recursive: true });
  return browserProfileDir;
}

export function findMarketplaceEdgeExecutable() {
  return edgeCandidates.find((candidate) => existsSync(candidate));
}

export function scheduleMarketplaceBrowserWork(profileName, work) {
  const pending = queuedBrowserWorkByProfile.get(profileName) || Promise.resolve();
  const scheduled = pending.then(work, work);
  queuedBrowserWorkByProfile.set(profileName, scheduled.catch(() => {}));
  return scheduled;
}

export async function createMarketplaceEdgeContext({ profileName = defaultProfileName } = {}) {
  const browserProfileDir = await ensureMarketplaceBrowserProfile(profileName);
  const { chromium } = await import("playwright-core");
  const executablePath = findMarketplaceEdgeExecutable();

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
