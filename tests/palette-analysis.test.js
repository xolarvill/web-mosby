import test from "node:test";
import assert from "node:assert/strict";

import { analyzePalette } from "../lib/palette-analysis.js";

test("analyzePalette ranks dominant colors and assigns semantic roles", () => {
  const result = analyzePalette({
    page: {
      title: "Demo landing page",
      url: "https://example.com"
    },
    domSamples: [
      { color: "#0f172a", role: "text", weight: 38, source: "text" },
      { color: "#ffffff", role: "background", weight: 42, source: "background" },
      { color: "#2563eb", role: "accent", weight: 26, source: "button" },
      { color: "#1d4ed8", role: "accent", weight: 22, source: "button" },
      { color: "#e2e8f0", role: "surface", weight: 20, source: "border" }
    ],
    screenshotSamples: [
      { color: "#2563eb", weight: 32 },
      { color: "#ffffff", weight: 40 },
      { color: "#111827", weight: 18 },
      { color: "#dbeafe", weight: 10 }
    ]
  });

  assert.equal(result.page.title, "Demo landing page");
  assert.equal(result.palette[0].hex, "#ffffff");
  assert.equal(result.roles.background, "#ffffff");
  assert.equal(result.roles.primary, "#2563eb");
  assert.equal(result.roles.text, "#0f172a");
  assert.ok(result.palette.length >= 4);
  assert.ok(result.palette.every((entry) => entry.weight > 0));
});

test("analyzePalette merges near-identical accent colors into one stable swatch", () => {
  const result = analyzePalette({
    domSamples: [
      { color: "#f97316", role: "accent", weight: 20, source: "button" },
      { color: "#fb923c", role: "accent", weight: 12, source: "icon" }
    ],
    screenshotSamples: [
      { color: "#f97316", weight: 14 },
      { color: "#fdba74", weight: 5 }
    ]
  });

  const orangeFamily = result.palette.filter((entry) => entry.hex === "#f97316");
  assert.equal(orangeFamily.length, 1);
  assert.equal(result.roles.primary, "#f97316");
});
