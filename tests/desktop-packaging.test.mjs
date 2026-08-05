import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("declares a portable Windows desktop build", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.equal(packageJson.main, "desktop/main.mjs");
  assert.equal(packageJson.scripts.desktop, "electron .");
  assert.equal(packageJson.scripts["package:source"], "node tools/build-source-archive.mjs");
  assert.equal(packageJson.scripts["package:win"], "node tools/build-release.mjs");
  assert.equal(packageJson.scripts["release:win"], "npm run check && npm run package:source && npm run package:win");
  assert.equal(packageJson.scripts["version:patch"], "npm version patch --no-git-tag-version");
  assert.equal(packageJson.scripts["version:minor"], "npm version minor --no-git-tag-version");
  assert.equal(packageJson.scripts["version:major"], "npm version major --no-git-tag-version");
  assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
  assert.ok(packageJson.devDependencies.electron);
  assert.ok(packageJson.devDependencies["electron-builder"]);
  assert.deepEqual(packageJson.build.win.target, ["portable"]);
  assert.equal(packageJson.build.directories.output, "dist");
});
