import { spawn } from "node:child_process";
import {
  ensureMarketplaceBrowserProfile,
  findMarketplaceEdgeExecutable
} from "./marketplace-edge.mjs";

const verificationUrl = "https://mall.iopenmall.tw/iopen/";

export function createIopenVerificationLauncher({
  executablePath = findMarketplaceEdgeExecutable(),
  profileDir,
  spawnImpl = spawn
} = {}) {
  return {
    async open() {
      if (!executablePath) {
        throw new Error("\u627e\u4e0d\u5230 Microsoft Edge\uff0c\u7121\u6cd5\u958b\u555f iOPEN Mall \u9a57\u8b49\u3002");
      }

      const resolvedProfileDir = profileDir || await ensureMarketplaceBrowserProfile();
      const child = spawnImpl(executablePath, [
        "--new-window",
        `--user-data-dir=${resolvedProfileDir}`,
        verificationUrl
      ], {
        detached: true,
        stdio: "ignore",
        windowsHide: false
      });

      child.unref?.();
    }
  };
}
