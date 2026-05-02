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
