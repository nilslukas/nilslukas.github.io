(function() {
  "use strict";
  var animParam = /[?&]anim=1\b/.test(location.search);
  if (navigator.webdriver === true && !animParam) document.documentElement.classList.add("no-cinema");
  var stage = document.querySelector(".stage");
  var slides = Array.prototype.slice.call(document.querySelectorAll("section.slide"));
  if (!stage || !slides.length || !window.Deck) return;
  function chapterOf(s, k) {
    if (k === slides.length - 1) return "Closing";
    var field = Array.prototype.slice.call(s.querySelectorAll(".footer > span")).find(function(sp) {
      var b = sp.querySelector("b");
      return b && /chapter/i.test(b.textContent);
    });
    if (!field) return "";
    return field.textContent.replace(field.querySelector("b").textContent, "").trim();
  }
  var segs = [];
  slides.forEach(function(s, k) {
    var name = chapterOf(s, k);
    var last = segs[segs.length - 1];
    if (last && (last.name === name || !name || !last.name)) {
      last.to = k + 1;
      if (!last.name) last.name = name;
    } else segs.push({ name, from: k, to: k + 1 });
  });
  var isMain = function(k) {
    return !slides[k].dataset.stack;
  };
  var mainPos = function(g, k) {
    var p = 0;
    for (var j = g.from; j <= k; j++) if (isMain(j)) p++;
    return Math.max(p, 1);
  };
  segs.forEach(function(g) {
    g.mains = 0;
    for (var j = g.from; j < g.to; j++) if (isMain(j)) g.mains++;
    g.mains = Math.max(g.mains, 1);
  });
  var bar = document.createElement("nav");
  bar.className = "cin-bar";
  bar.setAttribute("aria-label", "Chapters");
  var N = slides.length;
  segs.forEach(function(g) {
    var el = document.createElement("button");
    el.type = "button";
    el.className = "cin-seg";
    el.style.flexGrow = String(g.mains);
    el.setAttribute("aria-label", g.name);
    el.innerHTML = '<span class="cin-lab"></span><span class="cin-line"><span class="cin-fill"></span></span>';
    el.querySelector(".cin-lab").textContent = g.name;
    if (g.name) {
      var n = document.createElement("span");
      n.className = "cin-n";
      n.textContent = String(g.mains);
      el.querySelector(".cin-lab").appendChild(n);
    }
    el.addEventListener("click", function(e) {
      e.stopPropagation();
      window.Deck.go(g.from);
    });
    g.el = el;
    bar.appendChild(el);
  });
  stage.appendChild(bar);
  var BI = (window.ML8502_DECK || {}).build;
  if (BI) {
    var ib = document.createElement("span");
    ib.className = "build-i pagenum";
    ib.textContent = "i";
    ib.tabIndex = 0;
    var nSlides = slides.filter(function(s) {
      return !s.dataset.stack;
    }).length;
    var lines = [
      "Built " + BI.built,
      BI.commit ? "Source commit " + BI.commit + (BI.commit_date ? " (" + BI.commit_date + ")" : "") : "",
      BI.commit_subject ? "“" + BI.commit_subject + "”" : "",
      nSlides + " slides · " + (BI.tool || "")
    ].filter(Boolean);
    ib.setAttribute("data-tip-title", (window.ML8502_DECK || {}).title || "This deck");
    ib.setAttribute("data-tip", lines.join("|"));
    ib.setAttribute("aria-label", lines.join(". "));
    stage.appendChild(ib);
  }
  segs.forEach(function(g) {
    for (var k = g.from; k < g.to; k++) {
      var field = Array.prototype.slice.call(slides[k].querySelectorAll(".footer > span")).find(function(sp) {
        var b = sp.querySelector("b");
        return b && /chapter/i.test(b.textContent);
      });
      if (!field || field.querySelector(".cin-chpos")) continue;
      var pos = document.createElement("span");
      pos.className = "cin-chpos pagenum";
      pos.textContent = mainPos(g, k) + " / " + g.mains;
      field.appendChild(pos);
    }
  });
  var CFG = window.ML8502_DECK || {};
  var WEEK = CFG.week ? String(CFG.week) : "", DATES = CFG.dates || [], TOPIC = CFG.topic || "";
  if (WEEK) slides.forEach(function(s) {
    var foot = s.querySelector(".footer");
    if (!foot || foot.querySelector(".wk-badge")) return;
    var badge = document.createElement("span");
    badge.className = "wk-badge pagenum";
    badge.tabIndex = 0;
    badge.setAttribute("aria-label", "Week " + WEEK + ": " + DATES.map(function(d) {
      return d.join(" ");
    }).join("; "));
    badge.textContent = WEEK;
    var pop = document.createElement("span");
    pop.className = "wk-pop";
    pop.innerHTML = '<span class="wk-pop-h">Week ' + WEEK + (TOPIC ? " · " + TOPIC : "") + "</span>" + DATES.map(function(d) {
      return '<span class="wk-pop-r"><b>' + d[0] + "</b><span>" + d[1] + "</span><i>" + d[2] + "</i></span>";
    }).join("");
    badge.appendChild(pop);
    foot.insertBefore(badge, foot.firstChild);
  });
  var SHOW_LEFT = false;
  if (SHOW_LEFT) slides.forEach(function(s, k) {
    var page = s.querySelector(".footer .page");
    if (!page || page.querySelector(".cin-left")) return;
    var left = N - 1 - k;
    var span = document.createElement("span");
    span.className = "cin-left pagenum";
    span.textContent = left ? left + (left === 1 ? " slide left" : " slides left") : "last slide";
    page.appendChild(span);
  });
  function update() {
    var i = window.Deck.current();
    var s = slides[i];
    var max = Number(s.dataset.maxStep || 0), step = Number(s.dataset.step || 0);
    var within = (step + 1) / (max + 1);
    segs.forEach(function(g) {
      var f = i >= g.to ? 1 : i < g.from ? 0 : (mainPos(g, i) - 1 + within) / g.mains;
      g.el.querySelector(".cin-fill").style.transform = "scaleX(" + Math.max(0, Math.min(1, f)) + ")";
      var cur = i >= g.from && i < g.to;
      g.el.classList.toggle("is-current", cur);
      var n = g.el.querySelector(".cin-n");
      if (n) n.textContent = cur ? mainPos(g, i) + "/" + g.mains : String(g.mains);
    });
    bar.classList.toggle("on-dark", s.classList.contains("on-deep"));
  }
  var mo = new MutationObserver(update);
  slides.forEach(function(s) {
    mo.observe(s, { attributes: true, attributeFilter: ["class", "data-step"] });
  });
  update();
})();
