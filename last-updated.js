// Single source of truth for the site-wide "Last updated" footer.
// Edit the date here and every page updates automatically.
(function () {
  var LAST_UPDATED = '30 May 2026';
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('last-updated');
    if (el) el.textContent = 'Nils Lukas – Last updated ' + LAST_UPDATED;
  });
})();
