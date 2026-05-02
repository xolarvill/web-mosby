const HEX_PATTERN = /^#?([0-9a-f]{6})$/i;

export function normalizeHex(input) {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  const shortMatch = /^#?([0-9a-f]{3})$/i.exec(trimmed);

  if (shortMatch) {
    const expanded = shortMatch[1]
      .split("")
      .map((value) => value + value)
      .join("");

    return `#${expanded.toLowerCase()}`;
  }

  const match = HEX_PATTERN.exec(trimmed);
  return match ? `#${match[1].toLowerCase()}` : null;
}

export function hexToRgb(hex) {
  const normalized = normalizeHex(hex);

  if (!normalized) {
    return null;
  }

  const value = normalized.slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

export function rgbToHex({ r, g, b }) {
  const values = [r, g, b].map((channel) =>
    Math.max(0, Math.min(255, Math.round(channel)))
      .toString(16)
      .padStart(2, "0")
  );

  return `#${values.join("")}`;
}

export function colorDistance(hexA, hexB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);

  if (!a || !b) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.sqrt(
    (a.r - b.r) ** 2 +
      (a.g - b.g) ** 2 +
      (a.b - b.b) ** 2
  );
}

export function rgbToHsl({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l: lightness };
  }

  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue;

  switch (max) {
    case red:
      hue = (green - blue) / delta + (green < blue ? 6 : 0);
      break;
    case green:
      hue = (blue - red) / delta + 2;
      break;
    default:
      hue = (red - green) / delta + 4;
      break;
  }

  return {
    h: hue * 60,
    s: saturation,
    l: lightness
  };
}

export function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);

  if (!rgb) {
    return 0;
  }

  const channels = [rgb.r, rgb.g, rgb.b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function isDark(hex) {
  return relativeLuminance(hex) < 0.4;
}

export function slugify(value) {
  return String(value || "palette")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "palette";
}
