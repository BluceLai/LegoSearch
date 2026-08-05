import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function recordVersionStart({ filePath, version, now = () => new Date() }) {
  if (!version) return;

  const startedAt = now().toISOString();
  const entries = await readEntries(filePath);
  const existing = entries.find((entry) => entry.version === version);
  if (existing) {
    existing.lastStartedAt = startedAt;
  } else {
    entries.push({ version, firstStartedAt: startedAt, lastStartedAt: startedAt });
  }

  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify({ versions: entries }, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

async function readEntries(filePath) {
  try {
    const data = JSON.parse(await readFile(filePath, "utf8"));
    return Array.isArray(data.versions) ? data.versions : [];
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return [];
    throw error;
  }
}
