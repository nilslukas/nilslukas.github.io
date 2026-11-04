(() => {
  "use strict";
  const MIN_PX = 90;
  const FILL = 0.94;
  const MS = 300;
  const EASE = "cubic-bezier(.22,.61,.36,1)";
  const SCRIM = "rgba(7,27,52,.88)";
  const CHROME = ".brand-logo,.footer,.pagenum,.chapters,.cast-mark,.controls,.notes,.overview,#lightbox";
  const STOP = 'a[href],button,input,select,textarea,video,[role="button"]';
  const KEYS = /* @__PURE__ */ new Set([
    "Escape",
    "ArrowRight",
    "ArrowLeft",
    "ArrowUp",
    "ArrowDown",
    "PageUp",
    "PageDown",
    " ",
    "Spacebar",
    "Home",
    "End",
    "g",
    "G",
    "n",
    "N",
    "f",
    "F",
    "p",
    "P"
  ]);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function shown(el) {
    for (let e = el; e && e.nodeType === 1 && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      if (parseFloat(cs.opacity) < 0.1) return false;
    }
    return true;
  }
  function eligible(el) {
    if (document.documentElement.classList.contains("cm-on")) return false;
    if (!el || el.tagName !== "IMG" && el.tagName !== "VIDEO") return false;
    if (!el.closest(".slide")) return false;
    if (el.closest(CHROME)) return false;
    if (el.closest("[data-nozoom]")) return false;
    const forced = !!el.closest("[data-zoom]");
    if (el.tagName === "VIDEO" && el.controls && !forced) return false;
    if (!forced && (el.offsetWidth < MIN_PX || el.offsetHeight < MIN_PX)) return false;
    return shown(el);
  }
  function pick(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (eligible(el)) return el;
      if (el.matches && el.matches(STOP)) return null;
      if (el.classList && el.classList.contains("slide")) break;
    }
    return null;
  }
  function ground(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (c && c !== "transparent" && !/,\s*0\)$/.test(c)) return c;
    }
    return "#fff";
  }
  let src = null;
  let root = null, scrim = null, clone = null;
  function place(zoomed) {
    const r = src.getBoundingClientRect();
    clone.style.left = r.left + "px";
    clone.style.top = r.top + "px";
    clone.style.width = r.width + "px";
    clone.style.height = r.height + "px";
    if (!zoomed) {
      clone.style.transform = "none";
      return;
    }
    const vw = innerWidth, vh = innerHeight;
    const s = Math.max(1, Math.min(vw * FILL / r.width, vh * FILL / r.height));
    const dx = (vw - r.width * s) / 2 - r.left;
    const dy = (vh - r.height * s) / 2 - r.top;
    clone.style.transform = `translate(${dx}px,${dy}px) scale(${s})`;
  }
  function open(el) {
    if (src) return;
    src = el;
    root = document.createElement("div");
    root.id = "lightbox";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.style.cssText = "position:fixed;inset:0;z-index:9000;cursor:zoom-out;-webkit-user-select:none;user-select:none";
    scrim = document.createElement("div");
    scrim.style.cssText = "position:absolute;inset:0;opacity:0;background:" + SCRIM;
    const cs = getComputedStyle(el);
    const bg = ground(el);
    clone = el.cloneNode(false);
    clone.removeAttribute("class");
    clone.removeAttribute("id");
    clone.style.cssText = "position:absolute;display:block;margin:0;max-width:none;max-height:none;transform-origin:0 0;will-change:transform;backface-visibility:hidden;object-fit:" + cs.objectFit + ";object-position:" + cs.objectPosition + ";background:" + bg;
    if (el.tagName === "VIDEO") {
      clone.muted = true;
      clone.loop = true;
      clone.playsInline = true;
      clone.removeAttribute("controls");
    }
    root.appendChild(scrim);
    root.appendChild(clone);
    document.body.appendChild(root);
    if (el.tagName === "VIDEO") {
      try {
        clone.currentTime = el.currentTime;
      } catch (_) {
      }
      const p = clone.play();
      if (p && p.catch) p.catch(() => {
      });
    }
    place(false);
    if (reduce) {
      scrim.style.opacity = "1";
      place(true);
      return;
    }
    getComputedStyle(clone).transform;
    clone.style.transition = `transform ${MS}ms ${EASE}`;
    scrim.style.transition = `opacity ${MS}ms ease`;
    scrim.style.opacity = "1";
    place(true);
  }
  function close(instant) {
    if (!src) return;
    const r = root, c = clone, s = scrim;
    src = null;
    root = null;
    clone = null;
    scrim = null;
    if (instant || reduce) {
      r.remove();
      return;
    }
    c.style.transition = `transform ${MS}ms ${EASE}`;
    c.style.transform = "none";
    r.style.pointerEvents = "none";
    s.style.opacity = "0";
    let done = false;
    const fin = () => {
      if (!done) {
        done = true;
        r.remove();
      }
    };
    c.addEventListener("transitionend", fin, { once: true });
    setTimeout(fin, MS + 150);
  }
  addEventListener("click", (e) => {
    if (src) {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.button || e.detail === 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const el = pick(e.clientX, e.clientY);
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    open(el);
  }, true);
  addEventListener("keydown", (e) => {
    if (!src || !KEYS.has(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    close();
  }, true);
  addEventListener("resize", () => {
    if (!src) return;
    const c = clone;
    c.style.transition = "none";
    place(true);
    getComputedStyle(c).transform;
    c.style.transition = `transform ${MS}ms ${EASE}`;
  });
  addEventListener("beforeprint", () => close(true));
  addEventListener("pointerover", (e) => {
    const el = e.target;
    if (!el || el.tagName !== "IMG" && el.tagName !== "VIDEO") return;
    el.classList.toggle("lb-zoomable", eligible(el));
  }, true);
})();
