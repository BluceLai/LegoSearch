import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createCoupangDamagedBoxSnapshotRepository } from "../src/infrastructure/coupang-damaged-box-snapshot-repository.mjs";

test("keeps only the latest Coupang damaged-box snapshot", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lego-search-coupang-snapshot-"));
  let now = new Date("2026-08-12T04:00:00.000Z");
  const repository = createCoupangDamagedBoxSnapshotRepository({
    filePath: join(directory, "coupang-damaged-box.json"),
    now: () => now
  });

  try {
    await repository.save({ query: "LEGO", results: [{ title: "LEGO 60500" }] });
    now = new Date("2026-08-12T05:00:00.000Z");
    await repository.save({ query: "LEGO", results: [{ title: "LEGO 43015" }] });

    assert.deepEqual(await repository.get(), {
      query: "LEGO",
      searchedAt: "2026-08-12T05:00:00.000Z",
      results: [{ title: "LEGO 43015" }]
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
