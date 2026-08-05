import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { migrateBrowserProfiles, resolveDesktopDataDir } from "./data-directory.mjs";

let mainWindow;
let server;

app.whenReady().then(createMainWindow).catch((error) => {
  console.error(error);
  app.quit();
});

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
  const browserDataDir = join(app.getPath("userData"), "browser-profiles");
  await migrateBrowserProfiles({ logDir, browserDataDir });
  process.env.LEGO_SEARCH_DATA_DIR = logDir;
  process.env.LEGO_SEARCH_BROWSER_DATA_DIR = browserDataDir;
  process.env.LEGO_SEARCH_VERSION = app.getVersion();
  const { startLegoSearchServer } = await import("../src/http/server.mjs");
  const running = await startLegoSearchServer({ port: 0 });
  server = running.server;
  const localUrl = `http://127.0.0.1:${running.port}`;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

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
}
