import {
  colorDistance,
  hexToRgb,
  isDark,
  normalizeHex,
  relativeLuminance,
  rgbToHsl
} from "./color-utils.js";

const SOURCE_MULTIPLIER = {
  dom: 1.15,
  screenshot: 1
};

const ROLE_PRIORITY = [
  "primary",
  "accent",
  "cta",
  "brand",
  "background",
  "surface",
  "text",
  "muted",
  "neutral"
];

function normalizeSamples(samples, kind) {
  return samples
    .map((sample) => {
      const color = normalizeHex(sample.color);

      if (!color || !Number.isFinite(sample.weight) || sample.weight <= 0) {
        return null;
      }

      return {
        color,
        role: sample.role || "neutral",
        source: kind,
        weight: sample.weight * (SOURCE_MULTIPLIER[kind] || 1),
        rawWeight: sample.weight
      };
    })
    .filter(Boolean);
}

function shouldMergeColors(baseHex, candidateHex) {
  const directDistance = colorDistance(baseHex, candidateHex);
  if (directDistance <= 8) {
    return true;
  }

  const baseHsl = rgbToHsl(hexToRgb(baseHex));
  const candidateHsl = rgbToHsl(hexToRgb(candidateHex));
  const hueDelta = Math.min(
    Math.abs(baseHsl.h - candidateHsl.h),
    360 - Math.abs(baseHsl.h - candidateHsl.h)
  );
  const saturationDelta = Math.abs(baseHsl.s - candidateHsl.s);
  const lightnessDelta = Math.abs(baseHsl.l - candidateHsl.l);

  if (hueDelta <= 12 && saturationDelta <= 0.28 && lightnessDelta <= 0.28) {
    return true;
  }

  return (
    baseHsl.s < 0.12 &&
    candidateHsl.s < 0.12 &&
    lightnessDelta <= 0.08 &&
    directDistance <= 28
  );
}

function upsertCluster(clusters, sample) {
  const match = clusters.find((cluster) =>
    shouldMergeColors(cluster.representativeHex, sample.color)
  );

  if (!match) {
    clusters.push({
      representativeHex: sample.color,
      weight: 0,
      rawWeight: 0,
      sampleCount: 0,
      colors: new Map(),
      roleWeights: new Map(),
      sourceWeights: new Map()
    });
    return clusters[clusters.length - 1];
  }

  return match;
}

function recordContribution(cluster, sample) {
  cluster.weight += sample.weight;
  cluster.rawWeight += sample.rawWeight;
  cluster.sampleCount += 1;
  cluster.colors.set(sample.color, (cluster.colors.get(sample.color) || 0) + sample.weight);
  cluster.roleWeights.set(sample.role, (cluster.roleWeights.get(sample.role) || 0) + sample.weight);
  cluster.sourceWeights.set(sample.source, (cluster.sourceWeights.get(sample.source) || 0) + sample.weight);

  const strongestColor = [...cluster.colors.entries()].sort((left, right) => right[1] - left[1])[0];
  cluster.representativeHex = strongestColor[0];
}

function toPaletteEntry(cluster, totalWeight) {
  const sortedRoles = [...cluster.roleWeights.entries()].sort((left, right) => {
    const leftPriority = ROLE_PRIORITY.indexOf(left[0]);
    const rightPriority = ROLE_PRIORITY.indexOf(right[0]);

    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return (leftPriority === -1 ? ROLE_PRIORITY.length : leftPriority) -
      (rightPriority === -1 ? ROLE_PRIORITY.length : rightPriority);
  });

  return {
    hex: cluster.representativeHex,
    label: sortedRoles[0]?.[0] || "neutral",
    weight: Number(cluster.weight.toFixed(2)),
    usage: Number((cluster.weight / totalWeight).toFixed(4)),
    roles: Object.fromEntries(cluster.roleWeights),
    sources: Object.fromEntries(cluster.sourceWeights),
    isDark: isDark(cluster.representativeHex),
    luminance: Number(relativeLuminance(cluster.representativeHex).toFixed(4))
  };
}

function pickRoleHex(entries, roleName, fallback) {
  const match = entries
    .filter((entry) => entry.roles[roleName])
    .sort((left, right) => right.roles[roleName] - left.roles[roleName])[0];

  return match?.hex || fallback || null;
}

function pickPrimary(entries, backgroundHex, textHex) {
  const rolePreferred = entries
    .filter((entry) => entry.label === "primary" || entry.label === "accent" || entry.label === "cta" || entry.label === "brand")
    .sort((left, right) => right.weight - left.weight)[0];

  if (rolePreferred) {
    return rolePreferred.hex;
  }

  const fallback = entries
    .filter((entry) => entry.hex !== backgroundHex && entry.hex !== textHex)
    .filter((entry) => {
      const hsl = rgbToHsl(hexToRgb(entry.hex));
      return hsl.s >= 0.12 && hsl.l >= 0.2 && hsl.l <= 0.8;
    })
    .sort((left, right) => right.weight - left.weight)[0];

  return fallback?.hex || entries[0]?.hex || null;
}

export function analyzePalette({ page = {}, domSamples = [], screenshotSamples = [] } = {}) {
  const allSamples = [
    ...normalizeSamples(domSamples, "dom"),
    ...normalizeSamples(screenshotSamples, "screenshot")
  ];

  if (allSamples.length === 0) {
    return {
      page,
      palette: [],
      roles: {},
      warnings: ["No readable colors were found on the current page."]
    };
  }

  const clusters = [];

  for (const sample of allSamples) {
    const cluster = upsertCluster(clusters, sample);
    recordContribution(cluster, sample);
  }

  const totalWeight = clusters.reduce((sum, cluster) => sum + cluster.weight, 0);
  const palette = clusters
    .map((cluster) => toPaletteEntry(cluster, totalWeight))
    .sort((left, right) => right.weight - left.weight);

  const background = pickRoleHex(
    palette,
    "background",
    [...palette].sort((left, right) => right.luminance - left.luminance || right.weight - left.weight)[0]?.hex
  );
  const text = pickRoleHex(
    palette,
    "text",
    [...palette].sort((left, right) => left.luminance - right.luminance || right.weight - left.weight)[0]?.hex
  );
  const surface = pickRoleHex(
    palette,
    "surface",
    palette.find((entry) => entry.hex !== background && !entry.isDark)?.hex || background
  );
  const primary = pickPrimary(palette, background, text);

  return {
    page,
    palette,
    roles: {
      primary,
      background,
      text,
      surface
    },
    warnings: []
  };
}
