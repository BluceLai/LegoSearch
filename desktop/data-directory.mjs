import { join } from "node:path";

export function resolveDesktopDataDir({ isPackaged, portableExecutableDir, userDataDir }) {
  return isPackaged && portableExecutableDir
    ? join(portableExecutableDir, "LOG")
    : userDataDir;
}
