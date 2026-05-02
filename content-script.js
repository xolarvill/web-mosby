(function collectVisibleColorSamples() {
  try {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
    const viewportArea = Math.max(1, viewportWidth * viewportHeight);
    const elements = Array.from(document.querySelectorAll("body, body *")).slice(0, 1800);
    const samples = [];

    const pushSample = (color, role, weight, source) => {
      if (!isSupportedColor(color) || !Number.isFinite(weight) || weight <= 0) {
        return;
      }

      samples.push({
        color: normalizeToHex(color),
        role,
        weight: Number(weight.toFixed(2)),
        source
      });
    };

    for (const element of elements) {
      const style = window.getComputedStyle(element);

      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number.parseFloat(style.opacity || "1") < 0.05
      ) {
        continue;
      }

      const rect = element.getBoundingClientRect();

      if (rect.width < 2 || rect.height < 2) {
        continue;
      }

      const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));

      if (visibleWidth < 2 || visibleHeight < 2) {
        continue;
      }

      const visibleArea = visibleWidth * visibleHeight;
      const areaWeight = Math.min(100, (visibleArea / viewportArea) * 140);
      const textWeight = Math.max(4, Math.min(28, areaWeight * 0.55));
      const accentWeight = Math.max(5, Math.min(36, areaWeight * 0.8));

      const backgroundColor = style.backgroundColor;
      const textColor = style.color;
      const borderColor = style.borderTopColor;
      const fillColor = style.fill;
      const strokeColor = style.stroke;

      if (isSupportedColor(backgroundColor)) {
        pushSample(
          backgroundColor,
          visibleArea / viewportArea > 0.18 ? "background" : "surface",
          areaWeight,
          "background"
        );
      }

      if (isSupportedColor(textColor)) {
        pushSample(textColor, "text", textWeight, "text");
      }

      if (
        isSupportedColor(borderColor) &&
        Number.parseFloat(style.borderTopWidth || "0") > 0
      ) {
        pushSample(borderColor, "surface", Math.max(3, areaWeight * 0.35), "border");
      }

      if (isSupportedColor(fillColor)) {
        pushSample(fillColor, "accent", accentWeight, "fill");
      }

      if (isSupportedColor(strokeColor)) {
        pushSample(strokeColor, "accent", Math.max(3, accentWeight * 0.5), "stroke");
      }

      if (style.backgroundImage && style.backgroundImage.includes("gradient")) {
        for (const gradientColor of extractCssColors(style.backgroundImage)) {
          pushSample(gradientColor, "accent", Math.max(4, areaWeight * 0.45), "gradient");
        }
      }
    }

    chrome.runtime.sendMessage({
      type: "dom-samples",
      ok: true,
      samples: samples.slice(0, 320)
    });
  } catch (error) {
    chrome.runtime.sendMessage({
      type: "dom-samples",
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  function isSupportedColor(value) {
    if (!value || typeof value !== "string") {
      return false;
    }

    if (value === "transparent" || value === "none") {
      return false;
    }

    if (value.startsWith("rgba")) {
      const alpha = Number.parseFloat(value.split(",")[3] || "1");
      return alpha > 0.05;
    }

    return value.startsWith("rgb") || value.startsWith("#");
  }

  function normalizeToHex(value) {
    if (value.startsWith("#")) {
      return value.toLowerCase();
    }

    const parts = value.match(/\d+(\.\d+)?/g);

    if (!parts || parts.length < 3) {
      return value.toLowerCase();
    }

    const [r, g, b] = parts.slice(0, 3).map((part) => Math.max(0, Math.min(255, Math.round(Number(part)))));
    return `#${[r, g, b]
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")}`;
  }

  function extractCssColors(cssValue) {
    const matches = cssValue.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,6}/g);
    return matches || [];
  }
})();
