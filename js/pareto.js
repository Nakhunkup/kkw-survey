/* กราฟพาเรโต (Pareto) แบบแท่งแนวตั้ง: เรียงมากไปน้อย เส้นร้อยละสะสมแกนขวา และเส้นตัด 80%
 * ดัดแปลงจากคอมโพเนนต์ React ParetoChart ให้ทำงานบนหน้าเว็บธรรมดา */
(function () {
  const K = (window.KKW = window.KKW || {});
  const NS = 'http://www.w3.org/2000/svg';
  const W = 640;
  const BAR = '#2f55c4';
  const MUTED = '#bccbef';
  const INK = '#1b2140';
  const GRID = '#e6e9f1';
  const TICK = '#59617d';
  let uid = 0;

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
    if (parent) parent.appendChild(e);
    return e;
  }
  function niceScale(max, count) {
    const raw = Math.max(1, max) / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
    const top = Math.max(step, Math.ceil(max / step) * step);
    const ticks = [];
    for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
    return { max: top, ticks };
  }
  const pct = (v) => Math.round(v * 100) + '%';

  // items: [{ label (ชื่อย่อใต้แท่ง), full (ชื่อเต็ม), value }]
  function render(container, opts) {
    const { h } = K.ui;
    const cutoff = opts.cutoff == null ? 0.8 : opts.cutoff;
    const valueLabel = opts.valueLabel || 'คน';
    const sorted = opts.items.filter((it) => it.value > 0).sort((a, b) => b.value - a.value);
    container.innerHTML = '';
    const total = sorted.reduce((s, it) => s + it.value, 0);
    if (!total) { container.appendChild(h('p.muted.small', 'ยังไม่มีผู้ตอบข้อนี้')); return; }
    let run = 0;
    const bars = sorted.map((it) => { const before = run / total; run += it.value; return { ...it, share: it.value / total, cum: run / total, vital: before < cutoff }; });
    const rotate = bars.length > 8;
    const H = opts.height || (rotate ? 330 : 270);
    const PAD = { top: 16, bottom: rotate ? 92 : 32 };
    const scale = niceScale(bars[0].value, 4);
    const left = Math.max(14 + String(scale.max).length * 7, rotate ? 64 : 0);
    const RIGHT = 40;
    const plot = { x: left, y: PAD.top, w: W - left - RIGHT, h: H - PAD.top - PAD.bottom };
    const toY = (v) => plot.y + plot.h - (v / scale.max) * plot.h;
    const toS = (v) => plot.y + plot.h - v * plot.h;
    const band = plot.w / bars.length;
    const cx = (i) => plot.x + band * (i + 0.5);
    const bw = Math.min(44, band * 0.66);
    const vital = bars.filter((b) => b.vital).length;
    const id = 'pareto-' + ++uid;

    const wrap = h('div.pareto');
    const box = h('div.pareto-box');
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', tabindex: '0', 'aria-describedby': id,
      'aria-label': `${opts.label}. ${vital} จาก ${bars.length} รายการ รวมกันได้ ${pct(cutoff)} ของทั้งหมด กดลูกศรซ้ายขวาเพื่อดูทีละรายการ` });
    svg.style.width = '100%'; svg.style.display = 'block';
    scale.ticks.forEach((t) => {
      el('line', { x1: plot.x, x2: plot.x + plot.w, y1: toY(t), y2: toY(t), stroke: GRID }, svg);
      const tx = el('text', { x: plot.x - 8, y: toY(t), 'text-anchor': 'end', 'dominant-baseline': 'middle', fill: TICK, 'font-size': 11 }, svg); tx.textContent = t;
    });
    [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
      const tx = el('text', { x: plot.x + plot.w + 8, y: toS(t), 'dominant-baseline': 'middle', fill: TICK, 'font-size': 11 }, svg); tx.textContent = pct(t);
    });
    const hl = el('rect', { x: 0, y: plot.y, width: band, height: plot.h, fill: '#eef1f8', opacity: 0 }, svg);
    const rects = bars.map((b, i) => {
      const r = el('rect', { x: cx(i) - bw / 2, y: toY(b.value), width: bw, height: Math.max(0, plot.y + plot.h - toY(b.value)), rx: 3, fill: b.vital ? BAR : MUTED }, svg);
      r.style.transformBox = 'fill-box'; r.style.transformOrigin = 'bottom';
      const t = el('text', rotate
        ? { x: cx(i), y: plot.y + plot.h + 12, 'text-anchor': 'end', transform: `rotate(-45 ${cx(i)} ${plot.y + plot.h + 12})`, fill: TICK, 'font-size': 11 }
        : { x: cx(i), y: H - 12, 'text-anchor': 'middle', fill: TICK, 'font-size': 11 }, svg);
      t.textContent = b.label;
      return { r, t };
    });
    el('line', { x1: plot.x, x2: plot.x + plot.w, y1: toS(cutoff), y2: toS(cutoff), stroke: '#8a91a8', 'stroke-dasharray': '4 4' }, svg);
    const ct = el('text', { x: plot.x + plot.w - 4, y: toS(cutoff) - 5, 'text-anchor': 'end', fill: TICK, 'font-size': 10, 'font-weight': 700 }, svg); ct.textContent = pct(cutoff);
    const line = el('g', {}, svg);
    el('polyline', { points: bars.map((b, i) => `${cx(i)},${toS(b.cum)}`).join(' '), fill: 'none', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, line);
    const dots = bars.map((b, i) => el('circle', { cx: cx(i), cy: toS(b.cum), r: 3, fill: '#fff', stroke: INK, 'stroke-width': 2 }, line));

    // แอนิเมชันตอนแสดงครั้งแรก (ปิดเมื่อผู้ใช้ตั้งค่าลดการเคลื่อนไหว)
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      rects.forEach(({ r }, i) => { r.style.transform = 'scaleY(0)'; r.style.transition = `transform 400ms ease ${Math.min(i * 40, 400)}ms`; });
      line.style.opacity = 0; line.style.transition = 'opacity 300ms ease 300ms';
      requestAnimationFrame(() => requestAnimationFrame(() => { rects.forEach(({ r }) => (r.style.transform = 'scaleY(1)')); line.style.opacity = 1; }));
    }

    const tip = h('div.pareto-tip', { hidden: true, role: 'presentation' });
    const live = h('div.sr-only', { 'aria-live': 'polite' });
    let active = null;
    function setActive(i) {
      active = i;
      rects.forEach(({ r, t }, j) => { r.style.opacity = i == null || i === j ? 1 : 0.6; t.setAttribute('fill', i === j ? INK : TICK); });
      dots.forEach((d, j) => d.setAttribute('r', i === j ? 4.5 : 3));
      if (i == null) { hl.setAttribute('opacity', 0); tip.hidden = true; live.textContent = ''; return; }
      const b = bars[i];
      hl.setAttribute('x', plot.x + band * i); hl.setAttribute('opacity', 1);
      tip.innerHTML = '';
      tip.appendChild(h('b', b.full || b.label));
      tip.appendChild(h('div', h('i', { style: { background: b.vital ? BAR : MUTED } }), valueLabel + ' ', h('span', b.value.toLocaleString('th-TH'))));
      tip.appendChild(h('div', h('i', { style: { background: 'transparent' } }), 'สัดส่วน ', h('span', pct(b.share))));
      tip.appendChild(h('div', h('i', { style: { background: INK } }), 'สะสม ', h('span', pct(b.cum))));
      tip.hidden = false;
      const xr = cx(i) / W;
      tip.style.left = (xr * 100) + '%';
      tip.style.top = (toY(b.value) / H * 100) + '%';
      tip.classList.toggle('flip', xr > 0.6);
      live.textContent = `${b.full || b.label} ${b.value} ${valueLabel} ${pct(b.share)} สะสม ${pct(b.cum)}${b.vital ? '' : ' หลังเส้นตัด'}`;
    }
    const pointIndex = (ev) => {
      const r = svg.getBoundingClientRect();
      const x = ((ev.clientX - r.left) / r.width) * W;
      const i = Math.floor((x - plot.x) / band);
      return i >= 0 && i < bars.length ? i : null;
    };
    svg.addEventListener('pointermove', (e) => setActive(pointIndex(e)));
    svg.addEventListener('pointerdown', (e) => setActive(pointIndex(e)));
    svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') setActive(null); });
    svg.addEventListener('blur', () => setActive(null));
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); setActive(active == null ? 0 : Math.min(bars.length - 1, active + 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setActive(active == null ? bars.length - 1 : Math.max(0, active - 1)); }
      else if (e.key === 'Escape') setActive(null);
    });

    box.appendChild(svg); box.appendChild(tip);
    wrap.appendChild(h('div.pareto-scroll', box));
    if (bars.length > 8) wrap.appendChild(h('div.small.muted.pareto-hint', 'เลื่อนกราฟไปทางซ้าย–ขวาเพื่อดูทุกแท่ง'));
    wrap.appendChild(h('div.legend', { 'aria-label': opts.label + ' คำอธิบายสัญลักษณ์' },
      h('span', h('i', { style: { background: BAR } }), 'กลุ่มที่รวมกันได้ถึง ' + pct(cutoff)),
      h('span', h('i', { style: { background: MUTED } }), 'กลุ่มที่เหลือ'),
      h('span', h('i', { style: { background: INK, height: '3px', verticalAlign: '3px' } }), 'ร้อยละสะสม')));
    const table = h('table.sr-only', { id },
      h('caption', opts.label),
      h('thead', h('tr', ['รายการ', valueLabel, 'สัดส่วน', 'สะสม', 'อยู่ในกลุ่ม ' + pct(cutoff)].map((x) => h('th', { scope: 'col' }, x)))),
      h('tbody', bars.map((b) => h('tr', h('th', { scope: 'row' }, b.full || b.label), h('td', b.value), h('td', pct(b.share)), h('td', pct(b.cum)), h('td', b.vital ? 'ใช่' : 'ไม่ใช่')))));
    wrap.appendChild(table);
    wrap.appendChild(live);
    container.appendChild(wrap);
  }

  K.pareto = { render };
})();
