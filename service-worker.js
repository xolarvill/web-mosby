const LATEST_CAPTURE_KEY = "latestCapture";
const ANALYSIS_CONTEXT_KEY = "analysisContext";
const ANALYSIS_TIMEOUT_MS = 3000;

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    [LATEST_CAPTURE_KEY]: {
      status: "idle",
      message: "点击扩展图标，开始分析当前页面的可见配色。"
    }
  });
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id || !tab.windowId) {
    return;
  }

  await chrome.storage.local.set({
    [ANALYSIS_CONTEXT_KEY]: {
      tabId: tab.id,
      windowId: tab.windowId,
      title: tab.title || "",
      url: tab.url || ""
    }
  });

  try {
    await runAnalysisForTab(tab);
  } finally {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (error) {
      console.error("Unable to open side panel", error);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "reanalyze-current-page") {
    void reanalyzeCurrentPage()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      });

    return true;
  }

  if (message?.type === "get-analysis-context") {
    void chrome.storage.local
      .get([ANALYSIS_CONTEXT_KEY, LATEST_CAPTURE_KEY])
      .then((result) =>
        sendResponse({
          ok: true,
          context: result[ANALYSIS_CONTEXT_KEY] || null,
          latestCapture: result[LATEST_CAPTURE_KEY] || null
        })
      )
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );

    return true;
  }

  return false;
});

async function reanalyzeCurrentPage() {
  const stored = await chrome.storage.local.get(ANALYSIS_CONTEXT_KEY);
  const context = stored[ANALYSIS_CONTEXT_KEY];

  if (!context?.tabId || !context.windowId) {
    throw new Error("No active page context is available. Click the extension icon again.");
  }

  const tab = await chrome.tabs.get(context.tabId);
  await runAnalysisForTab(tab);
}

async function runAnalysisForTab(tab) {
  if (!tab?.id || !tab.windowId) {
    throw new Error("Missing tab context for analysis.");
  }

  const page = {
    title: tab.title || "",
    url: tab.url || ""
  };

  await chrome.storage.local.set({
    [LATEST_CAPTURE_KEY]: {
      status: "analyzing",
      page,
      startedAt: new Date().toISOString(),
      message: "正在分析当前视口的颜色样本..."
    }
  });

  try {
    const domSamples = await collectDomSamples(tab.id);
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: 72
    });
    const warnings = [];

    if (domSamples.length < 6) {
      warnings.push("DOM 可见颜色样本偏少，结果可能更依赖截图像素。");
    }

    await chrome.storage.local.set({
      [LATEST_CAPTURE_KEY]: {
        status: "ready",
        page,
        tabId: tab.id,
        windowId: tab.windowId,
        startedAt: new Date().toISOString(),
        domSamples,
        screenshotDataUrl,
        warnings
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown analysis error.";

    await chrome.storage.local.set({
      [LATEST_CAPTURE_KEY]: {
        status: "error",
        page,
        error: message,
        message: "分析失败。通常是页面权限已过期，或当前页面不支持截图采样。"
      }
    });

    throw error;
  }
}

function collectDomSamples(tabId) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeoutId);
      chrome.runtime.onMessage.removeListener(handleMessage);
    };

    const finalize = (callback) => (value) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      callback(value);
    };

    const resolveOnce = finalize(resolve);
    const rejectOnce = finalize(reject);

    const handleMessage = (message, sender) => {
      if (message?.type !== "dom-samples") {
        return;
      }

      if (sender.tab?.id !== tabId) {
        return;
      }

      if (message.ok) {
        resolveOnce(message.samples || []);
      } else {
        rejectOnce(new Error(message.error || "Failed to collect DOM samples."));
      }
    };

    const timeoutId = setTimeout(() => {
      rejectOnce(new Error("Timed out while waiting for page color samples."));
    }, ANALYSIS_TIMEOUT_MS);

    chrome.runtime.onMessage.addListener(handleMessage);

    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ["content-script.js"]
      },
      () => {
        const runtimeError = chrome.runtime.lastError;

        if (runtimeError) {
          rejectOnce(new Error(runtimeError.message));
        }
      }
    );
  });
}
