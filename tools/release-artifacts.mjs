import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ZipArchive } = require("archiver");

export async function archiveStaleReleaseArtifacts({ distDir, releaseName }) {
  const archiveDir = join(distDir, "archive");
  await mkdir(distDir, { recursive: true });
  await mkdir(archiveDir, { recursive: true });
  const entries = await readdir(distDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name === "win-unpacked") {
      await rm(join(distDir, entry.name), { recursive: true, force: true });
    }

    if (entry.isFile() && entry.name === "builder-debug.yml") {
      await rm(join(distDir, entry.name), { force: true });
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("LegoSearch_v") || entry.name === releaseName) {
      continue;
    }

    const directory = join(distDir, entry.name);
    await zipDirectory({
      directory,
      archivePath: join(archiveDir, `${entry.name}.zip`),
      rootDir: distDir
    });
    await rm(directory, { recursive: true, force: true });
  }

  for (const entry of entries) {
    if (!entry.isFile() || !/^LegoSearch_v.+\.zip$/.test(entry.name) || entry.name === `${releaseName}.zip`) {
      continue;
    }

    await moveReplacing(join(distDir, entry.name), join(archiveDir, entry.name));
  }

  for (const entry of entries) {
    if (entry.isFile() && /^LegoSearch-.+-portable\.exe$/.test(entry.name)) {
      await moveReplacing(join(distDir, entry.name), join(archiveDir, entry.name));
    }
  }
}

export async function createSourceArchive({ archivePath, rootDir, rootFiles, directories }) {
  await createZip(archivePath, (archive) => {
    for (const name of rootFiles) {
      const file = join(rootDir, name);
      if (fileExists(file)) {
        archive.file(file, { name });
      }
    }

    for (const name of directories) {
      const directory = join(rootDir, name);
      if (fileExists(directory)) {
        archive.directory(directory, name);
      }
    }
  });
}

export async function zipDirectory({ directory, archivePath, rootDir = dirname(directory) }) {
  const destination = relative(rootDir, directory).split("\\").join("/") || basename(directory);
  await createZip(archivePath, (archive) => {
    archive.directory(directory, destination);
  });
}

async function createZip(archivePath, addEntries) {
  await mkdir(dirname(archivePath), { recursive: true });
  await rm(archivePath, { force: true });

  await new Promise((resolve, reject) => {
    const output = createWriteStream(archivePath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);

    try {
      addEntries(archive);
      archive.finalize();
    } catch (error) {
      reject(error);
    }
  });
}

async function moveReplacing(source, destination) {
  await rm(destination, { force: true });
  await rename(source, destination);
}

function fileExists(path) {
  return existsSync(path);
}
