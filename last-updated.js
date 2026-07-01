// Single source of truth for the site-wide "Last updated" footer.
// Edit the date here and every page updates automatically.
(function () {
  var LAST_UPDATED = '30 May 2026';
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
})();
