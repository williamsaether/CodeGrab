declare const QRCode: any
declare const JsBarcode: any

async function injectOverlay() {
  if (document.getElementById("codesnag-overlay")) return;

  const htmlText = await (await fetch(chrome.runtime.getURL("public/overlay.html"))).text();
  const wrapper = document.createElement("div");
  wrapper.innerHTML = htmlText;
  document.body.appendChild(wrapper);

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = chrome.runtime.getURL("public/overlay.css");
  document.head.appendChild(css);

  document.getElementById("codesnag-close")?.addEventListener("click", () => {
    document.getElementById("codesnag-overlay")?.remove();
  });

  const js1 = document.createElement("script");
  js1.src = chrome.runtime.getURL("lib/qrcode.min.js");
  js1.onload = () => {
    const js2 = document.createElement("script");
    js2.src = chrome.runtime.getURL("lib/JsBarcode.all.min.js");
    document.body.appendChild(js2);
  };
  document.body.appendChild(js1);
}

chrome.runtime.onMessage.addListener((message) => {
  injectOverlay().then(() => {
    const output = document.getElementById("codesnag-output");
    if (!output) return;

    output.innerHTML = "";

    if (message.type === "generate-qr") {
      new QRCode(output, {
        text: message.text || "No data",
        width: 128,
        height: 128
      });
    } else if (message.type === "generate-barcode") {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      output.appendChild(svg);

      JsBarcode(svg, message.text || "123456789012", {
				format: "CODE128",
				width: 2,
				height: 80,
				displayValue: true
			});
    }
  });
});
