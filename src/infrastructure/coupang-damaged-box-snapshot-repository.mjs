import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export function createCoupangDamagedBoxSnapshotRepository({
  filePath,
  now = () => new Date()
}) {
  let pending = Promise.resolve();

  return {
    async save({ query, results }) {
      const snapshot = {
        query,
        searchedAt: now().toISOString(),
        results
      };
      const write = pending.then(() => writeSnapshot(filePath, snapshot));
      pending = write.catch(() => {});
      return write;
    },

    async get() {
      await pending;
      return readSnapshot(filePath);
    }
  };
}

async function readSnapshot(filePath) {
  try {
    const snapshot = JSON.parse(await readFile(filePath, "utf8"));
    return Array.isArray(snapshot?.results) && snapshot.results.length ? snapshot : null;
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) {
      return null;
    }

    throw error;
  }
}

async function writeSnapshot(filePath, snapshot) {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}
