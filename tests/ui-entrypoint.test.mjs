import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("web entrypoint keeps local assets relative and includes a startup notice", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /src="\.\/app\.js"/);
  assert.match(html, /id="open-instructions"/);
});
