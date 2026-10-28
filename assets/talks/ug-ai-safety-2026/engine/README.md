# Shared deck engine

One template, navigation and runtime for every lecture deck that has a `src/deck.json`
(Weeks 1-5 since 19 Oct 2026). Nils: "make it so that all weeks ... use ONE shared source code
for the template/navigation and so forth and only the data is different".

The style is the exec deck's (slides/exec-ai-security-2026-10-16, Act 1 draft), as first
ported to Week 9: SPOT AI Lab and MBZUAI logos, no eyebrow and no blue left bar, the chapter
bar with per-chapter slide counts, the week badge with the week's dates, Keynote-style magic
move between slides, clips that load only near the current slide.

## What lives where

| Engine (`slides/shared/engine/`) | Deck (`slides/weekNN-slug/`) |
|---|---|
| `head.html`, `tail.html`: the page around the slides | `src/NNN-*.html`: the slides |
| `deck.css`, `components.css`, fonts, KaTeX | `src/deck.json`: title, week, topic, dates |
| `deck.js` and every runtime script (`cinema.js`, `morph.js`, `lazy-media.js`, ...) | `src/deck.css`: rules that name this week's layouts |
| SPOT AI Lab and MBZUAI logos | `src/deck-tail.html`: this week's widget scripts and SVG symbols |
| | `assets/`: figures, art, clips, the numbered `favicon.svg` |

`build_deck.py` fills `{{TITLE}}`, `{{ENGINE}}` (the relative path to this folder),
`{{DECK_HEAD}}` and `{{DECK_TAIL}}`, and rewrites a fragment's `assets/<engine file>`
references (the MBZUAI logo becomes the logo pair) to point here. `export_single_file.py`
inlines engine files like the deck's own assets, so `student.html` and the PDF stay single files.

## Changing the style

Edit the engine once, then rebuild every engine deck:

```bash
for d in slides/week0[1-5]-*; do python3 artifacts/tools/build_deck.py build "$d"; done
```

Never copy an engine rule or script into a week. A rule that only one week needs goes in that
week's `src/deck.css`. A new deck joins with
`python3 artifacts/tools/migrate_to_engine.py slides/weekNN-slug --week N --topic "..."`,
then fill `dates` in its `deck.json` from the Lecture Schedule slide.

Week 9 (taught 20 Oct 2026) and the later weeks still carry their own head, tail and runtime.
