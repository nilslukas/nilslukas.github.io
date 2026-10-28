/* ============================================================================
   comments.js — review comments pinned to a spot on a slide (Nils, 2026-09-14).

   WHAT IT IS. Nils, 2026-09-14: "make it so that I can leave comments on each
   slide like in claude design ... a slider to go into 'edit mode' and then when
   I click on some location on the slide it allows me to add a comment as text
   and then it attaches it to the slide (multiple comments allowed). after
   saving it/hitting enter it then becomes a subtle 'x' and I can see all
   comments sorted by which slide they are on in some panel that is always
   collapsed." The point is the round trip: he annotates a review pass, then
   tells Claude "fix all my comments", and an agent reads the JSON and works
   through it.

   THE THREE PIECES.
     · A "Comment" switch in the bottom-right controls bar (or the `c` key).
       While it is on, the stage takes a crosshair cursor, a crimson pill sits
       at the top of the window, and a click anywhere on the active slide opens
       a small editor at that spot. Enter saves (Shift+Enter is a newline),
       Escape cancels. A saved comment becomes a small crimson × pinned at the
       click position, in slide coordinates, so it scales with the stage.
       Hovering the × shows the text; clicking it reopens the editor.
     · A collapsed tab (✎, with a count) at the bottom left, above the deck's
       own menu and PDF tabs. It opens a panel listing every comment grouped by
       slide and sorted by slide number; a row jumps to its slide, and each row
       has done / edit / delete. The panel is closed on load, always.
     · Storage. Every change is written to localStorage under a key derived
       from the deck folder name, so comments survive a reload and a rebuild
       of index.html. If the deck is served by artifacts/tools/serve_deck.py
       (which sets a session cookie, ml8502_feedback=1, on every response) the
       same JSON is also PUT to /__feedback/<deck>.json and the server writes
       it to outputs/feedback/<deck>.json in the checkout it serves, which is
       the file an agent reads. Without that server the panel says so and
       offers Copy JSON / Download; either output is the same document.

   THE DOCUMENT (also what Download writes):
     { deck: "week03-certified-defenses", page: "/slides/.../index.html",
       exported: ISO time,
       comments: [ { id, slide: 1-based index in document order (the #N hash),
                     label: the page label deck.js prints ("03", "07▾1"),
                     name: the slide's data-name, x, y: fractions of the
                     .canvas box, target: the element under the click
                     ("p “The gradient of …”"), text, status: "open"|"done",
                     created, updated: ISO times } ] }
   An agent that has fixed a comment sets status to "done" (and bumps
   updated); the panel then shows it struck through and its × dimmed, and
   "Clear done" removes them. Merging is by id, newest `updated` wins, so a
   server file edited by an agent and a browser copy reconcile on reload.

   A COMMENT BELONGS TO A SLIDE BY NAME, NOT BY POSITION (Nils, 2026-09-15:
   "when a slide is deleted the comments/notes annotated on that slide don't
   show up anymore on this slide. they are still in the notes 'database' but
   they don't visually appear on the slide"). On every render each comment is
   resolved through its `name` to the slide that currently carries that
   data-name: found, its `slide` and `label` are refreshed to the current
   position, so a reorder or an insertion never lands a × on the wrong page;
   not found, the comment is marked `removed: true`, draws no × anywhere and
   sits in the panel's last group, "removed slides", still counted, still
   exported, editable only as text, and revived by itself the moment a slide
   with that name comes back. A record with no `name` (the first day's
   comments) keeps its position.

   SAVES MERGE, DELETIONS ARE TOMBSTONED (2026-09-15, observed on Week 3). A
   tab that stays open sends its whole list on every save, and a plain replace
   overwrote the `status: "done"` an agent had written on the server file. So
   every save first reads the server copy and merges it in (same id: the newer
   `updated` wins), and serve_deck.py merges again on its side. A comment Nils
   deletes here (a row's ×, Clear done, Clear all) is remembered in
   localStorage as a tombstone and sent as `deleted: [ids]`, which is the only
   way a record leaves the server file; a comment on a removed slide is not a
   deletion and stays. Import revives a tombstoned id on purpose.

   WHY QA AND THE EXPORTS NEVER SEE IT. Nothing here is inside a .slide at load
   time except the × markers, and those exist only for saved comments in THIS
   browser's localStorage, which the QA browser does not have; every piece of
   chrome is display:none until used and hidden again under @media print. The
   server probe runs only when the cookie is present, so a plain http.server or
   file:// never fires a request that could 404 into the console. The tag in
   _tail.html carries data-export="skip", which export_single_file.py honours,
   so student.html and slides.pdf carry no trace of the review tooling.
   ======================================================================== */
(function () {
  'use strict';

  var stage = document.querySelector('.stage');
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  if (!stage || !slides.length) return;

  var m = location.pathname.match(/slides\/([^\/]+)\//);
  var deckId = m ? m[1] : (document.title || 'deck').replace(/[^A-Za-z0-9_-]+/g, '-').toLowerCase();
  var KEY = 'ml8502-comments:' + deckId;
  var ENDPOINT = '/__feedback/' + deckId + '.json';
  var hasServer = /^https?:$/.test(location.protocol) && /(^|;\s*)ml8502_feedback=/.test(document.cookie);
  var savedPath = null;
  var TOMB_KEY = KEY + ':deleted';
  var tomb = (function () { try { return new Set(JSON.parse(localStorage.getItem(TOMB_KEY) || '[]')); } catch (e) { return new Set(); } })();
  function writeTomb() { try { localStorage.setItem(TOMB_KEY, JSON.stringify(Array.from(tomb))); } catch (e) { /* nothing */ } }
  function notTombed(c) { return !tomb.has(c.id); }

  var comments = [];
  var mode = false;
  var composer = null;
  var bubble = null;
  var ui = {};

  /* ------------------------------------------------------------ storage */
  function payload() {
    return { deck: deckId, page: location.pathname, exported: new Date().toISOString(), comments: comments, deleted: Array.from(tomb) };
  }
  function readLocal() {
    try {
      var raw = localStorage.getItem(KEY);
      var d = raw ? JSON.parse(raw) : null;
      return d && Array.isArray(d.comments) ? d.comments.filter(valid) : [];
    } catch (e) { return []; }
  }
  function writeLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(payload())); } catch (e) { /* private mode */ }
  }
  function valid(c) {
    return c && typeof c.id === 'string' && typeof c.text === 'string' && isFinite(c.slide) && isFinite(c.x) && isFinite(c.y);
  }
  function merge(a, b) {
    var byId = {};
    a.concat(b).forEach(function (c) {
      if (!valid(c)) return;
      var o = byId[c.id];
      if (!o || String(c.updated || '') > String(o.updated || '')) byId[c.id] = c;
    });
    return Object.keys(byId).map(function (k) { return byId[k]; });
  }
  function bySlide(p, q) {
    return (p.slide - q.slide) || String(p.created || '').localeCompare(String(q.created || ''));
  }
  /* Which slide a comment belongs to NOW. By data-name, never by the position it
     was made at: -1 means no slide in this build carries that name. */
  var nameIndex = null;
  function slideOf(c) {
    if (!nameIndex) {
      nameIndex = {};
      slides.forEach(function (s, k) { var n = s.getAttribute('data-name'); if (n && !(n in nameIndex)) nameIndex[n] = k; });
    }
    if (c.name) return (c.name in nameIndex) ? nameIndex[c.name] : -1;
    return c.slide >= 1 && c.slide <= slides.length ? c.slide - 1 : -1;
  }
  /* Refresh slide/label from the current deck and flag the orphans. Returns true
     when any record changed, so the caller can persist the corrected positions. */
  function reindex() {
    var changed = false;
    comments.forEach(function (c) {
      var k = slideOf(c);
      if (k < 0) {
        if (!c.removed) { c.removed = true; changed = true; }
        return;
      }
      var i = info(k);
      if (c.removed) { delete c.removed; changed = true; }
      if (c.slide !== i.index) { c.slide = i.index; changed = true; }
      if (c.label !== i.label) { c.label = i.label; changed = true; }
      if (!c.name && i.name) { c.name = i.name; changed = true; }
    });
    return changed;
  }
  /* Every save first reads the server copy and merges it in (newest `updated`
     wins, deletions made in this browser are remembered as tombstones), THEN
     writes. Without this a browser that stays open while an agent marks
     comments done on the server overwrote the agent's edits on its next save
     (2026-09-15, observed). */
  function pushServer() {
    if (!hasServer) return Promise.resolve(false);
    return fetch(ENDPOINT, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : { comments: [] }; }).catch(function () { return { comments: [] }; })
    .then(function (d) {
      var remote = d && Array.isArray(d.comments) ? d.comments : [];
      var before = JSON.stringify(comments);
      comments = merge(comments, remote).filter(notTombed);
      reindex();
      comments.sort(bySlide);
      if (JSON.stringify(comments) !== before) { writeLocal(); renderAll(); }
      return fetch(ENDPOINT, {
        method: 'PUT', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(), null, 1)
      });
    }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      savedPath = r.headers.get('X-Feedback-Path') || savedPath;
      renderStatus();
      return true;
    }).catch(function () { hasServer = false; renderStatus(); return false; });
  }
  function persist() {
    reindex();
    comments.sort(bySlide);
    writeLocal();
    pushServer();
    renderAll();
  }
  function load() {
    comments = readLocal();
    if (reindex()) writeLocal();
    comments.sort(bySlide);
    renderAll();
    if (!hasServer) return;
    fetch(ENDPOINT, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      savedPath = r.headers.get('X-Feedback-Path') || savedPath;
      return r.json();
    }).then(function (d) {
      var remote = d && Array.isArray(d.comments) ? d.comments : [];
      comments = merge(comments, remote).filter(notTombed);
      reindex();
      comments.sort(bySlide);
      writeLocal();
      pushServer();
      renderAll();
    }).catch(function () { hasServer = false; renderAll(); });
  }

  /* live review (26 Oct 2026, Nils: "once a comment is fixed, please also fix it in the popup"): pull the store every
     10 s and merge, so a comment the agent marks done turns done here without a reload. Newer `updated` wins, as on load;
     nothing is pushed, and an open composer is left alone. */
  function pull() {
    if (!hasServer || composer) return;
    fetch(ENDPOINT, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || composer) return;
      var remote = Array.isArray(d.comments) ? d.comments : [];
      var before = JSON.stringify(comments);
      comments = merge(comments, remote).filter(notTombed);
      reindex();
      comments.sort(bySlide);
      if (JSON.stringify(comments) !== before) { writeLocal(); renderAll(); }
    }).catch(function () { /* try again next time */ });
  }
  setInterval(pull, 10000);

  /* ------------------------------------------------------------ helpers */
  function pad(n) { return String(n).padStart(2, '0'); }
  function info(k) {
    var s = slides[k];
    var pg = s.querySelector('.page');
    var label = pg && pg.textContent.indexOf('/') > -1 ? pg.textContent.split('/')[0].trim() : pad(k + 1);
    var h = s.querySelector('.slide-head h2, h1, h2');
    return { index: k + 1, label: label, name: s.getAttribute('data-name') || (h ? h.textContent.trim() : '') };
  }
  function activeIndex() {
    for (var k = 0; k < slides.length; k++) if (slides[k].classList.contains('is-active')) return k;
    return 0;
  }
  function canvasOf(k) { return slides[k].querySelector('.canvas') || slides[k]; }
  /* What was clicked, for the agent that reads the JSON: tag, up to two classes and a
     text snippet. A click on empty space (a margin, the gap between two blocks) names the
     NEAREST text-bearing element instead, prefixed "near", so a note placed beside a table
     row or a figure still says which one. */
  var HIT = 'h1,h2,h3,p,li,td,th,figcaption,img,video,svg,pre,code,.note,.takeaway,.thm,.defbox,.gloss,.eyebrow,b,span,div';
  var NEAR = 'h1,h2,h3,p,li,tr,figcaption,img,video,svg,pre,.note,.takeaway,.thm,.defbox,.gloss,.eyebrow';
  function label(t) {
    var tag = t.tagName.toLowerCase();
    var cls = (t.getAttribute('class') || '').trim().split(/\s+/).filter(function (c) { return c && !/^(is-|has-|cm-)/.test(c); }).slice(0, 2).join('.');
    var txt;
    if (tag === 'img') txt = t.getAttribute('alt') || t.getAttribute('src') || '';
    else if (tag === 'tr') txt = Array.prototype.map.call(t.children, function (c) { return (c.textContent || '').replace(/\s+/g, ' ').trim(); }).filter(Boolean).join(' | ');
    else txt = (t.textContent || '').replace(/\s+/g, ' ').trim();
    if (txt.length > 72) txt = txt.slice(0, 69) + '…';
    return tag + (cls ? '.' + cls : '') + (txt ? ' “' + txt + '”' : '');
  }
  function describe(el, canvas, cx, cy) {
    var t = el && el.closest ? el.closest(HIT) : null;
    if (t && canvas.contains(t) && t !== canvas) return label(t);
    var best = null, bd = Infinity;
    Array.prototype.forEach.call(canvas.querySelectorAll(NEAR), function (n) {
      if (n.closest('.cm-editor, .cm-bubble')) return;
      var r = n.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var dx = Math.max(r.left - cx, 0, cx - r.right), dy = Math.max(r.top - cy, 0, cy - r.bottom);
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bd) { bd = d; best = n; }
    });
    return best ? 'near ' + label(best) : '';
  }
  function newId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function stopKeys(node) {
    ['keydown', 'keyup', 'keypress'].forEach(function (ev) {
      node.addEventListener(ev, function (e) { e.stopPropagation(); });
    });
  }
  function go(index) {
    var want = '#' + index;
    if (location.hash !== want) location.hash = want;
  }
  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  /* ------------------------------------------------------------ mode */
  /* The mode lives in sessionStorage, so a reload after a rebuild lands back
     in the review pass; a fresh tab always opens clean, ready to present. */
  var MODE_KEY = KEY + ':mode';
  function setMode(on) {
    mode = !!on;
    document.documentElement.classList.toggle('cm-on', mode);
    if (ui.toggle) ui.toggle.checked = mode;
    if (!mode) { closeComposer(false); hideBubble(); }
    try { if (mode) sessionStorage.setItem(MODE_KEY, '1'); else sessionStorage.removeItem(MODE_KEY); } catch (e) { /* nothing */ }
  }

  /* ------------------------------------------------------------ markers */
  function placeBox(box, x, y) {
    box.style.left = (x * 100).toFixed(3) + '%';
    box.style.top = (y * 100).toFixed(3) + '%';
    var tx = x > 0.58 ? '-100%' : '0', ty = y > 0.66 ? '-100%' : '0';
    box.style.transform = 'translate(' + (x > 0.58 ? 'calc(' + tx + ' - 18px)' : '18px') + ',' + (y > 0.66 ? 'calc(' + ty + ' - 18px)' : '18px') + ')';
  }
  function renderMarkers() {
    slides.forEach(function (s, k) {
      var canvas = canvasOf(k);
      Array.prototype.slice.call(canvas.querySelectorAll('.cm-mark')).forEach(function (n) { n.remove(); });
      comments.forEach(function (c) {
        if (c.removed || slideOf(c) !== k) return;
        var b = el('button', 'cm-mark' + (c.status === 'done' ? ' is-done' : ''), '×');
        b.type = 'button';
        b.dataset.id = c.id;
        if (c.step != null) b.dataset.step = String(c.step);   /* 26 Oct 2026: a comment belongs to one build step */
        b.style.left = (c.x * 100).toFixed(3) + '%';
        b.style.top = (c.y * 100).toFixed(3) + '%';
        b.setAttribute('aria-label', 'Comment: ' + c.text);
        b.addEventListener('mouseenter', function () { showBubble(c, canvas); });
        b.addEventListener('mouseleave', hideBubble);
        b.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          hideBubble();
          openComposer(k, c.x, c.y, c);
        });
        canvas.appendChild(b);
      });
    });
  }
  /* a marker shows only at the build step it was pinned on (comments without a step show at every step) */
  function syncSteps() {
    slides.forEach(function (s, k) {
      var st = String(Number(s.dataset.step || 0));
      Array.prototype.forEach.call(canvasOf(k).querySelectorAll('.cm-mark[data-step]'), function (b) {
        b.classList.toggle('cm-otherstep', b.dataset.step !== st);
      });
    });
  }
  new MutationObserver(syncSteps).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-step'] });
  /* go to a comment's slide and replay the presses up to its step */
  function goStep(c) {
    go(c.slide);
    var n = Number(c.step || 0);
    if (!n || !window.Deck) return;
    setTimeout(function () {
      var k = slideOf(c);
      if (k < 0 || !slides[k]) return;
      for (var t = 0; t < 20 && Number(slides[k].dataset.step || 0) < n; t++) window.Deck.next();
    }, 120);
  }
  function showBubble(c, canvas) {
    if (composer) return;
    hideBubble();
    bubble = el('div', 'cm-bubble');
    var meta = el('small', null, (c.status === 'done' ? 'done · ' : '') + (c.target ? c.target + ' · ' : '') + fmtTime(c.updated || c.created));
    var p = el('p', null, c.text);
    bubble.appendChild(p);
    bubble.appendChild(meta);
    placeBox(bubble, c.x, c.y);
    canvas.appendChild(bubble);
  }
  function hideBubble() { if (bubble) { bubble.remove(); bubble = null; } }

  /* ------------------------------------------------------------ composer */
  function openComposer(k, x, y, existing, target) {
    closeComposer(false);
    hideBubble();
    var canvas = canvasOf(k);
    var box = el('div', 'cm-editor');
    var ta = el('textarea');
    ta.placeholder = existing ? 'Edit the comment' : 'Comment on this spot…';
    ta.value = existing ? existing.text : '';
    ta.rows = 3;
    stopKeys(ta);
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeComposer(false); }
      else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); closeComposer(true); }
    });
    var bar = el('div', 'cm-bar');
    var hint = el('span', 'cm-hint', existing ? info(k).label + ' · Enter saves · Esc cancels' : 'Enter saves · Shift+Enter newline · Esc cancels');
    bar.appendChild(hint);
    if (existing) {
      var del = el('button', 'cm-btn cm-danger', 'Delete');
      del.type = 'button';
      del.addEventListener('click', function (e) { e.stopPropagation(); remove(existing.id); closeComposer(false); });
      bar.appendChild(del);
    }
    var save = el('button', 'cm-btn', existing ? 'Save' : 'Add');
    save.type = 'button';
    save.addEventListener('click', function (e) { e.stopPropagation(); closeComposer(true); });
    bar.appendChild(save);
    box.appendChild(ta);
    box.appendChild(bar);
    box.addEventListener('click', function (e) { e.stopPropagation(); });
    placeBox(box, x, y);
    var pin = null;
    if (!existing) {
      pin = el('span', 'cm-mark cm-pin', '×');
      pin.style.left = (x * 100).toFixed(3) + '%';
      pin.style.top = (y * 100).toFixed(3) + '%';
      canvas.appendChild(pin);
    }
    canvas.appendChild(box);
    composer = { box: box, ta: ta, pin: pin, k: k, x: x, y: y, existing: existing || null, target: target || (existing && existing.target) || '' };
    ta.focus();
  }
  function closeComposer(commit) {
    if (!composer) return;
    var c = composer;
    composer = null;
    var text = c.ta.value.replace(/^\s+|\s+$/g, '');
    c.box.remove();
    if (c.pin) c.pin.remove();
    if (!commit || !text.trim()) { if (commit && c.existing) remove(c.existing.id); return; }
    var now = new Date().toISOString();
    if (c.existing) {
      c.existing.text = text;
      c.existing.updated = now;
    } else {
      var i = info(c.k);
      comments.push({ id: newId(), slide: i.index, label: i.label, name: i.name, step: Number(slides[c.k].dataset.step || 0), x: Math.round(c.x * 1e4) / 1e4, y: Math.round(c.y * 1e4) / 1e4, target: c.target, text: text, status: 'open', created: now, updated: now });
    }
    persist();
  }
  function remove(id) {
    tomb.add(id); writeTomb();
    comments = comments.filter(function (c) { return c.id !== id; });
    persist();
  }
  function setDone(id, done) {
    comments.forEach(function (c) { if (c.id === id) { c.status = done ? 'done' : 'open'; c.updated = new Date().toISOString(); } });
    persist();
  }

  /* ------------------------------------------------------------ panel */
  function renderPanel() {
    var list = ui.list;
    while (list.firstChild) list.removeChild(list.firstChild);
    var live = comments.filter(function (c) { return !c.removed; });
    var gone = comments.filter(function (c) { return c.removed; });
    var open = live.filter(function (c) { return c.status !== 'done'; }).length;
    var done = live.length - open;
    ui.total.textContent = comments.length ? (open + ' open' + (done ? ', ' + done + ' done' : '') + (gone.length ? ', ' + gone.length + ' on removed slides' : '')) : 'none yet';
    ui.count.textContent = String(open);
    ui.count.classList.toggle('is-on', open > 0);
    if (!comments.length) {
      list.appendChild(el('p', 'cm-empty', 'No comments. Switch on Comment (bottom-right controls, or press c), then click a spot on a slide.'));
      return;
    }
    var groups = {};
    live.forEach(function (c) { (groups[c.slide] = groups[c.slide] || []).push(c); });
    var keys = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    /* the orphans last, grouped by the name of the slide they were made on */
    var goneBy = {};
    gone.forEach(function (c) { var n = c.name || ('slide ' + c.slide); (goneBy[n] = goneBy[n] || []).push(c); });
    Object.keys(goneBy).sort().forEach(function (n) { groups['gone:' + n] = goneBy[n]; keys.push('gone:' + n); });
    keys.forEach(function (n) {
      var removed = typeof n === 'string';
      var h, i;
      if (removed) {
        h = el('div', 'cm-group is-removed', 'removed slide · ' + n.slice(5));
        h.title = 'No slide in this build is named “' + n.slice(5) + '”; these comments stay in the store and show no marker.';
      } else {
        i = info(Math.max(0, Math.min(slides.length, n) - 1));
        h = el('div', 'cm-group', i.label + ' · ' + (groups[n][0].name || i.name));
        h.title = 'Go to slide ' + n;
        h.addEventListener('click', function () { go(n); });
      }
      list.appendChild(h);
      groups[n].forEach(function (c) {
        var row = el('div', 'cm-row' + (c.status === 'done' ? ' is-done' : '') + (removed ? ' is-removed' : ''));
        var body = el('div', 'cm-body');
        body.appendChild(el('p', null, c.text));
        body.appendChild(el('small', null, (c.step ? 'step ' + c.step + ' · ' : '') + (c.target ? c.target + ' · ' : '') + fmtTime(c.updated || c.created)));
        var ops = el('div', 'cm-ops');
        var done = el('button', null, c.status === 'done' ? '↺' : '✓');
        done.type = 'button'; done.title = c.status === 'done' ? 'Reopen' : 'Mark done';
        done.addEventListener('click', function (e) { e.stopPropagation(); setDone(c.id, c.status !== 'done'); });
        var edit = el('button', null, '✎');
        edit.type = 'button'; edit.title = removed ? 'Edit the text (the slide is gone, so there is no spot to pin)' : 'Edit';
        edit.addEventListener('click', function (e) {
          e.stopPropagation();
          if (removed) { var t = prompt('Edit the comment', c.text); if (t != null && t.trim()) { c.text = t.trim(); c.updated = new Date().toISOString(); persist(); } return; }
          go(c.slide); setMode(true); setTimeout(function () { openComposer(c.slide - 1, c.x, c.y, c); }, 60);
        });
        var del = el('button', null, '×');
        del.type = 'button'; del.title = 'Delete';
        del.addEventListener('click', function (e) { e.stopPropagation(); remove(c.id); });
        ops.appendChild(done); ops.appendChild(edit); ops.appendChild(del);
        row.appendChild(body); row.appendChild(ops);
        if (!removed) row.addEventListener('click', function () { goStep(c); });
        list.appendChild(row);
      });
    });
  }
  function renderStatus() {
    if (!ui.status) return;
    if (hasServer) {
      ui.status.textContent = 'Saved to ' + (savedPath || 'outputs/feedback/' + deckId + '.json') + ' (deck server) and in this browser.';
    } else {
      ui.status.textContent = 'Saved in this browser only. Download or Copy JSON to hand these to Claude, or serve the deck with artifacts/tools/serve_deck.py so they land in outputs/feedback/ by themselves.';
    }
  }
  function renderAll() { renderMarkers(); syncSteps(); renderPanel(); renderStatus(); }
  function setPanel(open) {
    ui.panel.classList.toggle('is-open', !!open);
    ui.tab.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function copyJSON() {
    var text = JSON.stringify(payload(), null, 2);
    var done = function () { flash('Copied ' + comments.length + ' comments as JSON'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = el('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* nothing */ }
    ta.remove();
  }
  function download() {
    var blob = new Blob([JSON.stringify(payload(), null, 2)], { type: 'application/json' });
    var a = el('a'); a.href = URL.createObjectURL(blob); a.download = deckId + '-comments.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function importFile(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(String(r.result));
        var incoming = Array.isArray(d) ? d : (d && d.comments) || [];
        incoming.forEach(function (c) { if (c && c.id) tomb.delete(c.id); }); writeTomb();
        comments = merge(comments, incoming);
        persist();
        flash('Imported: now ' + comments.length + ' comments');
      } catch (e) { flash('Not a comments JSON file'); }
    };
    r.readAsText(file);
  }
  var flashTimer = 0;
  function flash(msg) {
    ui.flash.textContent = msg;
    ui.flash.classList.add('is-on');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { ui.flash.classList.remove('is-on'); }, 2600);
  }

  /* ------------------------------------------------------------ chrome */
  function css() {
    var s = document.createElement('style');
    s.textContent = [
      'html.cm-on .stage{cursor:crosshair}',
      'html.cm-on .slide.is-active>.canvas{outline:2px dashed rgba(176,50,42,.45);outline-offset:-2px}',
      '.cm-pill{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:903;display:none;padding:7px 13px;border-radius:4px;background:#b0322a;color:#fff;font:700 12px/1 var(--mono,monospace);letter-spacing:.1em;text-transform:uppercase;box-shadow:0 6px 18px rgba(7,27,52,.22);pointer-events:none}',
      'html.cm-on .cm-pill{display:block}',
      '.cm-mark{display:none;position:absolute;z-index:30;width:26px;height:26px;margin:-13px 0 0 -13px;padding:0;border:1.5px solid rgba(176,50,42,.6);border-radius:50%;background:rgba(255,255,255,.88);color:#b0322a;font:700 17px/1 var(--sans,sans-serif);cursor:pointer;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(7,27,52,.2);transition:background .12s,color .12s}',
      'html.cm-on .cm-mark{display:flex}',
      'html.cm-on .cm-mark.cm-otherstep{display:none}',
      '.cm-mark:hover,.cm-mark.cm-pin{background:#b0322a;color:#fff}',
      '.cm-mark.cm-pin{pointer-events:none}',
      '.cm-mark.is-done{border-color:rgba(96,118,141,.55);color:#60768d;background:rgba(255,255,255,.75)}',
      '.cm-mark.is-done:hover{background:#60768d;color:#fff}',
      '.cm-bubble{position:absolute;z-index:32;max-width:420px;padding:10px 13px;background:#fff;border:1px solid var(--line,#c9d5e5);border-left:4px solid #b0322a;box-shadow:0 8px 24px rgba(7,27,52,.16);pointer-events:none}',
      '.cm-bubble p{margin:0;font-size:18px;line-height:1.35;color:var(--ink,#071b34);white-space:pre-wrap}',
      '.cm-bubble small{display:block;margin-top:6px;font-size:13px;line-height:1.3;color:var(--ink-3,#60768d)}',
      '.cm-editor{position:absolute;z-index:33;width:460px;padding:10px;background:#fff;border:1px solid var(--line,#c9d5e5);border-left:4px solid #b0322a;box-shadow:0 12px 32px rgba(7,27,52,.22);cursor:auto}',
      '.cm-editor textarea{display:block;width:100%;min-height:86px;box-sizing:border-box;margin:0;padding:8px 10px;border:1px solid var(--line,#c9d5e5);border-radius:3px;background:#fff;color:var(--ink,#071b34);font:inherit;font-size:19px;line-height:1.35;resize:vertical}',
      '.cm-editor textarea:focus{outline:2px solid #b0322a;outline-offset:1px}',
      '.cm-editor .cm-bar{display:flex;align-items:center;gap:8px;margin-top:8px}',
      '.cm-editor .cm-hint{flex:1 1 auto;font-size:13px;color:var(--ink-3,#60768d)}',
      '.cm-btn{flex:0 0 auto;height:30px;padding:0 12px;border:1px solid #b0322a;border-radius:3px;background:#b0322a;color:#fff;font:600 14px/1 var(--sans,sans-serif);cursor:pointer}',
      '.cm-btn.cm-danger{background:#fff;color:#b0322a}',
      '.cm-btn:hover{filter:brightness(1.08)}',
      '.controls .cm-switch{position:relative;display:flex;align-items:center;gap:8px;height:36px;margin:0;padding:0 12px;color:#fff;font:inherit;font-size:13px;cursor:pointer;user-select:none;white-space:nowrap}',
      '.controls .cm-switch input{position:absolute;opacity:0;width:0;height:0;margin:0}',
      '.controls .cm-switch .cm-track{position:relative;flex:0 0 auto;width:32px;height:18px;border-radius:9px;background:rgba(255,255,255,.28);transition:background .15s}',
      '.controls .cm-switch .cm-track::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .15s}',
      '.controls .cm-switch input:checked+.cm-track{background:#b0322a}',
      '.controls .cm-switch input:checked+.cm-track::after{left:16px}',
      '.controls .cm-switch input:focus-visible+.cm-track{outline:3px solid var(--sand,#69b9d8);outline-offset:2px}',
      'html.cm-on .controls{opacity:1}',
      '.cm-tab{position:fixed;left:10px;bottom:96px;z-index:901;width:34px;height:34px;padding:0;border:1px solid var(--line,#c9d5e5);border-radius:8px;background:var(--paper,#f4f7fb);color:var(--ink-2,#233c57);font-size:16px;line-height:1;cursor:pointer}',
      '.cm-tab .cm-count{position:absolute;top:-7px;right:-8px;display:none;min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;border-radius:9px;background:#b0322a;color:#fff;font:700 11px/18px var(--mono,monospace)}',
      '.cm-tab .cm-count.is-on{display:block}',
      '.cm-panel{position:fixed;top:0;left:0;bottom:0;z-index:905;width:430px;display:none;flex-direction:column;background:rgba(7,27,52,.98);color:#e7edf6;font-size:14px;line-height:1.45;box-shadow:0 22px 64px rgba(7,27,52,.35)}',
      '.cm-panel.is-open{display:flex}',
      '.cm-panel .cm-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;border-bottom:1px solid rgba(255,255,255,.12)}',
      '.cm-panel .cm-head b{color:var(--mint,#aab5ff);font-size:11px;letter-spacing:.12em;text-transform:uppercase}',
      '.cm-panel .cm-head button,.cm-panel .cm-actions button{height:28px;padding:0 10px;border:1px solid rgba(255,255,255,.28);border-radius:4px;background:transparent;color:#fff;font:inherit;font-size:12px;cursor:pointer}',
      '.cm-panel .cm-head button:hover,.cm-panel .cm-actions button:hover{background:rgba(255,255,255,.14)}',
      '.cm-panel .cm-list{flex:1 1 auto;overflow:auto;padding:6px 0 12px}',
      '.cm-panel .cm-empty{margin:14px 18px;color:#c9d5e5}',
      '.cm-group{padding:14px 18px 5px;color:var(--mint,#aab5ff);font:700 11px/1.3 var(--mono,monospace);letter-spacing:.12em;text-transform:uppercase;cursor:pointer}',
      '.cm-group:hover{color:#fff}',
      '.cm-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 8px;align-items:start;padding:8px 12px 8px 18px;border-top:1px solid rgba(255,255,255,.08);cursor:pointer}',
      '.cm-row:hover{background:rgba(255,255,255,.06)}',
      '.cm-row p{margin:0;font-size:14px;line-height:1.4;color:#fff;white-space:pre-wrap;word-break:break-word}',
      '.cm-row small{display:block;margin-top:3px;font-size:11px;line-height:1.3;color:#aab5ff}',
      '.cm-row.is-done p{color:#8fa0b8;text-decoration:line-through}',
      '.cm-group.is-removed{color:#8fa0b8;cursor:default}',
      '.cm-group.is-removed:hover{color:#8fa0b8}',
      '.cm-row.is-removed{cursor:default}',
      '.cm-row.is-removed p{color:#aab5ff;font-style:italic}',
      '.cm-row .cm-ops{display:flex;gap:2px}',
      '.cm-row .cm-ops button{width:26px;height:26px;padding:0;border:0;border-radius:4px;background:transparent;color:#c9d5e5;font-size:14px;line-height:1;cursor:pointer}',
      '.cm-row .cm-ops button:hover{background:rgba(255,255,255,.16);color:#fff}',
      '.cm-panel .cm-foot{padding:12px 18px 16px;border-top:1px solid rgba(255,255,255,.12)}',
      '.cm-panel .cm-status{margin:0 0 10px;font-size:12px;line-height:1.4;color:#c9d5e5}',
      '.cm-panel .cm-actions{display:flex;flex-wrap:wrap;gap:6px}',
      '.cm-panel .cm-flash{margin:8px 0 0;min-height:1.3em;font-size:12px;color:var(--mint,#aab5ff);opacity:0;transition:opacity .2s}',
      '.cm-panel .cm-flash.is-on{opacity:1}',
      '@media print{.cm-mark,.cm-editor,.cm-bubble,.cm-panel,.cm-tab,.cm-pill{display:none!important}html.cm-on .slide.is-active>.canvas{outline:0}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function build() {
    /* the switch, in the deck's own controls bar */
    var nav = document.querySelector('.controls');
    var sw = el('label', 'cm-switch');
    var inp = el('input'); inp.type = 'checkbox'; inp.setAttribute('aria-label', 'Comment mode');
    sw.appendChild(inp); sw.appendChild(el('span', 'cm-track')); sw.appendChild(el('span', null, 'Comment'));
    inp.addEventListener('change', function () { setMode(inp.checked); });
    (nav || document.body).appendChild(sw);
    ui.toggle = inp;

    ui.pill = el('div', 'cm-pill', 'Comment mode · click a spot on the slide · c to leave');
    document.body.appendChild(ui.pill);

    /* the collapsed tab and the panel */
    ui.tab = el('button', 'cm-tab', '✎');
    ui.tab.type = 'button'; ui.tab.title = 'Comments (review notes on this deck)';
    ui.tab.setAttribute('aria-label', 'Open the comments panel');
    ui.tab.setAttribute('aria-expanded', 'false');
    ui.count = el('span', 'cm-count', '0');
    ui.tab.appendChild(ui.count);
    ui.tab.addEventListener('click', function () { setPanel(!ui.panel.classList.contains('is-open')); });
    document.body.appendChild(ui.tab);

    ui.panel = el('aside', 'cm-panel');
    ui.panel.id = 'cmPanel';
    ui.panel.setAttribute('aria-label', 'Slide comments');
    var head = el('div', 'cm-head');
    var title = el('b', null, 'Comments · ');
    ui.total = el('span'); title.appendChild(ui.total);
    var close = el('button', null, 'Close'); close.type = 'button';
    close.addEventListener('click', function () { setPanel(false); });
    head.appendChild(title); head.appendChild(close);
    ui.list = el('div', 'cm-list');
    var foot = el('div', 'cm-foot');
    ui.status = el('p', 'cm-status');
    var actions = el('div', 'cm-actions');
    var mk = function (label, fn, title) { var b = el('button', null, label); b.type = 'button'; if (title) b.title = title; b.addEventListener('click', fn); actions.appendChild(b); return b; };
    mk('Copy JSON', copyJSON, 'Copy every comment as JSON to paste into a Claude session');
    mk('Download', download, 'Save every comment as ' + deckId + '-comments.json');
    var file = el('input'); file.type = 'file'; file.accept = '.json,application/json'; file.style.display = 'none';
    file.addEventListener('change', function () { if (file.files && file.files[0]) importFile(file.files[0]); file.value = ''; });
    mk('Import', function () { file.click(); }, 'Merge a comments JSON file into this list');
    mk('Clear done', function () { comments.forEach(function (c) { if (c.status === 'done') tomb.add(c.id); }); writeTomb(); comments = comments.filter(function (c) { return c.status !== 'done'; }); persist(); }, 'Remove every comment marked done');
    mk('Clear all', function () { if (comments.length && confirm('Delete all ' + comments.length + ' comments on this deck?')) { comments.forEach(function (c) { tomb.add(c.id); }); writeTomb(); comments = []; persist(); } });
    ui.flash = el('p', 'cm-flash', '');
    foot.appendChild(ui.status); foot.appendChild(actions); foot.appendChild(file); foot.appendChild(ui.flash);
    ui.panel.appendChild(head); ui.panel.appendChild(ui.list); ui.panel.appendChild(foot);
    ui.panel.addEventListener('click', function (e) { e.stopPropagation(); });
    document.body.appendChild(ui.panel);
  }

  function bind() {
    /* Capture phase, so in comment mode a click on the slide reaches nothing
       else: not the lightbox, not a link, not a stepped figure. */
    document.addEventListener('click', function (e) {
      if (!mode) return;
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('.cm-editor, .cm-mark, .cm-bubble, .cm-panel, .cm-tab, .controls, .notes, .overview, #slidemenu, #slidemenuTab, #pdfTab, #chapterPick, #deckTip, #blank')) return;
      var canvas = t.closest('.slide.is-active .canvas');
      if (!canvas) { if (composer) closeComposer(!!composer.ta.value.trim()); return; }
      e.preventDefault(); e.stopPropagation();
      if (composer) { closeComposer(!!composer.ta.value.trim()); return; }
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      var y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      var k = slides.indexOf(canvas.closest('.slide'));
      if (k < 0) return;
      openComposer(k, x, y, null, describe(t, canvas, e.clientX, e.clientY));
    }, true);

    addEventListener('keydown', function (e) {
      var typing = e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable="true"]');
      if (e.key === 'Escape') {
        if (composer) { closeComposer(false); e.stopPropagation(); return; }
        if (ui.panel.classList.contains('is-open')) { setPanel(false); e.stopPropagation(); return; }
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      var ov = document.getElementById('overview');
      if (ov && ov.classList.contains('is-open')) return;
      if (e.key === 'c' || e.key === 'C') { setMode(!mode); }
    }, true);

    /* keep the page label of a comment current if the deck is renumbered */
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && hasServer) load(); });
  }

  css();
  build();
  bind();
  load();
  try { if (sessionStorage.getItem(MODE_KEY) === '1') setMode(true); } catch (e) { /* nothing */ }
})();
