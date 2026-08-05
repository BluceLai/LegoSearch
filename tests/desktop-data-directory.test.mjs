import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { resolveDesktopDataDir } from "../desktop/data-directory.mjs";

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
