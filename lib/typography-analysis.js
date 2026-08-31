const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace"
]);

export function analyzeTypography({ fontSamples = [] } = {}) {
  const buckets = new Map();

  for (const sample of fontSamples) {
    const family = normalizeFontFamily(sample.family || sample.stack);
    const weight = Number(sample.weight);

    if (!family || !Number.isFinite(weight) || weight <= 0) {
      continue;
    }

    const bucket = buckets.get(family) || {
      family,
      stack: sample.stack || family,
      weight: 0,
      samples: 0,
      sizeTotal: 0,
      weightTotal: 0,
      styles: new Map()
    };

    bucket.weight += weight;
    bucket.samples += 1;
    bucket.sizeTotal += Number(sample.size) || 0;
    bucket.weightTotal += parseFontWeight(sample.fontWeight);
    const style = normalizeStyle(sample);
    const styleBucket = bucket.styles.get(style.key) || { ...style, weight: 0, sampleCount: 0 };
    styleBucket.weight += weight;
    styleBucket.sampleCount += 1;
    bucket.styles.set(style.key, styleBucket);
    buckets.set(family, bucket);
  }

  const totalWeight = [...buckets.values()].reduce((sum, bucket) => sum + bucket.weight, 0);
  const fonts = [...buckets.values()]
    .sort((left, right) => right.weight - left.weight)
    .map((bucket) => ({
      family: bucket.family,
      stack: bucket.stack,
      usage: totalWeight > 0 ? bucket.weight / totalWeight : 0,
      sampleCount: bucket.samples,
      averageSize: bucket.samples > 0 ? Math.round(bucket.sizeTotal / bucket.samples) : 0,
      averageWeight: bucket.samples > 0 ? Math.round(bucket.weightTotal / bucket.samples) : 0,
      styles: [...bucket.styles.values()]
        .sort((left, right) => right.weight - left.weight)
        .map(({ key, weight, ...style }) => ({
          ...style,
          usage: bucket.weight > 0 ? weight / bucket.weight : 0
        }))
    }));

  return {
    fonts,
    primary: fonts[0]?.family || null,
    totalWeight: Number(totalWeight.toFixed(2)),
    warnings: fonts.length === 0 ? ["No readable font samples were found on the current page."] : []
  };
}

function normalizeStyle(sample) {
  const fontWeight = String(sample.fontWeight || "normal");
  const fontSize = Number(sample.size) > 0 ? `${Number(sample.size)}px` : "unknown";
  const lineHeight = String(sample.lineHeight || "normal");
  const letterSpacing = String(sample.letterSpacing || "normal");
  const fontStyle = String(sample.fontStyle || "normal");

  return {
    key: [fontWeight, fontSize, lineHeight, letterSpacing, fontStyle].join("|"),
    fontWeight,
    fontSize,
    lineHeight,
    letterSpacing,
    fontStyle
  };
}

function normalizeFontFamily(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const firstSpecific = value
    .split(",")
    .map((part) => part.trim().replace(/^["']|["']$/g, ""))
    .find((part) => part && !GENERIC_FAMILIES.has(part.toLowerCase()));

  return firstSpecific || null;
}

function parseFontWeight(value) {
  if (Number.isFinite(Number(value))) {
    return Number(value);
  }

  if (value === "bold" || value === "bolder") {
    return 700;
  }

  return 400;
}
