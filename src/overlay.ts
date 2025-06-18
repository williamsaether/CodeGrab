declare const QRCode: any
declare const JsBarcode: any

(function() {
  if ((window as any).__codegrab_injected) {
    return
  }
  (window as any).__codegrab_injected = true

  async function injectOverlay() {
    if (document.getElementById('codegrab-shadow-host')) return

    const htmlText = await (await fetch(chrome.runtime.getURL('public/overlay.html'))).text()
    const wrapper = document.createElement('div')
    wrapper.id = 'codegrab-shadow-host'
    const shadow = wrapper.attachShadow({ mode: 'open' })
    document.body.appendChild(wrapper)

    const htmlWrapper = document.createElement('div')
    htmlWrapper.innerHTML = htmlText
    shadow.appendChild(htmlWrapper)
    
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = chrome.runtime.getURL('public/overlay.css')
    css.id = 'codegrab-overlay-css'
    shadow.appendChild(css)

    await new Promise((resolve) => setTimeout(resolve, 0))

    const $ = (id: string) => shadow.getElementById(id)!
    
    const overlay = $('codegrab-overlay')

    $('codegrab-close').addEventListener('click', () => {
      overlay.style.display = 'none'
    })

    $('codegrab-minimize').addEventListener('click', (e) => {
      e.stopPropagation()
      overlay.classList.add('minimized')
    })
    
    overlay.addEventListener('click', (e) => {
      if (overlay.classList.contains('minimized')) {
        overlay.classList.remove('minimized')
        e.stopPropagation()
        window.dispatchEvent(new CustomEvent('codegrab-unminimized'))
      }
    })

    document.addEventListener('mousedown', (e) => {
      const wrapper = document.getElementById('codegrab-shadow-host')
      const shadow = wrapper?.shadowRoot

      const isClickInsideOverlay = e
        .composedPath()
        .filter((el): el is Node => el instanceof Node)
        .some((el) => shadow?.contains(el))

      if (
        !isClickInsideOverlay &&
        !overlay.classList.contains('minimized') &&
        overlay.style.display !== 'none'
      ) {
        overlay.classList.add('minimized')
      }
    })

    const qrBtn = $('codegrab-generate-qr')
    const barcodeBtn = $('codegrab-generate-barcode')

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
    
    $('codegrab-remove-input').addEventListener('click', () => {
      ($('codegrab-input') as HTMLInputElement).value = ''
    })

    const inputElement = $('codegrab-input') as HTMLInputElement
    const inputWrapper = inputElement.parentElement as HTMLDivElement
    
    inputElement.addEventListener('focusin', () => {
      inputWrapper.classList.add('focus')
    })

    inputElement.addEventListener('focusout', () => {
      inputWrapper.classList.remove('focus')
    })

    const js1 = document.createElement('script')
    js1.src = chrome.runtime.getURL('lib/qrcode.min.js')
    js1.id = 'codegrab-qrcode-js'
    js1.onload = () => {
      const js2 = document.createElement('script')
      js2.src = chrome.runtime.getURL('lib/JsBarcode.all.min.js')
      js2.id = 'codegrab-barcode-js'
      document.body.appendChild(js2)
    }
    document.body.appendChild(js1);

    ($('codegrab-logo-img') as HTMLImageElement).src = chrome.runtime.getURL('public/icons/codegrab-white@500x.webp')
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ping') {
      sendResponse({ type: 'pong' })
      return true
    }

    injectOverlay().then(async () => {
      const wrapper = document.getElementById('codegrab-shadow-host')
      const shadow = wrapper?.shadowRoot!
      const $ = (id: string) => shadow.getElementById(id)!
      const $$ = (query: string) => shadow.querySelector(query)!

      const overlay = $('codegrab-overlay') as HTMLDivElement
      const output = $('codegrab-output') as HTMLDivElement
      if (!overlay || !output) return

      const outputText = $$('#codegrab-value span') as HTMLSpanElement
      const cbox = $('codegrab-remember') as HTMLInputElement
      const input = $('codegrab-input') as HTMLInputElement
      const inputWrap = input.parentElement as HTMLDivElement
      const url = location.hostname
      let selectorObj: any = undefined
      try {
        const result = await new Promise<any>(resolve => chrome.storage.sync.get(url, resolve))
        selectorObj = result[url]
      } catch (e) {
        selectorObj = undefined
      }
      const selector = selectorObj?.selector

      cbox.checked = selector && selector === message.selector

      let text = getTextFromSelector(selector)
      input.value = text || ''

      window.addEventListener('codegrab-unminimized', () => {
        text = getTextFromSelector(selector)
        if (text) input.value = text
        checkUpdated()
      })

      if (message.type === 'toggle-overlay') {
        if (output.children.length === 0 && selector) {
          if (text) {
            renderOutputQR(text)
            enableAndCheckCheckbox()
            setGenerated(true)
          }
        } else if (output.children.length > 0 && selector) {
          if (output.title === text) enableAndCheckCheckbox()
          else if (overlay.style.display === 'none' && text) {
            renderOutputQR(text)
            enableAndCheckCheckbox()
            setGenerated(true)
          } else if (overlay.classList.contains('minimized')) {
            if (getGenerated() === true) enableAndCheckCheckbox()
            else disableAndUncheckCheckbox()
            checkUpdated()
          } else disableAndUncheckCheckbox()
        } else disableAndUncheckCheckbox()
      } else if (message.type === 'generate-qr') {
        renderOutputQR(message.text)
        enableCheckbox()
        setGenerated(false)
      } else if (message.type === 'generate-barcode') {
        renderOutputBarcode(message.text)
        enableCheckbox()
        setGenerated(false)
      }

      cbox.onchange = async () => {
        if (cbox.checked) {
          if (message.selector && message.text) {
            text = message.text
            if (text) input.value = text
            checkUpdated()
            const el = document.querySelector(message.selector)
            let sliceInfo = null
            if (el) {
              const idx = ((el as HTMLElement).innerText || '').indexOf(message.text)
              if (idx !== -1) {
                sliceInfo = { start: idx, end: idx + message.text.length }
              }
            }
            const selectorObj = {
              selector: message.selector,
              name: message.text?.slice(0, 32) || 'Element',
              slice: sliceInfo
            }
            await new Promise<void>(resolve => chrome.storage.sync.set({ [url]: selectorObj }, resolve))
          }
        } else {
          if (text && output.title !== text) {
            cbox.disabled = true
            cbox.parentElement?.classList.add('codegrab-disabled')
            text = null
          }
          if (!message.selector) {
            disableAndUncheckCheckbox()
            checkUpdated()
          }
          await new Promise<void>(resolve => chrome.storage.sync.remove(url, resolve))
        }
      }

      checkUpdated()
      input.oninput = () => checkUpdated()

      function renderOutputQR(value?: string) {
        if (!value) return
        output.innerHTML = ''
        new QRCode(output, {
          text: value || 'No data',
          width: 200,
          height: 200
        })
        output.title = value
        outputText.textContent = value
      }
      
      function renderOutputBarcode(value?: string) {
        if (!value) return
        output.innerHTML = ''
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        output.appendChild(svg)
        JsBarcode(svg, value || 'No data', {
          format: 'CODE128',
          width: 2,
          height: 80,
          displayValue: true
        })
        output.title = value || ''
        outputText.textContent = value || '...'
      }

      function getTextFromSelector(selector: string) {
        const el = document.querySelector(selector)
        if (el) {
          const text = (el as HTMLElement).innerText || ''
          if (selectorObj?.slice) return (({ start, end }) => text.slice(start, end))(selectorObj.slice)
          if (text.length > 0) return text
        }
        return null
      }

      function enableCheckbox() {
        cbox.disabled = false
        cbox.parentElement?.classList.remove('codegrab-disabled')
      }

      function enableAndCheckCheckbox() {
        cbox.disabled = false
        cbox.checked = true
        cbox.parentElement?.classList.remove('codegrab-disabled')
      }

      function disableAndUncheckCheckbox() {
        cbox.disabled = true
        cbox.checked = false
        cbox.parentElement?.classList.add('codegrab-disabled')
      }

      function checkUpdated() {
        if (input.value === text) {
          inputWrap.classList.add('stored')
        } else {
          inputWrap.classList.remove('stored')
        }
      }

      function setGenerated(value: boolean) {
        output.setAttribute('generated-from-selector', value + '')
      }

      function getGenerated() {
        return output.getAttribute('generated-from-selector') === 'true'
      }
      
      ($('codegrab-generate-qr') as HTMLButtonElement).onclick = () => {
        const val = input.value
        if (val && val.trim() !== '') {
          if (val === text) enableAndCheckCheckbox()
          else disableAndUncheckCheckbox()
          renderOutputQR(val)
          checkUpdated()
        }
      }
      ($('codegrab-generate-barcode') as HTMLButtonElement).onclick = () => {
        const val = input.value
        if (val && val.trim() !== '') {
          if (val === text) enableAndCheckCheckbox()
          else disableAndUncheckCheckbox()
          renderOutputBarcode(val)
          checkUpdated()
        }
      }

      const copyBtn = $('codegrab-copy') as HTMLButtonElement
      const downloadBtn = $('codegrab-download') as HTMLButtonElement
      
      function utf8ToBase64(str: string) {
        return btoa(
          encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
            String.fromCharCode(parseInt(p1, 16))
          )
        )
      }

      function svgToPngBlob(svg: SVGSVGElement): Promise<Blob> {
        return new Promise((resolve, reject) => {
          const bbox = svg.getBBox()
          const canvas = document.createElement('canvas')
          canvas.width = bbox.width
          canvas.height = bbox.height
          const ctx = canvas.getContext('2d')!
          const svgData = new XMLSerializer().serializeToString(svg)
          const imgSrc = 'data:image/svg+xml;base64,' + utf8ToBase64(svgData)
          const image = new window.Image()
          image.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(image, 0, 0)
            canvas.toBlob((blob) => {
              if (blob) resolve(blob)
              else reject(new Error('Failed to create PNG blob'))
            }, 'image/png')
          }
          image.onerror = reject
          image.src = imgSrc
        })
      }

      copyBtn.onclick = async () => {
        const img = output.querySelector('img') as HTMLImageElement | null
        const svg = output.querySelector('svg') as SVGSVGElement | null
        if (img) {
          try {
            const response = await fetch(img.src)
            const blob = await response.blob()
            await navigator.clipboard.write([
              new ClipboardItem({ [blob.type]: blob })
            ])
            copyBtn.textContent = 'Copied!'
            setTimeout(() => (copyBtn.textContent = 'Copy'), 1200)
          } catch (e) {
            copyBtn.textContent = 'Failed!'
            setTimeout(() => (copyBtn.textContent = 'Copy'), 1200)
          }
        } else if (svg) {
          try {
            const blob = await svgToPngBlob(svg)
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ])
            copyBtn.textContent = 'Copied!'
            setTimeout(() => (copyBtn.textContent = 'Copy'), 1200)
          } catch (e) {
            copyBtn.textContent = 'Failed!'
            setTimeout(() => (copyBtn.textContent = 'Copy'), 1200)
          }
        }
      }

      downloadBtn.onclick = async () => {
        const img = output.querySelector('img') as HTMLImageElement | null
        const svg = output.querySelector('svg') as SVGSVGElement | null
        if (img) {
          const a = document.createElement('a')
          a.href = img.src
          a.download = 'codegrab-' + output.title + '-qr.png'
          document.body.appendChild(a)
          a.click()
          setTimeout(() => document.body.removeChild(a), 100)
        } else if (svg) {
          try {
            const blob = await svgToPngBlob(svg)
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'codegrab-' + output.title + '-barcode.png'
            document.body.appendChild(a)
            a.click()
            setTimeout(() => {
              document.body.removeChild(a)
              URL.revokeObjectURL(url)
            }, 100)
          } catch (e) {}
        }
      }
      
      if (message.type !== 'toggle-overlay') {
        overlay.style.display = 'grid'
        overlay.classList.remove('minimized')
      }
      if (message.type === 'toggle-overlay') {
        if (overlay.classList.contains('minimized')) {
          overlay.style.display = 'grid'
          overlay.classList.remove('minimized')
        } else if (overlay.style.display === 'grid') {
          overlay.style.display = 'none'
        } else {
          overlay.style.display = 'grid'
          overlay.classList.remove('minimized')
        }
        return
      }
    })
  })
})()
