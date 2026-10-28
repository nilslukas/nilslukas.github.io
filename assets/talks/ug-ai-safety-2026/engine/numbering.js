/* numbering.js — paper-style numbers for figures, algorithms and definition boxes (Nils, 2026-09-02:
   "please always start with 1.0"; "make all figures with subtext so that I can reference them").
   Runs once at load. Figures opt in with `data-fig` on the <figure> (a caption then starts "Figure N."). Slides are display:none when inactive, so CSS counters cannot do this.
   Main slides count; stacked slides (data-stack) repeat their parent's definition label and get a bare
   "Figure". Chapter = number of `.slide.divider:not(.cont)` passed so far (the Part II divider is .cont).
   Figures and algorithms are numbered once across the lecture; Definition/Lemma/Theorem/Corollary/
   Remark/Equation share one counter per chapter, as a shared theorem counter does in LaTeX. A stack never inherits a
   label from an earlier chapter (26 Oct 2026: Week 10's 412d2 showed 125's "Definition 1.5"); it prints the bare env. */
(function(){
  const slides=[...document.querySelectorAll('section.slide')];
  let chap=0, thm=0, fig=0, alg=0;
  let lastMainDef=null;
  slides.forEach(s=>{
    const stacked=!!s.dataset.stack;
    if(!stacked && s.classList.contains('divider') && !s.classList.contains('cont')){chap++; thm=0; lastMainDef=null;}
    s.querySelectorAll('figure.fig[data-fig]').forEach(f=>{
      const cap=f.querySelector(':scope>.figcap,:scope>figcaption'); if(!cap) return;
      if(stacked){cap.dataset.label='Figure.'; return;}
      fig++; cap.dataset.label='Figure '+fig+'.';
    });
    s.querySelectorAll('.algo[data-env]').forEach(a=>{
      const b=a.querySelector('.algo-title b'); if(!b) return;
      if(stacked){b.dataset.label=a.dataset.env; return;}
      alg++; b.dataset.label=a.dataset.env+' '+alg;
    });
    s.querySelectorAll('.defbox[data-env]').forEach(d=>{
      const n=d.querySelector('.dfname'); if(!n) return;
      if(stacked){n.dataset.label=(lastMainDef&&lastMainDef.env===d.dataset.env)?lastMainDef.label:d.dataset.env; return;}
      thm++; const label=d.dataset.env+' '+Math.max(chap,1)+'.'+thm; n.dataset.label=label; lastMainDef={env:d.dataset.env,label};
    });
  });
})();
