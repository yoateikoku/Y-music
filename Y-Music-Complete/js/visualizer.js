(function (global) {
  "use strict";

  const peaks = new Float32Array(64);
  let bg, bgCtx, wv, wvCtx;

  function init(bgCanvas, waveCanvas, waveWrap) {
    bg = bgCanvas;
    bgCtx = bg.getContext("2d");
    wv = waveCanvas;
    wvCtx = wv.getContext("2d");

    function resize() {
      bg.width = window.innerWidth;
      bg.height = window.innerHeight;
      wv.width = waveWrap.clientWidth || 300;
      wv.height = 42;
    }
    window.addEventListener("resize", resize);
    resize();
  }

  function renderFrame(analyser, playing, embedMode, progressRatio, vuFillEl) {
    const W = bg.width, H = bg.height;
    bgCtx.fillStyle = "rgba(6,7,9,0.28)";
    bgCtx.fillRect(0, 0, W, H);

    const bars = 64;
    const data = new Uint8Array(bars);
    if (analyser && playing && !embedMode) {
      analyser.getByteFrequencyData(data);
    } else if (playing) {
      const t = performance.now() * 0.004;
      for (let i = 0; i < bars; i++) {
        data[i] = Math.max(8, Math.sin(t + i * 0.25) * 90 + 100);
      }
    }

    let sum = 0;
    const bw = W / bars;
    for (let i = 0; i < bars; i++) {
      const v = data[i] / 255;
      sum += v;
      const bh = v * H * 0.62;
      if (bh > peaks[i]) peaks[i] = bh;
      else peaks[i] = Math.max(0, peaks[i] - 2.2);

      const hue = (i / bars) * 360;
      bgCtx.fillStyle = "hsla(" + hue + ",95%,55%,0.42)";
      bgCtx.fillRect(i * bw + 1, H - bh, Math.max(2, bw - 3), bh);
      bgCtx.fillStyle = "hsla(" + hue + ",100%,75%,0.9)";
      bgCtx.fillRect(i * bw + 1, H - peaks[i] - 3, Math.max(2, bw - 3), 2);
    }

    if (vuFillEl) {
      vuFillEl.style.width = Math.min(100, (sum / bars) * 180) + "%";
    }

    const ww = wv.width, wh = wv.height;
    wvCtx.clearRect(0, 0, ww, wh);
    for (let i = 0; i < bars; i++) {
      const x = (i / bars) * ww;
      const h = Math.max(4, (data[i] / 255) * wh * 0.85 || (Math.sin(i * 0.6) * 8 + 14));
      wvCtx.fillStyle = (i / bars) <= progressRatio ? "#00e5ff" : "rgba(255,255,255,0.18)";
      wvCtx.fillRect(x, (wh - h) / 2, Math.max(2, ww / bars - 2), h);
    }
  }

  global.YVisualizer = { init, renderFrame };
})(window);
