// ==========================================
// MODO DIFÍCIL
// ==========================================

(function () {
  const HARD_MODE_KEY = "luizos_hard_mode";
  const JUMPSCARE_CHANCE = 0.04;          // por janela aberta
  const JUMPSCARE_CHANCE_DARK = 0.2;    // idem, com o Modo Escuro (flashlight.js) ligado
  const JUMPSCARE_COOLDOWN_MS = 90 * 1000; // intervalo mínimo entre sustos
  const JUMPSCARE_DURATION_MS = 1400;
  const JUMPSCARE_DIR = "assets/jumpscare/";
  const JUMPSCARE_IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp"];
  const JUMPSCARE_AUDIO_EXTS = ["mp3", "ogg"];

  let hardMode = false;
  let lastScareAt = Date.now(); // não assusta logo depois de carregar a página
  let scaring = false;

  try { hardMode = localStorage.getItem(HARD_MODE_KEY) === "true"; } catch {}

  const style = document.createElement("style");
  style.textContent = `
    /* Fundo transparente: o site continua visível atrás do susto. */
    .jumpscare-overlay {
      position: fixed; inset: 0; z-index: 2147483001; /* acima do Modo Escuro (flashlight.js) */
      background: transparent;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      overflow: hidden; cursor: none;
    }
    /* cover: a imagem ocupa a tela toda e o corte fica na borda da tela. */
    .jumpscare-overlay img { width: 100vw; height: 100vh; object-fit: cover; }
    .jumpscare-overlay svg {
      width: min(95vw, 95vh); height: min(95vw, 95vh);
      filter: contrast(1.6) drop-shadow(0 0 30px #f00);
    }
    /* A imagem (GIF animado) já tem o próprio movimento; só treme. */
    .jumpscare-overlay img { animation: js-shake 0.05s linear infinite; }
    .jumpscare-overlay svg {
      animation: js-zoom 0.25s cubic-bezier(.2,2,.4,1) forwards, js-shake 0.05s linear infinite;
    }
    @keyframes js-zoom { from { transform: scale(0.1); } to { transform: scale(1.15); } }
    @keyframes js-shake {
      0%   { translate: 0 0; }
      25%  { translate: -14px 8px; }
      50%  { translate: 10px -12px; }
      75%  { translate: -8px -6px; }
      100% { translate: 12px 10px; }
    }
  `;
  document.head.appendChild(style);

  // Rosto pálido com olhos vazios e boca rasgada.
  const FACE_SVG = `
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="js-skin" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#e8e2d0"/>
          <stop offset="70%" stop-color="#8a8470"/>
          <stop offset="100%" stop-color="#1a1610"/>
        </radialGradient>
        <radialGradient id="js-eye" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ff2020"/>
          <stop offset="25%" stop-color="#600"/>
          <stop offset="60%" stop-color="#000"/>
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="100" rx="78" ry="95" fill="url(#js-skin)"/>
      <path d="M40 70 Q60 55 85 72 Q70 100 45 95 Z" fill="url(#js-eye)"/>
      <path d="M160 70 Q140 55 115 72 Q130 100 155 95 Z" fill="url(#js-eye)"/>
      <path d="M100 95 L92 125 L108 125 Z" fill="#2a2418"/>
      <path d="M45 140 Q100 120 155 140 Q140 195 100 192 Q60 195 45 140 Z" fill="#000"/>
      <path d="M48 141 L56 156 L64 138 L72 158 L80 134 L88 160 L96 132 L104 160 L112 132 L120 158 L128 134 L136 156 L144 137 L152 154 L154 141"
            fill="none" stroke="#d8d0b8" stroke-width="3" stroke-linejoin="bevel"/>
      <path d="M58 180 L66 168 L74 184 L84 170 L94 188 L104 170 L114 188 L124 170 L134 184 L142 168"
            fill="none" stroke="#d8d0b8" stroke-width="3" stroke-linejoin="bevel"/>
      <path d="M100 5 L96 40 L104 60" fill="none" stroke="#300" stroke-width="2"/>
    </svg>`;

  // Pré-carrega jumpscare.<ext> (imagem e som), se existirem. Assim o susto
  // aparece na hora em vez de esperar o download. A imagem fica guardada como
  // Blob e cada susto usa uma object URL nova: com a mesma URL o navegador
  // reaproveitaria o GIF já animado e o pulo não recomeçaria do primeiro quadro.
  let customImageBlob = null;
  let customAudio = null;

  (async function preloadCustomImage() {
    for (const ext of JUMPSCARE_IMAGE_EXTS) {
      try {
        const res = await fetch(JUMPSCARE_DIR + "jumpscare." + ext);
        if (!res.ok || !(res.headers.get("content-type") || "").startsWith("image/")) continue;
        customImageBlob = await res.blob();
        return;
      } catch { /* tenta a próxima extensão */ }
    }
  })();

  (function preloadCustomAudio(i) {
    if (i >= JUMPSCARE_AUDIO_EXTS.length) return;
    const audio = new Audio();
    audio.preload = "auto";
    audio.addEventListener("canplaythrough", () => { customAudio = audio; }, { once: true });
    audio.addEventListener("error", () => preloadCustomAudio(i + 1), { once: true });
    audio.src = JUMPSCARE_DIR + "jumpscare." + JUMPSCARE_AUDIO_EXTS[i];
  })(0);

  let audioCtx = null;

  // Grito: osciladores dente-de-serra desafinados + ruído branco, com distorção.
  function playScream() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx;
      const now = ctx.currentTime;
      const dur = JUMPSCARE_DURATION_MS / 1000;

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.9, now + 0.02);
      master.gain.setValueAtTime(0.9, now + dur - 0.3);
      master.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      const shaper = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / curve.length) * 2 - 1;
        curve[i] = Math.tanh(x * 8);
      }
      shaper.curve = curve;
      shaper.connect(master).connect(ctx.destination);

      [520, 547, 780, 1210].forEach((f) => {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(f * 0.6, now);
        osc.frequency.exponentialRampToValueAtTime(f * 1.4, now + 0.15);
        osc.frequency.exponentialRampToValueAtTime(f, now + dur);
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 23 + Math.random() * 10;
        lfoGain.gain.value = f * 0.08;
        lfo.connect(lfoGain).connect(osc.frequency);
        const g = ctx.createGain();
        g.gain.value = 0.25;
        osc.connect(g).connect(shaper);
        osc.start(now); lfo.start(now);
        osc.stop(now + dur); lfo.stop(now + dur);
      });

      const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.35;
      noise.connect(noiseGain).connect(shaper);
      noise.start(now);
    } catch { /* sem áudio, só o visual */ }
  }

  function triggerJumpscare() {
    if (scaring) return;
    scaring = true;
    lastScareAt = Date.now();

    const overlay = document.createElement("div");
    overlay.className = "jumpscare-overlay";
    const imageUrl = customImageBlob ? URL.createObjectURL(customImageBlob) : null;
    overlay.innerHTML = imageUrl ? `<img src="${imageUrl}" alt="">` : FACE_SVG;
    document.body.appendChild(overlay);
    if (customAudio) {
      customAudio.currentTime = 0;
      customAudio.volume = 1;
      customAudio.play().catch(playScream);
    } else {
      playScream();
    }

    setTimeout(() => {
      overlay.remove();
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      scaring = false;
    }, JUMPSCARE_DURATION_MS);
  }

  function maybeJumpscare() {
    if (!hardMode || scaring) return;
    if (Date.now() - lastScareAt < JUMPSCARE_COOLDOWN_MS) return;
    if (Math.random() < currentChance()) triggerJumpscare();
  }

  function currentChance() {
    const darkMode = document.querySelector("#flashlight-overlay.on");
    return darkMode ? JUMPSCARE_CHANCE_DARK : JUMPSCARE_CHANCE;
  }

  function syncHardModeUI() {
    document.body.classList.toggle("hard-mode", hardMode);
    const btn = document.getElementById("hardmode-menu-btn");
    if (btn) btn.textContent = `💀 Modo Difícil: ${hardMode ? "ON" : "OFF"}`;
  }

  function toggleHardMode() {
    hardMode = !hardMode;
    lastScareAt = Date.now();
    try { localStorage.setItem(HARD_MODE_KEY, String(hardMode)); } catch {}
    syncHardModeUI();
  }

  // Envolve openWindow (global de app.js): o sorteio só acontece quando a
  // janela estava fechada, igual ao som de abertura.
  const originalOpenWindow = window.openWindow;
  window.openWindow = function (id) {
    const w = document.getElementById(id);
    const wasHidden = w && w.style.display !== "block";
    const result = originalOpenWindow.apply(this, arguments);
    if (wasHidden) maybeJumpscare();
    return result;
  };

  window.toggleHardMode = toggleHardMode;
  window.triggerJumpscare = triggerJumpscare;
  syncHardModeUI();
})();
