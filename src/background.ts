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
	chrome.contextMenus.create({
		id: "toggle-overlay",
		title: "Open CodeGrab",
		contexts: ["all"]
	})
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return

  if (info.menuItemId === "toggle-overlay") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["dist/overlay.js"]
    }).then(() => {
      chrome.tabs.sendMessage(tab.id!, { type: "toggle-overlay" })
    })
    return
  }

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["lib/finder.umd.js"]
  }).then(() => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      func: (selectedText: string) => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        let node: Node | null
        while ((node = walker.nextNode())) {
          if (node.nodeValue?.includes(selectedText)) {
            const el = node.parentElement
            // @ts-ignore
            return typeof window.finder === "function" && el ? window.finder(el) : null
          }
        }
        return null
      },
      args: [info.selectionText || '']
    }, (results) => {
      const selector = results && results[0] && results[0].result;
      chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        files: ["dist/overlay.js"]
      }).then(() => {
        chrome.tabs.sendMessage(tab.id!, {
          type: info.menuItemId,
          text: info.selectionText,
          selector: selector
        })
      })
    })
  })
})

chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id) return

  chrome.tabs.sendMessage(tab.id!, { type: "ping" }, (response) => {
    if (response && response.type === "pong") {
      chrome.tabs.sendMessage(tab.id!, { type: "toggle-overlay" })
    } else {
      chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        files: ["dist/overlay.js"]
      }).then(() => {
        chrome.tabs.sendMessage(tab.id!, { type: "toggle-overlay" })
      })
    }
  })
})