(function() {
  "use strict";
  var SEL = "[data-tip]";
  var panel = null, list = null, head = null, current = null, hideTimer = null;
  function css() {
    var s = document.createElement("style");
    s.textContent = [
      "[data-tip]{cursor:help}",
      /* Everything inside the panel is sized in em against --tip-fs, which
         place() rewrites per hover, so the whole panel scales as one piece
         instead of the type drifting away from the box. */
      "#deckTip{position:fixed;z-index:940;display:none;font-size:var(--tip-fs,16px);",
      "  max-width:26em;padding:.78em .95em;border:1px solid var(--line,#c9d5e5);",
      "  border-radius:.5em;background:var(--paper,#f4f7fb);",
      "  box-shadow:0 10px 30px rgba(7,27,52,.17);",
      "  color:var(--ink,#071b34);font-family:inherit;line-height:1.34;",
      "  text-align:left;pointer-events:none}",
      "#deckTip.is-open{display:block}",
      "#deckTip b{display:block;margin-bottom:.42em;color:var(--green,#210eca);",
      "  font-family:var(--mono,SFMono-Regular,Consolas,monospace);font-size:.87em;",
      "  font-weight:700;letter-spacing:.07em;text-transform:uppercase}",
      "#deckTip ul{margin:0;padding:0;list-style:none}",
      /* font-size:1em is NOT redundant. deck.css:87 sets p,li{font-size:var(--fs-body)}
         on the ELEMENT, and an element-level declaration beats inheritance from
         #deckTip, so without this every bullet renders at 23px whatever --tip-fs
         says and the panel GROWS as the window shrinks -- measured on AI Risk
         Categories at 1280x720, the panel was 869px tall against 268px once this
         line is present. The id selector outranks deck.css's element selector. */
      "#deckTip li{position:relative;padding-left:1.02em;margin-bottom:.3em;",
      "  font-size:1em;line-height:1.34;color:var(--ink-2,#233c57)}",
      "#deckTip li:last-child{margin-bottom:0}",
      '#deckTip li::before{content:"";position:absolute;left:.12em;top:.56em;',
      "  width:.36em;height:.36em;border-radius:50%;background:var(--green,#210eca)}",
      "#deckTip p{margin:0;font-size:1em;line-height:1.34;color:var(--ink-2,#233c57)}",
      "@media print{#deckTip{display:none!important}}"
    ].join("");
    document.head.appendChild(s);
  }
  function build() {
    panel = document.createElement("div");
    panel.id = "deckTip";
    panel.setAttribute("role", "tooltip");
    head = document.createElement("b");
    list = document.createElement("ul");
    panel.appendChild(head);
    panel.appendChild(list);
    document.body.appendChild(panel);
  }
  function fill(el) {
    var raw = el.getAttribute("data-tip") || "";
    var title = el.getAttribute("data-tip-title") || "";
    var items = (/\n/.test(raw) ? raw.split(/\s*\n\s*/) : raw.split(/\s*\|\s*/)).map(function(t) {
      return t.trim();
    }).filter(function(t) {
      return t.length;
    });
    if (!items.length) return false;
    head.textContent = title;
    head.style.display = title ? "block" : "none";
    while (list.firstChild) list.removeChild(list.firstChild);
    if (items.length === 1) {
      var p = document.createElement("p");
      p.textContent = items[0];
      list.appendChild(p);
      list.style.listStyle = "none";
    } else {
      items.forEach(function(t) {
        var li = document.createElement("li");
        li.textContent = t;
        list.appendChild(li);
      });
    }
    return true;
  }
  var BASE = 16, MIN = 11, MAX = 22;
  function scale() {
    var stage = document.querySelector(".stage");
    var fit = stage && parseFloat(getComputedStyle(stage).getPropertyValue("--fit"));
    if (!fit || !isFinite(fit) || fit <= 0) fit = 1;
    panel.style.setProperty(
      "--tip-fs",
      Math.round(Math.min(MAX, Math.max(MIN, BASE * fit)) * 10) / 10 + "px"
    );
  }
  function place(el) {
    var r = el.getBoundingClientRect();
    var GAP = 12, EDGE = 10;
    scale();
    panel.style.left = "0px";
    panel.style.top = "0px";
    panel.classList.add("is-open");
    var p = panel.getBoundingClientRect();
    var left = r.left + r.width / 2 - p.width / 2;
    left = Math.max(EDGE, Math.min(left, innerWidth - p.width - EDGE));
    var top = r.top - p.height - GAP;
    if (top < EDGE) top = r.bottom + GAP;
    top = Math.max(EDGE, Math.min(top, innerHeight - p.height - EDGE));
    panel.style.left = Math.round(left) + "px";
    panel.style.top = Math.round(top) + "px";
  }
  function show(el) {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (el === current) return;
    if (current) current.classList.remove("has-tip");
    current = null;
    if (!fill(el)) {
      panel.classList.remove("is-open");
      return;
    }
    current = el;
    el.classList.add("has-tip");
    place(el);
  }
  function hide() {
    if (!current) return;
    current.classList.remove("has-tip");
    current = null;
    panel.classList.remove("is-open");
  }
  function bind() {
    document.addEventListener("mouseover", function(e) {
      var t = e.target && e.target.closest ? e.target.closest(SEL) : null;
      if (t) show(t);
      else if (current && !panel.contains(e.target)) hide();
    }, true);
    document.addEventListener("mouseout", function(e) {
      if (!current) return;
      var to = e.relatedTarget;
      if (to && to.closest && to.closest(SEL) === current) return;
      hideTimer = setTimeout(hide, 60);
    }, true);
    document.addEventListener("focusin", function(e) {
      var t = e.target && e.target.closest ? e.target.closest(SEL) : null;
      if (t) show(t);
    });
    document.addEventListener("focusout", hide);
    addEventListener("keydown", hide, true);
    addEventListener("resize", hide);
    addEventListener("beforeprint", hide);
    addEventListener("scroll", hide, true);
  }
  function boot() {
    try {
      css();
      build();
      bind();
      Array.prototype.forEach.call(document.querySelectorAll(SEL), function(el) {
        if (!el.hasAttribute("tabindex") && !/^(a|button|input|select|textarea)$/i.test(el.tagName)) {
          el.setAttribute("tabindex", "0");
        }
      });
    } catch (err) {
    }
  }
  if (document.readyState === "loading") {
    addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
