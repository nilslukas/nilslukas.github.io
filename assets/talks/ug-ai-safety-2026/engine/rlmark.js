(function() {
  "use strict";
  var rl = document.querySelector('.slide[data-name$="Reading List"]');
  if (!rl) return;
  function key(href) {
    var m = /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/.exec(href || "");
    return m ? "arxiv:" + m[1] : (href || "").replace(/[#?].*$/, "").replace(/\/+$/, "");
  }
  var entries = {};
  Array.prototype.forEach.call(rl.querySelectorAll("td.source"), function(td) {
    var a = td.querySelector("a[href]"), num = td.previousElementSibling;
    if (!a || !num) return;
    var n = (num.textContent || "").trim();
    if (/^\d\d$/.test(n)) entries[key(a.getAttribute("href"))] = n;
  });
  if (!Object.keys(entries).length) return;
  Array.prototype.forEach.call(document.querySelectorAll(".slide"), function(s) {
    if (s === rl) return;
    Array.prototype.forEach.call(s.querySelectorAll(".footer .citation cite.src"), function(c) {
      var a = c.querySelector("a[href]");
      var n = a ? entries[key(a.getAttribute("href"))] : null;
      if (n) c.setAttribute("data-rl", "Reading list " + n);
    });
  });
})();
