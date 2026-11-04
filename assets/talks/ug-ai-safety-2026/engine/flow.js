(function() {
  function twin(p) {
    var f = p.cloneNode(false);
    f.removeAttribute("class");
    f.removeAttribute("style");
    f.removeAttribute("stroke-dasharray");
    f.removeAttribute("id");
    f.setAttribute("class", "flow" + ["at", "q", "out", "ok"].filter(function(c) {
      return p.classList.contains(c);
    }).map(function(c) {
      return " " + c;
    }).join(""));
    f.setAttribute("pathLength", "600");
    f.style.animationDelay = (-(Math.random() * 3.2)).toFixed(2) + "s";
    p.parentNode.insertBefore(f, p.nextSibling);
  }
  function run() {
    document.querySelectorAll("section.slide[data-flow]").forEach(function(s) {
      s.querySelectorAll("svg path.pl-wire, svg path.wtm-wire").forEach(function(p) {
        if (!p.getAttribute("d") || p.nextSibling && p.nextSibling.classList && p.nextSibling.classList.contains("flow")) return;
        twin(p);
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
