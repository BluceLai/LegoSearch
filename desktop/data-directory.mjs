import { existsSync } from "node:fs";
import { mkdir, readdir, rename } from "node:fs/promises";
import { join } from "node:path";

export function resolveDesktopDataDir({ isPackaged, portableExecutableDir, userDataDir }) {
  return isPackaged && portableExecutableDir
    ? join(portableExecutableDir, "LOG")
    : userDataDir;
}

export async function migrateBrowserProfiles({ logDir, browserDataDir }) {
  if (!existsSync(logDir)) return;

  await mkdir(browserDataDir, { recursive: true });
  const entries = await readdir(logDir, { withFileTypes: true });
  await Promise.all(entries
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("-browser-profile"))
    .filter((entry) => !existsSync(join(browserDataDir, entry.name)))
    .map((entry) => rename(join(logDir, entry.name), join(browserDataDir, entry.name))));
}
