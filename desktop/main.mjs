import { app, BrowserWindow, shell } from "electron";

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
  process.env.LEGO_SEARCH_DATA_DIR = app.getPath("userData");
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
