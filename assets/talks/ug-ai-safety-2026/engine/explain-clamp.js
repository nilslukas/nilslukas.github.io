(function() {
  var HALF = 250;
  function clamp(el) {
    var stage = el.closest(".stage") || document.body;
    var s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    var cx = (r.left + r.right) / 2;
    el.classList.remove("tipL", "tipR");
    if (cx - s.left < HALF) el.classList.add("tipL");
    else if (s.right - cx < HALF) el.classList.add("tipR");
  }
  function on(e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-explain]") : null;
    if (t) clamp(t);
  }
  document.addEventListener("mouseover", on, true);
  document.addEventListener("focusin", on, true);
})();
