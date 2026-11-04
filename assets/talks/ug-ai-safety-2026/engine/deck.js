(() => {
  "use strict";
  const W = 1600, H = 900;
  const stage = document.querySelector(".stage");
  const slides = [...document.querySelectorAll(".slide")];
  const pad = (n) => String(n).padStart(2, "0");
  const stackKind = (s) => s.dataset.stack === "exercise" ? "exercise" : s.dataset.stack === "more" ? "more" : "";
  const parentOf = new Array(slides.length).fill(-1);
  const moreOf = /* @__PURE__ */ new Map(), exOf = /* @__PURE__ */ new Map();
  let lastMain = -1;
  slides.forEach((s, k) => {
    const kind = stackKind(s);
    if (!kind) {
      lastMain = k;
      return;
    }
    if (lastMain < 0) return;
    parentOf[k] = lastMain;
    const m = kind === "more" ? moreOf : exOf;
    if (!m.has(lastMain)) m.set(lastMain, []);
    m.get(lastMain).push(k);
  });
  const mainIdx = slides.map((s, k) => k).filter((k) => !stackKind(slides[k]));
  const mainPos = new Map(mainIdx.map((k, n) => [k, n]));
  const mainOf = (k) => stackKind(slides[k]) ? parentOf[k] : k;
  const labelOf = (k) => {
    const kind = stackKind(slides[k]);
    const p = mainOf(k), n = pad(mainPos.get(p) + 1);
    if (!kind) return n;
    const chain = (kind === "more" ? moreOf : exOf).get(p) || [];
    return n + (kind === "more" ? "▾" : "▴") + (chain.indexOf(k) + 1);
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const backups = slides.filter((s) => s.hasAttribute("data-backup"));
  const lastKept = slides.filter((s) => !s.hasAttribute("data-backup")).at(-1) || slides.at(-1);
  const routeTerminal = lastKept;
  if (routeTerminal && routeTerminal !== slides[0] && !routeTerminal.classList.contains("title-slide"))
    routeTerminal.classList.add("closing", "on-deep", "route-terminal");
  renderMathInElement(document.body, {
    delimiters: [{ left: "$$", right: "$$", display: true }, { left: "\\(", right: "\\)", display: false }],
    throwOnError: false
  });
  if (document.fonts) {
    [
      "KaTeX_Main",
      "KaTeX_Math",
      "KaTeX_Size1",
      "KaTeX_Size2",
      "KaTeX_Size3",
      "KaTeX_Size4",
      "KaTeX_AMS",
      "KaTeX_Caligraphic",
      "KaTeX_Fraktur",
      "KaTeX_SansSerif",
      "KaTeX_Script",
      "KaTeX_Typewriter",
      "Caveat"
    ].forEach((f) => ["24px ", "italic 24px ", "bold 24px "].forEach((st) => document.fonts.load(st + '"' + f + '"').catch(() => {
    })));
  }
  slides.forEach((s, i2) => {
    const p = s.querySelector(".page");
    if (p) p.textContent = `${labelOf(i2)} / ${pad(mainIdx.length)}`;
    const kind = stackKind(s);
    if (kind) s.classList.add("stacked", "stack-" + kind);
    const canvas = s.querySelector(".canvas");
    if (!canvas) return;
    const par = mainOf(i2), fam = moreOf.has(par) || exOf.has(par);
    if (fam) {
      canvas.appendChild(stackNav(i2, par));
      return;
    }
    if (kind) return;
    const q = prevMain(i2);
    if (q >= 0 && (moreOf.has(q) || exOf.has(q))) canvas.appendChild(stackNav(i2, q, true));
  });
  function stackNav(i2, p, exit) {
    const ex = exOf.get(p) || [], mo = moreOf.get(p) || [];
    const W2 = 196, H2 = 66, cy = 33, px = 72, step = 22;
    const node = (x, y, cls) => `<circle class="${cls}" cx="${x}" cy="${y}" r="${cls.includes("here") ? 5.5 : 3.8}"/>`;
    let svg = `<path class="sn-line" d="M 8 ${cy} H ${W2 - 8}"/>`;
    if (ex.length) svg += `<path class="sn-branch" d="M ${px} ${cy} C ${px} ${cy - 11} ${px + 11} 11 ${px + 22} 11 H ${px + 22 + step * ex.length} C ${px + 33 + step * ex.length} 11 ${px + 44 + step * ex.length} ${cy - 11} ${px + 44 + step * ex.length} ${cy}"/>`;
    if (mo.length) svg += `<path class="sn-branch" d="M ${px} ${cy} C ${px} ${cy + 11} ${px + 11} ${H2 - 11} ${px + 22} ${H2 - 11} H ${px + 22 + step * mo.length} C ${px + 33 + step * mo.length} ${H2 - 11} ${px + 44 + step * mo.length} ${cy + 11} ${px + 44 + step * mo.length} ${cy}"/>`;
    svg += node(px - 44, cy, "sn-main") + node(px, cy, !exit && i2 === p ? "sn-main sn-here" : "sn-main sn-parent") + node(px + 44 + step * Math.max(ex.length, mo.length), cy, exit ? "sn-main sn-here" : "sn-main");
    ex.forEach((k, n) => {
      svg += node(px + 22 + step * (n + 1), 11, !exit && k === i2 ? "sn-ex sn-here" : "sn-ex");
    });
    mo.forEach((k, n) => {
      svg += node(px + 22 + step * (n + 1), H2 - 11, !exit && k === i2 ? "sn-mo sn-here" : "sn-mo");
    });
    const kind = stackKind(slides[i2]);
    let pills = "";
    if (exit) {
      pills = `<span class="sn-pill back quiet">◂ back to ${labelOf(p)}</span>`;
    } else if (!kind) {
      if (ex.length) pills += '<span class="sn-pill up">▴ exercise</span>';
      if (mo.length) pills += '<span class="sn-pill down">▾ more</span>';
    } else {
      const chain = kind === "more" ? mo : ex, j = chain.indexOf(i2);
      pills += '<span class="sn-pill back">◂ lecture</span>';
      if (j + 1 < chain.length) pills += `<span class="sn-pill ${kind === "more" ? "down" : "up"}">${kind === "more" ? "▾" : "▴"} next</span>`;
    }
    const nav = document.createElement("div");
    nav.className = "stack-nav" + (exit ? " on-exit" : kind ? " on-stack" : " on-parent");
    nav.setAttribute("aria-hidden", "true");
    nav.innerHTML = `<div class="sn-pills">${pills}</div><svg class="sn-map${exit ? " sn-exit" : ""}" viewBox="0 0 ${W2} ${H2}" width="${W2}" height="${H2}">${svg}</svg>`;
    return nav;
  }
  const fit = () => {
    stage.style.setProperty("--fit", String(Math.min(innerWidth / W, innerHeight / H)));
    document.documentElement.classList.toggle("deck-wide", innerWidth / innerHeight > W / H);
  };
  addEventListener("resize", fit);
  fit();
  const maxStep = (s) => Number(s.dataset.maxStep || 0);
  function applyStep(s, step) {
    const n = Math.max(0, Math.min(maxStep(s), step));
    s.dataset.step = String(n);
    s.classList.toggle("is-stepping", n > 0);
    s.querySelectorAll("[data-reveal-step]").forEach((el) => {
      const k = Number(el.dataset.revealStep);
      el.classList.toggle("is-revealed", n >= k);
      el.classList.toggle("is-now", n === k);
    });
    s.querySelectorAll("[data-focus-step]").forEach((el) => {
      const k = Number(el.dataset.focusStep);
      el.classList.toggle("is-lit", k <= n);
      el.classList.toggle("is-now", k === n);
    });
    s.querySelectorAll(`video[data-play-step="${n}"]`).forEach((v) => {
      if (reduce) {
        v.muted = true;
      }
      try {
        v.currentTime = 0;
        v.play().catch(() => {
        });
      } catch (_) {
      }
    });
    update();
  }
  function reset(s) {
    s.querySelectorAll("video").forEach((v) => {
      try {
        v.pause();
        v.currentTime = 0;
      } catch (_) {
      }
    });
    applyStep(s, 0);
  }
  let i = Math.max(0, slides.findIndex((s) => s.classList.contains("is-active")));
  let arrivalBuildTimer = 0;
  const prevB = document.getElementById("prev"), nextB = document.getElementById("next");
  const count = document.getElementById("count");
  const notes = document.getElementById("notes"), notesP = notes.querySelector("p");
  const ov = document.getElementById("overview");
  function update() {
    const s = slides[i], step = Number(s.dataset.step || 0);
    prevB.disabled = i === 0 && step === 0;
    nextB.disabled = i === slides.length - 1 && step >= maxStep(s);
    count.textContent = `${labelOf(i)} / ${pad(mainIdx.length)}`;
  }
  function noteFor(slide) {
    const template = slide.querySelector(".speaker-notes");
    return template ? template.content.textContent.trim() : slide.dataset.notes || "No presenter notes.";
  }
  let gestured = false;
  ["keydown", "pointerdown"].forEach((ev) => addEventListener(ev, () => {
    gestured = true;
  }, { once: true, capture: true }));
  function playSlideVideos(s) {
    s.querySelectorAll("video:not([data-play-step])").forEach((v) => {
      if (reduce) {
        v.muted = true;
        v.play().catch(() => {
        });
        return;
      }
      v.muted = false;
      v.volume = 1;
      const p = v.play();
      if (p && p.catch) p.catch(() => {
        v.muted = true;
        v.play().catch(() => {
        });
        if (!gestured) {
          addEventListener("keydown", () => {
            v.muted = false;
          }, { once: true });
          addEventListener("pointerdown", () => {
            v.muted = false;
          }, { once: true });
        }
      });
    });
  }
  function isAnswerOnlyBuild(s) {
    if (s.querySelector("[data-focus-step]")) return false;
    if (s.classList.contains("question")) return true;
    const reveals = [...s.querySelectorAll("[data-reveal-step]")];
    return reveals.length > 0 && reveals.every((el) => el.matches(".answer.veiled") || !!el.closest(".answer.veiled"));
  }
  function shouldStartOnArrival(s) {
    if (maxStep(s) < 1 || s.dataset.autostep || s.dataset.autostart === "off") return false;
    if (s.dataset.autostart === "on") return true;
    return !isAnswerOnlyBuild(s);
  }
  function startBuildOnArrival(s, slideIndex) {
    clearTimeout(arrivalBuildTimer);
    arrivalBuildTimer = 0;
    if (!shouldStartOnArrival(s)) return;
    arrivalBuildTimer = setTimeout(() => {
      arrivalBuildTimer = 0;
      if (i === slideIndex && s.classList.contains("is-active") && Number(s.dataset.step || 0) === 0)
        applyStep(s, 1);
    }, 80);
  }
  function show(t) {
    clearTimeout(arrivalBuildTimer);
    arrivalBuildTimer = 0;
    i = Math.max(0, Math.min(slides.length - 1, t));
    slides.forEach((s, k) => {
      const on = k === i;
      s.classList.toggle("is-active", on);
      s.setAttribute("aria-hidden", on ? "false" : "true");
      if (!on) reset(s);
    });
    reset(slides[i]);
    playSlideVideos(slides[i]);
    startBuildOnArrival(slides[i], i);
    notesP.textContent = noteFor(slides[i]);
    history.replaceState(null, "", `#${i + 1}`);
    update();
    if (typeof syncMenu === "function") syncMenu();
  }
  function nextMain(k) {
    const n = mainPos.get(mainOf(k)) + 1;
    return n < mainIdx.length ? mainIdx[n] : -1;
  }
  function prevMain(k) {
    if (stackKind(slides[k])) return mainOf(k);
    const n = mainPos.get(k) - 1;
    return n >= 0 ? mainIdx[n] : -1;
  }
  function next() {
    const s = slides[i], step = Number(s.dataset.step || 0);
    if (step < maxStep(s)) return applyStep(s, step + 1);
    const n = nextMain(i);
    if (n >= 0) show(n);
  }
  function prev() {
    const s = slides[i], step = Number(s.dataset.step || 0);
    if (step > 0) return applyStep(s, step - 1);
    const p = prevMain(i);
    if (p >= 0) {
      show(p);
      applyStep(slides[i], maxStep(slides[i]));
    }
  }
  function down() {
    const kind = stackKind(slides[i]), p = mainOf(i);
    if (!kind) {
      const c2 = moreOf.get(i);
      if (c2) show(c2[0]);
      return;
    }
    if (kind === "more") {
      const c2 = moreOf.get(p), j2 = c2.indexOf(i);
      if (j2 + 1 < c2.length) show(c2[j2 + 1]);
      return;
    }
    const c = exOf.get(p), j = c.indexOf(i);
    show(j > 0 ? c[j - 1] : p);
  }
  function up() {
    const kind = stackKind(slides[i]), p = mainOf(i);
    if (!kind) {
      const c2 = exOf.get(i);
      if (c2) show(c2[0]);
      return;
    }
    if (kind === "exercise") {
      const c2 = exOf.get(p), j2 = c2.indexOf(i);
      if (j2 + 1 < c2.length) show(c2[j2 + 1]);
      return;
    }
    const c = moreOf.get(p), j = c.indexOf(i);
    show(j > 0 ? c[j - 1] : p);
  }
  const grid = document.getElementById("overviewGrid");
  slides.forEach((s, k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "thumb";
    b.innerHTML = `<small>${labelOf(k)}</small><strong></strong>`;
    if (stackKind(s)) b.classList.add("thumb-stack");
    b.querySelector("strong").textContent = s.dataset.name || "Slide";
    b.onclick = () => {
      show(k);
      ov.classList.remove("is-open");
    };
    grid.appendChild(b);
  });
  prevB.onclick = prev;
  nextB.onclick = next;
  document.getElementById("grid").onclick = () => ov.classList.toggle("is-open");
  document.getElementById("closeGrid").onclick = () => ov.classList.remove("is-open");
  document.getElementById("noteToggle").onclick = () => notes.classList.toggle("is-open");
  document.getElementById("full").onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {
  });
  const blank = document.createElement("div");
  blank.id = "blank";
  blank.style.cssText = "position:fixed;inset:0;background:var(--green-deep,#071b34);z-index:999;display:none;cursor:none";
  document.body.appendChild(blank);
  const setBlank = (on) => {
    blank.style.display = on ? "block" : "none";
  };
  blank.onclick = () => setBlank(false);
  const menu = document.createElement("nav");
  menu.id = "slidemenu";
  menu.setAttribute("aria-label", "Slide menu");
  menu.style.cssText = "position:fixed;top:0;left:0;bottom:0;width:348px;background:var(--paper,#f4f7fb);border-right:1px solid var(--line,#c9d5e5);box-shadow:6px 0 24px rgba(7,27,52,.10);z-index:900;overflow-y:auto;padding:14px 0;transform:translateX(-102%);transition:transform .18s ease";
  const menuList = document.createElement("div");
  slides.forEach((s, k) => {
    const it = document.createElement("button");
    it.type = "button";
    it.textContent = k + 1 + " · " + (s.dataset.name || "Slide " + (k + 1));
    it.style.cssText = "display:block;width:100%;text-align:left;padding:7px 20px;border:0;background:none;color:var(--ink-2,#233c57);font-family:inherit;font-size:15px;line-height:1.3;cursor:pointer";
    it.onmouseenter = () => {
      if (k !== i) it.style.background = "rgba(7,27,52,.06)";
    };
    it.onmouseleave = () => {
      if (k !== i) it.style.background = "none";
    };
    it.onclick = () => {
      show(k);
      setMenu(false);
      it.blur();
    };
    menuList.appendChild(it);
  });
  menu.appendChild(menuList);
  document.body.appendChild(menu);
  const menuTab = document.createElement("button");
  menuTab.type = "button";
  menuTab.id = "slidemenuTab";
  menuTab.title = "Slide menu (m)";
  menuTab.setAttribute("aria-label", "Toggle slide menu");
  menuTab.textContent = "≡";
  document.body.appendChild(menuTab);
  const pdfTab = document.createElement("button");
  pdfTab.type = "button";
  pdfTab.id = "pdfTab";
  pdfTab.title = "Export PDF (p): prints every slide at its final build step; choose Save as PDF";
  pdfTab.setAttribute("aria-label", "Export the deck as PDF");
  pdfTab.textContent = "⤓";
  document.body.appendChild(pdfTab);
  const tabCss = document.createElement("style");
  tabCss.textContent = [
    "#slidemenuTab,#pdfTab{position:fixed;z-index:901;left:8px;bottom:8px;width:26px;height:26px;padding:0;",
    "border:1px solid var(--line,#c9d5e5);border-radius:6px;background:var(--paper,#f4f7fb);color:var(--ink-2,#233c57);",
    "font:15px/1 system-ui,sans-serif;cursor:pointer;opacity:.92;transition:opacity .3s ease}",
    "#pdfTab{left:40px}",
    "html.deck-wide #pdfTab{left:8px;bottom:40px}",
    "html.deck-idle #slidemenuTab:not(:focus-visible),html.deck-idle #pdfTab:not(:focus-visible){opacity:0;pointer-events:none}",
    "@media (hover:none),(pointer:coarse){html.deck-idle #slidemenuTab:not(:focus-visible),",
    "html.deck-idle #pdfTab:not(:focus-visible){opacity:.4;pointer-events:auto}}"
  ].join("");
  document.head.appendChild(tabCss);
  let idleTimer = 0;
  function wake(ms) {
    document.documentElement.classList.remove("deck-idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!menuOpen) document.documentElement.classList.add("deck-idle");
    }, ms);
  }
  addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") wake(2500);
  }, { passive: true });
  addEventListener("pointerdown", (e) => wake(e.pointerType === "mouse" ? 2500 : 3500), { passive: true, capture: true });
  wake(3e3);
  const pdfMeta = document.querySelector('meta[name="deck-pdf"]');
  const pdfUrl = pdfMeta && pdfMeta.content;
  if (pdfUrl) {
    pdfTab.title = "Download the slides (PDF)";
    pdfTab.setAttribute("aria-label", "Download the slides as a PDF");
  }
  async function exportPdf() {
    if (pdfUrl && location.protocol !== "file:") {
      try {
        const r = await fetch(pdfUrl, { method: "HEAD", cache: "no-store" });
        if (r.ok) {
          const a = document.createElement("a");
          a.href = pdfUrl;
          a.download = pdfMeta.dataset.name || pdfUrl.split("/").pop();
          document.body.appendChild(a);
          a.click();
          a.remove();
          return;
        }
      } catch (_) {
      }
    }
    print();
  }
  pdfTab.onclick = () => {
    setMenu(false);
    setBlank(false);
    pdfTab.blur();
    exportPdf();
  };
  let menuOpen = false;
  function setMenu(on) {
    menuOpen = on;
    menu.style.transform = on ? "translateX(0)" : "translateX(-102%)";
    if (on) syncMenu();
    else wake(2500);
  }
  menuTab.onclick = () => {
    setMenu(!menuOpen);
    menuTab.blur();
  };
  function syncMenu() {
    if (!menuList.children.length) return;
    Array.from(menuList.children).forEach((el, k) => {
      const on = k === i;
      el.style.background = on ? "var(--green-deep,#071b34)" : "none";
      el.style.color = on ? "#fff" : "var(--ink-2,#233c57)";
      if (on && menuOpen) el.scrollIntoView({ block: "nearest" });
    });
  }
  const chapterStarts = [];
  slides.forEach((s, index) => {
    const explicit = (s.dataset.chapter || "").trim();
    const heading = s.classList.contains("divider") ? s.querySelector("h1")?.textContent.trim() : "";
    const name = explicit || heading;
    if (name && chapterStarts.at(-1)?.name !== name) chapterStarts.push({ name, index });
  });
  (function() {
    let current = null;
    slides.forEach((s, index) => {
      const start = chapterStarts.find((c) => c.index === index);
      if (start) current = start.name;
      const field = [...s.querySelectorAll(".footer > span")].find((sp) => sp.querySelector("b") && /lecture/i.test(sp.querySelector("b").textContent));
      if (!field) return;
      if (s === slides[0]) {
        field.remove();
        return;
      }
      if (backups.includes(s)) {
        const b2 = field.querySelector("b");
        b2.textContent = "Chapter";
        [...field.childNodes].forEach((n) => {
          if (n !== b2) n.remove();
        });
        field.appendChild(document.createTextNode(s.dataset.chapter || "Papers"));
        return;
      }
      if (s === routeTerminal) {
        const b2 = field.querySelector("b");
        b2.textContent = "Lecture";
        [...field.childNodes].forEach((n) => {
          if (n !== b2) n.remove();
        });
        field.appendChild(document.createTextNode(document.title.trim()));
        return;
      }
      if (!current) {
        field.remove();
        return;
      }
      const b = field.querySelector("b");
      b.textContent = "Chapter";
      [...field.childNodes].forEach((n) => {
        if (n !== b) n.remove();
      });
      field.appendChild(document.createTextNode(current));
    });
  })();
  (function() {
    const chapters = chapterStarts;
    if (!chapters.length) return;
    const pick = document.createElement("nav");
    pick.id = "chapterPick";
    pick.setAttribute("aria-label", "Jump to chapter");
    pick.style.cssText = "position:fixed;top:0;left:50%;transform:translate(-50%,-104%);z-index:902;display:flex;gap:6px;padding:9px 11px;background:var(--paper,#f4f7fb);border:1px solid var(--line,#c9d5e5);border-top:0;border-radius:0 0 10px 10px;box-shadow:0 8px 26px rgba(7,27,52,.14);transition:transform .18s ease";
    chapters.forEach((c, n) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = String(n + 1).padStart(2, "0") + "  " + c.name;
      btn.style.cssText = "border:1px solid transparent;border-radius:6px;padding:7px 13px;background:none;cursor:pointer;color:var(--ink-2,#233c57);font-family:inherit;font-size:15px;line-height:1.2;white-space:nowrap";
      btn.onmouseenter = () => {
        btn.style.background = "rgba(7,27,52,.06)";
      };
      btn.onmouseleave = () => {
        btn.style.background = c.index === lastLit ? "rgba(7,27,52,.06)" : "none";
      };
      btn.onclick = () => {
        show(c.index);
        setPick(false);
        btn.blur();
      };
      pick.appendChild(btn);
    });
    document.body.appendChild(pick);
    let open = false, lastLit = -1;
    function setPick(on) {
      open = on;
      pick.style.transform = on ? "translate(-50%,0)" : "translate(-50%,-104%)";
      if (!on) return;
      let cur = -1;
      chapters.forEach((c) => {
        if (c.index <= i) cur = c.index;
      });
      lastLit = cur;
      [...pick.children].forEach((b, n) => {
        const on2 = chapters[n].index === cur;
        b.style.background = on2 ? "rgba(7,27,52,.06)" : "none";
        b.style.borderColor = on2 ? "var(--line,#c9d5e5)" : "transparent";
        b.style.fontWeight = on2 ? "650" : "400";
      });
    }
    slides.forEach((s) => {
      const field = [...s.querySelectorAll(".footer > span")].find((sp) => sp.querySelector("b") && sp.querySelector("b").textContent === "Chapter");
      if (!field) return;
      const b = field.querySelector("b");
      b.setAttribute("role", "button");
      b.setAttribute("tabindex", "0");
      b.title = "Jump to chapter";
      b.style.cursor = "pointer";
      b.style.textDecorationLine = "underline";
      b.style.textDecorationStyle = "dotted";
      b.style.textUnderlineOffset = "3px";
      const fire = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setPick(!open);
        b.blur();
      };
      b.addEventListener("click", fire);
      b.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") fire(e);
      });
    });
    addEventListener("keydown", (e) => {
      if (open && e.key === "Escape") {
        setPick(false);
        e.preventDefault();
      }
    }, true);
    addEventListener("pointerdown", (e) => {
      if (open && !pick.contains(e.target)) setPick(false);
    });
  })();
  (function() {
    const cards = [...document.querySelectorAll(".slide .lrc")];
    if (!cards.length) return;
    const chapters = chapterStarts;
    const n = Math.min(cards.length, chapters.length);
    if (cards.length !== chapters.length)
      console.warn("[deck] lecture roadmap: " + cards.length + " card(s) against " + chapters.length + " chapter divider(s) - wired the first " + n + ", left the rest inert");
    for (let c = 0; c < n; c++) {
      const card = cards[c], target = chapters[c];
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", "Jump to chapter: " + target.name);
      card.title = "Jump to " + target.name;
      const fire = (e) => {
        e.preventDefault();
        e.stopPropagation();
        show(target.index);
        card.blur();
      };
      card.addEventListener("click", fire);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") fire(e);
      });
    }
  })();
  (function() {
    "use strict";
    var slide = document.querySelector('.slide[data-name="What Training Costs"]');
    if (!slide) return;
    var inp = slide.querySelector(".s330-n");
    var tok = slide.querySelector(".s330-tok");
    var mant = slide.querySelector(".s330-mant");
    var expo = slide.querySelector(".s330-exp");
    var usd = slide.querySelector(".s330-usd");
    if (!inp || !tok || !mant || !expo || !usd) return;
    var TOK_PER_PARAM = 38.5;
    var USD_PER_FLOP = 17e-19;
    var FALLBACK = 405, LO = 0.1, HI = 1e5;
    function sig2(x) {
      if (!isFinite(x) || x <= 0) return 0;
      var p = Math.pow(10, Math.floor(Math.log10(x)) - 1);
      return Math.round(x / p) * p;
    }
    function money(v) {
      v = sig2(v);
      var u = [[1e12, "trillion"], [1e9, "billion"], [1e6, "million"], [1e3, "thousand"]];
      for (var i2 = 0; i2 !== u.length; i2++) {
        if (v >= u[i2][0]) {
          var q = v / u[i2][0];
          return "≈ $" + (q >= 10 ? Math.round(q) : q.toFixed(1)) + " " + u[i2][1];
        }
      }
      return "≈ $" + (v >= 10 ? Math.round(v) : v.toFixed(1));
    }
    function tokens(t) {
      var big = t >= 1e12, q = t / (big ? 1e12 : 1e9);
      var s = q >= 1e3 ? Math.round(q).toLocaleString("en-US") : q.toFixed(1).replace(/\.0$/, "");
      return s + (big ? "T" : "B");
    }
    function paint() {
      var raw = inp.value.trim();
      var n = raw === "" ? NaN : Number(raw), note = "";
      if (!isFinite(n)) {
        n = FALLBACK;
      } else if (n < LO) {
        n = LO;
        note = "floored at 0.1";
      } else if (n > HI) {
        n = HI;
        note = "capped at 100,000";
      }
      var params = n * 1e9;
      var ntok = TOK_PER_PARAM * params;
      var flop = 6 * params * ntok;
      var e = Math.floor(Math.log10(flop));
      var m = Math.round(flop / Math.pow(10, e) * 10) / 10;
      if (m >= 10) {
        m = m / 10;
        e = e + 1;
      }
      tok.setAttribute("data-t", note || "→ " + tokens(ntok) + " tokens");
      mant.textContent = m.toFixed(1);
      expo.textContent = String(e);
      usd.textContent = money(flop * USD_PER_FLOP);
    }
    inp.addEventListener("input", paint);
    inp.addEventListener("keydown", function(e) {
      e.stopPropagation();
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        inp.blur();
      }
    });
    inp.addEventListener("keyup", function(e) {
      e.stopPropagation();
    });
    inp.addEventListener("keypress", function(e) {
      e.stopPropagation();
    });
    paint();
  })();
  const chromeHide = document.createElement("style");
  chromeHide.textContent = "@media print{#slidemenu,#slidemenuTab,#pdfTab,#blank,#chapterPick{display:none!important}}";
  document.head.appendChild(chromeHide);
  addEventListener("keydown", (e) => {
    if (ov.classList.contains("is-open")) {
      if (e.key === "Escape" || e.key.toLowerCase() === "g") ov.classList.remove("is-open");
      return;
    }
    if (blank.style.display === "block") {
      if (e.key === "Escape" || e.key.toLowerCase() === "b") setBlank(false);
      e.preventDefault();
      return;
    }
    if (menuOpen && e.key === "Escape") {
      setMenu(false);
      return;
    }
    if (e.target.closest("button, a")) return;
    const k = e.key;
    if (k === "ArrowRight" || k === "PageDown" || k === " ") {
      e.preventDefault();
      next();
    } else if (k === "ArrowLeft" || k === "PageUp") {
      e.preventDefault();
      prev();
    } else if (k === "ArrowDown") {
      e.preventDefault();
      down();
    } else if (k === "ArrowUp") {
      e.preventDefault();
      up();
    } else if (k === "Home") show(0);
    else if (k === "End") show(slides.length - 1);
    else if (k.toLowerCase() === "g") ov.classList.add("is-open");
    else if (k.toLowerCase() === "n") document.getElementById("noteToggle").click();
    else if (k.toLowerCase() === "f") document.getElementById("full").click();
    else if (k.toLowerCase() === "b") setBlank(true);
    else if (k.toLowerCase() === "m") setMenu(!menuOpen);
    else if (k.toLowerCase() === "p") {
      e.preventDefault();
      print();
    }
  });
  addEventListener("hashchange", () => {
    const n = Number(location.hash.slice(1));
    if (n >= 1 && n <= slides.length && n - 1 !== i) show(n - 1);
  });
  (() => {
    const SKIP = "a, button, input, textarea, select, label, summary, [contenteditable], [data-goto], video[controls], #slidemenu, .overview, .controls, .notes, #chapterPick, .cin-seg, #blank";
    const press = (key) => document.body.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    const zoomed = () => !!window.visualViewport && visualViewport.scale > 1.05;
    let t0 = null;
    addEventListener("touchstart", (e) => {
      const p = e.touches[0];
      t0 = e.touches.length === 1 ? { x: p.clientX, y: p.clientY, t: Date.now(), el: e.target } : null;
    }, { passive: true });
    addEventListener("touchmove", (e) => {
      if (e.touches.length > 1) t0 = null;
    }, { passive: true });
    addEventListener("touchcancel", () => {
      t0 = null;
    }, { passive: true });
    addEventListener("touchend", (e) => {
      const s = t0;
      t0 = null;
      if (!s || e.touches.length || e.changedTouches.length !== 1) return;
      if (document.documentElement.classList.contains("cm-on")) return;
      if (s.el && s.el.closest && s.el.closest(SKIP)) return;
      const p = e.changedTouches[0], dx = p.clientX - s.x, dy = p.clientY - s.y, dt = Date.now() - s.t;
      if (Math.abs(dx) >= 40 && Math.abs(dx) > 1.4 * Math.abs(dy) && dt < 900 && !zoomed()) {
        if (e.cancelable) e.preventDefault();
        if (menuOpen) setMenu(false);
        press(dx < 0 ? "ArrowRight" : "ArrowLeft");
        return;
      }
      if (Math.abs(dx) > 12 || Math.abs(dy) > 12 || dt > 600) return;
      if (String(getSelection && getSelection()).trim()) return;
      if (e.cancelable) e.preventDefault();
      if (menuOpen) {
        setMenu(false);
        return;
      }
      const r = stage.getBoundingClientRect();
      press(p.clientX < r.left + r.width / 4 ? "ArrowLeft" : "ArrowRight");
    }, { passive: false });
    const css = document.createElement("style");
    css.textContent = "html{touch-action:manipulation}#tapHint{position:fixed;left:50%;bottom:44px;transform:translateX(-50%);z-index:950;width:max-content;max-width:min(300px,calc(100vw - 32px));padding:6px 12px;border-radius:8px;background:rgba(244,247,251,.94);color:#233c57;box-shadow:0 2px 10px rgba(0,0,0,.25);font:500 12px/1.35 system-ui,sans-serif;text-align:center;pointer-events:none;transition:opacity .4s ease}@media print{#tapHint{display:none!important}}";
    document.head.appendChild(css);
    let seen = false;
    try {
      seen = sessionStorage.getItem("deckTapHint") === "1";
      sessionStorage.setItem("deckTapHint", "1");
    } catch (_) {
    }
    if (seen || !matchMedia("(hover: none) and (pointer: coarse)").matches) return;
    const hint = document.createElement("div");
    hint.id = "tapHint";
    hint.textContent = "Tap to go on · left edge goes back" + (innerHeight > innerWidth ? " · turn sideways to enlarge" : "");
    document.body.appendChild(hint);
    const gone = () => {
      hint.style.opacity = "0";
      setTimeout(() => hint.remove(), 500);
    };
    const timer = setTimeout(gone, 5e3);
    addEventListener("touchend", () => {
      clearTimeout(timer);
      gone();
    }, { once: true, passive: true });
  })();
  addEventListener("beforeprint", () => {
    clearTimeout(arrivalBuildTimer);
    arrivalBuildTimer = 0;
    setBlank(false);
    slides.forEach((s) => {
      s.classList.add("is-active");
      applyStep(s, maxStep(s));
    });
  });
  addEventListener("afterprint", () => show(i));
  const req = Number(location.hash.slice(1));
  show(req >= 1 ? req - 1 : i);
  const wanted = new URLSearchParams(location.search).get("step");
  if (wanted) applyStep(slides[i], wanted === "max" ? maxStep(slides[i]) : Number(wanted));
  function fitTitles() {
    const root = getComputedStyle(document.documentElement);
    const base = parseFloat(root.getPropertyValue("--fs-h2")) || 46;
    const floor = parseFloat(root.getPropertyValue("--fs-h2-min")) || 38;
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;left:-99999px;top:0;white-space:nowrap;visibility:hidden";
    document.body.appendChild(probe);
    const active = document.querySelector(".slide.is-active .slide-head h2");
    const columnWidth = active && active.parentElement.clientWidth || 1190;
    const over = [];
    document.querySelectorAll(".slide-head h2").forEach((h) => {
      const slide = h.closest(".slide");
      const cs = getComputedStyle(h);
      probe.style.font = `${cs.fontStyle} ${cs.fontWeight} ${base}px/${cs.lineHeight} ${cs.fontFamily}`;
      probe.style.letterSpacing = cs.letterSpacing;
      probe.textContent = h.textContent.trim();
      const naturalWidth = probe.getBoundingClientRect().width;
      const clear = () => {
        h.style.whiteSpace = "";
        slide.style.removeProperty("--band-head");
      };
      if (naturalWidth <= columnWidth) {
        h.style.fontSize = "";
        clear();
        return;
      }
      const exact = base * columnWidth / naturalWidth;
      if (exact >= floor) {
        h.style.fontSize = `${Math.floor(exact * 10) / 10}px`;
        clear();
      } else {
        h.style.fontSize = `${floor}px`;
        h.style.whiteSpace = "normal";
        slide.style.setProperty("--band-head", "auto");
      }
      over.push(`${probe.textContent} (${h.style.fontSize})`);
    });
    probe.remove();
    if (over.length) console.warn("[deck] headline too long for one line at full size:", over);
  }
  fitTitles();
  addEventListener("resize", fitTitles);
  addEventListener("beforeprint", fitTitles);
  window.Deck = { go: show, next, prev, length: slides.length, current: () => i };
})();
