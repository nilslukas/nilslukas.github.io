// Single source of truth for the site-wide "Last updated" footer.
// Edit the date here and every page updates automatically.
(function () {
  var LAST_UPDATED = '17 August 2026';
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('last-updated');
    if (el) el.textContent = 'Nils Lukas – Last updated ' + LAST_UPDATED;
  });

  // Close the nav "More" drawer on outside click or Escape.
  function closeDrawers(pred) {
    var open = document.querySelectorAll('details.nav-drawer[open]');
    for (var i = 0; i < open.length; i++) {
      if (pred(open[i])) open[i].removeAttribute('open');
    }
  }
  document.addEventListener('click', function (e) {
    closeDrawers(function (d) { return !d.contains(e.target); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawers(function () { return true; });
  });

  /* ---- Copyable short bio popup ------------------------------------- */
  var BIO = "Nils Lukas is an Assistant Professor of Machine Learning at MBZUAI in Abu Dhabi, where he leads the SPOT (Secure, Private, Open and Trustworthy) AI Lab. His research builds secure and private machine learning that millions can use responsibly, with a focus on content watermarking, privacy-preserving inference, and AI safety and security. He holds a Ph.D. from the University of Waterloo — awarded its Top Mathematics Doctoral Prize and Alumni Gold Medal — and has worked with Microsoft Research and Borealis AI. His work appears at top venues including ICML, ICLR, NeurIPS, IEEE S&P, and USENIX Security, and has been recognized with a 2025 Amazon Research Award and supported by funding from Etihad Airways, the United Al-Saqer Group, and TII. He recently founded Adherence, delivering enterprise AI agents.";

  function injectBioStyle() {
    if (document.getElementById('bio-style')) return;
    var css = ''
      + '.bio-dialog{max-width:33rem;width:calc(100% - 2rem);border:1px solid #DAD7CC;'
      + 'border-radius:10px;padding:1.5rem 1.6rem;background:#FAF9F5;color:#26251F;'
      + "font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;"
      + 'box-shadow:0 24px 64px rgba(20,20,19,.24);}'
      + '.bio-dialog::backdrop{background:rgba(20,20,19,.4);}'
      + '.bio-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:.5rem;}'
      + ".bio-dialog-head h3{margin:0;font-family:'Source Serif 4',Georgia,serif;font-size:1.15rem;color:#141413;}"
      + '.bio-close{border:none;background:none;cursor:pointer;font-size:1.5rem;line-height:1;color:#6B6960;padding:.05rem .35rem;border-radius:5px;}'
      + '.bio-close:hover{color:#141413;background:#F0EEE6;}'
      + '.bio-text{font-size:.95rem;line-height:1.6;color:#26251F;margin:0 0 1.15rem;}'
      + '.bio-adh{color:#00509F;font-weight:600;}'
      + '.bio-actions{display:flex;justify-content:flex-end;}'
      + '.bio-copy{font-family:inherit;font-size:.9rem;font-weight:600;cursor:pointer;color:#FAF9F5;'
      + 'background:#9E4A2F;border:none;border-radius:999px;padding:.5rem 1.15rem;transition:background .15s ease;}'
      + '.bio-copy:hover{background:#C15F3C;}';
    var st = document.createElement('style'); st.id = 'bio-style'; st.textContent = css;
    document.head.appendChild(st);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  function buildBioDialog() {
    var existing = document.getElementById('bio-dialog');
    if (existing) return existing;
    injectBioStyle();
    var dlg = document.createElement('dialog');
    dlg.id = 'bio-dialog'; dlg.className = 'bio-dialog';
    dlg.innerHTML =
      '<div class="bio-dialog-head"><h3>Short bio</h3>'
      + '<button type="button" class="bio-close" aria-label="Close">×</button></div>'
      + '<p class="bio-text"></p>'
      + '<div class="bio-actions"><button type="button" class="bio-copy">Copy bio</button></div>';
    // Show "Adherence" in the company blue, but keep BIO plain text so the
    // copy button still yields something pasteable anywhere.
    (function (el, text) {
      var parts = text.split('Adherence');
      for (var i = 0; i < parts.length; i++) {
        if (i) {
          var s = document.createElement('span');
          s.className = 'bio-adh';
          s.textContent = 'Adherence';
          el.appendChild(s);
        }
        el.appendChild(document.createTextNode(parts[i]));
      }
    })(dlg.querySelector('.bio-text'), BIO);
    document.body.appendChild(dlg);
    dlg.querySelector('.bio-close').addEventListener('click', function () {
      if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
    });
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
    });
    var copy = dlg.querySelector('.bio-copy');
    copy.addEventListener('click', function () {
      var done = function () {
        copy.textContent = 'Copied ✓';
        setTimeout(function () { copy.textContent = 'Copy bio'; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(BIO).then(done, function () { fallbackCopy(BIO); done(); });
      } else { fallbackCopy(BIO); done(); }
    });
    return dlg;
  }

  function openBio() {
    var dlg = buildBioDialog();
    closeDrawers(function () { return true; });
    if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); }
    else dlg.setAttribute('open', '');
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-bio-open]') : null;
    if (t) { e.preventDefault(); openBio(); }
  });

  // Add the "Bio" trigger: next to CV on desktop, inside "More" on mobile.
  function injectBioNav() {
    var container = document.querySelector('nav .main-container > div');
    if (!container) return;
    var cv = container.querySelector('a.navbar-link[href="cv.html"]');
    if (cv && !container.querySelector('.bio-desktop')) {
      var a = document.createElement('a');
      a.className = 'navbar-link bio-desktop'; a.href = '#'; a.textContent = 'Bio';
      a.setAttribute('data-bio-open', ''); a.setAttribute('role', 'button');
      cv.insertAdjacentElement('afterend', a);
    }
    var menu = container.querySelector('.nav-drawer-menu');
    if (menu && !menu.querySelector('.bio-mobile')) {
      var b = document.createElement('a');
      b.className = 'navbar-link bio-mobile'; b.href = '#'; b.textContent = 'Bio';
      b.setAttribute('data-bio-open', '');
      menu.insertBefore(b, menu.firstChild);
    }
  }
  /* ---- Mobile slide-in menu ------------------------------------------
     Keeps the bar to a single line on narrow screens: the brand stays put
     and every link moves into a panel behind a burger button. Built from
     the existing nav markup, so pages need no extra tags. */
  function buildMobileNav() {
    var nav = document.querySelector('nav');
    var bar = nav && nav.querySelector('.main-container');
    var links = bar && bar.querySelector(':scope > div');
    if (!links || nav.classList.contains('has-burger')) return;

    var panel = document.createElement('div');
    panel.className = 'nav-panel';
    panel.id = 'nav-panel';

    var seen = {};
    links.querySelectorAll('a.navbar-link').forEach(function (a) {
      if (a.classList.contains('bio-mobile')) return;          // duplicate of "Bio"
      var key = a.getAttribute('href') + '|' + a.textContent;
      if (seen[key]) return;
      seen[key] = true;
      var c = a.cloneNode(true);
      c.classList.remove('bio-desktop', 'bio-mobile');
      panel.appendChild(c);
    });

    var scrim = document.createElement('div');
    scrim.className = 'nav-scrim';

    var burger = document.createElement('button');
    burger.type = 'button';
    burger.className = 'nav-burger';
    burger.setAttribute('aria-label', 'Menu');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-controls', 'nav-panel');
    burger.innerHTML = '<span></span><span></span><span></span>';

    function setOpen(open) {
      panel.classList.toggle('open', open);
      scrim.classList.toggle('open', open);
      document.body.classList.toggle('nav-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        var first = panel.querySelector('.navbar-link');
        if (first) first.focus();
      }
    }

    burger.addEventListener('click', function () {
      setOpen(!panel.classList.contains('open'));
    });
    scrim.addEventListener('click', function () { setOpen(false); });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) {
        setOpen(false);
        burger.focus();
      }
    });
    window.matchMedia('(max-width:720px)').addEventListener('change', function (m) {
      if (!m.matches) setOpen(false);
    });

    links.classList.add('nav-links');
    bar.appendChild(burger);
    document.body.appendChild(scrim);
    document.body.appendChild(panel);
    nav.classList.add('has-burger');
  }

  document.addEventListener('DOMContentLoaded', function () {
    injectBioNav();
    buildMobileNav();
  });
})();
