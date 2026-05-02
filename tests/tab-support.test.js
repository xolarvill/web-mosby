import test from "node:test";
import assert from "node:assert/strict";

import { getTabAnalysisSupport } from "../lib/tab-support.js";

test("getTabAnalysisSupport allows standard web pages", () => {
  assert.deepEqual(
    getTabAnalysisSupport({ url: "https://example.com/docs?foo=bar" }),
    { supported: true, reason: null }
  );
});

test("getTabAnalysisSupport rejects chrome internal pages", () => {
  const result = getTabAnalysisSupport({ url: "chrome://extensions" });

  assert.equal(result.supported, false);
  assert.match(result.reason, /chrome:/);
});

test("getTabAnalysisSupport rejects extension pages", () => {
  const result = getTabAnalysisSupport({ url: "chrome-extension://abc123/popup.html" });

  assert.equal(result.supported, false);
  assert.match(result.reason, /chrome-extension:/);
});
