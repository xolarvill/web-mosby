const SUPPORTED_PROTOCOLS = new Set(["http:", "https:"]);

export function getTabAnalysisSupport(tab) {
  const url = tab?.url || "";

  if (!url) {
    return {
      supported: false,
      reason: "Current tab URL is unavailable."
    };
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    return {
      supported: false,
      reason: `Unsupported page URL: ${url}`
    };
  }

  if (!SUPPORTED_PROTOCOLS.has(parsedUrl.protocol)) {
    return {
      supported: false,
      reason: `This page uses ${parsedUrl.protocol} and Chrome extensions cannot analyze it with activeTab.`
    };
  }

  return {
    supported: true,
    reason: null
  };
}
