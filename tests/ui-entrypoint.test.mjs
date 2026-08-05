import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("web entrypoint keeps local assets relative and includes a startup notice", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /src="\.\/app\.js"/);
  assert.match(html, /id="open-instructions"/);
  assert.match(html, /window\.location\.replace\("http:\/\/localhost:5178\/"\)/);
  assert.match(html, /id="lowest-results"/);
  assert.match(html, /id="show-thumbnails"/);
  assert.doesNotMatch(html, /id="show-thumbnails"[^>]*checked/);
  assert.match(html, /id="discount-floor"/);
  assert.match(html, /option value="0">/);
  assert.match(html, /option value="0\.3" selected/);
  assert.match(html, /id="verify-iopen"/);
  assert.match(html, /class="group-toggle"/);
  assert.match(html, /id="platform-group-template"/);
});
