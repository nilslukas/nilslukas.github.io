/* Compatibility surface for older ML8502 fragments.

   Focus-step visibility now belongs to deck.css. Future items are fully hidden
   at step 0, and deck.js starts the first real build step on slide arrival.
   The old per-slide pre-dimming policy is intentionally retired because it
   left future content faintly visible. */
(function () {
  'use strict';

  function audit(loud) {
    var decided = [];
    var deprecated = [];
    document.querySelectorAll('.slide').forEach(function (slide) {
      if (!slide.querySelector('[data-focus-step]')) return;
      var name = slide.getAttribute('data-name') || '(unnamed)';
      decided.push({ name: name, on: true, from: 'platform default' });
      if (slide.hasAttribute('data-prestep')) deprecated.push(name);
    });
    return { decided: decided, unlisted: [], stale: [], deprecated: deprecated };
  }

  window.Prestep = {
    audit: function () { return audit(true); },
    state: function () { return audit(false).decided; },
    disable: function () {}
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { audit(true); });
  } else {
    audit(true);
  }
})();
