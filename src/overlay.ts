declare const QRCode: any
declare const JsBarcode: any

(function() {
  if ((window as any).__codegrab_injected) {
    return
  }
  (window as any).__codegrab_injected = true

  async function injectOverlay() {
    if (document.getElementById("codegrab-overlay")) return

    const htmlText = await (await fetch(chrome.runtime.getURL("public/overlay.html"))).text()
    const wrapper = document.createElement("div")
    wrapper.innerHTML = htmlText
    document.body.appendChild(wrapper)
    
    const css = document.createElement("link")
    css.rel = "stylesheet"
    css.href = chrome.runtime.getURL("public/overlay.css")
    css.id = "codegrab-overlay-css"
    document.head.appendChild(css)

    const closeBtn = document.getElementById("codegrab-close")
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        const overlay = document.getElementById("codegrab-overlay")
        if (overlay) overlay.style.display = "none"
      })
    }

    const minimizeBtn = document.getElementById("codegrab-minimize")
    const overlay = document.getElementById("codegrab-overlay")
    if (minimizeBtn && overlay) {
      minimizeBtn.addEventListener("click", (e) => {
        e.stopPropagation()
        overlay.classList.add("minimized")
      })
      overlay.addEventListener("click", (e) => {
        if (overlay.classList.contains("minimized")) {
          overlay.classList.remove("minimized")
          e.stopPropagation()
        }
      })
      document.addEventListener("mousedown", (e) => {
        if (!overlay.contains(e.target as Node) && !overlay.classList.contains("minimized") && overlay.style.display !== "none") {
          overlay.classList.add("minimized")
        }
      })
    }

    const qrBtn = document.getElementById('codegrab-generate-qr')
    const barcodeBtn = document.getElementById('codegrab-generate-barcode')
    if (qrBtn && barcodeBtn) {
      qrBtn.addEventListener('mouseenter', () => {
        barcodeBtn.style.display = 'inline-block'
      })
      qrBtn.addEventListener('mouseleave', () => {
        setTimeout(() => {
          if (!barcodeBtn.matches(':hover')) barcodeBtn.style.display = 'none'
        }, 100)
      })
      barcodeBtn.addEventListener('mouseleave', () => {
        barcodeBtn.style.display = 'none'
      })
    }

    (document.getElementById("codegrab-remove-input") as HTMLButtonElement).addEventListener('click', () => {
      (document.getElementById("codegrab-input") as HTMLInputElement).value = ''
    })

    const js1 = document.createElement("script")
    js1.src = chrome.runtime.getURL("lib/qrcode.min.js")
    js1.id = "codegrab-qrcode-js"
    js1.onload = () => {
      const js2 = document.createElement("script")
      js2.src = chrome.runtime.getURL("lib/JsBarcode.all.min.js")
      js2.id = "codegrab-barcode-js"
      document.body.appendChild(js2)
    }
    document.body.appendChild(js1)

    const logoImg = document.getElementById('codegrab-logo-img') as HTMLImageElement | null
    if (logoImg) {
      logoImg.src = chrome.runtime.getURL('public/icons/logo.svg')
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "ping") {
      sendResponse({ type: "pong" })
      return true
    }

    injectOverlay().then(() => {
      const overlay = document.getElementById("codegrab-overlay")
      const output = document.getElementById("codegrab-output")
      if (!overlay || !output) return

      const cbox = document.getElementById('codegrab-remember') as HTMLInputElement
      const inputWrap = document.querySelector('.codegrab-input') as HTMLDivElement
      const input = document.getElementById('codegrab-input') as HTMLInputElement
      const url = location.hostname
      const selectors = JSON.parse(localStorage.getItem('codegrab_selectors') || '{}')
      const selector = selectors[url]?.selector

      cbox.checked = selector && selector === message.selector

      if (message.type === 'toggle-overlay') {
        if (output.children.length > 0 && selector) {
          const text = getTextFromSelector(selector)

          if (output.title === text) {
            cbox.disabled = false
            cbox.checked = true
            cbox.parentElement?.classList.remove("codegrab-disabled")
          } else {
            cbox.checked = false
            cbox.disabled = true
            cbox.parentElement?.classList.add("codegrab-disabled")
          }
        } else {
          cbox.checked = false
          cbox.disabled = true
          cbox.parentElement?.classList.add("codegrab-disabled")
        }
      } else if (message.type === "generate-from-selector") {
        //
      } else {
        // generate-qr or generate-barcode
      }

      cbox.onchange = () => {
        if (cbox.checked) {
          if (message.selector && message.text) {
            const el = document.querySelector(message.selector)
            let sliceInfo = null
            if (el) {
              const idx = ((el as HTMLElement).innerText || '').indexOf(message.text)
              if (idx !== -1) {
                sliceInfo = { start: idx, end: idx + message.text.length }
              }
            }
            selectors[url] = {
              selector: message.selector,
              name: message.text?.slice(0, 32) || 'Element',
              slice: sliceInfo
            }
            localStorage.setItem('codegrab_selectors', JSON.stringify(selectors))
          }
        } else {
          if (output.title !== getTextFromSelector(selectors[url].selector)) {
            cbox.disabled = true
            cbox.parentElement?.classList.add("codegrab-disabled")
          }

          delete selectors[url]
          localStorage.setItem('codegrab_selectors', JSON.stringify(selectors))
        }
      }

      input.oninput = () => {
        if (selectors[url] && input.value === getTextFromSelector(selectors[url].selector)) {
          inputWrap.classList.add("stored")
        } else {
          inputWrap.classList.remove("stored")
        }
      }

      let selectorToUse = message.selector
      let textToUse = message.text
      if ((message.type === 'generate-from-selector' || message.type === 'toggle-overlay') && selectors[url]) {
        selectorToUse = selectors[url].selector
        const el = document.querySelector(selectorToUse)
        if (el && selectors[url].slice) {
          const fullText = (el as HTMLElement).innerText || ''
          const { start, end } = selectors[url].slice
          textToUse = fullText.slice(start, end)
        } else if (el) {
          textToUse = (el as HTMLElement).innerText || ''
        }
      }
      if (selectorToUse) {
        (document.getElementById('codegrab-input') as HTMLInputElement).value = textToUse || ''
      }

      function renderOutputQR(text?: string) {
        if (!output) return
        output.innerHTML = ""
        new QRCode(output, {
          text: text || "No data",
          width: 200,
          height: 200
        })
      }
      
      function renderOutputBarcode(text?: string) {
        if (!output) return
        output.innerHTML = ""
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        output.appendChild(svg)
        JsBarcode(svg, text || "No data", {
          format: "CODE128",
          width: 2,
          height: 80,
          displayValue: true
        })
      }

      function getTextFromSelector(selector: string) {
        const el = document.querySelector(selector)
        
        if (el) {
          const text = (el as HTMLElement).innerText || ''
          if (selectors[url].slice) {
            const { start, end } = selectors[url].slice
            return text.slice(start, end)
          }
          if (text.length > 0) return text
        }
        return null
      }

      // Always rerender QR code on overlay open, but only if there is data
      if (message.type === "toggle-overlay" && overlay.style.display !== "none") {
        const inputVal = (document.getElementById('codegrab-input') as HTMLInputElement).value
        if (inputVal && inputVal.trim() !== '') {
          renderOutputQR(inputVal)
        } else {
          const output = document.getElementById("codegrab-output")
          if (output) output.innerHTML = ''
        }
      }

      // Make the QR and Barcode buttons work
      const qrBtn = document.getElementById('codegrab-generate-qr')
      const barcodeBtn = document.getElementById('codegrab-generate-barcode')
      if (qrBtn) {
        qrBtn.onclick = () => {
          const val = (document.getElementById('codegrab-input') as HTMLInputElement).value
          if (val && val.trim() !== '') {
            renderOutputQR(val)
          }
        }
      }
      if (barcodeBtn) {
        barcodeBtn.onclick = () => {
          const val = (document.getElementById('codegrab-input') as HTMLInputElement).value
          if (val && val.trim() !== '') {
            renderOutputBarcode(val)
          }
        }
      }

      if (message.type !== "toggle-overlay") {
        overlay.style.display = "grid"
        overlay.classList.remove("minimized")
      }
      if (message.type === "toggle-overlay") {
        if (overlay.style.display === "grid") {
          overlay.style.display = "none"
        } else {
          overlay.style.display = "grid"
          overlay.classList.remove("minimized")
          // Only rerender QR if there is data
          const inputVal = (document.getElementById('codegrab-input') as HTMLInputElement).value
          if (inputVal && inputVal.trim() !== '') {
            renderOutputQR(inputVal)
          } else {
            const output = document.getElementById("codegrab-output")
            if (output) output.innerHTML = ''
          }
        }
        return
      }
    })
  })
})()
