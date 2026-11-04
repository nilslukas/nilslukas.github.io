(function() {
  function render() {
    if (typeof katex === "undefined") return;
    document.querySelectorAll(".ktx[data-tex]").forEach(function(el) {
      if (el.dataset.rendered) return;
      var tex = el.dataset.tex;
      try {
        katex.render(tex, el, { trust: true, throwOnError: false, displayMode: el.dataset.display === "1", strict: "ignore", output: "html" });
        el.dataset.rendered = "1";
      } catch (e) {
        el.textContent = tex;
        el.classList.add("todo");
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
