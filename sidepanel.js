import { rgbToHex } from "./lib/color-utils.js";
import { exportPaletteAsCssVariables, exportPaletteAsJson, exportPaletteAsTailwindPreset } from "./lib/exporters.js";
import { analyzePalette } from "./lib/palette-analysis.js";

const LATEST_CAPTURE_KEY = "latestCapture";
const EXPORT_HANDLERS = {
  json: exportPaletteAsJson,
  css: exportPaletteAsCssVariables,
  tailwind: exportPaletteAsTailwindPreset
};

const analyzeButton = document.getElementById("analyzeButton");
const statusText = document.getElementById("statusText");
const summaryGrid = document.getElementById("summaryGrid");
const swatchList = document.getElementById("swatchList");
const roleList = document.getElementById("roleList");
const warningList = document.getElementById("warningList");
const previewImage = document.getElementById("previewImage");
const previewEmpty = document.getElementById("previewEmpty");
const exportButtons = Array.from(document.querySelectorAll("[data-export]"));

let latestRawCapture = null;
let latestAnalysis = null;
let renderSequence = 0;

analyzeButton.addEventListener("click", async () => {
  setBusy(true);
  updateStatus("重新请求页面分析...");

  const response = await chrome.runtime.sendMessage({ type: "reanalyze-current-page" });

  if (!response?.ok) {
    updateStatus("需要重新点击浏览器工具栏里的扩展图标以授权当前页面。");
    setBusy(false);
  }
});

for (const button of exportButtons) {
  button.addEventListener("click", () => {
    if (!latestAnalysis) {
      updateStatus("先完成一次页面分析，再导出结果。");
      return;
    }

    const handler = EXPORT_HANDLERS[button.dataset.export];
    const exported = handler(latestAnalysis);
    downloadTextFile(exported);
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[LATEST_CAPTURE_KEY]) {
    return;
  }

  void consumeCapture(changes[LATEST_CAPTURE_KEY].newValue);
});

await bootstrap();

async function bootstrap() {
  const response = await chrome.runtime.sendMessage({ type: "get-analysis-context" });

  if (response?.latestCapture) {
    await consumeCapture(response.latestCapture);
  } else {
    updateStatus("点击扩展图标，开始采样当前页面。");
  }
}

async function consumeCapture(rawCapture) {
  latestRawCapture = rawCapture || null;
  renderSequence += 1;
  const sequence = renderSequence;

  if (!rawCapture) {
    latestAnalysis = null;
    renderEmpty("点击扩展图标，开始采样当前页面。");
    setBusy(false);
    return;
  }

  if (rawCapture.status === "analyzing") {
    latestAnalysis = null;
    renderEmpty("正在分析当前视口，请稍候...");
    updateStatus(rawCapture.message || "正在分析当前视口，请稍候...");
    setBusy(true);
    return;
  }

  if (rawCapture.status === "error") {
    latestAnalysis = null;
    renderEmpty(rawCapture.message || rawCapture.error || "分析失败。");
    renderWarnings(rawCapture.error ? [rawCapture.error] : []);
    updateStatus(rawCapture.message || "分析失败。");
    setBusy(false);
    return;
  }

  if (rawCapture.status !== "ready") {
    latestAnalysis = null;
    renderEmpty(rawCapture.message || "等待页面分析。");
    updateStatus(rawCapture.message || "等待页面分析。");
    setBusy(false);
    return;
  }

  updateStatus("正在融合 DOM 样本和截图像素...");
  setBusy(true);

  try {
    const screenshotSamples = await extractScreenshotSamples(rawCapture.screenshotDataUrl);

    if (sequence !== renderSequence) {
      return;
    }

    latestAnalysis = analyzePalette({
      page: rawCapture.page,
      domSamples: rawCapture.domSamples,
      screenshotSamples
    });

    latestAnalysis.meta = {
      domSampleCount: rawCapture.domSamples.length,
      screenshotSampleCount: screenshotSamples.length
    };

    renderAnalysis(latestAnalysis, rawCapture);
    updateStatus("分析完成，可以导出 JSON / CSS / Tailwind。");
  } catch (error) {
    latestAnalysis = null;
    renderEmpty("截图像素解析失败，建议重新点击扩展图标再试一次。");
    renderWarnings([error instanceof Error ? error.message : String(error)]);
    updateStatus("截图像素解析失败。");
  } finally {
    setBusy(false);
  }
}

function renderAnalysis(analysis, rawCapture) {
  summaryGrid.hidden = false;
  summaryGrid.innerHTML = "";

  const summaryItems = [
    ["Page", analysis.page?.title || "Untitled"],
    ["Primary", analysis.roles.primary || "N/A"],
    ["Background", analysis.roles.background || "N/A"],
    ["Samples", `${analysis.meta.domSampleCount} DOM / ${analysis.meta.screenshotSampleCount} image`]
  ];

  for (const [label, value] of summaryItems) {
    const card = document.createElement("article");
    card.className = "summary-card";
    card.innerHTML = `
      <div class="summary-label">${escapeHtml(label)}</div>
      <div class="summary-value">${escapeHtml(value)}</div>
    `;
    summaryGrid.appendChild(card);
  }

  swatchList.classList.remove("empty-state");
  swatchList.innerHTML = "";

  for (const swatch of analysis.palette.slice(0, 8)) {
    const item = document.createElement("article");
    item.className = "swatch-item";
    item.innerHTML = `
      <div class="swatch-chip" style="background:${escapeHtml(swatch.hex)}"></div>
      <div class="swatch-meta">
        <div class="swatch-name">${escapeHtml(swatch.hex)}</div>
        <div class="swatch-detail">${escapeHtml(swatch.label)} · ${Math.round(swatch.usage * 100)}%</div>
      </div>
      <div class="swatch-weight">${escapeHtml(String(swatch.weight))}</div>
    `;
    swatchList.appendChild(item);
  }

  roleList.classList.remove("empty-state");
  roleList.innerHTML = "";

  for (const [role, hex] of Object.entries(analysis.roles)) {
    if (!hex) {
      continue;
    }

    const item = document.createElement("article");
    item.className = "role-item";
    item.innerHTML = `
      <div class="swatch-chip" style="background:${escapeHtml(hex)}"></div>
      <div class="role-meta">
        <div class="role-name">${escapeHtml(role)}</div>
        <div class="role-value">${escapeHtml(hex)}</div>
      </div>
    `;
    roleList.appendChild(item);
  }

  renderWarnings(rawCapture.warnings || []);

  if (rawCapture.screenshotDataUrl) {
    previewImage.hidden = false;
    previewImage.src = rawCapture.screenshotDataUrl;
    previewEmpty.hidden = true;
  } else {
    previewImage.hidden = true;
    previewEmpty.hidden = false;
  }
}

function renderWarnings(warnings) {
  if (!warnings || warnings.length === 0) {
    warningList.hidden = true;
    warningList.innerHTML = "";
    return;
  }

  warningList.hidden = false;
  warningList.innerHTML = warnings
    .map((warning) => `<div class="warning-item">${escapeHtml(warning)}</div>`)
    .join("");
}

function renderEmpty(message) {
  summaryGrid.hidden = true;
  summaryGrid.innerHTML = "";
  swatchList.classList.add("empty-state");
  swatchList.textContent = message;
  roleList.classList.add("empty-state");
  roleList.textContent = "识别完成后会在这里显示 primary、background、text、surface。";
  previewImage.hidden = true;
  previewImage.removeAttribute("src");
  previewEmpty.hidden = false;
}

function updateStatus(message) {
  statusText.textContent = message;
}

function setBusy(isBusy) {
  analyzeButton.disabled = isBusy;

  for (const button of exportButtons) {
    button.disabled = isBusy || !latestAnalysis;
  }
}

async function extractScreenshotSamples(dataUrl) {
  if (!dataUrl) {
    return [];
  }

  const image = await loadImage(dataUrl);
  const width = Math.max(32, Math.min(96, image.naturalWidth || image.width || 96));
  const height = Math.max(
    32,
    Math.round(width / Math.max(0.1, (image.naturalWidth || width) / (image.naturalHeight || width)))
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  context.drawImage(image, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);
  const buckets = new Map();

  for (let index = 0; index < data.length; index += 16) {
    const alpha = data[index + 3];

    if (alpha < 200) {
      continue;
    }

    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const bucketKey = [
      quantizeChannel(r),
      quantizeChannel(g),
      quantizeChannel(b)
    ].join(":");

    const bucket = buckets.get(bucketKey) || {
      count: 0,
      sumR: 0,
      sumG: 0,
      sumB: 0
    };

    bucket.count += 1;
    bucket.sumR += r;
    bucket.sumG += g;
    bucket.sumB += b;
    buckets.set(bucketKey, bucket);
  }

  return [...buckets.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 28)
    .map((bucket) => ({
      color: rgbToHex({
        r: bucket.sumR / bucket.count,
        g: bucket.sumG / bucket.count,
        b: bucket.sumB / bucket.count
      }),
      weight: bucket.count
    }));
}

function quantizeChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value / 24) * 24));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to decode captured viewport image."));
    image.src = src;
  });
}

function downloadTextFile({ filename, content, mimeType }) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
