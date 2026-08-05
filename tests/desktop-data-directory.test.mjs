import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { migrateBrowserProfiles, resolveDesktopDataDir } from "../desktop/data-directory.mjs";

test("stores portable EXE logs beside the executable", () => {
  assert.equal(resolveDesktopDataDir({
    isPackaged: true,
    portableExecutableDir: "C:/Users/BluceL/Downloads/LegoSearch",
    userDataDir: "C:/Users/BluceL/AppData/Roaming/LegoSearch"
  }), join("C:/Users/BluceL/Downloads/LegoSearch", "LOG"));
});

test("keeps development logs in the app user data directory", () => {
  assert.equal(resolveDesktopDataDir({
    isPackaged: false,
    portableExecutableDir: null,
    userDataDir: "C:/Users/BluceL/AppData/Roaming/LegoSearch"
  }), "C:/Users/BluceL/AppData/Roaming/LegoSearch");
});

test("moves legacy browser profiles out of the portable LOG directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "lego-search-log-"));
  const logDir = join(root, "LOG");
  const browserDataDir = join(root, "browser-data");
  await mkdir(join(logDir, "iopen-browser-profile"), { recursive: true });

  try {
    await migrateBrowserProfiles({ logDir, browserDataDir });
    assert.equal(existsSync(join(logDir, "iopen-browser-profile")), false);
    assert.equal(existsSync(join(browserDataDir, "iopen-browser-profile")), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
