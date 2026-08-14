import { app, BrowserWindow, dialog, shell } from "electron";
import { join } from "node:path";
import { migrateBrowserProfiles, resolveDesktopDataDir } from "./data-directory.mjs";
import { appendStartupLog } from "./startup-diagnostics.mjs";

let mainWindow;
let server;
let startupLogDir;

app.whenReady().then(createMainWindow).catch(handleStartupFailure);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  server?.close();
});

async function createMainWindow() {
  const logDir = resolveDesktopDataDir({
    isPackaged: app.isPackaged,
    portableExecutableDir: process.env.PORTABLE_EXECUTABLE_DIR,
    userDataDir: app.getPath("userData")
  });
  startupLogDir = logDir;
  await appendStartupLog({ logDir, phase: "startup" });
  const browserDataDir = join(app.getPath("userData"), "browser-profiles");
  await migrateBrowserProfiles({ logDir, browserDataDir });
  process.env.LEGO_SEARCH_DATA_DIR = logDir;
  process.env.LEGO_SEARCH_BROWSER_DATA_DIR = browserDataDir;
  process.env.LEGO_SEARCH_VERSION = app.getVersion();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    autoHideMenuBar: true,
    title: "LegoSearch",
    backgroundColor: "#f3f5f8",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.show();
  mainWindow.focus();
  await appendStartupLog({ logDir, phase: "main-window" });

  const { startLegoSearchServer } = await import("../src/http/server.mjs");
  const running = await startLegoSearchServer({ port: 0 });
  server = running.server;
  const localUrl = `http://127.0.0.1:${running.port}`;
  await appendStartupLog({ logDir, phase: "local-server" });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(localUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  await mainWindow.loadURL(localUrl);
  await appendStartupLog({ logDir, phase: "page-loaded" });
}

async function handleStartupFailure(error) {
  console.error(error);
  const logDir = startupLogDir || app.getPath("userData");
  let logPath = join(logDir, "startup.log");

  try {
    logPath = await appendStartupLog({ logDir, phase: "startup-failure", error });
  } catch {
    // The error dialog still gives the user the original startup failure.
  }

  dialog.showErrorBox(
    "LegoSearch \u7121\u6cd5\u555f\u52d5",
    `\u555f\u52d5\u5931\u6557\uff1a${error.message}\n\n\u8acb\u5c07\u6b64\u8cc7\u8a0a\u9023\u540c\u8a18\u9304\u6a94\u4e00\u8d77\u63d0\u4f9b\uff1a\n${logPath}`
  );
  app.quit();
}
