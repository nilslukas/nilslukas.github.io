(function() {
  "use strict";
  function audit(loud) {
    var decided = [];
    var deprecated = [];
    document.querySelectorAll(".slide").forEach(function(slide) {
      if (!slide.querySelector("[data-focus-step]")) return;
      var name = slide.getAttribute("data-name") || "(unnamed)";
      decided.push({ name, on: true, from: "platform default" });
      if (slide.hasAttribute("data-prestep")) deprecated.push(name);
    });
    return { decided, unlisted: [], stale: [], deprecated };
  }
  window.Prestep = {
    audit: function() {
      return audit(true);
    },
    state: function() {
      return audit(false).decided;
    },
    disable: function() {
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      audit(true);
    });
  } else {
    audit(true);
  }
})();
