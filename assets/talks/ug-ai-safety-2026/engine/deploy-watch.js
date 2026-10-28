/* deploy-watch.js — tell the reviewer when a new version of the deck is live (Nils, 26 Oct 2026: "make a pop-up that
   you addressed or that you redeployed a new version").

   Only on the local review server (http, with the feedback cookie serve_deck.py sets), never in student.html or the
   PDF (the tag carries data-export="skip"). Every 15 s it fetches this page again and reads the build stamp that
   build_deck.py writes ("built": "..."); when it differs from the stamp this page was built with, a small toast at the
   bottom right says so, lists how many of the reviewer's comments were marked done since this page loaded, and offers
   a reload that keeps the slide (#N). Each addressed comment shows in small type with a screenshot of the fixed slide at
   the comment's step (taken after landing into outputs/feedback/shots/<deck>/<id>.jpg; Nils, 26 Oct 2026), and the list
   grows while the toast is open as more comments are marked done. Clicking one opens the new version at that slide
   and step. */
(function () {
  if (window.__deployWatch) return;
  window.__deployWatch = true;
  if (!/^https?:$/.test(location.protocol)) return;
  var mine = ((window.ML8502_DECK || {}).build || {}).built;
  if (!mine) return;
  var m = location.pathname.match(/slides\/([^\/]+)\//);
  var deckId = m ? m[1] : '';
  var store = deckId && /(^|;\s*)ml8502_feedback=/.test(document.cookie) ? '/__feedback/' + deckId + '.json' : '';
  var doneAtLoad = null, toast = null, shownFor = '', lastN = -1, newHtml = '';

  // Clicking a fixed comment reloads into the new version at that slide and step (Nils, 26 Oct 2026). The slide is
  // found by name in the new build (numbers shift as slides are added); the step is replayed after the reload.
  try {
    var pend = JSON.parse(sessionStorage.getItem('dw-go') || 'null');
    sessionStorage.removeItem('dw-go');
    if (pend && pend.step > 0) setTimeout(function () {
      for (var t = 0; t < pend.step && window.Deck; t++) window.Deck.next();
    }, 700);
  } catch (e) { /* storage blocked: land on the slide only */ }
  function goTo(c) {
    var k = -1;
    try {
      var names = [].map.call(new DOMParser().parseFromString(newHtml, 'text/html').querySelectorAll('section.slide'),
        function (x) { return x.dataset.name || ''; });
      k = names.indexOf(c.name || '');
    } catch (e) { /* fall back to the stored number */ }
    var n = k >= 0 ? k + 1 : Number(c.slide) || 1;
    try { sessionStorage.setItem('dw-go', JSON.stringify({ step: Number(c.step || 0) })); } catch (e) {}
    location.hash = '#' + n;
    location.reload();
  }

  function doneSet(d) {
    var s = {};
    ((d && d.comments) || []).forEach(function (c) { if (c.status === 'done' && !c.removed) s[c.id] = c; });
    return s;
  }
  function readStore() {
    if (!store) return Promise.resolve(null);
    return fetch(store, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  readStore().then(function (d) { doneAtLoad = doneSet(d); });

  function show(built, newlyDone) {
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'dw-toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
      var st = document.createElement('style');
      st.textContent = '.dw-toast{position:fixed;right:18px;bottom:64px;z-index:9999;width:400px;max-width:calc(100vw - 36px);padding:14px 16px 12px;' +
        'background:#fff;color:#071b34;border:1px solid rgba(7,27,52,.14);border-radius:14px;box-shadow:0 12px 32px rgba(7,27,52,.22);' +
        'font:15px/1.35 AktivGrotesk,system-ui,sans-serif}.dw-toast b{display:block;font-size:16px;margin-bottom:4px}' +
        '.dw-toast ul{margin:8px 0 10px;padding:0;list-style:none;max-height:60vh;overflow:auto}' +
        '.dw-toast li{margin:0 0 10px;color:#233c57;font-size:12.5px;line-height:1.3;cursor:pointer}.dw-toast li:hover .dw-s{text-decoration:underline}.dw-toast li .dw-s{font-weight:700;color:#071b34}' +
        '.dw-toast li img{display:block;width:100%;margin-top:4px;border:1px solid rgba(7,27,52,.14);border-radius:6px}' +
        '.dw-toast .dw-row{display:flex;gap:8px;justify-content:flex-end}.dw-toast button{font:inherit;border-radius:999px;padding:5px 14px;' +
        'border:1px solid rgba(7,27,52,.2);background:#fff;cursor:pointer}.dw-toast button.dw-go{background:#002554;color:#fff;border-color:#002554}' +
        '@media print{.dw-toast{display:none}}';
      document.head.appendChild(st);
    }
    var list = newlyDone.slice(0, 12).map(function (c) {
      var esc = function (t) { return String(t || '').replace(/[<&"]/g, function (x) { return x === '<' ? '&lt;' : x === '&' ? '&amp;' : '&quot;'; }); };
      // the fixed slide as it looks now: mark_done takes it after landing (outputs/feedback/shots/<deck>/<id>.jpg)
      var shot = '/outputs/feedback/shots/' + deckId + '/' + encodeURIComponent(c.id) + '.jpg?v=' + encodeURIComponent(c.updated || '');
      return '<li data-i="' + newlyDone.indexOf(c) + '" title="Go to this slide"><span class="dw-s">' + esc(c.label || c.slide) + (c.name ? ' ' + esc(c.name) : '') + '</span> · ' + esc(c.text).slice(0, 110) +
        '<img src="' + shot + '" alt="" loading="lazy" onerror="this.remove()"></li>';
    }).join('');
    toast.innerHTML = '<b>New version deployed</b>built ' + built +
      (newlyDone.length ? ' · ' + newlyDone.length + ' comment' + (newlyDone.length > 1 ? 's' : '') + ' addressed<ul>' + list + '</ul>' : '') +
      '<div class="dw-row"><button type="button" class="dw-later">Later</button><button type="button" class="dw-go">Reload</button></div>';
    toast.querySelector('.dw-go').onclick = function () { location.reload(); };
    [].forEach.call(toast.querySelectorAll('li[data-i]'), function (li) {
      li.onclick = function () { goTo(newlyDone[Number(li.dataset.i)]); };
    });
    toast.querySelector('.dw-later').onclick = function () { toast.remove(); toast = null; lastN = -1; };
    ['keydown', 'keyup'].forEach(function (ev) { toast.addEventListener(ev, function (e) { e.stopPropagation(); }); });
  }

  function check() {
    fetch(location.pathname, { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (html) {
      var b = (html.match(/"built":\s*"([^"]+)"/) || [])[1];
      if (b && b !== mine) newHtml = html;
      if (!b || b === mine || (b === shownFor && !toast)) return;
      shownFor = b;
      readStore().then(function (d) {
        var now = doneSet(d), fresh = [];
        Object.keys(now).forEach(function (id) { if (!doneAtLoad || !doneAtLoad[id]) fresh.push(now[id]); });
        if (toast && fresh.length === lastN) return;  // open toast: redraw only when more comments got marked done
        lastN = fresh.length;
        show(b, fresh);
      });
    }).catch(function () { /* offline: try again later */ });
  }
  setInterval(check, 15000);
})();
