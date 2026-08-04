import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const runtimeDir = join(root, "data");
const pidFile = join(runtimeDir, "legosearch.pid");
const action = process.argv[2] || "status";
const port = Number(process.argv[3] || process.env.PORT || 5178);

switch (action) {
  case "start":
    await start();
    break;
  case "open":
    await start();
    await openBrowser();
    break;
  case "stop":
    await stop();
    break;
  case "restart":
    await stop({ quiet: true });
    await start();
    break;
  case "status":
    await status();
    break;
  default:
    console.log("Usage: node tools/legoctl.mjs start|open|stop|restart|status [port]");
    process.exitCode = 1;
}

async function start() {
  await mkdir(runtimeDir, { recursive: true });
  const existing = await readPid();

  if (existing && isRunning(existing)) {
    console.log(`LegoSearch is already running. PID: ${existing}`);
    console.log(`URL: http://localhost:${port}`);
    return;
  }

  const child = spawn(process.execPath, ["src/http/server.mjs", "--port", String(port)], {
    cwd: root,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });

  child.unref();
  await writeFile(pidFile, String(child.pid), "ascii");
  await waitUntilReady();
  console.log(`LegoSearch started. PID: ${child.pid}`);
  console.log(`URL: http://localhost:${port}`);
}

async function stop({ quiet = false } = {}) {
  const pid = await readPid();

  if (!pid || !isRunning(pid)) {
    await rm(pidFile, { force: true });
    if (!quiet) {
      console.log("LegoSearch is stopped.");
    }
    return;
  }

  process.kill(pid);
  await rm(pidFile, { force: true });
  if (!quiet) {
    console.log(`LegoSearch stopped. PID: ${pid}`);
  }
}

async function status() {
  const pid = await readPid();
  const running = pid ? isRunning(pid) : false;

  console.log(`Status: ${running ? "running" : "stopped"}`);
  if (running) {
    console.log(`PID: ${pid}`);
    console.log(`URL: http://localhost:${port}`);
  }
}

async function openBrowser() {
  const target = `http://localhost:${port}`;
  const command = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", target] : [target];
  spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true }).unref();
  console.log(`Opened: ${target}`);
}

async function waitUntilReady() {
  const deadline = Date.now() + 6000;
  const url = `http://localhost:${port}/api/platforms`;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until the child process starts accepting connections.
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(`LegoSearch did not become ready at http://localhost:${port}`);
}

async function readPid() {
  try {
    const value = await readFile(pidFile, "utf8");
    const pid = Number.parseInt(value, 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
