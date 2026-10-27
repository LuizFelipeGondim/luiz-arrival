// ==========================================
// 3D PINBALL FOR WINDOWS - SPACE CADET (WASM)
// ==========================================

let pinballRunning = false;
let pinballMessageListenerInstalled = false;

function installPinballMessageListener() {
  if (pinballMessageListenerInstalled) return;
  pinballMessageListenerInstalled = true;

  window.addEventListener("message", (e) => {
    const data = e && e.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "pinball-status") {
      const statusEl = document.getElementById("pinball-status");
      if (!statusEl) return;
      if (data.ready || !data.text) {
        statusEl.style.display = "none";
        statusEl.textContent = "";
      } else {
        statusEl.style.display = "block";
        statusEl.textContent = data.text;
      }
    } else if (data.type === "pinball-focus") {
      const win = document.getElementById("win-pinball");
      if (win && typeof bringToFront === "function") {
        bringToFront(win);
      }
    }
  });
}

function focusPinballIframe() {
  const iframe = document.getElementById("pinball-iframe");
  if (!iframe) return;
  try {
    iframe.focus();
    if (iframe.contentWindow) {
      iframe.contentWindow.focus();
      const canvas = iframe.contentDocument && iframe.contentDocument.getElementById("canvas");
      if (canvas) canvas.focus();
    }
  } catch {}
}

function openPinballWindow() {
  openWindow("win-pinball");
  initPinballGame();
}

function initPinballGame() {
  installPinballMessageListener();

  const wrap = document.getElementById("pinball-container");
  const statusEl = document.getElementById("pinball-status");
  if (!wrap) return;

  if (pinballRunning && document.getElementById("pinball-iframe")) {
    setTimeout(focusPinballIframe, 50);
    return;
  }

  pinballRunning = true;
  if (statusEl) {
    statusEl.style.display = "block";
    statusEl.textContent = "⏳ Carregando 3D Pinball Space Cadet...";
  }

  wrap.innerHTML =
    '<iframe id="pinball-iframe" class="pinball-iframe" src="/assets/pinball/embed.html" width="600" height="440" frameborder="0" scrolling="no" allow="autoplay"></iframe>';

  const iframe = document.getElementById("pinball-iframe");
  if (iframe) {
    iframe.addEventListener("load", () => {
      setTimeout(focusPinballIframe, 60);
    });
  }
}

function stopPinballGame() {
  pinballRunning = false;
  const iframe = document.getElementById("pinball-iframe");
  if (iframe) {
    try {
      iframe.src = "about:blank";
    } catch {}
  }
  const wrap = document.getElementById("pinball-container");
  if (wrap) {
    wrap.innerHTML = "";
  }
  const statusEl = document.getElementById("pinball-status");
  if (statusEl) {
    statusEl.style.display = "none";
    statusEl.textContent = "";
  }
}
