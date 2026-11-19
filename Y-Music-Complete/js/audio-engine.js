(function (global) {
  "use strict";

  let audioCtx, srcNode, gainNode, eqHi, eqMid, eqLow, fltNode;
  let delayNode, delayFb, delayWet, subNode, presNode, airNode, compNode;
  let analyser, recDest, mediaRec, recChunks = [];
  let hifiEnabled = true;
  let currentPreset = "STUDIO HI-FI";
  let presets = {
    "STUDIO HI-FI": { sub: 3.5, pres: 2.0, air: 3.0, thresh: -14, ratio: 3.5 },
    "CLUB BASS":    { sub: 7.5, pres: 1.0, air: 2.0, thresh: -18, ratio: 5.0 },
    "CLEAR VOCAL":  { sub: 0.5, pres: 4.5, air: 2.5, thresh: -12, ratio: 2.5 },
    "LOUDNESS":     { sub: 5.0, pres: 3.0, air: 4.0, thresh: -20, ratio: 6.0 },
    "FLAT":         { sub: 0.0, pres: 0.0, air: 0.0, thresh: -6,  ratio: 1.5 }
  };

  function setPresets(map) {
    if (map && typeof map === "object") presets = map;
  }

  function init(audioEl, initialVol) {
    if (audioCtx) {
      if (audioCtx.state === "suspended") audioCtx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    srcNode = audioCtx.createMediaElementSource(audioEl);

    eqLow = audioCtx.createBiquadFilter(); eqLow.type = "lowshelf"; eqLow.frequency.value = 250;
    eqMid = audioCtx.createBiquadFilter(); eqMid.type = "peaking"; eqMid.frequency.value = 1000; eqMid.Q.value = 1;
    eqHi  = audioCtx.createBiquadFilter(); eqHi.type = "highshelf"; eqHi.frequency.value = 3500;
    fltNode = audioCtx.createBiquadFilter(); fltNode.type = "allpass";

    delayNode = audioCtx.createDelay(1.0); delayNode.delayTime.value = 0.28;
    delayFb = audioCtx.createGain(); delayFb.gain.value = 0.35;
    delayWet = audioCtx.createGain(); delayWet.gain.value = 0;

    subNode  = audioCtx.createBiquadFilter(); subNode.type = "lowshelf"; subNode.frequency.value = 60;
    presNode = audioCtx.createBiquadFilter(); presNode.type = "peaking"; presNode.frequency.value = 2800; presNode.Q.value = 1.2;
    airNode  = audioCtx.createBiquadFilter(); airNode.type = "highshelf"; airNode.frequency.value = 12000;
    compNode = audioCtx.createDynamicsCompressor();

    gainNode = audioCtx.createGain();
    gainNode.gain.value = typeof initialVol === "number" ? initialVol : 0.85;

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    recDest = audioCtx.createMediaStreamDestination();

    srcNode.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHi);
    eqHi.connect(fltNode);

    fltNode.connect(subNode);
    fltNode.connect(delayNode);
    delayNode.connect(delayFb);
    delayFb.connect(delayNode);
    delayNode.connect(delayWet);
    delayWet.connect(subNode);

    subNode.connect(presNode);
    presNode.connect(airNode);
    airNode.connect(compNode);
    compNode.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(audioCtx.destination);
    gainNode.connect(recDest);

    applyPreset(currentPreset);
  }

  function applyPreset(name) {
    currentPreset = name;
    const p = presets[name] || presets["FLAT"];
    if (!subNode) return;
    const m = hifiEnabled ? 1 : 0;
    subNode.gain.value = p.sub * m;
    presNode.gain.value = p.pres * m;
    airNode.gain.value = p.air * m;
    compNode.threshold.value = hifiEnabled ? p.thresh : -1;
    compNode.ratio.value = hifiEnabled ? p.ratio : 1;
  }

  function setHifi(flag) {
    hifiEnabled = !!flag;
    applyPreset(currentPreset);
  }

  function setParam(key, val) {
    if (!audioCtx) return;
    if (key === "vol") gainNode.gain.value = val;
    if (key === "hi") eqHi.gain.value = val;
    if (key === "mid") eqMid.gain.value = val;
    if (key === "low") eqLow.gain.value = val;
    if (key === "echo") delayWet.gain.value = val;
    if (key === "flt") {
      if (Math.abs(val) < 0.05) fltNode.type = "allpass";
      else if (val < 0) { fltNode.type = "lowpass"; fltNode.frequency.value = Math.max(180, 12000 * (1 + val)); }
      else { fltNode.type = "highpass"; fltNode.frequency.value = 100 + val * 4500; }
    }
  }

  function triggerFx(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.connect(g);
    g.connect(gainNode);

    if (type === "horn") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.12);
      g.gain.setValueAtTime(0.35, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.start(now); osc.stop(now + 0.72);
    } else if (type === "sub") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.9);
      g.gain.setValueAtTime(0.6, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      osc.start(now); osc.stop(now + 1.0);
    } else if (type === "laser") {
      osc.type = "square";
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.25);
      g.gain.setValueAtTime(0.25, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.start(now); osc.stop(now + 0.28);
    } else if (type === "siren") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.linearRampToValueAtTime(980, now + 0.35);
      osc.frequency.linearRampToValueAtTime(520, now + 0.7);
      g.gain.setValueAtTime(0.3, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc.start(now); osc.stop(now + 0.78);
    } else {
      const len = audioCtx.sampleRate * (type === "clap" ? 0.18 : 0.35);
      const nb = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const d = nb.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.25));
      const ns = audioCtx.createBufferSource();
      ns.buffer = nb;
      const hp = audioCtx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = type === "clap" ? 1200 : 6000;
      ns.connect(hp); hp.connect(gainNode); ns.start(now);
    }
  }

  function encodeWavBlob(l, r, sr) {
    const n = l.length;
    const buf = new ArrayBuffer(44 + n * 4);
    const v = new DataView(buf);
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, "RIFF"); v.setUint32(4, 36 + n * 4, true); ws(8, "WAVE"); ws(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
    ws(36, "data"); v.setUint32(40, n * 4, true);
    let off = 44;
    for (let i = 0; i < n; i++) {
      v.setInt16(off, Math.max(-1, Math.min(1, l[i])) * 32767, true); off += 2;
      v.setInt16(off, Math.max(-1, Math.min(1, r[i])) * 32767, true); off += 2;
    }
    return new Blob([buf], { type: "audio/wav" });
  }

  function synthTrackBlob(mode, bpm) {
    const sr = 44100, sec = 16, len = sr * sec;
    const chL = new Float32Array(len), chR = new Float32Array(len);
    const beatLen = Math.floor(sr * 60 / bpm);
    const notes = mode === "phonk" ? [55, 55, 65.4, 51.9] : mode === "techno" ? [49, 49, 55, 61.7] : [130.8, 164.8, 196, 146.8];
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const bPos = (i % beatLen) / beatLen;
      const bar = Math.floor(i / beatLen) % notes.length;
      const kick = Math.sin(2 * Math.PI * (140 * Math.exp(-bPos * 18) + 42) * bPos * 0.25) * Math.exp(-bPos * 7) * 0.7;
      const bass = Math.tanh(Math.sin(2 * Math.PI * notes[bar] * t) * (mode === "phonk" ? 3.2 : 1.5)) * 0.35;
      const hat = ((i % Math.floor(beatLen / 2)) < 900 ? (Math.random() * 2 - 1) * 0.14 : 0);
      const cow = mode === "phonk" && (i % Math.floor(beatLen / 2)) < 2400
        ? Math.sin(2 * Math.PI * 560 * t) * Math.exp(-((i % Math.floor(beatLen / 2)) / 900)) * 0.25
        : 0;
      const s = Math.max(-0.95, Math.min(0.95, kick + bass + hat + cow));
      chL[i] = s; chR[i] = s * 0.98;
    }
    return encodeWavBlob(chL, chR, sr);
  }

  async function renderWavWithDsp(arrayBuffer) {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const off = new OfflineAudioContext(2, decoded.length, decoded.sampleRate);
    const s = off.createBufferSource();
    s.buffer = decoded;
    const p = presets[currentPreset] || presets["FLAT"];
    const sub = off.createBiquadFilter(); sub.type = "lowshelf"; sub.frequency.value = 60; sub.gain.value = hifiEnabled ? p.sub : 0;
    const air = off.createBiquadFilter(); air.type = "highshelf"; air.frequency.value = 12000; air.gain.value = hifiEnabled ? p.air : 0;
    const comp = off.createDynamicsCompressor(); comp.threshold.value = hifiEnabled ? p.thresh : -1;
    s.connect(sub); sub.connect(air); air.connect(comp); comp.connect(off.destination);
    s.start(0);
    const rendered = await off.startRendering();
    return encodeWavBlob(rendered.getChannelData(0), rendered.getChannelData(1), rendered.sampleRate);
  }

  function startLiveRec(onStop) {
    recChunks = [];
    mediaRec = new MediaRecorder(recDest.stream);
    mediaRec.ondataavailable = e => { if (e.data.size) recChunks.push(e.data); };
    mediaRec.onstop = () => onStop(new Blob(recChunks, { type: "audio/webm" }));
    mediaRec.start();
  }

  function stopLiveRec() {
    if (mediaRec && mediaRec.state !== "inactive") mediaRec.stop();
  }

  function getAnalyser() { return analyser; }
  function getPresets() { return presets; }

  global.YAudio = {
    init, setPresets, getPresets, applyPreset, setHifi, setParam,
    triggerFx, synthTrackBlob, renderWavWithDsp, startLiveRec, stopLiveRec, getAnalyser
  };
})(window);
