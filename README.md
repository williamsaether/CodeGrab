# CodeGrab

**CodeGrab** is a browser extension that allows you to quickly generate QR codes and barcodes from any selected text or saved selector on a website. It works entirely client-side and respects your privacy.

👉 **[Install CodeGrab from the Chrome Web Store](https://chromewebstore.google.com/detail/codegrab/doijgnjlnohblbcidlgnmkpjnfppcalp)**  
Available for all Chromium-based browsers: Chrome, Edge, Brave, Vivaldi, Opera, etc.

## ✨ Features

- Right-click to generate a QR or barcode from selected text
- Save CSS selectors to auto-generate codes per site
- Minimal overlay UI with Shadow DOM isolation
- Manual input for generating codes
- Copy or download QR/barcode as PNG
- 100% client-side – no data collected or stored
- Powered by [CodeCore](https://codecore.bysaether.com)

## 🛠 Technologies Used

- [@medv/finder](https://github.com/antonmedv/finder)
- [JsBarcode](https://github.com/lindell/JsBarcode)
- [QRCode.js](https://github.com/davidshimjs/qrcodejs)
- TypeScript + Shadow DOM + Chrome Extensions API

## 🔒 Privacy & Data Usage

CodeGrab is fully client-side. No user data is collected. See [Privacy Policy](https://codegrab.bysaether.com/privacy-policy) for more info.

## 📦 Installation (Dev)

```bash
git clone https://github.com/yourusername/codegrab.git
cd codegrab
npm install
npx tsc --watch
# Load /dist as unpacked extension in Chrome
