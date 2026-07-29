import test from "node:test";
import assert from "node:assert/strict";

import {
  exportPaletteAsAgentPrompt,
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
  },
  typography: {
    fonts: [
      { family: "Inter", usage: 0.72 },
      { family: "Georgia", usage: 0.28 }
    ]
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

test("exportPaletteAsAgentPrompt emits a conversational color brief", () => {
  const exported = exportPaletteAsAgentPrompt(analysis);

  assert.equal(exported.filename, "demo-landing-page.palette.prompt.txt");
  assert.match(exported.content, /主色（主要按钮、链接和重点状态）：#2563eb/);
  assert.match(exported.content, /背景色（页面画布）：#ffffff/);
  assert.match(exported.content, /辅助色板：#ffffff（background，约 41%）/);
  assert.match(exported.content, /字体分布：Inter（约 72%）、Georgia（约 28%）/);
  assert.match(exported.content, /不要自行引入与该色板冲突的新颜色/);
});
