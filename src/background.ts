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
    if (typeof tab?.id !== 'number') return;

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selectedText: string) => {
        function getElementBySelectedText(selectedText: string): Element | null {
          if (!selectedText) return null
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null)
          let node: Node | null
          while ((node = walker.nextNode())) {
            if (node.nodeValue && node.nodeValue.includes(selectedText)) {
              return node.parentElement
            }
          }
          return null
        }
        function getUniqueSelector(el: Element | null): string {
          if (!el) return ''
          if (el.id) return `#${el.id}`
          let path = []
          while (el && el.nodeType === 1 && el !== document.body) {
            let selector = el.nodeName.toLowerCase()
            if (el.className) selector += '.' + Array.from(el.classList).join('.')
            path.unshift(selector)
            el = el.parentElement!
          }
          return path.join(' > ')
        }
        const el = getElementBySelectedText(selectedText)
        const selector = getUniqueSelector(el)
        return selector
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