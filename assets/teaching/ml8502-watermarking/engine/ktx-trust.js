/* ktx-trust.js (deck-local, 2026-09-02). Per-symbol hover explanations INSIDE a formula.
   deck.js renders delimited maths with KaTeX auto-render and no `trust`, so \htmlData is
   unavailable there. Authors who need a hover on individual symbols write the formula as
     <span class="ktx" data-tex="x'_{t+1} = \htmlData{explain=the next iterate}{x'_{t+1}} ..." data-display="1"></span>
   (no \( \) delimiters, so auto-render ignores it) and this script renders it with trust on.
   KaTeX turns \htmlData{explain=...}{...} into <span data-explain="..."> around the sub-expression,
   which deck.css already styles as a hover tooltip. Values must not contain commas (KaTeX splits
   key=value pairs on commas); use a semicolon or a period instead. */
(function () {
  function render() {
    if (typeof katex === 'undefined') return;
    document.querySelectorAll('.ktx[data-tex]').forEach(function (el) {
      if (el.dataset.rendered) return;
      var tex = el.dataset.tex;
      try {
        katex.render(tex, el, { trust: true, throwOnError: false, displayMode: el.dataset.display === '1', strict: 'ignore', output: 'html' });
        el.dataset.rendered = '1';
      } catch (e) { el.textContent = tex; el.classList.add('todo'); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
})();
