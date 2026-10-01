// Spiral reveal: each character turns on its vertical axis, one after another,
// like the steps of a spiral staircase rising around its pole.
// - Only elements near / inside the viewport are split (501 poems).
// - Each element plays once, then collapses back to a plain text node.
// - While split, the original text stays available to screen readers.
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const TOTAL_MAX = 1500;  // whole poem finishes within 1.5s
  const DUR = 620;         // one character's turn
  const STEP_MAX = 48;

  // Characters that must not start a line stay glued to the previous glyph,
  // opening brackets stay glued to the next one.
  const NO_START = /[、。，．,.・：；？！?!ー〜」』）〕］｝〉》】”’…‥ゝゞヽヾぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ]/;
  const NO_END = /[「『（〔［｛〈《【“‘]/;

  const seg = typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter('ja', { granularity: 'grapheme' }) : null;
  const graphemes = (s) => seg ? Array.from(seg.segment(s), (x) => x.segment) : Array.from(s);

  function units(text) {
    const out = [];
    let carry = '';
    for (const g of graphemes(text)) {
      if (NO_END.test(g)) { carry += g; continue; }
      if (NO_START.test(g) && out.length && !carry) { out[out.length - 1] += g; continue; }
      out.push(carry + g);
      carry = '';
    }
    if (carry) out.push(carry);
    return out;
  }

  const state = new WeakMap(); // el -> 'split' | 'playing' | 'done'
  const played = new Set();    // keys already revealed in this visit

  function finish(el) {
    el.textContent = el.dataset.text;
    el.classList.remove('spiral', 'is-playing');
    el.style.removeProperty('--step');
    state.set(el, 'done');
  }

  function split(el) {
    if (state.has(el)) return;
    const text = el.dataset.text ?? (el.dataset.text = el.textContent);
    const parts = units(text);
    const step = parts.length > 1
      ? Math.min(STEP_MAX, (TOTAL_MAX - DUR) / (parts.length - 1)) : 0;

    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    const vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');
    const frag = document.createDocumentFragment();
    parts.forEach((p, i) => {
      const s = document.createElement('span');
      s.className = 'g';
      s.style.setProperty('--i', i);
      s.textContent = p;
      frag.appendChild(s);
    });
    vis.appendChild(frag);
    el.style.setProperty('--step', step.toFixed(1) + 'ms');
    el.style.setProperty('--dur', DUR + 'ms');
    el.classList.add('spiral');
    el.replaceChildren(sr, vis);
    el.dataset.total = Math.ceil(DUR + step * (parts.length - 1));
    state.set(el, 'split');
  }

  function play(el) {
    if (state.get(el) !== 'split') return;
    state.set(el, 'playing');
    if (el.dataset.key) played.add(el.dataset.key);
    el.classList.add('is-playing');
    setTimeout(() => finish(el), +el.dataset.total + 60);
  }

  let prepIO, playIO;
  function ensureObservers() {
    if (prepIO) return;
    // Split slightly before the poem arrives, so it never flashes as plain text.
    prepIO = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { split(e.target); prepIO.unobserve(e.target); }
    }, { rootMargin: '0px 0px 60% 0px' });
    playIO = new IntersectionObserver((entries) => {
      let n = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        split(e.target);
        playIO.unobserve(e.target);
        // poems arriving together start one after another, not in unison
        const el = e.target;
        if (n === 0) play(el); else setTimeout(() => play(el), n * 140);
        n++;
      }
    }, { rootMargin: '0px 0px -10% 0px' });
  }

  // Register poems. Elements already on screen are split synchronously so the
  // first paint shows them in their resting pose instead of as plain text.
  function observe(els) {
    if (reduce.matches || !('IntersectionObserver' in window)) return;
    ensureObservers();
    const limit = innerHeight * 1.6;
    for (const el of els) {
      if (el.dataset.key && played.has(el.dataset.key)) continue;
      if (el.getBoundingClientRect().top < limit) split(el);
      else prepIO.observe(el);
      playIO.observe(el);
    }
  }

  // Stop watching elements that are about to be removed from the page.
  function release(els) {
    if (!prepIO) return;
    for (const el of els) { prepIO.unobserve(el); playIO.unobserve(el); }
  }

  // Turning on reduced motion mid-visit: settle everything immediately.
  reduce.addEventListener?.('change', () => {
    if (!reduce.matches) return;
    if (prepIO) { prepIO.disconnect(); playIO.disconnect(); }
    document.querySelectorAll('.spiral').forEach(finish);
  });

    // Put an element in its resting pose now; observe() later starts it.
  function prepare(el) {
    if (!reduce.matches && 'IntersectionObserver' in window) split(el);
  }

  window.Spiral = { observe, release, prepare };
})();
