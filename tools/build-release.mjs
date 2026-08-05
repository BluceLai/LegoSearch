import { access, copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { archiveStaleReleaseArtifacts, zipDirectory } from "./release-artifacts.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(join(rootDir, "package.json"), "utf8"));
const releaseName = `LegoSearch_v${packageJson.version}`;
const distDir = join(rootDir, "dist");
const releaseDir = join(distDir, releaseName);
const releaseArchive = join(distDir, `${releaseName}.zip`);

await archiveStaleReleaseArtifacts({ distDir, releaseName });
await runElectronBuilder();

const portableExe = join(distDir, `LegoSearch-${packageJson.version}-portable.exe`);
await access(portableExe);
await rm(releaseDir, { recursive: true, force: true });
await mkdir(join(releaseDir, "LegoSearch"), { recursive: true });
await copyFile(portableExe, join(releaseDir, "LegoSearch", "LegoSearch.exe"));
await copyFile(join(rootDir, "README.md"), join(releaseDir, "README.md"));
await copyFile(join(rootDir, "CHANGELOG.md"), join(releaseDir, "CHANGELOG.md"));
await zipDirectory({ directory: releaseDir, archivePath: releaseArchive, rootDir: distDir });
await rm(portableExe, { force: true });
await archiveStaleReleaseArtifacts({ distDir, releaseName });

console.log(releaseArchive);

function runElectronBuilder() {
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(executable, ["electron-builder", "--win", "portable"], {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => code === 0
      ? resolve()
      : reject(new Error(`electron-builder exited with code ${code}`)));
  });
}
