import { rgbToHex } from "./lib/color-utils.js";
import { exportPaletteAsAgentPrompt, exportPaletteAsCssVariables, exportPaletteAsJson, exportPaletteAsTailwindPreset } from "./lib/exporters.js";
import { analyzePalette } from "./lib/palette-analysis.js";
import { analyzeTypography } from "./lib/typography-analysis.js";

const LATEST_CAPTURE_KEY = "latestCapture";
const EXPORT_HANDLERS = {
  agent: exportPaletteAsAgentPrompt,
  json: exportPaletteAsJson,
  css: exportPaletteAsCssVariables,
  tailwind: exportPaletteAsTailwindPreset
};

const analyzeButton = document.getElementById("analyzeButton");
const statusText = document.getElementById("statusText");
const swatchList = document.getElementById("swatchList");
const roleList = document.getElementById("roleList");
const fontList = document.getElementById("fontList");
const warningList = document.getElementById("warningList");
const tabButtons = Array.from(document.querySelectorAll("[data-tab]"));
const tabPanels = {
  color: document.getElementById("colorPanel"),
  font: document.getElementById("fontPanel")
};
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

for (const button of tabButtons) {
  button.addEventListener("click", () => {
    setActiveTab(button.dataset.tab);
  });
}

for (const button of exportButtons) {
  button.addEventListener("click", async () => {
    if (!latestAnalysis) {
      updateStatus("先完成一次页面分析，再复制结果。");
      return;
    }

    const handler = EXPORT_HANDLERS[button.dataset.export];
    const exported = handler(latestAnalysis);

    try {
      await navigator.clipboard.writeText(exported.content);
      const label = button.querySelector("span")?.textContent || button.dataset.export;
      button.dataset.copied = "true";
      button.setAttribute("aria-label", `${label} 已复制`);
      updateStatus(`${label} 已复制到剪贴板。`);

      setTimeout(() => {
        delete button.dataset.copied;
        button.setAttribute("aria-label", `复制 ${label}`);
      }, 1200);
    } catch {
      updateStatus("复制失败，请允许剪贴板访问后重试。");
    }
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
  setBusy(true);
  updateStatus("正在采样当前页面...");

  const response = await chrome.runtime.sendMessage({ type: "reanalyze-current-page" });

  if (!response?.ok) {
    renderEmpty("无法读取当前页面，请切到普通网页后重试。");
    updateStatus(response?.error || "当前页面分析失败。");
    setBusy(false);
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
    const domSamples = rawCapture.domSamples || [];
    const fontSamples = rawCapture.fontSamples || [];
    const screenshotSamples = await extractScreenshotSamples(rawCapture.screenshotDataUrl);

    if (sequence !== renderSequence) {
      return;
    }

    latestAnalysis = analyzePalette({
      page: rawCapture.page,
      domSamples,
      screenshotSamples
    });
    latestAnalysis.typography = analyzeTypography({
      fontSamples
    });

    latestAnalysis.meta = {
      domSampleCount: domSamples.length,
      screenshotSampleCount: screenshotSamples.length,
      fontSampleCount: fontSamples.length
    };

    renderAnalysis(latestAnalysis, rawCapture);
    updateStatus("分析完成，点击格式复制结果。");
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
  renderTypography(analysis.typography);
}

function renderTypography(typography) {
  const fonts = typography?.fonts || [];

  fontList.classList.remove("empty-state");
  fontList.innerHTML = "";

  if (fonts.length === 0) {
    fontList.classList.add("empty-state");
    fontList.textContent = "未识别到可见文本字体。";
    return;
  }

  for (const font of fonts.slice(0, 8)) {
    const item = document.createElement("article");
    item.className = "font-item";
    item.innerHTML = `
      <div class="font-name">${escapeHtml(font.family)}</div>
      <div class="font-detail">${Math.round(font.usage * 100)}% · ${escapeHtml(font.averageSize)}px · ${escapeHtml(font.averageWeight)}</div>
    `;
    fontList.appendChild(item);
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
  swatchList.classList.add("empty-state");
  swatchList.textContent = message;
  roleList.classList.add("empty-state");
  roleList.textContent = "分析后显示 primary、background、text、surface。";
  fontList.classList.add("empty-state");
  fontList.textContent = "分析后显示主要字体及占比。";
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

function setActiveTab(tabName) {
  const activeTab = tabPanels[tabName] ? tabName : "color";

  for (const button of tabButtons) {
    const isActive = button.dataset.tab === activeTab;
    button.setAttribute("aria-selected", String(isActive));
  }

  for (const [name, panel] of Object.entries(tabPanels)) {
    panel.hidden = name !== activeTab;
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
