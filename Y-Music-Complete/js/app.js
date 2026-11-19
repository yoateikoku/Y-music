(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  let DEFAULT_ICON = "https://i.pinimg.com/736x/cb/9e/29/cb9e29fe8ad55421b6a0b621e095cd05.jpg";
  let settings = null;

  const audioEl = new Audio();
  audioEl.crossOrigin = "anonymous";
  audioEl.preload = "auto";

  const state = {
    playing: false,
    userStopped: true,
    nonStop: true,
    hifi: true,
    preset: "STUDIO HI-FI",
    embedMode: false,
    provider: "audius",
    queue: [],
    qIndex: -1,
    currentTrack: null,
    cues: [null, null, null, null],
    loop: { active: false, start: 0, end: 0 },
    discAngle: 0,
    scratching: false,
    recording: false,
    shuffle: false,
    playlists: JSON.parse(localStorage.getItem("ym_playlists_v3") || '[{"name":"FAVORITES","tracks":[]}]'),
    activePl: 0
  };

  const BUILTIN = [
    { id: "bi_1", title: "Y-PHONK 808 DRIVE", artist: "Y-MUSIC ENGINE", bpm: 132, mode: "phonk", artwork: DEFAULT_ICON, source: "BUILTIN" },
    { id: "bi_2", title: "MIDNIGHT TECHNO PULSE", artist: "Y-MUSIC ENGINE", bpm: 128, mode: "techno", artwork: DEFAULT_ICON, source: "BUILTIN" },
    { id: "bi_3", title: "CYBER LO-FI DRIFT", artist: "Y-MUSIC ENGINE", bpm: 92, mode: "lofi", artwork: DEFAULT_ICON, source: "BUILTIN" }
  ];

  function toast(msg) {
    $("toast-msg").textContent = msg;
    $("toast").style.display = "flex";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => ($("toast").style.display = "none"), 2600);
  }

  function fmt(s) {
    if (!isFinite(s)) return "00:00";
    const m = Math.floor(s / 60), sc = Math.floor(s % 60);
    return String(m).padStart(2, "0") + ":" + String(sc).padStart(2, "0");
  }

  function setViewMode(embed) {
    state.embedMode = embed;
    $("disc-wrap").style.display = embed ? "none" : "flex";
    $("embed-box").classList.toggle("show", embed);
  }

  function updatePlayButtons() {
    const lbl = state.playing ? "PAUSE" : "PLAY";
    $("btn-play").textContent = lbl;
    $("m-play").textContent = lbl;
  }

  function updateCueUI() {
    document.querySelectorAll("[data-cue]").forEach(b => {
      b.classList.toggle("active", state.cues[+b.dataset.cue] !== null);
    });
  }

  async function requestWakeLock() {
    try { if ("wakeLock" in navigator) await navigator.wakeLock.request("screen"); } catch {}
  }

  function updateMediaSession(track) {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist || "Y-Music",
      artwork: [{ src: track.artwork || DEFAULT_ICON, sizes: "512x512", type: "image/jpeg" }]
    });
    navigator.mediaSession.setActionHandler("play", togglePlay);
    navigator.mediaSession.setActionHandler("pause", () => {
      state.userStopped = true; audioEl.pause(); state.playing = false; updatePlayButtons();
    });
    navigator.mediaSession.setActionHandler("nexttrack", nextTrack);
    navigator.mediaSession.setActionHandler("previoustrack", prevTrack);
  }

  async function loadTrack(track, autoPlay = true) {
    YAudio.init(audioEl, parseFloat($("f-vol").value));
    state.currentTrack = track;
    state.cues = [null, null, null, null];
    state.loop.active = false;
    updateCueUI();

    $("t-title").textContent = track.title;
    $("t-artist").textContent = track.artist || track.source || "Y-MUSIC";
    $("m-title").textContent = track.title;
    $("m-sub").textContent = track.artist || track.source || "Y-MUSIC";
    $("disc-art").src = track.artwork || DEFAULT_ICON;

    if (track.embedUrl) {
      audioEl.pause();
      state.playing = true;
      $("embed-box").innerHTML = '<iframe src="' + track.embedUrl + '" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>';
      setViewMode(true);
      $("t-mode").textContent = track.source || "EMBED";
      updatePlayButtons();
      return;
    }

    $("embed-box").innerHTML = "";
    setViewMode(false);
    let src = track.streamUrl;
    if (track.mode) {
      if (!track._blobUrl) track._blobUrl = URL.createObjectURL(YAudio.synthTrackBlob(track.mode, track.bpm));
      src = track._blobUrl;
    }

    audioEl.crossOrigin = "anonymous";
    audioEl.src = src;
    audioEl.playbackRate = parseFloat($("f-pitch").value);
    $("t-mode").textContent = track.source || "AUDIO";

    if (autoPlay) {
      state.userStopped = false;
      try {
        await audioEl.play();
        state.playing = true;
        requestWakeLock();
        updateMediaSession(track);
      } catch {
        // CORS fallback without anonymous header
        audioEl.crossOrigin = null;
        audioEl.src = src;
        try {
          await audioEl.play();
          state.playing = true;
        } catch {
          toast("TAP PLAY TO START");
        }
      }
    }
    updatePlayButtons();
  }

  async function togglePlay() {
    YAudio.init(audioEl, parseFloat($("f-vol").value));
    if (!state.currentTrack) {
      state.queue = BUILTIN.slice();
      state.qIndex = 0;
      return loadTrack(state.queue[0], true);
    }
    if (state.embedMode) return toast("CONTROL INSIDE EMBED PLAYER");
    if (audioEl.paused) {
      state.userStopped = false;
      await audioEl.play();
      state.playing = true;
      requestWakeLock();
    } else {
      state.userStopped = true;
      audioEl.pause();
      state.playing = false;
    }
    updatePlayButtons();
  }

  function stopPlay() {
    state.userStopped = true;
    state.playing = false;
    audioEl.pause();
    audioEl.currentTime = 0;
    if (state.embedMode) { $("embed-box").innerHTML = ""; setViewMode(false); }
    updatePlayButtons();
  }

  function nextTrack() {
    if (!state.queue.length) return;
    state.qIndex = state.shuffle && state.queue.length > 1
      ? Math.floor(Math.random() * state.queue.length)
      : (state.qIndex + 1) % state.queue.length;
    loadTrack(state.queue[state.qIndex], true);
  }

  function prevTrack() {
    if (!state.queue.length) return;
    state.qIndex = (state.qIndex - 1 + state.queue.length) % state.queue.length;
    loadTrack(state.queue[state.qIndex], true);
  }

  // NON-STOP Endless Playback
  audioEl.addEventListener("ended", () => {
    if (state.nonStop && !state.userStopped) {
      if (state.queue.length > 1) nextTrack();
      else { audioEl.currentTime = 0; audioEl.play().catch(() => {}); }
    } else {
      state.playing = false;
      updatePlayButtons();
    }
  });
  audioEl.addEventListener("pause", () => {
    if (state.nonStop && !state.userStopped && !state.embedMode && audioEl.readyState >= 2) {
      setTimeout(() => { if (!state.userStopped && audioEl.paused) audioEl.play().catch(() => {}); }, 350);
    }
  });

  // Search & URL
  async function runSearchOrUrl(val) {
    if (!YSecurity.allowRequest()) return toast("SHIELD: RATE LIMIT ACTIVE");
    const q = (val || $("search-inp").value).trim();
    if (!q) return;

    const parsed = YUrlParser.parseMediaUrl(q);
    if (parsed) {
      const tr = {
        id: "url_" + Date.now(),
        title: parsed.title,
        artist: parsed.service,
        source: parsed.service,
        artwork: DEFAULT_ICON,
        embedUrl: parsed.embedUrl,
        streamUrl: parsed.streamUrl
      };
      state.queue.unshift(tr);
      state.qIndex = 0;
      loadTrack(tr, true);
      switchMobileCol("deck");
      toast("LOADED: " + parsed.service);
      return;
    }

    $("search-list").innerHTML = '<div style="padding:12px;font-family:var(--mono);font-size:11px;color:var(--muted)">SEARCHING...</div>';
    try {
      let items = [];
      if (state.provider === "audius") {
        const r = await fetch("https://discoveryprovider.audius.co/v1/tracks/search?query=" + encodeURIComponent(q) + "&app_name=YMusicV3&limit=15");
        const j = await r.json();
        items = (j.data || []).map(t => ({
          id: "au_" + t.id,
          title: t.title || "Untitled",
          artist: (t.user && t.user.name) || "Unknown",
          artwork: (t.artwork && (t.artwork["480x480"] || t.artwork["150x150"])) || DEFAULT_ICON,
          streamUrl: "https://discoveryprovider.audius.co/v1/tracks/" + t.id + "/stream?app_name=YMusicV3",
          source: "AUDIUS"
        }));
      } else {
        const r = await fetch("https://itunes.apple.com/search?term=" + encodeURIComponent(q) + "&media=music&limit=15&country=jp");
        const j = await r.json();
        items = (j.results || []).filter(t => t.previewUrl).map(t => ({
          id: "it_" + t.trackId,
          title: t.trackName || "Untitled",
          artist: t.artistName || "Unknown",
          artwork: (t.artworkUrl100 || "").replace("100x100", "400x400") || DEFAULT_ICON,
          streamUrl: t.previewUrl,
          source: "ITUNES"
        }));
      }
      renderTrackList($("search-list"), items.length ? items : BUILTIN);
    } catch {
      renderTrackList($("search-list"), BUILTIN);
      toast("OFFLINE FALLBACK LOADED");
    }
  }

  function renderTrackList(container, items, isPl = false) {
    container.innerHTML = "";
    items.forEach((t, idx) => {
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML =
        '<img src="' + (t.artwork || DEFAULT_ICON) + '" onerror="this.src=\'' + DEFAULT_ICON + '\'">' +
        '<div class="item-info"><div class="item-t"></div><div class="item-s"></div></div>' +
        '<div class="item-act">' +
        (isPl ? '<button class="mini-btn" data-del="1">RM</button>' : '<button class="mini-btn" data-addpl="1">+PL</button>') +
        '</div>';
      el.querySelector(".item-t").textContent = t.title;
      el.querySelector(".item-s").textContent = (t.artist || "") + " // " + (t.source || "TRACK");
      el.addEventListener("click", e => {
        if (e.target.dataset.addpl) {
          state.playlists[state.activePl].tracks.push(t);
          savePlaylists();
          toast("ADDED TO " + state.playlists[state.activePl].name);
          return;
        }
        if (e.target.dataset.del) {
          state.playlists[state.activePl].tracks.splice(idx, 1);
          savePlaylists();
          renderPlaylists();
          return;
        }
        state.queue = items.slice();
        state.qIndex = idx;
        loadTrack(t, true);
        switchMobileCol("deck");
      });
      container.appendChild(el);
    });
  }

  function savePlaylists() {
    localStorage.setItem("ym_playlists_v3", JSON.stringify(state.playlists));
  }

  function renderPlaylists() {
    const ch = $("pl-chips");
    ch.innerHTML = "";
    state.playlists.forEach((p, i) => {
      const b = document.createElement("button");
      b.className = "chip" + (i === state.activePl ? " active" : "");
      b.textContent = p.name + " (" + p.tracks.length + ")";
      b.addEventListener("click", () => { state.activePl = i; renderPlaylists(); });
      ch.appendChild(b);
    });
    const cur = state.playlists[state.activePl] || { tracks: [] };
    renderTrackList($("pl-list"), cur.tracks, true);
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function switchMobileCol(name) {
    document.querySelectorAll(".col").forEach(c => c.classList.toggle("m-active", c.dataset.mcol === name));
    document.querySelectorAll("[data-mnav]").forEach(b => b.classList.toggle("active", b.dataset.mnav === name));
  }

  function openModal(title, html) {
    $("modal-title").textContent = title;
    $("modal-body").innerHTML = html;
    $("modal-bg").classList.add("open");
  }

  function wireUI() {
    $("btn-play").addEventListener("click", togglePlay);
    $("m-play").addEventListener("click", togglePlay);
    $("btn-stop").addEventListener("click", stopPlay);
    $("btn-next").addEventListener("click", nextTrack);
    $("btn-prev").addEventListener("click", prevTrack);
    $("btn-view-mode").addEventListener("click", () => setViewMode(!state.embedMode));

    $("btn-brake").addEventListener("click", () => {
      if (audioEl.paused || state.embedMode) return;
      let r = audioEl.playbackRate;
      const iv = setInterval(() => {
        r -= 0.08;
        if (r <= 0.08) {
          clearInterval(iv);
          state.userStopped = true;
          audioEl.pause();
          audioEl.playbackRate = parseFloat($("f-pitch").value);
          state.playing = false;
          updatePlayButtons();
        } else audioEl.playbackRate = r;
      }, 45);
    });

    $("btn-hifi").addEventListener("click", () => {
      state.hifi = !state.hifi;
      YAudio.setHifi(state.hifi);
      $("btn-hifi").textContent = state.hifi ? "HI-FI ON" : "HI-FI OFF";
      $("btn-hifi").classList.toggle("active", state.hifi);
      $("dsp-label").textContent = state.hifi ? state.preset : "BYPASS";
    });

    $("btn-nonstop").addEventListener("click", () => {
      state.nonStop = !state.nonStop;
      $("btn-nonstop").classList.toggle("active", state.nonStop);
      $("led-nonstop").classList.toggle("on", state.nonStop);
    });

    document.querySelectorAll("[data-cue]").forEach(b => {
      b.addEventListener("click", e => {
        const i = +b.dataset.cue;
        if (e.shiftKey) { state.cues[i] = null; updateCueUI(); return; }
        if (state.cues[i] === null) { state.cues[i] = audioEl.currentTime; updateCueUI(); toast("CUE " + (i + 1) + " SET"); }
        else { audioEl.currentTime = state.cues[i]; if (audioEl.paused) togglePlay(); }
      });
    });

    document.querySelectorAll("[data-loop]").forEach(b => {
      b.addEventListener("click", () => {
        const s = +b.dataset.loop;
        state.loop = { active: true, start: audioEl.currentTime, end: audioEl.currentTime + s };
        toast("LOOP " + s + "S ACTIVE");
      });
    });
    $("btn-loop-off").addEventListener("click", () => { state.loop.active = false; toast("LOOP OFF"); });

    // Mixer
    $("f-vol").addEventListener("input", e => { const v = +e.target.value; $("v-vol").textContent = Math.round(v * 100) + "%"; YAudio.setParam("vol", v); });
    $("f-pitch").addEventListener("input", e => { const v = +e.target.value; $("v-pitch").textContent = v.toFixed(2) + "x"; audioEl.playbackRate = v; });
    $("f-hi").addEventListener("input", e => { const v = +e.target.value; $("v-hi").textContent = v + "dB"; YAudio.setParam("hi", v); });
    $("f-mid").addEventListener("input", e => { const v = +e.target.value; $("v-mid").textContent = v + "dB"; YAudio.setParam("mid", v); });
    $("f-low").addEventListener("input", e => { const v = +e.target.value; $("v-low").textContent = v + "dB"; YAudio.setParam("low", v); });
    $("f-flt").addEventListener("input", e => {
      const v = +e.target.value;
      $("v-flt").textContent = Math.abs(v) < 0.05 ? "OFF" : (v < 0 ? "LPF" : "HPF");
      YAudio.setParam("flt", v);
    });
    $("f-echo").addEventListener("input", e => { const v = +e.target.value; $("v-echo").textContent = Math.round(v * 100) + "%"; YAudio.setParam("echo", v); });

    document.querySelectorAll("[data-fx]").forEach(b => {
      b.addEventListener("click", () => {
        YAudio.init(audioEl, parseFloat($("f-vol").value));
        YAudio.triggerFx(b.dataset.fx);
      });
    });

    // Search & Tabs
    $("btn-go").addEventListener("click", () => runSearchOrUrl());
    $("search-inp").addEventListener("keydown", e => { if (e.key === "Enter") runSearchOrUrl(); });
    $("btn-paste").addEventListener("click", async () => {
      try { const t = await navigator.clipboard.readText(); $("search-inp").value = t; runSearchOrUrl(t); }
      catch { toast("PASTE MANUALLY"); }
    });

    document.querySelectorAll("[data-prov]").forEach(b => {
      b.addEventListener("click", () => {
        state.provider = b.dataset.prov;
        document.querySelectorAll("[data-prov]").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
      });
    });

    document.querySelectorAll(".tab").forEach(t => {
      t.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
        t.classList.add("active");
        document.querySelectorAll("[data-lpanel]").forEach(p => p.style.display = p.dataset.lpanel === t.dataset.ltab ? "flex" : "none");
        if (t.dataset.ltab === "playlist") renderPlaylists();
      });
    });

    document.querySelectorAll("[data-mnav]").forEach(b => b.addEventListener("click", () => switchMobileCol(b.dataset.mnav)));

    // Playlist buttons
    $("btn-pl-add").addEventListener("click", () => {
      const name = $("pl-name").value.trim().toUpperCase();
      if (!name) return;
      state.playlists.push({ name, tracks: [] });
      state.activePl = state.playlists.length - 1;
      $("pl-name").value = "";
      savePlaylists();
      renderPlaylists();
    });
    $("btn-pl-play").addEventListener("click", () => {
      const cur = state.playlists[state.activePl];
      if (!cur || !cur.tracks.length) return toast("PLAYLIST EMPTY");
      state.queue = cur.tracks.slice();
      state.qIndex = 0;
      loadTrack(state.queue[0], true);
      switchMobileCol("deck");
    });
    $("btn-pl-shuf").addEventListener("click", () => {
      state.shuffle = !state.shuffle;
      $("btn-pl-shuf").classList.toggle("active", state.shuffle);
    });
    $("btn-pl-del").addEventListener("click", () => {
      if (state.playlists.length <= 1) return toast("KEEP AT LEAST 1 PLAYLIST");
      state.playlists.splice(state.activePl, 1);
      state.activePl = 0;
      savePlaylists();
      renderPlaylists();
    });

    // Local Files & Export
    $("local-file").addEventListener("change", e => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const items = files.map(f => ({
        id: "loc_" + f.name,
        title: f.name.replace(/\.[^.]+$/, ""),
        artist: "LOCAL FILE",
        source: "LOCAL",
        artwork: DEFAULT_ICON,
        streamUrl: URL.createObjectURL(f)
      }));
      renderTrackList($("search-list"), items);
      state.queue = items;
      state.qIndex = 0;
      loadTrack(items[0], true);
    });

    $("btn-exp-cur").addEventListener("click", async () => {
      if (!state.currentTrack || state.embedMode) return toast("AUDIO TRACK REQUIRED");
      try {
        toast("RENDERING HI-FI WAV...");
        const r = await fetch(audioEl.src);
        const blob = await YAudio.renderWavWithDsp(await r.arrayBuffer());
        downloadBlob(blob, "Y-Music_" + state.currentTrack.title.replace(/[^\w\-]+/g, "_") + ".wav");
        toast("DOWNLOAD COMPLETE");
      } catch {
        toast("CORS RESTRICTED — USE LIVE REC");
      }
    });

    function toggleRec() {
      YAudio.init(audioEl, parseFloat($("f-vol").value));
      if (!state.recording) {
        YAudio.startLiveRec(blob => {
          downloadBlob(blob, "Y-Music_LIVE_" + Date.now() + ".webm");
          toast("LIVE RECORDING SAVED");
        });
        state.recording = true;
        $("btn-rec").classList.add("rec-on");
        $("led-rec").classList.add("red");
        toast("LIVE REC STARTED");
      } else {
        YAudio.stopLiveRec();
        state.recording = false;
        $("btn-rec").classList.remove("rec-on");
        $("led-rec").classList.remove("red");
      }
    }
    $("btn-rec").addEventListener("click", toggleRec);
    $("btn-exp-rec").addEventListener("click", toggleRec);

    $("conv-file").addEventListener("change", async e => {
      const f = e.target.files[0];
      if (!f) return;
      YAudio.init(audioEl, parseFloat($("f-vol").value));
      toast("CONVERTING TO HI-FI WAV...");
      const blob = await YAudio.renderWavWithDsp(await f.arrayBuffer());
      downloadBlob(blob, "Y-Music_" + f.name.replace(/\.[^.]+$/, "") + ".wav");
      toast("CONVERSION COMPLETE");
    });

    // Disc scratch & Waveform seek
    let lastX = 0;
    $("disc").addEventListener("pointerdown", e => { state.scratching = true; lastX = e.clientX; $("disc").setPointerCapture(e.pointerId); });
    $("disc").addEventListener("pointermove", e => {
      if (!state.scratching || state.embedMode) return;
      const dx = e.clientX - lastX; lastX = e.clientX;
      state.discAngle += dx * 1.4;
      if (audioEl.duration) audioEl.currentTime = Math.max(0, Math.min(audioEl.duration, audioEl.currentTime + dx * 0.04));
    });
    $("disc").addEventListener("pointerup", () => (state.scratching = false));
    $("wave-wrap").addEventListener("click", e => {
      if (!audioEl.duration || state.embedMode) return;
      const r = $("wave-wrap").getBoundingClientRect();
      audioEl.currentTime = ((e.clientX - r.left) / r.width) * audioEl.duration;
    });

    // Modals
    $("modal-close").addEventListener("click", () => $("modal-bg").classList.remove("open"));
    $("modal-bg").addEventListener("click", e => { if (e.target === $("modal-bg")) $("modal-bg").classList.remove("open"); });

    $("btn-shield").addEventListener("click", () => {
      const st = YSecurity.getStats();
      openModal("SECURITY SHIELD",
        '<div class="card"><div class="card-title">CLIENT PROTECTION STATUS</div>' +
        '<div class="card-desc">Rate Limit: ' + st.recentRequests + ' / ' + st.maxReq + ' req per ' + (st.windowMs / 1000) + 's<br>' +
        'Blocked Requests: ' + st.blockedCount + '<br>' +
        'XSS Sanitizer &amp; Anti-Tamper: ACTIVE</div></div>'
      );
    });

    $("btn-notice").addEventListener("click", () => {
      $("led-notice").classList.remove("red");
      const list = (settings && settings.notifications) || [];
      const html = list.map(n =>
        '<div class="card"><div class="card-title">' + YSecurity.sanitizeText(n.date) + ' // ' + YSecurity.sanitizeText(n.title) + '</div>' +
        '<div class="card-desc" style="color:var(--text)">' + YSecurity.sanitizeText(n.body) + '</div></div>'
      ).join("");
      openModal("SYSTEM NOTICES", html || "NO NOTICES");
    });
  }

  async function boot() {
    try {
      const r = await fetch("./settings.json", { cache: "no-store" });
      if (r.ok) settings = await r.json();
    } catch {}

    if (settings) {
      if (settings.app && settings.app.defaultIcon) {
        DEFAULT_ICON = settings.app.defaultIcon;
        $("brand-icon").src = DEFAULT_ICON;
        $("disc-art").src = DEFAULT_ICON;
        $("toast-icon").src = DEFAULT_ICON;
      }
      if (settings.audio && settings.audio.presets) YAudio.setPresets(settings.audio.presets);
      YSecurity.init(settings.security);
    } else {
      YSecurity.init();
    }

    // Render Presets
    const pGrid = $("preset-grid");
    Object.keys(YAudio.getPresets()).forEach(k => {
      const b = document.createElement("button");
      b.className = "btn" + (k === state.preset ? " active" : "");
      b.textContent = k;
      b.addEventListener("click", () => {
        YAudio.init(audioEl, parseFloat($("f-vol").value));
        state.preset = k;
        state.hifi = true;
        YAudio.setHifi(true);
        YAudio.applyPreset(k);
        $("dsp-label").textContent = k;
        pGrid.querySelectorAll(".btn").forEach(x => x.classList.toggle("active", x.textContent === k));
      });
      pGrid.appendChild(b);
    });

    // Render Genre Chips
    const genres = (settings && settings.search && settings.search.quickGenres) || ["Phonk", "Lo-Fi", "EDM", "J-Pop", "House", "Techno"];
    genres.forEach(g => {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = g.toUpperCase();
      b.addEventListener("click", () => { $("search-inp").value = g; runSearchOrUrl(g); });
      $("genre-row").appendChild(b);
    });

    YVisualizer.init($("bg-canvas"), $("wave-canvas"), $("wave-wrap"));
    wireUI();
    renderTrackList($("search-list"), BUILTIN);
    renderPlaylists();

    function loop() {
      requestAnimationFrame(loop);
      const prog = audioEl.duration ? audioEl.currentTime / audioEl.duration : 0;
      YVisualizer.renderFrame(YAudio.getAnalyser(), state.playing, state.embedMode, prog, $("vu-fill"));
      if (state.playing && !state.scratching) state.discAngle = (state.discAngle + 1.8 * audioEl.playbackRate) % 360;
      $("disc").style.transform = "rotate(" + state.discAngle + "deg)";
      if (state.loop.active && audioEl.currentTime >= state.loop.end) audioEl.currentTime = state.loop.start;
      $("t-cur").textContent = fmt(audioEl.currentTime);
      $("t-dur").textContent = fmt(audioEl.duration);
    }
    loop();
  }

  boot();
})();
