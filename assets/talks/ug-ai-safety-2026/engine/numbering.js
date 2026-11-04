(function() {
  const slides = [...document.querySelectorAll("section.slide")];
  let chap = 0, thm = 0, fig = 0, alg = 0;
  let lastMainDef = null;
  slides.forEach((s) => {
    const stacked = !!s.dataset.stack;
    if (!stacked && s.classList.contains("divider") && !s.classList.contains("cont")) {
      chap++;
      thm = 0;
      lastMainDef = null;
    }
    s.querySelectorAll("figure.fig[data-fig]").forEach((f) => {
      const cap = f.querySelector(":scope>.figcap,:scope>figcaption");
      if (!cap) return;
      if (stacked) {
        cap.dataset.label = "Figure.";
        return;
      }
      fig++;
      cap.dataset.label = "Figure " + fig + ".";
    });
    s.querySelectorAll(".algo[data-env]").forEach((a) => {
      const b = a.querySelector(".algo-title b");
      if (!b) return;
      if (stacked) {
        b.dataset.label = a.dataset.env;
        return;
      }
      alg++;
      b.dataset.label = a.dataset.env + " " + alg;
    });
    s.querySelectorAll(".defbox[data-env]").forEach((d) => {
      const n = d.querySelector(".dfname");
      if (!n) return;
      if (stacked) {
        n.dataset.label = lastMainDef && lastMainDef.env === d.dataset.env ? lastMainDef.label : d.dataset.env;
        return;
      }
      thm++;
      const label = d.dataset.env + " " + Math.max(chap, 1) + "." + thm;
      n.dataset.label = label;
      lastMainDef = { env: d.dataset.env, label };
    });
  });
})();
