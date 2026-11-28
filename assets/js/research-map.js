/* Research map (end of the About page, and the teaser at the top of the
   Publications page).

   Every paper is one dot. Columns are topics, rows are years (newest on
   top). A vertical line joins the papers of one line of work, drawn like a
   branch in a commit graph; a line with `from` forks off an earlier paper.
   Pointing at a paper shows its title and venue, lights up its line of work,
   and draws a dotted link to related work elsewhere on the map.

   TO ADD A PAPER: add it to the BibTeX on publications.html. The map reads
   that list when the page loads, so the paper appears here on its own, in a
   topic guessed from the words of its title. To give it a short label, a
   line of work or a note, add one entry to PAPERS with its BibTeX key in
   `bib` (and, if it starts a new line of work, one entry to LINES).
   Everything else, including the counts, the layout and the legend
   position, is computed. A paper removed from publications.html leaves the
   map too. If publications.html cannot be read (for example over file://),
   the map shows the entries in PAPERS.

     id      unique key
     bib     its BibTeX key on publications.html (the url and year come
             from there)
     line    id of its line of work in LINES, or use `topic` for a paper that
             stands alone
     year    publication year
     label   short name shown on the map (keep under about 22 characters)
     note    optional two or three muted words after the label
     title   full title, shown when the paper is selected
     venue   venue and year
     award   optional: "oral", "spotlight", ... (draws the accent ring)
     url     optional link to the paper

   Within one year, papers are listed top to bottom in the order of LINES,
   then in the order they appear here. A line that has `from` must start in a
   later year than the paper it forks from. */
(function () {
  'use strict';

  var root = document.getElementById('research-map');
  if (!root) return;

  /* ------------------------------------------------------------------
     Data
     ------------------------------------------------------------------ */
  var TOPICS = [
    { id: 'wm', name: 'Watermarking',
      gloss: 'Marking models and generated content, and breaking those marks.' },
    { id: 'priv', name: 'Privacy',
      gloss: 'Private computation, and language models that do not leak.' },
    { id: 'safe', name: 'Safety and security',
      gloss: 'Backdoors, jailbreaks and prompt injection in models and agents.' },
    { id: 'reason', name: 'Reasoning',
      gloss: 'More reasoning from small models and fixed budgets.' }
  ];

  var LINES = [
    { id: 'own',    topic: 'wm',     name: 'Proving who owns a model' },
    { id: 'gen',    topic: 'wm',     name: 'Watermarks for generated content', from: 'sok' },
    { id: 'atk',    topic: 'wm',     name: 'Breaking content watermarks', from: 'ptw' },
    { id: 'set',    topic: 'priv',   name: 'Private set operations' },
    { id: 'lm',     topic: 'priv',   name: 'Privacy of language models' },
    { id: 'mpc',    topic: 'priv',   name: 'Private inference with cryptography' },
    { id: 'agent',  topic: 'safe',   name: 'Security of AI agents' },
    { id: 'align',  topic: 'safe',   name: 'Suppressing unwanted model output' },
    { id: 'latent', topic: 'reason', name: 'Reasoning in latent space' },
    { id: 'small',  topic: 'reason', name: 'Training small models to reason' }
  ];

  var PAPERS = [
    /* Watermarking */
    { id: 'threshold', bib: 'bakr2026collaborative', line: 'own', year: 2026, label: 'Threshold watermarking',
      title: 'Collaborative Threshold Watermarking',
      venue: 'ICML 2026', url: 'https://arxiv.org/abs/2602.10765' },
    { id: 'monitor', bib: 'aremu2026watermarking', line: 'gen', year: 2026, label: 'Watermarks as monitors',
      title: 'Watermarking Should Be Treated as a Monitoring Primitive',
      venue: 'NeurIPS 2026', url: 'https://arxiv.org/abs/2605.13095' },
    { id: 'raven', bib: 'shamshad2026raven', line: 'atk', year: 2026, label: 'RAVEN', note: 'watermark removal',
      title: 'RAVEN: Erasing Invisible Watermarks via Novel View Synthesis',
      venue: 'CVPR 2026', award: 'oral, top 0.8%', url: 'https://arxiv.org/abs/2601.08832' },
    { id: 'video', bib: 'hou2026detecting', topic: 'wm', year: 2026, label: 'Detecting AI video', note: 'survey',
      title: 'Detecting AI-Generated Video: A Vision-Language Dual-View Survey',
      venue: 'ACL 2026 Findings', url: 'https://arxiv.org/abs/2607.10787' },
    { id: 'mask', bib: 'hu2025mask', line: 'gen', year: 2025, label: 'Mask watermarking',
      title: 'Mask Image Watermarking',
      venue: 'NeurIPS 2025', url: 'https://arxiv.org/pdf/2504.12739' },
    { id: 'textattack', bib: 'diaa2025adaptivellm', line: 'atk', year: 2025, label: 'Text watermark attacks',
      title: 'Optimizing Adaptive Attacks against Content Watermarks for Language Models',
      venue: 'ICML 2025', award: 'spotlight', url: 'https://arxiv.org/abs/2410.02440' },
    { id: 'challenge', bib: 'shamshad2024neurips', line: 'atk', year: 2025, label: 'Removal challenge',
      title: 'First-Place Solution to NeurIPS 2024 Invisible Watermark Removal Challenge',
      venue: 'Workshop on GenAI Watermarking, 2025', award: 'first place in the challenge',
      url: 'https://arxiv.org/abs/2508.21072' },
    { id: 'imgattack', bib: 'lukas2023leveraging', line: 'atk', year: 2024, label: 'Image watermark attacks',
      title: 'Leveraging Optimization for Adaptive Attacks on Image Watermarks',
      venue: 'ICLR 2024', url: 'https://arxiv.org/abs/2309.16952' },
    { id: 'ptw', bib: 'lukas2023ptw', line: 'gen', year: 2023, label: 'PTW', note: 'generator watermark',
      title: 'PTW: Pivotal Tuning Watermarking for Pre-Trained Image Generators',
      venue: 'USENIX Security 2023', url: 'https://arxiv.org/pdf/2304.07361' },
    { id: 'sok', bib: 'lukas2022sok', line: 'own', year: 2022, label: 'SoK: model watermarks',
      title: 'SoK: How Robust is Image Classification Deep Neural Network Watermarking?',
      venue: 'IEEE S&P 2022', url: 'https://arxiv.org/abs/2108.04974' },
    { id: 'backdoorwm', bib: 'shafieinejad2021robustness', line: 'own', year: 2021, label: 'Backdoor watermarks',
      title: 'On the Robustness of Backdoor-based Watermarking in Deep Neural Networks',
      venue: 'IH&MMSec 2021', url: 'https://arxiv.org/abs/1906.07745' },
    { id: 'fingerprint', bib: 'lukas2021deep', line: 'own', year: 2021, label: 'Model fingerprinting',
      title: 'Deep Neural Network Fingerprinting by Conferrable Adversarial Examples',
      venue: 'ICLR 2021', award: 'spotlight', url: 'https://arxiv.org/abs/1912.00888' },

    /* Privacy */
    { id: 'dpfusion', bib: 'thareja2026dpfusion', line: 'lm', year: 2026, label: 'DP-Fusion', note: 'DP inference',
      title: 'DP-Fusion: Token-Level Differentially Private Inference for Large Language Models',
      venue: 'ICLR 2026', url: 'https://arxiv.org/pdf/2507.04531' },
    { id: 'pepsi', bib: 'mahdavi2023pepsi', line: 'set', year: 2024, label: 'PEPSI', note: 'unbalanced PSI',
      title: 'PEPSI: Practically Efficient Private Set Intersection in the Unbalanced Setting',
      venue: 'USENIX Security 2024', url: 'https://arxiv.org/abs/2310.14565' },
    { id: 'inference', bib: 'diaa2023fast', line: 'mpc', year: 2024, label: 'Private inference',
      title: 'Fast and Private Inference of Deep Neural Networks by Co-designing Activation Functions',
      venue: 'USENIX Security 2024', url: 'https://arxiv.org/abs/2306.08538' },
    { id: 'pii', bib: 'lukas2023analyzing', line: 'lm', year: 2023, label: 'PII leakage in LMs',
      title: 'Analyzing Leakage of Personally Identifiable Information in Language Models',
      venue: 'IEEE S&P 2023', url: 'https://arxiv.org/abs/2302.00539' },
    { id: 'ppml', bib: 'kerschbaum2023privacy', line: 'mpc', year: 2023, label: 'Privacy-preserving ML',
      title: 'Privacy-Preserving Machine Learning [Cryptography]',
      venue: 'IEEE Security & Privacy magazine, 2023',
      url: 'https://ieeexplore.ieee.org/document/10315769' },
    { id: 'tpsi', bib: 'mahdavi2020practical', line: 'set', year: 2020, label: 'Multi-party PSI',
      title: 'Practical Over-threshold Multi-party Private Set Intersection',
      venue: 'ACSAC 2020', url: 'https://nilslukas.github.io/assets/pdfs/mahdavi_tpsi_paper.pdf' },
    { id: 'dpset', bib: 'kacsmar2020differentially', line: 'set', year: 2020, label: 'DP set operations',
      title: 'Differentially Private Two-party Set Operations',
      venue: 'IEEE EuroS&P 2020', url: 'https://nilslukas.github.io/assets/pdfs/kacsmar_dipsi_paper.pdf' },

    /* Safety and security */
    { id: 'tracer', bib: 'mishra2026tracer', line: 'agent', year: 2026, label: 'TRACER', note: 'prompt injection',
      title: 'TRACER: Trace-Regularized Training Against Indirect Prompt Injection',
      venue: 'EMNLP 2026 Findings' },
    { id: 'probe', bib: 'mishra2026probe', line: 'agent', year: 2026, label: 'PROBE', note: 'policy audits',
      title: 'PROBE: Learning to Audit Policy Compliance in Tool-Using LLM Agents',
      venue: 'NeurIPS 2026' },
    { id: 'spqr', bib: 'alam2026spqr', line: 'align', year: 2026, label: 'SPQR', note: 'safety benchmark',
      title: 'SPQR: A Multi-Dimensional Benchmark for Safety Alignment under Benign Model Adaptation',
      venue: 'ECCV 2026', url: 'https://arxiv.org/abs/2511.19558' },
    { id: 'copyshield', bib: 'alshehyari2026copyshield', line: 'align', year: 2026, label: 'CopyShield', note: 'copyright defenses',
      title: 'CopyShield: A Cross-Level Benchmark of Copyright Defenses in LLMs',
      venue: 'EMNLP 2026', award: 'oral', url: 'https://arxiv.org/abs/2609.01161' },
    { id: 'cowpox', bib: 'wu2025cowpox', line: 'agent', year: 2025, label: 'Cowpox', note: 'multi-agent immunity',
      title: 'Cowpox: Towards the Immunity of VLM-based Multi-Agent Systems',
      venue: 'ICML 2025', url: 'https://arxiv.org/abs/2508.09230' },
    { id: 'spirit', bib: 'djanibekov2025spirit', line: 'align', year: 2025, label: 'SPIRIT', note: 'speech jailbreaks',
      title: 'SPIRIT: Patching Speech Language Models against Jailbreak Attacks',
      venue: 'EMNLP 2025', url: 'https://arxiv.org/abs/2505.13541' },
    { id: 'backdoor', bib: 'schneider2023universal', topic: 'safe', year: 2024, label: 'Universal backdoors',
      title: 'Universal Backdoor Attacks',
      venue: 'ICLR 2024', url: 'https://arxiv.org/abs/2312.00157' },

    /* Reasoning */
    { id: 'eglr', bib: 'bhattacharjee2026entropy', line: 'latent', year: 2026, label: 'EGLR', note: 'latent recursion',
      title: 'Entropy-Gated Latent Recursion',
      venue: 'NeurIPS 2026', url: 'https://arxiv.org/abs/2606.16620' },
    { id: 'forest', bib: 'wang2026forest', line: 'latent', year: 2026, label: 'Forest before trees',
      title: 'Forest Before Trees: Latent Superposition for Efficient Visual Reasoning',
      venue: 'ACL 2026', url: 'https://arxiv.org/abs/2601.06803' },
    { id: 'core', bib: 'mishra2026core', line: 'small', year: 2026, label: 'CoRe', note: 'cross teaching',
      title: 'CoRe: Collaborative Reasoning via Cross Teaching',
      venue: 'ICML 2026', url: 'https://arxiv.org/abs/2601.21600' },
    { id: 'sde2', bib: 'mishra2026sd', line: 'small', year: 2026, label: 'SD-E²', note: 'token budgets',
      title: 'SD-E²: Semantic Exploration for Reasoning Under Token Budgets',
      venue: 'EACL 2026 Findings', url: 'https://arxiv.org/pdf/2601.17982' }
  ];

  /* Related work in another line or topic: [paper, paper, what they share]. */
  var RELATED = [
    ['backdoorwm', 'backdoor',
      'Both study backdoors in neural networks: one as a watermark, the other as an attack.'],
    ['pii', 'copyshield',
      'Both measure language models that repeat memorised training text.'],
    ['tpsi', 'threshold',
      'Both are threshold protocols: a result appears only when at least t parties contribute to it.'],
    ['inference', 'dpfusion',
      'Both make model inference private: one with cryptography, the other with differential privacy.']
  ];

  /* ------------------------------------------------------------------
     The paper list comes from publications.html
     ------------------------------------------------------------------ */
  var SOURCE = root.getAttribute('data-papers') || 'publications.html';

  function norm(t) {
    return String(t || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /* The same small parser as on publications.html: one field per line. */
  function parseBibtex(text) {
    var out = [], re = /@(\w+)\s*{\s*([^,]+),([\s\S]*?)\n}/g, m;
    while ((m = re.exec(text)) !== null) {
      var f = { key: m[2].trim() };
      m[3].split(/\n/).forEach(function (l) {
        var kv = l.match(/\s*(\w+)\s*=\s*[{"'](.*?)[}"'],?\s*$/);
        if (kv) f[kv[1].toLowerCase()] = kv[2];
      });
      out.push(f);
    }
    return out;
  }

  /* A paper with no entry in PAPERS: topic from its title (never from the
     venue, where "Security & Privacy" would mislead), a short label, and the
     venue without emoji or the award text. */
  var TOPIC_WORDS = [
    ['wm', /watermark|fingerprint|provenance|ai-generated|deepfake/i],
    ['priv', /privacy|private|differential|leak|\bpii\b|membership|set intersection|cryptograph|encrypt/i],
    ['reason', /reason|latent|chain-of-thought|token budget/i]
  ];
  var SMALL = /^(a|an|and|the|of|for|in|on|to|with|via|by|from|under|against)$/i;

  function shortLabel(title) {
    var head = title.split(/:\s/)[0];
    if (head !== title && head.length <= 24) return head;
    var words = title.split(/\s+/), out = [];
    for (var i = 0; i < words.length; i++) {
      if (out.length && (out.join(' ') + ' ' + words[i]).length > 26) break;
      out.push(words[i]);
    }
    while (out.length > 1 && SMALL.test(out[out.length - 1])) out.pop();
    return out.join(' ');
  }

  function venueOf(e) {
    var v = (e.journal || e.booktitle || '')       /* cut at the first emoji, comma or bracket */
      .split(/[,(\u2600-\u27BF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDEFF]|\uD83E[\uDD00-\uDEFF]/)[0]
      .replace(/\uFE0F/g, '')
      .replace(/'(\d\d)\b/, ' 20$1')
      .replace(/\s+/g, ' ').trim();
    if (!/\b(19|20)\d\d\b/.test(v)) v = v ? v + (/\s/.test(v) ? ', ' : ' ') + e.year : String(e.year);
    return v;
  }

  function fromBib(e, year) {
    var topic = 'safe';
    for (var i = 0; i < TOPIC_WORDS.length; i++) {
      if (TOPIC_WORDS[i][1].test(e.title)) { topic = TOPIC_WORDS[i][0]; break; }
    }
    var award = (e.journal || e.booktitle || '').match(/best paper|oral|spotlight/i);
    var p = { id: 'bib:' + e.key, bib: e.key, topic: topic, year: year,
              label: shortLabel(e.title), title: e.title, venue: venueOf(e) };
    if (award) p.award = award[0].toLowerCase();
    if (e.url) p.url = e.url;
    return p;
  }

  /* Keep the entries of PAPERS that are on publications.html (taking the url
     and year from there) and add the papers that have no entry yet. */
  function merge(curated, entries) {
    var byBib = {}, byTitle = {}, kept = {}, fresh = [];
    curated.forEach(function (p) {
      if (p.bib) byBib[p.bib] = p;
      byTitle[norm(p.title)] = p;
    });
    entries.forEach(function (e) {
      var year = parseInt(e.year, 10);
      if (!e.title || !year) return;
      var p = byBib[e.key] || byTitle[norm(e.title)];
      if (p && !kept[p.id]) {
        kept[p.id] = true;
        p.year = year;
        if (e.url) p.url = e.url;
      } else if (!p) {
        fresh.push(fromBib(e, year));
      }
    });
    if (fresh.length && window.console) {
      console.info('Research map: placed by title words, no entry in research-map.js yet: ' +
        fresh.map(function (p) { return p.bib; }).join(', '));
    }
    return curated.filter(function (p) { return kept[p.id]; }).concat(fresh);
  }

  /* Draw once: with the publications list, or with PAPERS alone if that
     list cannot be read within a few seconds. */
  function loadPapers(done) {
    var finished = false;
    function finish(entries) {
      if (finished) return;
      finished = true;
      if (entries && entries.length) PAPERS = merge(PAPERS, entries);
      done();
    }
    /* On publications.html the list is on the page itself. */
    var inline = document.getElementById('bibtex-inline');
    if (inline) { finish(parseBibtex(inline.textContent)); return; }
    if (!window.fetch) { finish(null); return; }
    setTimeout(function () { finish(null); }, 4000);
    fetch(SOURCE)
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (html) {
        var m = html.match(/<script[^>]*id="bibtex-inline"[^>]*>([\s\S]*?)<\/script>/);
        finish(m ? parseBibtex(m[1]) : null);
      })
      .catch(function () { finish(null); });
  }

  /* Wait for the whole page: on publications.html the BibTeX block comes
     after this script. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { loadPapers(draw); });
  } else {
    loadPapers(draw);
  }

  function draw() {
    /* ------------------------------------------------------------------
       Index the data
       ------------------------------------------------------------------ */
    var NS = 'http://www.w3.org/2000/svg';
    var paperById = {}, lineById = {}, topicById = {};
    TOPICS.forEach(function (t) { topicById[t.id] = t; });
    LINES.forEach(function (l, i) { l.order = i; lineById[l.id] = l; });
    var allLines = LINES.slice();
    PAPERS.forEach(function (p, i) {
      p.order = i;
      paperById[p.id] = p;
      if (p.line) {
        p.topic = lineById[p.line].topic;
      } else {                       /* a paper on its own: a one-dot line */
        var solo = { id: '_' + p.id, topic: p.topic, name: null, order: LINES.length + i, solo: true };
        lineById[solo.id] = solo;
        allLines.push(solo);
        p.line = solo.id;
      }
      p.related = [];
    });
    RELATED.forEach(function (r) {
      var a = paperById[r[0]], b = paperById[r[1]];
      if (!a || !b) return;
      a.related.push({ paper: b, why: r[2] });
      b.related.push({ paper: a, why: r[2] });
    });
    allLines.forEach(function (l) {
      l.papers = PAPERS.filter(function (p) { return p.line === l.id; });
    });
    allLines = allLines.filter(function (l) { return l.papers.length; });
    allLines.forEach(function (l) {
      var parent = l.from && paperById[l.from];
      l.parent = parent && parent.topic === l.topic ? parent : null;
    });

    var canHover = !window.matchMedia || window.matchMedia('(hover: hover)').matches;
    var leaving = 0;

    /* ------------------------------------------------------------------
       Build the DOM once; layout() only positions it
       ------------------------------------------------------------------ */
    function h(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    }
    function s(tag, attrs) {
      var n = document.createElementNS(NS, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      return n;
    }

    root.textContent = '';
    var stage = h('div', 'rmap-stage');
    var wires = s('svg', { 'class': 'rmap-wires', 'aria-hidden': 'true', focusable: 'false' });
    var gRules = s('g', { 'class': 'rules' });
    var gRails = s('g', { 'class': 'rails' });
    var gLinks = s('g', { 'class': 'links' });
    var gDots = s('g', { 'class': 'dots' });
    [gRules, gRails, gLinks, gDots].forEach(function (g) { wires.appendChild(g); });
    stage.appendChild(wires);

    var years = h('div', 'rmap-years');
    years.setAttribute('aria-hidden', 'true');
    stage.appendChild(years);

    TOPICS.forEach(function (t) {
      var box = h('div', 'rmap-topic');
      var h3 = h('h3', null, t.name);
      var n = PAPERS.filter(function (p) { return p.topic === t.id; }).length;
      var count = h('span', null, String(n));
      count.setAttribute('aria-label', n + ' papers');
      h3.appendChild(count);
      box.appendChild(h3);
      box.appendChild(h('p', null, t.gloss));
      t.node = box;
      stage.appendChild(box);
    });

    PAPERS.forEach(function (p) {
      var a = h('a', 'rmap-paper');
      if (p.url) { a.href = p.url; a.target = '_blank'; a.rel = 'noopener'; }
      else a.tabIndex = 0;
      a.setAttribute('aria-label', p.title + ', ' + p.venue + (p.award ? ', ' + p.award : ''));
      a.appendChild(h('span', 'name', p.label));
      if (p.note) a.appendChild(h('span', 'note', p.note));
      p.node = a;
      stage.appendChild(a);

      /* Leaving waits a moment, so the legend does not flash back while the
         pointer crosses the gap between two papers. */
      a.addEventListener('mouseenter', function () { if (canHover) { clearTimeout(leaving); select(p); } });
      a.addEventListener('mouseleave', function () {
        if (canHover) leaving = setTimeout(function () { select(null); }, 140);
      });
      a.addEventListener('focus', function () { clearTimeout(leaving); select(p); });
      a.addEventListener('blur', function () { if (canHover) select(null); });
      a.addEventListener('click', function (e) {
        /* Touch: the first tap shows the paper, the link in the card opens it. */
        if (!canHover) { e.preventDefault(); select(current === p ? null : p); }
      });
    });

    /* Legend (shown at rest) and detail card (shown for the selected paper). */
    var key = h('div', 'rmap-key');
    key.innerHTML =
      '<p><svg viewBox="0 0 30 12"><circle class="d" cx="15" cy="6" r="3.2"/></svg>' +
        'One paper, in its topic and year</p>' +
      '<p><svg viewBox="0 0 30 12"><path class="r" d="M5,6H25"/><circle class="d" cx="5" cy="6" r="3.2"/>' +
        '<circle class="d" cx="25" cy="6" r="3.2"/></svg>Papers in one line of work</p>' +
      '<p><svg viewBox="0 0 30 12"><circle class="ar" cx="15" cy="6" r="5"/><circle class="ad" cx="15" cy="6" r="2.5"/></svg>' +
        'Oral, spotlight or first place</p>' +
      '<p><svg viewBox="0 0 30 12"><path class="l" d="M3,6H27"/></svg>' +
        'Related work elsewhere, shown when you ' + (canHover ? 'point at' : 'tap') + ' a paper</p>';
    stage.appendChild(key);

    var card = h('div', 'rmap-card');
    card.setAttribute('aria-live', 'polite');
    stage.appendChild(card);
    root.appendChild(stage);

    document.addEventListener('click', function (e) {
      if (!canHover && current && !stage.contains(e.target)) select(null);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && current) { select(null); }
    });

    /* Counts for the sentence above the figure */
    var firstYear = Math.min.apply(null, PAPERS.map(function (p) { return p.year; }));
    var lastYear = Math.max.apply(null, PAPERS.map(function (p) { return p.year; }));
    var slots = { count: PAPERS.length, topics: TOPICS.length, first: firstYear, last: lastYear };
    Object.keys(slots).forEach(function (k) {
      var nodes = document.querySelectorAll('[data-rmap="' + k + '"]');
      for (var i = 0; i < nodes.length; i++) nodes[i].textContent = slots[k];
    });

    /* ------------------------------------------------------------------
       Layout
       ------------------------------------------------------------------ */
    var PITCH = 10;          /* distance between two rails            */
    var RAIL_PAD = 5;        /* lane edge to the first rail           */
    var mode = '', stageW = 0, stageH = 0, ROW = 19;

    function layout() {
      var W = Math.floor(root.clientWidth);
      if (!W) return;
      stageW = W;
      var perRow = W >= 760 ? 4 : (W >= 500 ? 2 : 1);
      mode = perRow === 4 ? 'wide' : 'stack';
      root.classList.toggle('is-wide', mode === 'wide');
      root.classList.toggle('is-stack', mode !== 'wide');
      ROW = mode === 'wide' ? 19 : 26;
      var BAND = mode === 'wide' ? 10 : 8;      /* gap between two years        */
      var GUT = 40;                             /* year column                  */
      var GAP = mode === 'wide' ? 16 : 20;      /* gap between two topic lanes  */

      gRules.textContent = ''; gRails.textContent = ''; gDots.textContent = ''; gLinks.textContent = '';
      years.textContent = '';

      /* Natural width of every label, so that no lane is narrower than its text. */
      PAPERS.forEach(function (p) {
        var a = p.node;
        a.style.width = 'auto';
        a.style.paddingLeft = '0';
        p.w = Math.ceil(a.getBoundingClientRect().width);
      });

      var groups = [];
      for (var g = 0; g < TOPICS.length; g += perRow) groups.push(TOPICS.slice(g, g + perRow));

      var y = 0, rules = [];
      groups.forEach(function (group, gi) {
        if (gi) y += 26;
        var ids = group.map(function (t) { return t.id; });
        var inGroup = PAPERS.filter(function (p) { return ids.indexOf(p.topic) >= 0; });
        var ys = [];
        inGroup.forEach(function (p) { if (ys.indexOf(p.year) < 0) ys.push(p.year); });
        ys.sort(function (a, b) { return b - a; });

        /* 1. Rows, measured from the first year of the group. */
        var rel = 0, bands = [];
        ys.forEach(function (yr, bi) {
          if (bi) rel += BAND;
          var rows = 0;
          group.forEach(function (t) {
            var ps = inGroup.filter(function (p) { return p.topic === t.id && p.year === yr; });
            ps.sort(function (a, b) {
              return (lineById[a.line].order - lineById[b.line].order) || (a.order - b.order);
            });
            ps.forEach(function (p, j) { p.ry = rel + j * ROW + ROW / 2; });
            rows = Math.max(rows, ps.length);
          });
          bands.push({ year: yr, top: rel });
          rel += rows * ROW;
        });

        /* 2. Rails: each line of work takes the first rail free over its span. */
        group.forEach(function (t) {
          var lines = allLines.filter(function (l) { return l.topic === t.id; });
          lines.sort(function (a, b) { return a.order - b.order; });
          var used = [];
          lines.forEach(function (l) {
            var ps = l.papers.slice().sort(function (a, b) { return a.ry - b.ry; });
            l.sorted = ps;
            var lo = ps[0].ry - 7;
            var hi = (l.parent ? l.parent.ry - 6 : ps[ps.length - 1].ry) + 7;
            var r = 0;
            while (used[r] && used[r].some(function (iv) { return lo < iv[1] && hi > iv[0]; })) r++;
            (used[r] = used[r] || []).push([lo, hi]);
            l.rail = r;
          });
          t.zone = RAIL_PAD + (used.length - 1) * PITCH + 12;
        });

        /* 3. Lane widths: what the labels need, plus an equal share of the rest. */
        var need = group.map(function (t) {
          var w = 0;
          inGroup.forEach(function (p) { if (p.topic === t.id) w = Math.max(w, p.w); });
          return t.zone + w + 4;
        });
        var room = W - GUT - (perRow - 1) * GAP;
        var sum = need.reduce(function (a, b) { return a + b; }, 0);
        var even = mode !== 'wide';       /* stacked rows of lanes must line up */
        var x = GUT;
        group.forEach(function (t, i) {
          t.w = even ? room / perRow
              : sum <= room ? need[i] + (room - sum) / group.length : need[i] * room / sum;
          t.x = x;
          x += t.w + GAP;
        });

        /* 4. Headings. */
        var headH = 0;
        group.forEach(function (t) {
          t.node.style.left = t.x + 'px';
          t.node.style.top = y + 'px';
          t.node.style.width = t.w + 'px';
          headH = Math.max(headH, t.node.offsetHeight);
        });
        y += headH + 8;
        rules.push({ y: y, head: true });
        y += 9;

        /* 5. Final positions. */
        bands.forEach(function (b, bi) {
          if (bi) rules.push({ y: y + b.top - BAND / 2 });
          var label = h('span', 'rmap-year', String(b.year));
          label.style.top = (y + b.top) + 'px';
          label.style.height = ROW + 'px';
          label.style.lineHeight = ROW + 'px';
          years.appendChild(label);
        });
        inGroup.forEach(function (p) { p.y = y + p.ry; });
        group.forEach(function (t) {
          allLines.forEach(function (l) {
            if (l.topic !== t.id) return;
            l.x = t.x + RAIL_PAD + l.rail * PITCH;
            l.papers.forEach(function (p) { p.x = l.x; });
          });
        });
        y += rel;
      });

      allLines.forEach(function (l) {
        var ps = l.sorted, top = ps[0].y, bottom = ps[ps.length - 1].y, d = '';
        if (l.parent) {
          var px = l.parent.x, py = l.parent.y;
          d = 'M' + px + ',' + py + 'C' + px + ',' + (py - 9) + ' ' + l.x + ',' + (py - 6) + ' ' +
              l.x + ',' + (py - 15) + 'V' + top;
        } else if (ps.length > 1) {
          d = 'M' + l.x + ',' + bottom + 'V' + top;
        }
        if (d) {
          l.path = s('path', { d: d });
          gRails.appendChild(l.path);
        } else l.path = null;
      });

      PAPERS.forEach(function (p) {
        var t = topicById[p.topic];
        var g = s('g', { 'class': p.award ? 'dot award' : 'dot' });
        if (p.award) {
          g.appendChild(s('circle', { cx: p.x, cy: p.y, r: 5, 'class': 'ring' }));
          g.appendChild(s('circle', { cx: p.x, cy: p.y, r: 2.5, 'class': 'core' }));
        } else {
          g.appendChild(s('circle', { cx: p.x, cy: p.y, r: 3.2, 'class': 'core' }));
        }
        p.dot = g;
        gDots.appendChild(g);
        var a = p.node;
        a.style.left = t.x + 'px';
        a.style.top = (p.y - ROW / 2) + 'px';
        a.style.width = t.w + 'px';
        a.style.height = ROW + 'px';
        a.style.lineHeight = ROW + 'px';
        a.style.paddingLeft = t.zone + 'px';
      });

      /* Legend and card: in the widest empty corner (bottom right) when there
         is one, otherwise the legend goes under the map and the card floats. */
      var corner = null;
      if (mode === 'wide') {
        for (var k = TOPICS.length - 1; k > 0; k--) {
          var top = 0;
          for (var j = k; j < TOPICS.length; j++) {
            PAPERS.forEach(function (p) {
              if (p.topic === TOPICS[j].id) top = Math.max(top, p.y + ROW / 2);
            });
          }
          top += BAND;
          var cw = W - TOPICS[k].x, ch = y - top;
          if (cw >= 290 && ch >= 128 && (!corner || cw * ch > corner.w * corner.h)) {
            corner = { x: TOPICS[k].x, y: top, w: cw, h: ch };
          }
        }
      }
      root.classList.toggle('has-corner', !!corner);
      [key, card].forEach(function (n) {
        n.style.cssText = '';
        if (corner) {
          n.style.left = corner.x + 'px';
          n.style.top = corner.y + 'px';
          n.style.width = corner.w + 'px';
          n.style.height = corner.h + 'px';
        }
      });
      if (!corner) {
        key.style.left = '0px';
        key.style.top = (y + 18) + 'px';
        key.style.width = W + 'px';
        y += 18 + key.offsetHeight;
      }

      /* Year rules stop short of the corner that holds the legend. */
      rules.forEach(function (r) {
        var end = corner && !r.head && r.y > corner.y ? corner.x - GAP : W;
        gRules.appendChild(s('path', {
          d: 'M0,' + (Math.round(r.y) + 0.5) + 'H' + end, 'class': r.head ? 'head' : ''
        }));
      });

      stageH = y;
      stage.style.height = y + 'px';
      wires.setAttribute('viewBox', '0 0 ' + W + ' ' + y);
      wires.setAttribute('width', W);
      wires.setAttribute('height', y);
      if (current) select(current, true);
    }

    /* ------------------------------------------------------------------
       Selection
       ------------------------------------------------------------------ */
    var current = null;

    function esc(t) {
      return String(t).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    }

    function select(p, keep) {
      if (!keep && p === current) return;
      current = p;
      gLinks.textContent = '';
      root.classList.toggle('is-active', !!p);
      PAPERS.forEach(function (q) {
        q.node.classList.remove('is-hot', 'is-on');
        q.dot.classList.remove('is-hot', 'is-on');
      });
      allLines.forEach(function (l) { if (l.path) l.path.classList.remove('is-on'); });
      if (!p) { card.innerHTML = ''; return; }

      var line = lineById[p.line];
      line.papers.forEach(function (q) { q.node.classList.add('is-on'); q.dot.classList.add('is-on'); });
      if (line.path) line.path.classList.add('is-on');
      if (line.parent) { line.parent.node.classList.add('is-on'); line.parent.dot.classList.add('is-on'); }
      p.node.classList.add('is-hot');
      p.dot.classList.add('is-hot');

      var html = '<p class="t">' + esc(p.title) + '</p>' +
        '<p class="v">' + esc(p.venue) + (p.award ? ' <span>' + esc(p.award) + '</span>' : '') + '</p>';
      if (!line.solo) {
        html += '<p class="l">Line of work: <b>' + esc(line.name) + '</b>' +
          (line.parent ? ', which follows from ' + esc(line.parent.label) : '') + '.</p>';
      }
      p.related.forEach(function (r) {
        var q = r.paper;
        q.node.classList.add('is-on');
        q.dot.classList.add('is-on');
        gLinks.appendChild(s('path', { d: 'M' + p.x + ',' + p.y + 'L' + q.x + ',' + q.y }));
        html += '<p class="l">Related: <b>' + esc(q.label) + '</b>' +
          (q.topic !== p.topic ? ' in ' + esc(topicById[q.topic].name) : '') + '. ' + esc(r.why) + '</p>';
      });
      if (!canHover && p.url) {
        html += '<p class="go"><a href="' + esc(p.url) + '" target="_blank" rel="noopener">Read the paper</a></p>';
      }
      card.innerHTML = html;

      if (!root.classList.contains('has-corner')) {       /* floating card */
        var t = topicById[p.topic];
        var w = Math.min(stageW, 340);
        var left = Math.max(0, Math.min(t.x, stageW - w));
        card.style.width = w + 'px';
        card.style.left = left + 'px';
        card.style.top = (p.y + ROW / 2 + 4) + 'px';
      }
    }

    /* ------------------------------------------------------------------
       Go
       ------------------------------------------------------------------ */
    layout();
    if (window.ResizeObserver) {
      var lastW = root.clientWidth;
      new ResizeObserver(function () {
        if (root.clientWidth !== lastW) { lastW = root.clientWidth; layout(); }
      }).observe(root);
    } else {
      window.addEventListener('resize', layout);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  }
})();
