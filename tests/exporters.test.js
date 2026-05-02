import test from "node:test";
import assert from "node:assert/strict";

import {
  exportPaletteAsCssVariables,
  exportPaletteAsJson,
  exportPaletteAsTailwindPreset
} from "../lib/exporters.js";

const analysis = {
  page: {
    title: "Demo landing page",
    url: "https://example.com"
  },
  palette: [
    { hex: "#ffffff", label: "background", weight: 82, usage: 0.41 },
    { hex: "#2563eb", label: "primary", weight: 58, usage: 0.29 },
    { hex: "#0f172a", label: "text", weight: 44, usage: 0.22 },
    { hex: "#e2e8f0", label: "surface", weight: 16, usage: 0.08 }
  ],
  roles: {
    primary: "#2563eb",
    background: "#ffffff",
    text: "#0f172a",
    surface: "#e2e8f0"
  }
};

test("exportPaletteAsJson returns a downloadable payload", () => {
  const exported = exportPaletteAsJson(analysis);

  assert.equal(exported.filename, "demo-landing-page.palette.json");
  assert.match(exported.content, /"primary": "#2563eb"/);
  assert.match(exported.content, /"url": "https:\/\/example.com"/);
});

test("exportPaletteAsCssVariables emits semantic variables and indexed swatches", () => {
  const exported = exportPaletteAsCssVariables(analysis);

  assert.equal(exported.filename, "demo-landing-page.palette.css");
  assert.match(exported.content, /--cp-primary: #2563eb;/);
  assert.match(exported.content, /--cp-background: #ffffff;/);
  assert.match(exported.content, /--cp-swatch-2: #0f172a;/);
});

test("exportPaletteAsTailwindPreset emits a colors object", () => {
  const exported = exportPaletteAsTailwindPreset(analysis);

  assert.equal(exported.filename, "demo-landing-page.tailwind.colors.js");
  assert.match(exported.content, /primary: "#2563eb"/);
  assert.match(exported.content, /background: "#ffffff"/);
  assert.match(exported.content, /swatch4: "#e2e8f0"/);
});
