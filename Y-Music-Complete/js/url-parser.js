(function (global) {
  "use strict";

  function parseMediaUrl(raw) {
    if (!raw || typeof raw !== "string") return null;
    const match = raw.match(/https?:\/\/[^\s"'<>]+/i);
    if (!match) return null;

    const urlStr = match[0];
    let u;
    try {
      u = new URL(urlStr);
    } catch {
      return null;
    }

    const host = u.hostname.replace(/^www\./, "").toLowerCase();

    // YouTube / Shorts / Live / Music / youtu.be
    if (host.includes("youtube.com") || host === "youtu.be") {
      let id = "";
      if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2];
      else if (u.pathname.startsWith("/live/")) id = u.pathname.split("/")[2];
      else id = u.searchParams.get("v") || "";

      if (id) {
        return {
          type: "embed",
          service: "YOUTUBE",
          title: "YouTube // " + id,
          embedUrl: "https://www.youtube.com/embed/" + encodeURIComponent(id) + "?autoplay=1&rel=0"
        };
      }
    }

    // Spotify (supports /intl-ja/ and other locale prefixes)
    if (host.includes("spotify.com")) {
      const sp = u.pathname.match(/\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/);
      if (sp) {
        return {
          type: "embed",
          service: "SPOTIFY",
          title: "Spotify // " + sp[1].toUpperCase(),
          embedUrl: "https://open.spotify.com/embed/" + sp[1] + "/" + sp[2] + "?theme=0"
        };
      }
    }

    // Apple Music
    if (host.includes("music.apple.com")) {
      return {
        type: "embed",
        service: "APPLE MUSIC",
        title: "Apple Music",
        embedUrl: urlStr.replace("music.apple.com", "embed.music.apple.com")
      };
    }

    // SoundCloud
    if (host.includes("soundcloud.com")) {
      return {
        type: "embed",
        service: "SOUNDCLOUD",
        title: "SoundCloud",
        embedUrl:
          "https://w.soundcloud.com/player/?url=" +
          encodeURIComponent(urlStr) +
          "&color=%2300e5ff&auto_play=true&visual=true"
      };
    }

    // NicoNico
    if (host.includes("nicovideo.jp") || host === "nico.ms") {
      const nm = urlStr.match(/(sm|nm|so)\d+/);
      if (nm) {
        return {
          type: "embed",
          service: "NICONICO",
          title: "NicoNico // " + nm[0],
          embedUrl: "https://embed.nicovideo.jp/watch/" + nm[0] + "?autoplay=1"
        };
      }
    }

    // Direct Audio URL
    const cleanName = decodeURIComponent(u.pathname.split("/").pop() || host);
    return {
      type: "audio",
      service: "DIRECT URL",
      title: cleanName,
      streamUrl: urlStr
    };
  }

  global.YUrlParser = { parseMediaUrl };
})(window);
