// Open side panel when the extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Relay messages between content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PAGE_CONTENT') {
    // Forward to the active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        sendResponse({ type: 'PAGE_CONTENT', data: null, fallback: true });
        return;
      }
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ type: 'PAGE_CONTENT', data: null, fallback: true });
          return;
        }
        sendResponse(response);
      });
    });
    return true; // Keep channel open for async response
  }

  if (message.type === 'GET_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tabId: tabs[0]?.id, url: tabs[0]?.url });
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
