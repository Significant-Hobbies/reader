chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function sendPageContentRequest(tabId: number, message: unknown) {
  return chrome.tabs.sendMessage(tabId, message);
}

async function extractPageContent(tabId: number, message: unknown) {
  try {
    return await sendPageContentRequest(tabId, message);
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-script.js'],
      });
      return await sendPageContentRequest(tabId, message);
    } catch {
      return { type: 'PAGE_CONTENT', data: null, fallback: true };
    }
  }
}

// Relay messages between content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PAGE_CONTENT') {
    // Forward to the active tab's content script
    getActiveTab().then(async (tab) => {
      const tabId = tab?.id;
      if (!tabId) {
        sendResponse({ type: 'PAGE_CONTENT', data: null, fallback: true });
        return;
      }
      const response = await extractPageContent(tabId, message);
      sendResponse(response);
    });
    return true; // Keep channel open for async response
  }

  if (message.type === 'GET_ACTIVE_TAB') {
    getActiveTab().then((tab) => {
      sendResponse({ tabId: tab?.id, url: tab?.url });
    });
    return true;
  }

  if (message.type === 'OPEN_URL_IN_ACTIVE_TAB') {
    getActiveTab().then((tab) => {
      const tabId = tab?.id;
      if (!tabId || typeof message.url !== 'string') {
        sendResponse({ ok: false });
        return;
      }

      chrome.tabs.update(tabId, { url: message.url }, () => {
        sendResponse({ ok: !chrome.runtime.lastError });
      });
    });
    return true;
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    getActiveTab().then((tab) => {
      const tabId = tab?.id;
      if (!tabId) {
        sendResponse({ ok: false });
        return;
      }

      chrome.sidePanel.open({ tabId }, () => {
        sendResponse({ ok: !chrome.runtime.lastError });
      });
    });
    return true;
  }
});

// Re-extract content when user navigates within a tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    chrome.runtime
      .sendMessage({
        type: 'TAB_UPDATED',
        tabId,
      })
      .catch(() => {
        // Side panel may not be open yet
      });
  }
});
