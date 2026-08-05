import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { archiveStaleReleaseArtifacts } from "../tools/release-artifacts.mjs";

test("archives older release folders and release zips", async () => {
  const root = await mkdtemp(join(tmpdir(), "lego-search-release-"));
  const distDir = join(root, "dist");
  const oldReleaseDir = join(distDir, "LegoSearch_v0.1.0");
  const currentReleaseDir = join(distDir, "LegoSearch_v0.2.0");
  const staleBuildDir = join(distDir, "win-unpacked");
  const builderDebugFile = join(distDir, "builder-debug.yml");
  await mkdir(oldReleaseDir, { recursive: true });
  await mkdir(currentReleaseDir, { recursive: true });
  await mkdir(staleBuildDir, { recursive: true });
  await writeFile(join(oldReleaseDir, "LegoSearch.exe"), "old");
  await writeFile(builderDebugFile, "debug");
  await writeFile(join(distDir, "LegoSearch_v0.1.0.zip"), "old zip");
  await writeFile(join(distDir, "LegoSearch_v0.2.0.zip"), "current zip");

  await archiveStaleReleaseArtifacts({
    distDir,
    releaseName: "LegoSearch_v0.2.0"
  });

  await assert.rejects(access(oldReleaseDir));
  await assert.rejects(access(staleBuildDir));
  await assert.rejects(access(builderDebugFile));
  assert.equal(await readText(join(distDir, "archive", "LegoSearch_v0.1.0.zip")), "old zip");
  assert.equal(await readText(join(distDir, "LegoSearch_v0.2.0.zip")), "current zip");
});

async function readText(path) {
  const { readFile } = await import("node:fs/promises");
  return readFile(path, "utf8");
}
