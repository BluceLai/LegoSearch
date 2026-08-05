import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSourceArchive } from "./release-artifacts.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const archivePath = join(rootDir, "dist", "lego-search-source.zip");

await createSourceArchive({
  archivePath,
  rootDir,
  rootFiles: [".gitignore", "AGENTS.md", "CHANGELOG.md", "README.md", "package-lock.json", "package.json"],
  directories: ["desktop", "docs", "public", "src", "tests", "tools"].filter((name) => existsSync(join(rootDir, name)))
});

console.log(archivePath);
