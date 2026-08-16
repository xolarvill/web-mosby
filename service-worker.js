import { getTabAnalysisSupport } from "./lib/tab-support.js";

const LATEST_CAPTURE_KEY = "latestCapture";
const ANALYSIS_TIMEOUT_MS = 3000;

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    [LATEST_CAPTURE_KEY]: {
      status: "idle",
      message: "点击扩展图标，开始分析当前页面的颜色与字体。"
    }
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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

  return false;
});

async function reanalyzeCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

  if (!tab?.id || !tab.windowId) {
    throw new Error("No active page is available for analysis.");
  }

  const result = await runAnalysisForTab(tab);

  if (!result.ok && !result.expected) {
    throw result.error;
  }
}

async function runAnalysisForTab(tab) {
  if (!tab?.id || !tab.windowId) {
    throw new Error("Missing tab context for analysis.");
  }

  const support = getTabAnalysisSupport(tab);

  const page = {
    title: tab.title || "",
    url: tab.url || ""
  };

  if (!support.supported) {
    await chrome.storage.local.set({
      [LATEST_CAPTURE_KEY]: {
        status: "error",
        page,
        error: support.reason,
        message: "当前页面不支持分析，请切到普通网页后再试。"
      }
    });

    return {
      ok: false,
      expected: true,
      error: new Error(support.reason)
    };
  }

  await chrome.storage.local.set({
    [LATEST_CAPTURE_KEY]: {
      status: "analyzing",
      page,
      startedAt: new Date().toISOString(),
      message: "正在分析当前视口的颜色与字体样本..."
    }
  });

  try {
    const { domSamples, fontSamples } = await collectDomSamples(tab.id);
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
        fontSamples,
        screenshotDataUrl,
        warnings
      }
    });

    return {
      ok: true
    };
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

    return {
      ok: false,
      expected: false,
      error: error instanceof Error ? error : new Error(message)
    };
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
        resolveOnce({
          domSamples: message.samples || [],
          fontSamples: message.fontSamples || []
        });
      } else {
        rejectOnce(new Error(message.error || "Failed to collect DOM samples."));
      }
    };

    const timeoutId = setTimeout(() => {
      rejectOnce(new Error("Timed out while waiting for page design samples."));
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
