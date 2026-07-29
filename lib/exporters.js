import { slugify } from "./color-utils.js";

const SWATCH_ROLE_ORDER = ["background", "text", "primary", "surface"];

function baseName(analysis, suffix) {
  const pageTitle = analysis?.page?.title || analysis?.page?.url || "palette";
  return `${slugify(pageTitle)}.${suffix}`;
}

function orderSwatches(analysis) {
  const seen = new Set();
  const ordered = [];
  const palette = analysis.palette || [];

  for (const roleName of SWATCH_ROLE_ORDER) {
    const hex = analysis.roles?.[roleName];

    if (!hex || seen.has(hex)) {
      continue;
    }

    const match = palette.find((entry) => entry.hex === hex);

    if (match) {
      ordered.push(match);
      seen.add(hex);
    }
  }

  for (const entry of palette) {
    if (!seen.has(entry.hex)) {
      ordered.push(entry);
      seen.add(entry.hex);
    }
  }

  return ordered;
}

export function exportPaletteAsJson(analysis) {
  return {
    filename: baseName(analysis, "palette.json"),
    mimeType: "application/json",
    content: JSON.stringify(analysis, null, 2)
  };
}

export function exportPaletteAsCssVariables(analysis) {
  const roleLines = Object.entries(analysis.roles || {})
    .filter(([, value]) => value)
    .map(([role, value]) => `  --cp-${role}: ${value};`);
  const swatchLines = orderSwatches(analysis).map(
    (entry, index) => `  --cp-swatch-${index + 1}: ${entry.hex};`
  );

  return {
    filename: baseName(analysis, "palette.css"),
    mimeType: "text/css",
    content: [":root {", ...roleLines, ...swatchLines, "}"].join("\n")
  };
}

export function exportPaletteAsTailwindPreset(analysis) {
  const roleLines = Object.entries(analysis.roles || {})
    .filter(([, value]) => value)
    .map(([role, value]) => `    ${role}: "${value}",`);
  const swatchLines = orderSwatches(analysis).map(
    (entry, index) => `    swatch${index + 1}: "${entry.hex}",`
  );

  return {
    filename: baseName(analysis, "tailwind.colors.js"),
    mimeType: "text/javascript",
    content: [
      "export default {",
      "  colors: {",
      ...roleLines,
      ...swatchLines,
      "  }",
      "};"
    ].join("\n")
  };
}

export function exportPaletteAsAgentPrompt(analysis) {
  const roles = analysis.roles || {};
  const swatches = orderSwatches(analysis)
    .slice(0, 8)
    .map((entry) => `${entry.hex}（${entry.label}，约 ${Math.round(entry.usage * 100)}%）`)
    .join("、");
  const fonts = (analysis.typography?.fonts || [])
    .slice(0, 4)
    .map((entry) => `${entry.family}（约 ${Math.round(entry.usage * 100)}%）`)
    .join("、");

  return {
    filename: baseName(analysis, "palette.prompt.txt"),
    mimeType: "text/plain",
    content: [
      "请按照以下颜色系统设计界面，保持清晰、克制，并优先保证可读性：",
      "",
      `整体风格：以 ${roles.background || "未指定"} 作为大面积背景，${roles.surface || "未指定"} 作为卡片和浮层，${roles.text || "未指定"} 作为正文，${roles.primary || "未指定"} 作为主要交互与强调色。`,
      `主色（主要按钮、链接和重点状态）：${roles.primary || "未指定"}`,
      `背景色（页面画布）：${roles.background || "未指定"}`,
      `正文色（标题和正文）：${roles.text || "未指定"}`,
      `表面色（卡片、输入框和浮层）：${roles.surface || "未指定"}`,
      `辅助色板：${swatches || "未识别"}`,
      `字体分布：${fonts || "未识别"}`,
      "",
      "使用约束：主色只用于关键交互和重点信息；背景色与表面色负责区分层级；正文与背景必须保持清晰对比；辅助色仅用于状态、图表或次级强调；不要自行引入与该色板冲突的新颜色。"
    ].join("\n")
  };
}
