# Color Pattern Reg Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 Chrome extension that analyzes the current page's visible color palette and exports the result as reusable design tokens.

**Architecture:** The extension opens a side panel from an explicit action click, samples the active page through a content script, captures the visible tab once for pixel-based weighting, then fuses DOM and screenshot signals into a structured palette. Shared analysis and export logic lives in plain ESM modules that are exercised by Node tests and reused by the side panel runtime.

**Tech Stack:** Chrome Extensions Manifest V3, vanilla JavaScript, Node built-in test runner, HTML/CSS

---

## File Structure

- Create: `package.json`
- Create: `manifest.json`
- Create: `service-worker.js`
- Create: `content-script.js`
- Create: `sidepanel.html`
- Create: `sidepanel.css`
- Create: `sidepanel.js`
- Create: `lib/color-utils.js`
- Create: `lib/palette-analysis.js`
- Create: `lib/exporters.js`
- Create: `tests/palette-analysis.test.js`
- Create: `tests/exporters.test.js`

### Task 1: Test the shared palette analysis

**Files:**
- Create: `tests/palette-analysis.test.js`
- Create: `lib/color-utils.js`
- Create: `lib/palette-analysis.js`

- [ ] **Step 1: Write the failing test**
  Add tests for: deduplicating near-identical colors, ranking dominant colors by weighted usage, and assigning semantic roles such as `primary`, `background`, and `text`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test -- tests/palette-analysis.test.js`
  Expected: FAIL because `lib/palette-analysis.js` does not exist yet.

- [ ] **Step 3: Write minimal implementation**
  Add pure functions that normalize colors, cluster similar swatches, compute weighted scores, and return a compact palette object.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test -- tests/palette-analysis.test.js`
  Expected: PASS

### Task 2: Test export formats

**Files:**
- Create: `tests/exporters.test.js`
- Create: `lib/exporters.js`

- [ ] **Step 1: Write the failing test**
  Add tests for JSON export, CSS custom properties export, and Tailwind token export from a structured palette result.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test -- tests/exporters.test.js`
  Expected: FAIL because `lib/exporters.js` does not exist yet.

- [ ] **Step 3: Write minimal implementation**
  Add formatter functions that return deterministic text payloads and filenames for each export type.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test -- tests/exporters.test.js`
  Expected: PASS

### Task 3: Wire the extension runtime

**Files:**
- Create: `manifest.json`
- Create: `service-worker.js`
- Create: `content-script.js`

- [ ] **Step 1: Create the manifest**
  Define a MV3 extension with `activeTab`, `scripting`, `storage`, and `sidePanel` permissions, an action button, and a side panel entry.

- [ ] **Step 2: Implement the service worker**
  Open the side panel from the action click, collect DOM samples through `chrome.scripting.executeScript`, capture the visible tab once, and cache the latest result in extension storage for the UI.

- [ ] **Step 3: Implement the content script sampler**
  Return visible-element color samples with roles, element counts, and area weighting so the panel can merge them with screenshot data.

- [ ] **Step 4: Smoke-check the runtime structure**
  Run: `node --check service-worker.js`
  Expected: no syntax errors

### Task 4: Build the side panel UI

**Files:**
- Create: `sidepanel.html`
- Create: `sidepanel.css`
- Create: `sidepanel.js`

- [ ] **Step 1: Create the panel layout**
  Include an analyze button, summary cards, swatch list, semantic-role breakdown, and export controls.

- [ ] **Step 2: Add panel behavior**
  Load the latest cached analysis, trigger a fresh analysis, render color groups with confidence and usage percentages, and allow export downloads.

- [ ] **Step 3: Add resilient empty/error states**
  Show helpful copy for unsupported pages, missing permission context, and analysis failures.

- [ ] **Step 4: Manual smoke-check**
  Load unpacked extension in Chrome and confirm the panel opens, analyzes a page, and downloads at least one export file.

### Task 5: Final verification

**Files:**
- Verify: `tests/palette-analysis.test.js`
- Verify: `tests/exporters.test.js`
- Verify: extension entry files

- [ ] **Step 1: Run the full test suite**
  Run: `npm test`
  Expected: all tests pass

- [ ] **Step 2: Validate generated artifact set**
  Run: `find . -maxdepth 2 -type f | sort`
  Expected: manifest, runtime files, shared libs, tests, and plan docs are present

- [ ] **Step 3: Record limitations**
  Note in the final handoff that v1 analyzes the current visible viewport and may under-read canvas-heavy or cross-origin embedded content.
