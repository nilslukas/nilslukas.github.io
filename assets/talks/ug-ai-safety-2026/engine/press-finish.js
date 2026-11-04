(function() {
  var FWD = { ArrowRight: 1, PageDown: 1, " ": 1 };
  function running(sec) {
    var out = [];
    sec.querySelectorAll("video").forEach(function(v) {
      if (v.loop || v.paused || v.ended) return;
      if (!(v.duration > 0) || v.currentTime >= v.duration - 0.06) return;
      out.push(v);
    });
    return out;
  }
  function finish(v) {
    var end = v.onended;
    if (v.classList.contains("w09m-clip") && typeof end === "function") {
      v.onplaying = null;
      v.onended = null;
      try {
        v.pause();
      } catch (_) {
      }
      end.call(v);
      return;
    }
    try {
      v.currentTime = Math.max(v.currentTime, v.duration - 0.05);
    } catch (_) {
    }
  }
  addEventListener("keydown", function(e) {
    if (!FWD[e.key] || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target && e.target.closest && e.target.closest("input, textarea, [contenteditable], button, a")) return;
    var sec = document.querySelector("section.slide.is-active");
    if (!sec) return;
    var vs = running(sec);
    if (!vs.length) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    vs.forEach(finish);
  }, true);
})();
