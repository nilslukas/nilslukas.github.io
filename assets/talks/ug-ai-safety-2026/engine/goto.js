(function() {
  "use strict";
  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  if (!slides.length) return;
  function find(name) {
    for (var k = 0; k < slides.length; k++) if (slides[k].getAttribute("data-name") === name) return k;
    return -1;
  }
  document.addEventListener("click", function(e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-goto]") : null;
    if (!t) return;
    if (document.documentElement.classList.contains("cm-on")) return;
    var name = t.getAttribute("data-goto"), k = find(name);
    if (k < 0) {
      console.warn('[goto] no slide is named "' + name + '"');
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    location.hash = "#" + (k + 1);
  }, true);
  var s = document.createElement("style");
  s.textContent = "[data-goto]{cursor:pointer}[data-goto]:hover{filter:brightness(.94)}@media print{[data-goto]{cursor:auto}}";
  document.head.appendChild(s);
})();
