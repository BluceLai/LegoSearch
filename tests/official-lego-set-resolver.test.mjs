import assert from "node:assert/strict";
import test from "node:test";
import { createOfficialLegoSetResolver } from "../src/infrastructure/official-lego-set-resolver.mjs";

test("resolves Chinese and English set names from LEGO building-instructions pages", async () => {
  const requestedUrls = [];
  const resolveLegoSet = createOfficialLegoSetResolver({
    fetchImpl: async (url) => {
      requestedUrls.push(String(url));
      return responseFor(url);
    }
  });

  const set = await resolveLegoSet("10305");

  assert.deepEqual(set, {
    setNumber: "10305",
    names: ["\u7345\u5b50\u9a0e\u58eb\u7684\u57ce\u5821", "Lion Knights' Castle"]
  });
  assert.deepEqual(requestedUrls, [
    "https://www.lego.com/zh-tw/service/building-instructions/10305",
    "https://www.lego.com/en-us/service/building-instructions/10305"
  ]);
});

test("does not cache an official lookup that returns no set names", async () => {
  let calls = 0;
  const resolveLegoSet = createOfficialLegoSetResolver({
    fetchImpl: async () => {
      calls += 1;
      return { ok: false, text: async () => "" };
    }
  });

  assert.equal(await resolveLegoSet("10305"), null);
  assert.equal(await resolveLegoSet("10305"), null);
  assert.equal(calls, 4);
});

test("evicts the oldest cached set name when the cache reaches its limit", async () => {
  let calls = 0;
  const resolveLegoSet = createOfficialLegoSetResolver({
    maxEntries: 1,
    fetchImpl: async (url) => {
      calls += 1;
      const setNumber = String(url).match(/(\d{4,6})$/)?.[1];
      return { ok: true, text: async () => `<h1>Set ${setNumber}</h1>` };
    }
  });

  await resolveLegoSet("10305");
  await resolveLegoSet("10306");
  await resolveLegoSet("10305");

  assert.equal(calls, 6);
});

function responseFor(url) {
  const html = String(url).includes("zh-tw")
    ? '<h1 data-test="page-heading">\u7345\u5b50\u9a0e\u58eb\u7684\u57ce\u5821</h1>'
    : '<h1 data-test="page-heading">Lion Knights&#x27; Castle</h1>';

  return {
    ok: true,
    text: async () => html
  };
}
