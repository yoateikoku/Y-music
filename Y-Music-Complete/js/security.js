(function (global) {
  "use strict";

  const timestamps = [];
  let blockedCount = 0;
  let config = {
    windowMs: 10000,
    maxReq: 20,
    blockContextMenu: true,
    blockDevToolsShortcuts: true
  };

  function init(secCfg) {
    if (secCfg) {
      config.windowMs = secCfg.rateLimitWindowMs || 10000;
      config.maxReq = secCfg.maxRequestsPerWindow || 20;
      config.blockContextMenu = secCfg.blockContextMenu !== false;
      config.blockDevToolsShortcuts = secCfg.blockDevToolsShortcuts !== false;
    }

    if (config.blockContextMenu) {
      document.addEventListener("contextmenu", function (e) {
        if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
          e.preventDefault();
        }
      });
    }

    if (config.blockDevToolsShortcuts) {
      document.addEventListener("keydown", function (e) {
        if (
          e.key === "F12" ||
          (e.ctrlKey && e.shiftKey && /^[IJC]$/i.test(e.key)) ||
          (e.ctrlKey && /^U$/i.test(e.key))
        ) {
          e.preventDefault();
        }
      });
    }
  }

  function allowRequest() {
    const now = Date.now();
    while (timestamps.length && now - timestamps[0] > config.windowMs) {
      timestamps.shift();
    }
    if (timestamps.length >= config.maxReq) {
      blockedCount++;
      return false;
    }
    timestamps.push(now);
    return true;
  }

  function sanitizeText(str) {
    return String(str || "").replace(/[<>"'&]/g, function (c) {
      return { "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "&": "&amp;" }[c];
    });
  }

  function getStats() {
    return {
      windowMs: config.windowMs,
      maxReq: config.maxReq,
      recentRequests: timestamps.length,
      blockedCount: blockedCount
    };
  }

  global.YSecurity = { init, allowRequest, sanitizeText, getStats };
})(window);
