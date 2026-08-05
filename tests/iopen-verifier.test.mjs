import assert from "node:assert/strict";
import test from "node:test";
import { createIopenVerificationLauncher } from "../src/infrastructure/iopen-verifier.mjs";

test("opens a visible iOPEN Mall verification window with the project profile", async () => {
  const launches = [];
  const launcher = createIopenVerificationLauncher({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    profileDir: "C:\\LegoSearch\\data\\marketplace-browser-profile",
    spawnImpl(command, args, options) {
      launches.push({ command, args, options });
      return { unref() {} };
    }
  });

  await launcher.open();

  assert.deepEqual(launches, [{
    command: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    args: [
      "--new-window",
      "--user-data-dir=C:\\LegoSearch\\data\\marketplace-browser-profile",
      "https://mall.iopenmall.tw/iopen/"
    ],
    options: {
      detached: true,
      stdio: "ignore",
      windowsHide: false
    }
  }]);
});
