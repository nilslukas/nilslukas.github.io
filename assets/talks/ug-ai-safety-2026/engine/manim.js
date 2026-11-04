(function() {
  if (window.__w09Manim) return;
  window.__w09Manim = true;
  var instant = navigator.webdriver === true && !/[?&]anim=1\b/.test(location.search);
  var CLIPS = /[?&]anim=clips\b/.test(location.search);
  var INTROS = !/[?&]intro=off\b/.test(location.search);
  var lastFwd = 0;
  addEventListener("keydown", function(e) {
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") lastFwd = Date.now();
  }, true);
  var XF = 260;
  function settle(st) {
    if (!st.pending) return;
    var p = st.pending;
    st.pending = null;
    clearTimeout(p.timer);
    st.img.src = p.src;
    st.img.style.transition = "none";
    st.img.style.opacity = "1";
    st.fade.onload = null;
    st.fade.style.transition = "none";
    st.fade.style.opacity = "0";
    st.fig.classList.remove("xfade");
  }
  function dissolve(st, src) {
    var f = st.fade, im = st.img;
    if (!f) {
      im.src = src;
      return;
    }
    settle(st);
    var p = st.pending = { src, timer: 0 };
    f.onload = function() {
      f.onload = null;
      if (st.pending !== p) return;
      st.fig.classList.add("xfade");
      f.style.transition = im.style.transition = "none";
      f.style.opacity = "0";
      im.style.opacity = "1";
      void f.offsetWidth;
      f.style.transition = im.style.transition = "opacity " + XF + "ms linear";
      f.style.opacity = "1";
      im.style.opacity = "0";
      p.timer = setTimeout(function() {
        if (st.pending !== p) return;
        im.style.transition = "none";
        im.src = src;
        var done = function() {
          if (st.pending === p) settle(st);
        };
        if (im.decode) im.decode().then(done, done);
        else done();
      }, XF + 20);
    };
    f.src = src;
  }
  try {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) instant = true;
  } catch (_) {
  }
  var states = /* @__PURE__ */ new Map();
  function hideClips(st) {
    st.all.forEach(function(v) {
      v.onplaying = v.onended = null;
      try {
        v.pause();
      } catch (_) {
      }
      v.classList.remove("on");
    });
  }
  function firstFrame(v, cb) {
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(function() {
      cb();
    });
    else requestAnimationFrame(cb);
  }
  function play(st, v, fromSrc, endSrc, alive) {
    if (fromSrc) {
      st.img.src = fromSrc;
      st.img.classList.remove("off");
    } else {
      st.img.classList.add("off");
    }
    var shown = false;
    var guard = setTimeout(function() {
      if (!alive() || shown) return;
      try {
        v.pause();
      } catch (_) {
      }
      st.img.src = endSrc;
      st.img.classList.remove("off");
    }, 2500);
    v.onplaying = function() {
      clearTimeout(guard);
      if (!alive() || shown) return;
      firstFrame(v, function() {
        if (!alive() || shown) return;
        shown = true;
        v.classList.add("on");
        st.img.classList.add("off");
      });
    };
    v.onended = function() {
      clearTimeout(guard);
      if (!alive()) return;
      var swap = function() {
        if (!alive()) return;
        st.img.classList.remove("off");
        requestAnimationFrame(function() {
          v.classList.remove("on");
        });
      };
      st.img.src = endSrc;
      if (st.img.decode) st.img.decode().then(swap, swap);
      else swap();
    };
    try {
      v.currentTime = 0;
    } catch (_) {
    }
    var p = v.play();
    if (p && p.catch) p.catch(function() {
      st.img.src = endSrc;
      st.img.classList.remove("off");
    });
  }
  var allSlides = Array.prototype.slice.call(document.querySelectorAll("section.slide"));
  function nearOf(sec) {
    var a = -1, me = allSlides.indexOf(sec);
    for (var i = 0; i < allSlides.length; i++) if (allSlides[i].classList.contains("is-active")) {
      a = i;
      break;
    }
    if (me < 0 || a < 0) return "";
    if (me === a) return "active";
    for (var j = a + 1; j < allSlides.length; j++) if (!allSlides[j].dataset.stack) return j === me ? "next" : "";
    return "";
  }
  function wantClip(st, k) {
    var n = nearOf(st.sec), s = st.step || 0;
    if (n === "next") return k <= 1;
    if (n !== "active") return false;
    if (k === 0) return s === 0;
    return k >= s && k <= s + 2;
  }
  function warm(st) {
    if (st.keep) return;
    st.keep = [];
    for (var q = 0; q <= st.max; q++) {
      var pq = new Image();
      pq.src = st.dir + "s" + q + ".png";
      st.keep.push(pq);
    }
  }
  var refreshing = false;
  function refresh() {
    if (refreshing) return;
    refreshing = true;
    Promise.resolve().then(function() {
      refreshing = false;
      states.forEach(function(st) {
        if (!st.packed && nearOf(st.sec)) warm(st);
      });
      if (window.LazyMedia && LazyMedia.sync) LazyMedia.sync();
    });
  }
  function mkVideo(fig, src, st, k) {
    var v = document.createElement("video");
    v.className = "w09m-clip";
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.setAttribute("aria-hidden", "true");
    v.setAttribute("data-play-step", "never");
    v.__lazyWant = function() {
      return wantClip(st, k);
    };
    v.src = src;
    fig.appendChild(v);
    return v;
  }
  Motion.register("w09-manim", {
    init: function(sec) {
      var fig = sec.querySelector(".w09m-fig");
      var max = Number(sec.dataset.maxStep || 0);
      var dir = fig.dataset.dir;
      var img = fig.querySelector(".w09m-still");
      var orig = img.getAttribute("src") || "";
      var st = {
        sec,
        fig,
        img,
        clips: {},
        dir,
        all: [],
        introOn: false,
        token: 0,
        orig,
        max,
        step: Number(sec.dataset.step || 0),
        keep: null,
        packed: /^data:/.test(orig),
        hasIntro: INTROS && fig.dataset.intro === "on"
      };
      if (st.packed) {
        st.hasIntro = false;
        states.set(sec, st);
        return st;
      }
      st.clipsOn = CLIPS || fig.dataset.clips === "on";
      if (!st.clipsOn) {
        st.fade = document.createElement("img");
        st.fade.className = "w09m-fade";
        st.fade.alt = "";
        st.fade.setAttribute("aria-hidden", "true");
        st.fade.style.opacity = "0";
        st.fade.src = orig;
        fig.appendChild(st.fade);
        if (st.hasIntro) {
          st.intro = mkVideo(fig, dir + "intro0.webm", st, 0);
          st.all.push(st.intro);
        }
      } else {
        for (var k = 1; k <= max; k++) {
          st.clips[k] = mkVideo(fig, dir + "t" + k + ".webm", st, k);
          st.all.push(st.clips[k]);
        }
        if (st.hasIntro) {
          st.intro = mkVideo(fig, dir + "intro0.webm", st, 0);
          st.all.push(st.intro);
        }
      }
      if (instant) warm(st);
      states.set(sec, st);
      refresh();
      return st;
    },
    render: function(sec, step, st, anim) {
      if (st.packed) {
        st.img.src = st.orig;
        st.img.classList.remove("off");
        return;
      }
      st.step = step;
      refresh();
      if (!st.clipsOn) {
        if (st.introOn && step === 0 && !anim && sec.classList.contains("is-active")) return;
        if (st.intro) {
          st.introOn = false;
          st.token++;
          hideClips(st);
        }
        var target = st.dir + "s" + step + ".png";
        st.img.classList.remove("off");
        if (anim && !instant) dissolve(st, target);
        else {
          st.pending = { src: target };
          settle(st);
        }
        return;
      }
      if (st.introOn && step === 0 && !anim && sec.classList.contains("is-active")) return;
      st.introOn = false;
      st.token++;
      var still = st.dir + "s" + step + ".png";
      hideClips(st);
      var v = anim && st.clips[step];
      if (!v) {
        st.img.src = still;
        st.img.classList.remove("off");
        return;
      }
      play(st, v, st.dir + "s" + (step - 1) + ".png", still, anim.alive);
    }
  });
  var slides = Array.prototype.slice.call(document.querySelectorAll("section.slide"));
  var cur = slides.findIndex(function(s) {
    return s.classList.contains("is-active");
  });
  function check() {
    var now = slides.findIndex(function(s) {
      return s.classList.contains("is-active");
    });
    if (now === cur) return;
    var prev = cur;
    cur = now;
    refresh();
    var sec = slides[now], st = sec && states.get(sec);
    if (!st || !st.hasIntro || instant || now !== prev + 1 || Number(sec.dataset.step || 0) !== 0) return;
    if (Date.now() - lastFwd > 1500) return;
    var token = ++st.token;
    st.introOn = true;
    hideClips(st);
    play(st, st.intro, null, st.dir + "s0.png", function() {
      return st.token === token && sec.classList.contains("is-active");
    });
    st.intro.addEventListener("ended", function done() {
      st.intro.removeEventListener("ended", done);
      if (st.token === token) st.introOn = false;
    });
  }
  var mo = new MutationObserver(check);
  slides.forEach(function(s) {
    mo.observe(s, { attributes: true, attributeFilter: ["class"] });
  });
})();
