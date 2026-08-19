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
  assert.match(html, /id="recent-searches-menu"/);
  assert.match(html, /id="recent-searches-toggle"/);
  assert.match(html, /id="search-tab"/);
  assert.doesNotMatch(html, /id="history-tab"/);
  assert.match(html, /id="history-results"/);
  assert.ok(html.indexOf('id="coupang-damaged-history"') > html.indexOf('id="coupang-damaged-view"'));
  assert.ok(html.indexOf('id="coupang-damaged-history"') > html.indexOf('id="history-results"'));
  assert.match(html, /id="coupang-damaged-tab"/);
  assert.match(html, /id="coupang-damaged-view"/);
  assert.match(html, /id="coupang-damaged-form"/);
  assert.doesNotMatch(html, /id="coupang-damaged-query"/);
  assert.doesNotMatch(html, /show-coupang-damaged-thumbnails/);
  assert.match(html, /id="coupang-damaged-results"/);
  assert.match(html, /id="search-view"[\s\S]*id="search-form"/);
  assert.match(html, /id="coupang-damaged-status"/);
});

test("damaged-box history can restore its saved result list", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /open\.addEventListener\("click", restoreCoupangDamagedBoxSnapshot\)/);
  assert.match(app, /function restoreCoupangDamagedBoxSnapshot\(\)[\s\S]*coupangDamagedResults = \[\.\.\.coupangDamagedSnapshot\.results\]/);
});

test("recent search entries offer an individual delete action", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /function deleteRecentSearch\(setNumber\)/);
  assert.match(app, /method: "DELETE"/);
  assert.match(app, /new URLSearchParams\(\{ setNumber \}\)/);
});
