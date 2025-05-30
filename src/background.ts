chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		id: "generate-qr",
		title: "Generate QR Code",
		contexts: ["selection"]
	})
	chrome.contextMenus.create({
		id: "generate-barcode",
		title: "Generate Barcode",
		contexts: ["selection"]
	})
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["dist/overlay.js"]
  }).then(() => {
    chrome.tabs.sendMessage(tab.id!, {
      type: info.menuItemId,
      text: info.selectionText
    });
  });
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id) return;

  // Try to ping the content script first
  chrome.tabs.sendMessage(tab.id!, { type: "ping" }, (response) => {
    if (response && response.type === "pong") {
      // Already injected, just toggle
      chrome.tabs.sendMessage(tab.id!, { type: "toggle-overlay" });
    } else {
      // Not injected, inject then toggle
      chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        files: ["dist/overlay.js"]
      }).then(() => {
        chrome.tabs.sendMessage(tab.id!, { type: "toggle-overlay" });
      });
    }
  });
});