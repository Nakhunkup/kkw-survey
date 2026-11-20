/* กราฟ (Chart.js) — สีผ่านการตรวจความแตกต่างสำหรับผู้มีภาวะตาบอดสีแล้ว */
(function () {
  const K = (window.KKW = window.KKW || {});
  const C = {
    single: '#2f55c4',
    rank: ['#1f3a8a', '#5b7fdb', '#afc3f2'],         // อันดับ 1 เข้มสุด → อันดับ 3 อ่อนสุด
    cat: ['#2f55c4', '#0e8fc7', '#d9488f'],          // ลำดับสีคงที่
    grid: '#e6e9f1', axis: '#59617d', ink: '#1b2140',
  };
  const registry = new WeakMap();

  function base() {
    if (!window.Chart) return;
    Chart.defaults.font.family = "'Sarabun', 'Leelawadee UI', Tahoma, sans-serif";
    Chart.defaults.font.size = 13;
    Chart.defaults.color = C.axis;
    Chart.defaults.animation = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 400 };
    Chart.defaults.plugins.tooltip.backgroundColor = '#1b2140';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.titleFont = { weight: '600' };
  }
  base();

  function make(canvas, cfg) {
    const old = registry.get(canvas); if (old) old.destroy();
    const ch = new Chart(canvas, cfg); registry.set(canvas, ch); return ch;
  }
  const wrapLabel = (s, n = 34) => {
    const out = []; let line = '';
    String(s).split(' ').forEach((w) => { if ((line + ' ' + w).trim().length > n && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); });
    if (line) out.push(line);
    return out.length > 2 ? [out[0], out[1] + '…'] : out;
  };
  const pct = (v, t) => (t ? Math.round((v / t) * 1000) / 10 : 0);

  // แท่งแนวนอนชุดเดียว: labels, counts, total (ฐานคิดร้อยละ)
  function hbar(canvas, labels, counts, total, opts = {}) {
    canvas.parentElement.style.height = Math.max(120, labels.length * (opts.rowH || 40) + 40) + 'px';
    return make(canvas, {
      type: 'bar',
      data: { labels: labels.map((l) => wrapLabel(l, opts.wrap || 40)), datasets: [{ data: counts, backgroundColor: opts.color || C.single, borderRadius: 4, borderSkipped: 'start', barThickness: 16, maxBarThickness: 18 }] },
      options: {
        indexAxis: 'y', maintainAspectRatio: false, responsive: true,
        layout: { padding: { right: 70 } },
        scales: {
          x: { beginAtZero: true, grid: { color: C.grid }, border: { display: false }, ticks: { precision: 0 }, max: opts.max },
          y: { grid: { display: false }, border: { color: C.grid }, ticks: { color: C.ink, autoSkip: false } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: (it) => labels[it[0].dataIndex], label: (it) => opts.fmt ? opts.fmt(it.raw) : it.raw + ' คน (' + pct(it.raw, total) + '%)' } },
        },
      },
      plugins: [valueLabels(opts.fmt ? opts.fmt : (v) => v + ' (' + pct(v, total) + '%)')],
    });
  }

  // แท่งแนวนอนแบบซ้อน: series = [{label, data, color}]
  function stacked(canvas, labels, series, opts = {}) {
    canvas.parentElement.style.height = Math.max(140, labels.length * 40 + 40) + 'px';
    return make(canvas, {
      type: 'bar',
      data: { labels: labels.map((l) => wrapLabel(l, 40)), datasets: series.map((s) => ({ label: s.label, data: s.data, backgroundColor: s.color, borderColor: '#fff', borderWidth: { left: 0, right: 2, top: 0, bottom: 0 }, borderSkipped: false, barThickness: 16 })) },
      options: {
        indexAxis: 'y', maintainAspectRatio: false, responsive: true,
        scales: {
          x: { stacked: true, beginAtZero: true, grid: { color: C.grid }, border: { display: false }, ticks: { precision: 0 }, max: opts.max },
          y: { stacked: true, grid: { display: false }, ticks: { color: C.ink, autoSkip: false } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { mode: 'index', callbacks: { title: (it) => labels[it[0].dataIndex], footer: opts.footer } },
        },
      },
    });
  }

  // แท่งแนวตั้ง (เช่น ร้อยละการส่งรายห้อง)
  function vbar(canvas, labels, values, opts = {}) {
    canvas.parentElement.style.height = (opts.height || 260) + 'px';
    return make(canvas, {
      type: 'bar',
      data: { labels, datasets: [{ data: values, backgroundColor: opts.color || C.single, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 28 }] },
      options: {
        maintainAspectRatio: false, responsive: true,
        scales: { y: { beginAtZero: true, max: opts.max, grid: { color: C.grid }, border: { display: false }, ticks: { callback: opts.yfmt } }, x: { grid: { display: false } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: opts.tip || ((it) => String(it.raw)) } } },
      },
    });
  }

  function radar(canvas, scores) {
    return make(canvas, {
      type: 'radar',
      data: { labels: scores.map((s) => s.code + ' ' + s.th), datasets: [{ data: scores.map((s) => s.score), borderColor: '#1f3a8a', backgroundColor: 'rgba(47,85,196,.18)', borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#1f3a8a', pointBorderColor: '#fff', pointBorderWidth: 2 }] },
      options: {
        maintainAspectRatio: false, responsive: true,
        scales: { r: { min: 0, max: 10, ticks: { stepSize: 2, backdropColor: 'transparent' }, grid: { color: C.grid }, angleLines: { color: C.grid }, pointLabels: { color: C.ink, font: { size: 13, weight: '600' } } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (it) => ' ' + it.raw + ' จาก 10' } } },
      },
    });
  }

  // ป้ายตัวเลขท้ายแท่ง (เฉพาะกราฟแท่งชุดเดียว)
  function valueLabels(fmt) {
    return {
      id: 'valueLabels',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        ctx.save();
        ctx.font = '600 12px Sarabun, Tahoma, sans-serif'; ctx.fillStyle = C.ink; ctx.textBaseline = 'middle';
        meta.data.forEach((bar, i) => { const v = chart.data.datasets[0].data[i]; ctx.fillText(fmt(v), bar.x + 6, bar.y); });
        ctx.restore();
      },
    };
  }

  K.charts = { C, hbar, stacked, vbar, radar, pct };
})();
