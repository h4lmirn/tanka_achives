(function () {
  const SITE_URL = 'https://tanka.h4lmiran.com/';
  const $ = (id) => document.getElementById(id);
  const listEl = $('tankaList');
  const searchEl = $('searchInput');
  const sortEl = $('sortSelect');
  const pillsEl = $('pillContainer');
  const countEl = $('countLabel');

  let all = [];
  let active = 'all';

  const seriesOf = (t) => Array.isArray(t.series) ? t.series
    : typeof t.series === 'string' && t.series.trim()
      ? t.series.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const time = (t) => new Date(t.date || '1900-01-01').getTime();
  const pad = (n) => String(n).padStart(3, '0');
  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function buildPills() {
    const names = [...new Set(all.flatMap(seriesOf))].sort();
    pillsEl.replaceChildren();
    for (const [value, label] of [['all', 'すべて'], ...names.map((s) => [s, s])]) {
      const b = el('button', 'pill', label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(active === value));
      b.addEventListener('click', () => {
        active = value;
        pillsEl.querySelectorAll('.pill').forEach((p) => p.setAttribute('aria-pressed', String(p === b)));
        render();
      });
      pillsEl.appendChild(b);
    }
  }

  function item(t) {
    const li = el('li', 'tanka');
    li.appendChild(el('span', 'tanka-no', 'No.' + pad(t._no)));
    const p = el('p', 'tanka-text', t.text);
    p.dataset.key = t._no;
    li.appendChild(p);

    const meta = el('div', 'tanka-meta');
    if (t.date) {
      const d = el('time', 'tanka-date', fmtDate(t.date));
      d.dateTime = t.date;
      meta.appendChild(d);
    }
    for (const s of seriesOf(t)) meta.appendChild(el('span', 'tanka-series', s));
    if (t.kettei) meta.appendChild(el('span', 'tanka-kettei', '決定'));
    const a = el('a', 'share', 'Post');
    a.href = 'https://x.com/intent/post?text=' +
      encodeURIComponent(t.text + '\n目黒なずな 短歌アーカイヴ\n' + SITE_URL);
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'この歌を X にポストする');
    meta.appendChild(a);
    li.appendChild(meta);
    return li;
  }

  function render() {
    const q = searchEl.value.trim();
    const asc = sortEl.value === 'date-asc';
    const rows = all
      .filter((t) => (active === 'all' || seriesOf(t).includes(active)) && (!q || t.text.includes(q)))
      .sort((a, b) => asc ? time(a) - time(b) || a._no - b._no : time(b) - time(a) || b._no - a._no);

    window.Spiral.release(listEl.querySelectorAll('.tanka-text'));
    countEl.textContent = `${rows.length} 首`;
    if (!rows.length) {
      listEl.replaceChildren(el('li', 'empty', '— 該当する歌がありません —'));
      return;
    }
    const frag = document.createDocumentFragment();
    rows.forEach((t) => frag.appendChild(item(t)));
    listEl.replaceChildren(frag);
    window.Spiral.observe(listEl.querySelectorAll('.tanka-text'));
  }

  function hero() {
    const years = all.map((t) => (t.date || '').slice(0, 4)).filter(Boolean).sort();
    $('heroCount').firstChild.textContent = all.length;
    $('heroRange').textContent = years.length ? `${years[0]} — ${years[years.length - 1]}` : '';
  }

  fetch('tanka.json')
    .then((r) => r.json())
    .then((data) => {
      // Stable numbering: oldest poem is No.001 (file order breaks ties).
      data.map((t, i) => [t, i])
        .sort((a, b) => time(a[0]) - time(b[0]) || a[1] - b[1])
        .forEach(([t], i) => { t._no = i + 1; });
      all = data;
      hero();
      buildPills();
      render();
    })
    .catch(() => {
      listEl.replaceChildren(el('li', 'empty', '— tanka.json が見つかりません —'));
    });

  let typing;
  searchEl.addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(render, 120); });
  sortEl.addEventListener('change', render);

  // Title reveal on first load, once the webfont is in (no fallback-font flash)
  const title = $('heroTitle');
  window.Spiral.prepare(title);
  (document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]) : Promise.resolve())
    .then(() => window.Spiral.observe([title]));

  // Scroll rail (transform only)
  const rail = document.querySelector('.rail i');
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      rail.style.setProperty('--p', max > 0 ? (scrollY / max).toFixed(4) : 0);
      ticking = false;
    });
  }, { passive: true });
})();
