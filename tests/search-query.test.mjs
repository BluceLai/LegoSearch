import assert from "node:assert/strict";
import test from "node:test";
import { parseSearchQuery } from "../src/domain/search-query.mjs";

test("normalizes a user query and defaults to every supported platform", () => {
  const query = parseSearchQuery({
    text: "  lego   10305  ",
    platforms: undefined
  });

  assert.deepEqual(query, {
    text: "lego 10305",
    platformIds: ["shopee", "momo", "pchome", "coupang"]
  });
});

test("keeps only supported platform ids in request order", () => {
  const query = parseSearchQuery({
    text: "\u6a02\u9ad8 75367",
    platforms: "momo,unknown,pchome"
  });

  assert.deepEqual(query, {
    text: "\u6a02\u9ad8 75367",
    platformIds: ["momo", "pchome"]
  });
});

test("rejects blank queries and empty platform selections", () => {
  assert.throws(
    () => parseSearchQuery({ text: "   ", platforms: "momo" }),
    /Search keyword is required/
  );

  assert.throws(
    () => parseSearchQuery({ text: "lego", platforms: "unknown" }),
    /At least one supported platform is required/
  );
});

test("adds LEGO to a set number entered without a brand", () => {
  assert.deepEqual(
    parseSearchQuery({ text: "10305", platforms: "pchome" }),
    {
      text: "LEGO 10305",
      platformIds: ["pchome"]
    }
  );
});
