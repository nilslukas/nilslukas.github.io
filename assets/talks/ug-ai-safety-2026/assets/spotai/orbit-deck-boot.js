(function() {
  var host = document.getElementById("agent-orbit");
  if (!host || !window.ResizeObserver) return;
  var last = 0;
  new ResizeObserver(function() {
    var w = host.clientWidth;
    if (w > 0 && w !== last) {
      last = w;
      window.dispatchEvent(new Event("resize"));
    }
  }).observe(host);
})();
