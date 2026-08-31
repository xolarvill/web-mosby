import test from "node:test";
import assert from "node:assert/strict";

import { analyzeTypography } from "../lib/typography-analysis.js";

test("analyzeTypography ranks visible font families by weighted usage", () => {
  const analysis = analyzeTypography({
    fontSamples: [
      { family: "Inter", stack: "Inter, sans-serif", size: 16, fontWeight: "400", lineHeight: "24px", letterSpacing: "normal", weight: 30 },
      { family: "Inter", stack: "Inter, sans-serif", size: 20, fontWeight: "700", lineHeight: "28px", letterSpacing: "0.2px", fontStyle: "italic", weight: 10 },
      { family: "Georgia", stack: "Georgia, serif", size: 18, fontWeight: "400", weight: 20 }
    ]
  });

  assert.equal(analysis.primary, "Inter");
  assert.equal(analysis.fonts[0].family, "Inter");
  assert.equal(Math.round(analysis.fonts[0].usage * 100), 67);
  assert.equal(analysis.fonts[0].averageSize, 18);
  assert.equal(analysis.fonts[0].averageWeight, 550);
  assert.deepEqual(analysis.fonts[0].styles, [
    { fontWeight: "400", fontSize: "16px", lineHeight: "24px", letterSpacing: "normal", fontStyle: "normal", sampleCount: 1, usage: 0.75 },
    { fontWeight: "700", fontSize: "20px", lineHeight: "28px", letterSpacing: "0.2px", fontStyle: "italic", sampleCount: 1, usage: 0.25 }
  ]);
});

test("analyzeTypography ignores generic-only stacks", () => {
  const analysis = analyzeTypography({
    fontSamples: [{ stack: "sans-serif", size: 16, fontWeight: "400", weight: 20 }]
  });

  assert.equal(analysis.primary, null);
  assert.deepEqual(analysis.fonts, []);
  assert.equal(analysis.warnings.length, 1);
});
