import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("extension action uses a popup without side panel permissions", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../manifest.json", import.meta.url), "utf8")
  );

  assert.equal(manifest.action.default_popup, "sidepanel.html");
  assert.equal(manifest.side_panel, undefined);
  assert.equal(manifest.permissions.includes("sidePanel"), false);
  assert.equal(manifest.permissions.includes("clipboardWrite"), true);
});

test("popup keeps its fixed desktop canvas", async () => {
  const css = await readFile(new URL("../sidepanel.css", import.meta.url), "utf8");

  assert.match(css, /width:\s*560px/);
  assert.match(css, /height:\s*400px/);
  assert.match(css, /--radius:\s*12px/);
  assert.doesNotMatch(css, /--radius-(?:nav|card|pill)/);
  assert.match(css, /\.segmented-tabs\s*{[^}]*display:\s*grid/s);
  assert.match(css, /\.tab-content,\s*\.tab-panel,\s*\.workspace-grid\s*{[^}]*height:\s*100%/s);
  assert.match(css, /\.role-list,\s*\.font-list\s*{[^}]*grid-template-columns:\s*1fr/s);
  assert.doesNotMatch(css, /@media\s*\(max-width:\s*600px\)/);
});

test("manifest references packaged extension icons", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../manifest.json", import.meta.url), "utf8")
  );

  for (const path of new Set([
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon)
  ])) {
    await assert.doesNotReject(readFile(new URL(`../${path}`, import.meta.url)));
  }
});

test("popup omits the redundant title bar but keeps refresh and status controls", async () => {
  const html = await readFile(new URL("../sidepanel.html", import.meta.url), "utf8");

  assert.doesNotMatch(html, /class="app-header"/);
  assert.match(html, /id="analyzeButton"/);
  assert.match(html, /id="statusText"/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /data-tab="color"/);
  assert.match(html, /data-tab="font"/);
  assert.doesNotMatch(html, /previewImage|视口预览/);
});

test("font analysis is isolated in a segmented tab panel", async () => {
  const html = await readFile(new URL("../sidepanel.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../sidepanel.js", import.meta.url), "utf8");

  assert.match(html, /id="colorPanel"[^>]*role="tabpanel"/);
  assert.match(html, /id="fontPanel"[^>]*role="tabpanel"[^>]*hidden/);
  assert.doesNotMatch(html, /side-stack/);
  assert.match(script, /function setActiveTab\(tabName\)/);
  assert.match(script, /panel\.hidden = name !== activeTab/);
});

test("export actions copy content instead of downloading files", async () => {
  const script = await readFile(new URL("../sidepanel.js", import.meta.url), "utf8");

  assert.match(script, /navigator\.clipboard\.writeText\(exported\.content\)/);
  assert.doesNotMatch(script, /downloadTextFile|link\.download/);
});
