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
      if (overlay && message.type !== "toggle-overlay") {
        overlay.style.display = "grid"
        overlay.classList.remove("minimized")
      }
      if (overlay && message.type === "toggle-overlay") {
        if (overlay.style.display === "grid") {
          overlay.style.display = "none"
        } else {
          overlay.style.display = "grid"
          overlay.classList.remove("minimized")
        }
        return
      }

      const output = document.getElementById("codegrab-output")
      if (!output) return

      output.innerHTML = ""

      if (message.type === "generate-qr") {
        new QRCode(output, {
          text: message.text || "No data",
          width: 200,
          height: 200
        })
      } else if (message.type === "generate-barcode") {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        output.appendChild(svg)

        JsBarcode(svg, message.text || "123456789012", {
          format: "CODE128",
          width: 2,
          height: 80,
          displayValue: true
        })
      }
    })
  })
})()
