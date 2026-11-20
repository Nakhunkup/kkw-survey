/* ระบบแอดมิน: ติดตามการส่ง วิเคราะห์ผล RIASEC ดู/ลบคำตอบ ดาวน์โหลด Excel */
(function () {
  const K = window.KKW;
  const { h, append, clear, toast, modal, confirmDialog, loading, fmtDate } = K.ui;
  const S = K.schema;
  const CH = K.charts;
  const view = document.getElementById('view');
  const subbar = document.getElementById('subbar');
  const TOKEN = 'kkw_admin_token';

  const st = { token: null, data: null, respById: new Map(), level: 3, room: '', tab: 'overview', listStatus: '', listQuery: '' };
  const tok = {
    get() { try { return sessionStorage.getItem(TOKEN); } catch (e) { return st.token; } },
    set(v) { st.token = v; try { v ? sessionStorage.setItem(TOKEN, v) : sessionStorage.removeItem(TOKEN); } catch (e) { /* ใช้ในหน่วยความจำ */ } },
  };
  let pending = []; // ฟังก์ชันวาดกราฟที่ต้องรอให้ canvas อยู่บนหน้าแล้ว
  const later = (fn) => pending.push(fn);
  function flush() { const p = pending; pending = []; requestAnimationFrame(() => p.forEach((fn) => fn())); }

  async function call(action, data) {
    try { return await K.api.req(action, Object.assign({ token: tok.get() }, data)); }
    catch (e) { if (e.code === 'SESSION_EXPIRED' || e.message === 'SESSION_EXPIRED') { tok.set(null); login('หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง'); } throw e; }
  }

  // ---------- เข้าสู่ระบบ ----------
  function login(note) {
    clear(subbar); subbar.hidden = true;
    const u = h('input.input#u', { autocomplete: 'username', required: true });
    const p = h('input.input#p', { type: 'password', autocomplete: 'current-password', required: true });
    const msg = h('div', { 'aria-live': 'assertive' });
    const btn = h('button.btn', { type: 'submit', style: { width: '100%', marginTop: '18px' } }, 'เข้าสู่ระบบ');
    clear(view);
    append(view, h('div.panel.login-box',
      h('h1', { style: { fontSize: '1.4rem' } }, 'เข้าสู่ระบบสำหรับครู'),
      h('p.muted', 'ดูผลแบบสำรวจ ติดตามการส่ง และดาวน์โหลดไฟล์ Excel'),
      note ? h('div.alert.warn', { style: { marginBottom: '12px' } }, note) : null,
      K.demo ? h('div.alert', { style: { marginBottom: '12px' } }, 'โหมดทดลอง: ชื่อผู้ใช้ ', h('b', K.mock.DEMO_USER), ' รหัสผ่าน ', h('b', K.mock.DEMO_PASS)) : null,
      h('form', {
        onsubmit: async (e) => {
          e.preventDefault();
          btn.disabled = true; btn.textContent = 'กำลังตรวจสอบ'; clear(msg);
          try {
            const r = await K.api.req('login', { username: u.value.trim(), password: p.value });
            tok.set(r.token); p.value = '';
            await loadData(); dashboard();
          } catch (err) {
            msg.appendChild(h('div.alert.error', { style: { marginTop: '12px' } }, err.message));
            btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; p.select();
          }
        },
      }, h('label.field', { for: 'u' }, 'ชื่อผู้ใช้'), u, h('div', { style: { height: '12px' } }), h('label.field', { for: 'p' }, 'รหัสผ่าน'), p, msg, btn)));
    u.focus();
  }

  async function loadData() {
    const d = await call('admin_data');
    st.data = d;
    st.respById = new Map(d.responses.map((r) => [String(r.id), r]));
  }

  // ---------- โครงหน้าหลัก ----------
  function dashboard() {
    subbar.hidden = false;
    clear(subbar);
    append(subbar, h('div.subbar-inner',
      h('span.grow', 'ระบบแอดมิน แบบสำรวจความต้องการศึกษาต่อ'),
      h('button.btn.small.secondary', { type: 'button', onclick: refresh }, 'โหลดข้อมูลล่าสุด'),
      h('button.btn.small.secondary', { type: 'button', onclick: () => { tok.set(null); st.data = null; login(); } }, 'ออกจากระบบ')));
    render();
  }
  async function refresh() {
    clear(view).appendChild(loading('กำลังโหลดข้อมูลล่าสุด'));
    try { await loadData(); render(); toast('อัปเดตข้อมูลแล้ว'); } catch (e) { if (st.token || tok.get()) clear(view).appendChild(h('div.alert.error', e.message)); }
  }

  const scopeStudents = () => st.data.students.filter((s) => (st.level === 'all' || s.level === st.level) && (!st.room || s.room === Number(st.room)));
  const scopeLabel = () => (st.level === 'all' ? 'ทุกระดับชั้น' : 'ม.' + st.level + (st.room ? '/' + st.room : ' ทุกห้อง'));

  function render() {
    pending = [];
    const rooms = st.level === 'all' ? [] : [...new Set(st.data.students.filter((s) => s.level === st.level).map((s) => s.room))].sort((a, b) => a - b);
    if (st.room && !rooms.includes(Number(st.room))) st.room = '';
    const seg = h('div.seg', { role: 'group', 'aria-label': 'ระดับชั้น' }, [[3, 'ม.3'], [6, 'ม.6'], ['all', 'ทุกระดับชั้น']].map(([v, l]) =>
      h('button', { type: 'button', 'aria-pressed': st.level === v ? 'true' : 'false', onclick: () => { st.level = v; st.room = ''; render(); } }, l)));
    const roomSel = h('select.input#roomSel', { style: { minWidth: '160px' }, disabled: st.level === 'all', onchange: (e) => { st.room = e.target.value; render(); } },
      h('option', { value: '' }, st.level === 'all' ? 'ทุกห้อง' : 'ทุกห้อง (ภาพรวมระดับชั้น)'), rooms.map((r) => h('option', { value: r, selected: String(r) === String(st.room) }, 'ม.' + st.level + '/' + r)));
    const tabs = [['overview', 'ภาพรวมการส่ง'], ['analysis', 'วิเคราะห์ผล'], ['riasec', 'RIASEC'], ['list', 'รายชื่อและคำตอบ']];
    const tabBar = h('div.tabs', { role: 'tablist' }, tabs.map(([k, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': st.tab === k ? 'true' : 'false', onclick: () => { st.tab = k; render(); } }, l)));
    const body = h('div');
    clear(view);
    append(view,
      h('div.toolbar',
        h('div.fieldset', h('span', 'ระดับชั้น'), seg),
        h('div.fieldset', h('label', { for: 'roomSel', style: { fontSize: '.85rem', color: 'var(--muted)', fontWeight: 600 } }, 'ห้อง'), roomSel),
        h('div', { style: { flex: 1 } }),
        h('button.btn', { type: 'button', onclick: () => { K.exporter.exportAll(scopeStudents(), st.respById, scopeLabel()); toast('กำลังดาวน์โหลดไฟล์ Excel'); } }, 'ดาวน์โหลด Excel (' + scopeLabel() + ')')),
      tabBar, body);
    ({ overview, analysis, riasec, list })[st.tab](body);
    flush();
  }

  // ---------- แท็บ: ภาพรวมการส่ง ----------
  function overview(body) {
    const list = scopeStudents();
    const sent = list.filter((s) => st.respById.has(s.id)).length;
    append(body, h('div.tiles',
      tile('นักเรียนทั้งหมด', list.length, scopeLabel()),
      tile('ส่งแล้ว', sent, CH.pct(sent, list.length) + '% ของทั้งหมด'),
      tile('ยังไม่ส่ง', list.length - sent, 'คลิกห้องในตารางเพื่อดูรายชื่อ')));

    const sw = h('div.panel', h('div.panel-title', h('h2', 'เปิด–ปิดรับคำตอบ')),
      [3, 6].map((lv) => {
        const on = !!st.data.open[lv];
        return h('div.switch-row',
          h('div', h('b', 'ม.' + lv + '  ' + S.byLevel[lv].short), h('div', on ? h('span.badge.open', 'กำลังเปิดรับคำตอบ') : h('span.badge.closed', 'ปิดรับคำตอบ'))),
          h('button.btn' + (on ? '.danger' : ''), {
            type: 'button',
            onclick: async (e) => {
              const ok = await confirmDialog(on ? 'ปิดรับคำตอบ ม.' + lv : 'เปิดรับคำตอบ ม.' + lv, on ? 'นักเรียน ม.' + lv + ' ที่ยังไม่ส่งจะส่งไม่ได้จนกว่าจะเปิดอีกครั้ง ส่วนคนที่ส่งแล้วยังดูคำตอบของตนเองได้' : 'นักเรียน ม.' + lv + ' จะเริ่มตอบแบบสำรวจได้ทันที', on ? 'ปิดรับคำตอบ' : 'เปิดรับคำตอบ', on);
              if (!ok) return;
              e.target.disabled = true;
              try { const r = await call('set_open', { level: lv, open: !on }); st.data.open = r.open; toast(r.open[lv] ? 'เปิดรับคำตอบ ม.' + lv + ' แล้ว' : 'ปิดรับคำตอบ ม.' + lv + ' แล้ว'); render(); } catch (err) { toast(err.message); e.target.disabled = false; }
            },
          }, on ? 'ปิดรับคำตอบ' : 'เปิดรับคำตอบ'));
      }));
    body.appendChild(sw);

    // ร้อยละการส่งรายห้อง
    const groups = groupRooms(list);
    const canvas = h('canvas', { role: 'img', 'aria-label': 'ร้อยละการส่งแบบสำรวจรายห้อง' });
    body.appendChild(h('div.chart-card', { style: { marginTop: '18px' } },
      h('h3', st.level === 'all' ? 'ร้อยละการส่งแยกตามระดับชั้น' : 'ร้อยละการส่งรายห้อง ม.' + st.level),
      h('div.meta', 'ชี้ที่แท่งเพื่อดูจำนวน'), h('div.chart-box', canvas)));
    later(() => CH.vbar(canvas, groups.map((g) => g.label), groups.map((g) => CH.pct(g.sent, g.total)), { max: 100, yfmt: (v) => v + '%', tip: (it) => { const g = groups[it.dataIndex]; return ' ส่งแล้ว ' + g.sent + ' จาก ' + g.total + ' คน (' + it.raw + '%)'; } }));

    const table = h('table.data-table',
      h('thead', h('tr', h('th', 'ห้อง'), h('th.n', 'ทั้งหมด'), h('th.n', 'ส่งแล้ว'), h('th.n', 'ยังไม่ส่ง'), h('th', 'ความคืบหน้า'), h('th', ''))),
      h('tbody', groups.map((g) => h('tr.clickable', { onclick: () => { if (g.level) { st.level = g.level; st.room = g.room || ''; } st.tab = 'list'; st.listStatus = 'wait'; render(); } },
        h('td', h('b', g.label)), h('td.n', g.total), h('td.n', g.sent), h('td.n', g.total - g.sent),
        h('td', h('div.row', h('div.progress', { style: { flex: 1 } }, h('span', { style: { width: CH.pct(g.sent, g.total) + '%' } })), h('span.small', CH.pct(g.sent, g.total) + '%'))),
        h('td', h('button.btn.small.secondary', { type: 'button' }, 'ดูคนที่ยังไม่ส่ง'))))));
    body.appendChild(h('div.panel', { style: { marginTop: '18px', padding: 0, overflow: 'hidden' } }, table));
  }
  function tile(label, value, sub) { return h('div.tile', h('div.t-label', label), h('div.t-value', value.toLocaleString('th-TH')), h('div.t-sub', sub)); }
  function groupRooms(list) {
    const map = new Map();
    list.forEach((s) => {
      const key = st.level === 'all' ? 'ม.' + s.level : 'ม.' + s.level + '/' + s.room;
      if (!map.has(key)) map.set(key, { label: key, level: s.level, room: st.level === 'all' ? '' : s.room, total: 0, sent: 0 });
      const g = map.get(key); g.total++; if (st.respById.has(s.id)) g.sent++;
    });
    return [...map.values()];
  }

  // ---------- แท็บ: วิเคราะห์ผล ----------
  function respondents(level) {
    return scopeStudents().filter((s) => (level == null || s.level === level) && st.respById.has(s.id)).map((s) => ({ s, A: st.respById.get(s.id).answers || {} }));
  }
  function analysis(body) {
    if (st.level === 'all') return analysisAll(body);
    const sv = S.byLevel[st.level];
    const rs = respondents(st.level);
    append(body, h('p.muted', 'วิเคราะห์จากผู้ตอบ ', h('b', rs.length + ' คน'), ' (' + scopeLabel() + ') ทุกกราฟคิดร้อยละจากจำนวนผู้ที่ตอบข้อนั้น'));
    if (!rs.length) { body.appendChild(h('div.alert', 'ยังไม่มีผู้ตอบในขอบเขตที่เลือก')); return; }
    sv.sections.forEach((sec, si) => {
      body.appendChild(h('h2.chart-section-title', 'ตอนที่ ' + (si + 1) + '  ' + sec.title));
      sec.questions.forEach((q) => { const card = questionCard(q, rs); if (card) body.appendChild(card); });
    });
  }
  function analysisAll(body) {
    const r3 = respondents(3), r6 = respondents(6), all = r3.concat(r6);
    append(body, h('p.muted', 'ภาพรวมทุกระดับชั้น เฉพาะข้อที่มีเหมือนกันทั้ง ม.3 และ ม.6 (ผู้ตอบ ม.3 ', h('b', r3.length), ' คน, ม.6 ', h('b', r6.length), ' คน) ข้ออื่นให้เลือกดูทีละระดับชั้น'));
    if (!all.length) { body.appendChild(h('div.alert', 'ยังไม่มีผู้ตอบ')); return; }
    const g = S.M3.sections[0].questions[1];
    body.appendChild(questionCard(g, all));
    const gp3 = S.M3.sections[0].questions[2], gp6 = S.M6.sections[0].questions[3];
    const merged = all.map(({ s, A }) => ({ s, A: { gp: s.level === 3 ? A[gp3.id] : A[gp6.id] } }));
    body.appendChild(questionCard({ ...gp3, id: 'gp', no: 'GPAX', label: 'ช่วงเกรดเฉลี่ยสะสม (ม.3 ข้อ 1.3, ม.6 ข้อ 1.4)' }, merged));
    const rmerged = all.map(({ s, A }) => ({ s, A: { rq: A[S.byLevel[s.level].riasecKey] } }));
    body.appendChild(questionCard({ ...S.M3.sections[2].questions[0], id: 'rq', no: 'RIASEC', label: 'ความสนใจเชิงอาชีพ (ม.3 ข้อ 3.1, ม.6 ข้อ 4.1)' }, rmerged));
  }

  function questionCard(q, rs) {
    if (q.type === 'info') return null;
    const seen = rs.filter(({ A }) => answered(q, A));
    const n = seen.length;
    const card = h('div.chart-card', h('h3', h('span.no', q.no), q.label), h('div.meta', 'ผู้ตอบข้อนี้ ' + n + ' คน'));
    if (!n) { card.appendChild(h('p.muted', 'ไม่มีผู้ตอบข้อนี้ในขอบเขตที่เลือก (อาจถูกข้ามตามเงื่อนไข)')); return card; }
    const opts = q.options ? S.realOptions(q.options) : [];
    const canvas = h('canvas', { role: 'img', 'aria-label': 'กราฟข้อ ' + q.no });
    const box = h('div.chart-box', canvas);
    switch (q.type) {
      case 'single': case 'multi': {
        const counts = opts.map((o) => seen.filter(({ A }) => (q.type === 'single' ? A[q.id] === o.value : (A[q.id] || []).includes(o.value))).length);
        card.appendChild(box);
        later(() => CH.hbar(canvas, opts.map((o) => o.label), counts, n));
        const others = opts.filter((o) => o.text);
        others.forEach((o) => {
          const texts = seen.filter(({ A }) => A[o.text]).map(({ s, A }) => ({ s, t: A[o.text] }));
          if (texts.length) card.appendChild(textList('คำตอบที่ระบุใน "' + o.label + '"', texts));
        });
        if (q.type === 'multi') card.querySelector('.meta').textContent += ' (เลือกได้หลายข้อ ร้อยละรวมจึงเกิน 100)';
        break;
      }
      case 'rank3': {
        const rows = opts.map((o) => {
          const c = [0, 1, 2].map((i) => seen.filter(({ A }) => (A[q.id] || [])[i] === o.value).length);
          return { label: o.label, c, w: c[0] * 3 + c[1] * 2 + c[2] };
        }).filter((r) => r.w > 0).sort((a, b) => b.w - a.w);
        card.querySelector('.meta').textContent += ' เรียงตามคะแนนถ่วงน้ำหนัก (อันดับ 1 = 3, อันดับ 2 = 2, อันดับ 3 = 1)';
        card.appendChild(h('div.legend', ['อันดับ 1', 'อันดับ 2', 'อันดับ 3'].map((l, i) => h('span', h('i', { style: { background: CH.C.rank[i] } }), l))));
        card.appendChild(box);
        later(() => CH.stacked(canvas, rows.map((r) => r.label), [0, 1, 2].map((i) => ({ label: 'อันดับ ' + (i + 1), data: rows.map((r) => r.c[i]), color: CH.C.rank[i] })),
          { footer: (it) => 'คะแนนถ่วงน้ำหนัก ' + rows[it[0].dataIndex].w }));
        break;
      }
      case 'likert': {
        const items = q.items;
        const stats = []; let idx = 0; let group = '';
        items.forEach((it) => {
          if (typeof it !== 'string') { group = it.group; return; }
          const i = idx++;
          const vals = seen.map(({ A }) => Number((A[q.id] || [])[i])).filter((v) => v >= 1 && v <= 5);
          const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
          const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, vals.length - 1));
          stats.push({ i, label: it, group, mean, sd, n: vals.length });
        });
        card.appendChild(box);
        later(() => CH.hbar(canvas, stats.map((s) => (s.i + 1) + '. ' + s.label), stats.map((s) => +s.mean.toFixed(2)), n, { max: 5, fmt: (v) => v.toFixed(2) + ' ' + S.interpret(v), wrap: 46 }));
        const groups = [...new Set(stats.map((s) => s.group))];
        const tbody = h('tbody');
        groups.forEach((g) => {
          const gs = stats.filter((s) => s.group === g);
          if (g) {
            const gm = gs.reduce((a, s) => a + s.mean, 0) / gs.length;
            tbody.appendChild(h('tr', h('td', { colspan: 2, style: { background: 'var(--page)', fontWeight: 700 } }, g), h('td.n', { style: { background: 'var(--page)', fontWeight: 700 } }, gm.toFixed(2)), h('td', { style: { background: 'var(--page)' } }), h('td', { style: { background: 'var(--page)', fontWeight: 700 } }, S.interpret(gm))));
          }
          gs.forEach((s) => tbody.appendChild(h('tr', h('td.n', s.i + 1), h('td', s.label), h('td.n', s.mean.toFixed(2)), h('td.n', s.sd.toFixed(2)), h('td.interp', S.interpret(s.mean)))));
        });
        const all = stats.reduce((a, s) => a + s.mean, 0) / stats.length;
        tbody.appendChild(h('tr', h('td'), h('td', h('b', 'ภาพรวม')), h('td.n', h('b', all.toFixed(2))), h('td'), h('td.interp', h('b', S.interpret(all)))));
        card.appendChild(h('details', { style: { marginTop: '12px' } }, h('summary', { style: { cursor: 'pointer', fontWeight: 600, color: 'var(--navy)' } }, 'ตารางค่าเฉลี่ย ส่วนเบี่ยงเบนมาตรฐาน และการแปลผล'),
          h('div', { style: { overflowX: 'auto', marginTop: '8px' } }, h('table.data-table.mean-table', h('thead', h('tr', h('th.n', 'ข้อ'), h('th', 'ข้อความ'), h('th.n', 'ค่าเฉลี่ย'), h('th.n', 'S.D.'), h('th', 'แปลผล'))), tbody)),
          h('p.small.muted', { style: { marginTop: '6px' } }, 'เกณฑ์แปลผล: 4.51–5.00 มากที่สุด, 3.51–4.50 มาก, 2.51–3.50 ปานกลาง, 1.51–2.50 น้อย, 1.00–1.50 น้อยที่สุด')));
        break;
      }
      case 'matrix': {
        card.appendChild(h('div.legend', q.cols.map((c, i) => h('span', h('i', { style: { background: CH.C.cat[i] } }), c))));
        card.appendChild(box);
        later(() => CH.stacked(canvas, q.rows, q.cols.map((c, k) => ({ label: c, data: q.rows.map((_, i) => seen.filter(({ A }) => (A[q.id] || [])[i] === k + 1).length), color: CH.C.cat[k] }))));
        break;
      }
      case 'text': case 'longtext':
        card.appendChild(textList(null, seen.map(({ s, A }) => ({ s, t: A[q.id] }))));
        break;
      case 'textgroup':
        q.fields.forEach((f) => { const t = seen.filter(({ A }) => A[f.key]).map(({ s, A }) => ({ s, t: A[f.key] })); if (t.length) card.appendChild(textList(f.label, t)); });
        break;
      default: break;
    }
    return card;
  }
  function answered(q, A) {
    if (q.type === 'textgroup') return q.fields.some((f) => A[f.key]);
    const v = A[q.id];
    return v != null && v !== '' && !(Array.isArray(v) && !v.length);
  }
  function textList(title, items) {
    // รวมคำตอบที่เหมือนกันและนับจำนวน
    const counts = new Map();
    items.forEach(({ t }) => { const k = String(t).trim(); counts.set(k, (counts.get(k) || 0) + 1); });
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return h('div', { style: { marginTop: '10px' } },
      title ? h('div', { style: { fontWeight: 600, margin: '6px 0' } }, title) : null,
      h('div.small.muted', { style: { marginBottom: '6px' } }, 'คำตอบที่พบบ่อย: ' + top.map(([k, c]) => k + ' (' + c + ')').join(', ')),
      h('details', h('summary', { style: { cursor: 'pointer', color: 'var(--navy)', fontWeight: 600 } }, 'ดูคำตอบทั้งหมด ' + items.length + ' รายการ'),
        h('div.text-answers', { style: { marginTop: '8px' } }, items.map(({ s, t }) => h('div', h('small', 'ม.' + s.level + '/' + s.room + ' เลขที่ ' + s.no + '  ' + s.name), t)))));
  }

  // ---------- แท็บ: RIASEC ----------
  function riasec(body) {
    const rs = respondents(null).map(({ s, A }) => ({ s, sc: S.riasecScores(A[S.byLevel[s.level].riasecKey]) })).filter((x) => x.sc);
    append(body, h('p.muted', 'ผล RIASEC ของผู้ตอบ ', h('b', rs.length + ' คน'), ' (' + scopeLabel() + ') คำนวณจาก ม.3 ข้อ 3.1 และ ม.6 ข้อ 4.1 แต่ละด้านรวม 2 ข้อ คะแนน 2–10'));
    if (!rs.length) { body.appendChild(h('div.alert', 'ยังไม่มีผู้ตอบในขอบเขตที่เลือก')); return; }
    const dom = S.RIASEC.map((t) => rs.filter((x) => S.riasecCode(x.sc)[0] === t.code).length);
    const avg = S.RIASEC.map((t, i) => +(rs.reduce((a, x) => a + x.sc[i].score, 0) / rs.length).toFixed(2));
    const c1 = h('canvas', { role: 'img', 'aria-label': 'จำนวนนักเรียนตามด้านที่เด่นที่สุด' });
    const c2 = h('canvas', { role: 'img', 'aria-label': 'คะแนนเฉลี่ยแต่ละด้าน' });
    const labels = S.RIASEC.map((t) => t.code + ' ' + t.th + ' (' + t.en + ')');
    body.appendChild(h('div.grid-2',
      h('div.chart-card', h('h3', 'ด้านที่เด่นที่สุดของนักเรียน'), h('div.meta', 'นับจากตัวอักษรตัวแรกของรหัส RIASEC ของแต่ละคน'), h('div.chart-box', c1)),
      h('div.chart-card', h('h3', 'คะแนนเฉลี่ยแต่ละด้าน'), h('div.meta', 'เต็ม 10 คะแนน'), h('div.chart-box', c2))));
    later(() => CH.hbar(c1, labels, dom, rs.length, { wrap: 30 }));
    later(() => CH.hbar(c2, labels, avg, rs.length, { max: 10, fmt: (v) => v.toFixed(2), wrap: 30 }));
    body.appendChild(h('div.chart-card', { style: { marginTop: '16px' } },
      h('h3', 'ด้านที่สอดคล้องกับแผนการเรียน / คณะ (แนวทาง)'),
      h('table.data-table', h('thead', h('tr', h('th', 'แบบ'), h('th', 'ลักษณะ'), h('th', 'ม.3: แผนการเรียนที่มักสอดคล้อง'), h('th', 'ม.6: คณะที่มักสอดคล้อง'))),
        h('tbody', S.RIASEC.map((t) => h('tr', h('td', h('b', t.code), ' ' + t.en), h('td', t.desc), h('td', t.m3), h('td', t.m6)))))));
    const sorted = rs.slice().sort((a, b) => a.s.level - b.s.level || a.s.room - b.s.room || a.s.no - b.s.no);
    body.appendChild(h('div.chart-card', { style: { marginTop: '16px' } }, h('h3', 'ผลรายบุคคล'),
      h('div.table-scroll', h('table.data-table',
        h('thead', h('tr', h('th', 'ห้อง'), h('th.n', 'เลขที่'), h('th', 'ชื่อ–สกุล'), S.RIASEC.map((t) => h('th.n', t.code)), h('th', 'รหัส'))),
        h('tbody', sorted.map((x) => h('tr.clickable', { onclick: () => viewStudent(x.s) },
          h('td', 'ม.' + x.s.level + '/' + x.s.room), h('td.n', x.s.no), h('td', x.s.name), x.sc.map((v) => h('td.n', v.score)), h('td', h('b', S.riasecCode(x.sc))))))))));
  }

  // ---------- แท็บ: รายชื่อและคำตอบ ----------
  function list(body) {
    const q = h('input.input#lq', { type: 'search', placeholder: 'ค้นหาชื่อ หรือเลขประจำตัว', value: st.listQuery, style: { maxWidth: '320px' } });
    const status = h('select.input#ls', { style: { maxWidth: '200px' } }, [['', 'ทุกสถานะ'], ['sent', 'ส่งแล้ว'], ['wait', 'ยังไม่ส่ง']].map(([v, l]) => h('option', { value: v, selected: st.listStatus === v }, l)));
    const holder = h('div');
    function paint() {
      st.listQuery = q.value; st.listStatus = status.value;
      const term = q.value.replace(/\s+/g, '');
      const rows = scopeStudents().filter((s) => {
        const sent = st.respById.has(s.id);
        if (status.value === 'sent' && !sent) return false;
        if (status.value === 'wait' && sent) return false;
        return !term || s.name.replace(/\s+/g, '').includes(term) || s.id.includes(term);
      }).sort((a, b) => a.level - b.level || a.room - b.room || a.no - b.no);
      clear(holder);
      holder.appendChild(h('p.small.muted', 'แสดง ' + rows.length + ' คน'));
      holder.appendChild(h('div.table-scroll', h('table.data-table',
        h('thead', h('tr', h('th', 'ห้อง'), h('th.n', 'เลขที่'), h('th', 'เลขประจำตัว'), h('th', 'ชื่อ–สกุล'), h('th', 'สถานะ'), h('th', 'เวลาที่ส่ง'), h('th', 'จัดการ'))),
        h('tbody', rows.map((s) => {
          const r = st.respById.get(s.id);
          return h('tr',
            h('td', 'ม.' + s.level + '/' + s.room), h('td.n', s.no), h('td', s.id), h('td', s.name),
            h('td', r ? h('span.badge.ok', 'ส่งแล้ว') : h('span.badge.wait', 'ยังไม่ส่ง')),
            h('td.small', r ? fmtDate(r.ts) : ''),
            h('td', r ? h('div.actions',
              h('button.btn.small.secondary', { type: 'button', onclick: () => viewStudent(s) }, 'ดูคำตอบ'),
              h('button.btn.small.secondary', { type: 'button', onclick: () => K.exporter.exportOne(s, r) }, 'Excel'),
              h('button.btn.small.danger', { type: 'button', onclick: () => removeResponse(s) }, 'ลบคำตอบ')) : ''));
        })))));
    }
    q.addEventListener('input', paint); status.addEventListener('change', paint);
    append(body, h('div.row', { style: { marginBottom: '12px' } }, h('label.sr-only', { for: 'lq' }, 'ค้นหา'), q, h('label.sr-only', { for: 'ls' }, 'สถานะ'), status), holder);
    paint();
  }

  function viewStudent(s) {
    const r = st.respById.get(s.id);
    if (!r) return;
    const sv = S.byLevel[s.level];
    const m = modal(s.name + '  ม.' + s.level + '/' + s.room + ' เลขที่ ' + s.no, { wide: true });
    const panel = h('div');
    const tabs = h('div.tabs', { role: 'tablist' });
    const open = (k) => {
      tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', b.dataset.k === k ? 'true' : 'false'));
      clear(panel).appendChild(k === 'a' ? K.render.renderAnswers(sv, r.answers || {}, s) : K.render.renderRiasec(sv, r.answers || {}));
    };
    [['a', 'คำตอบ'], ['r', 'ผล RIASEC']].forEach(([k, l]) => tabs.appendChild(h('button', { type: 'button', role: 'tab', 'data-k': k, onclick: () => open(k) }, l)));
    append(m.body, h('p.small.muted', 'เลขประจำตัว ' + s.id + '  ส่งเมื่อ ' + fmtDate(r.ts)), tabs, panel);
    append(m.foot,
      h('button.btn.danger', { type: 'button', onclick: () => { m.close(); removeResponse(s); } }, 'ลบคำตอบ'),
      h('button.btn.secondary', { type: 'button', onclick: () => K.exporter.exportOne(s, r) }, 'ดาวน์โหลด Excel'),
      h('button.btn', { type: 'button', onclick: () => m.close() }, 'ปิด'));
    open('a');
  }

  async function removeResponse(s) {
    const ok = await confirmDialog('ลบคำตอบของนักเรียน', h('div',
      h('p', 'ลบคำตอบของ ', h('b', s.name), ' (ม.' + s.level + '/' + s.room + ' เลขที่ ' + s.no + ')'),
      h('p', 'คำตอบจะถูกลบออกจาก Google Sheet ถาวร และนักเรียนจะตอบแบบสำรวจใหม่ได้อีกครั้ง (ใช้กรณีนักเรียนขอแก้ไขคำตอบ) แนะนำให้ดาวน์โหลด Excel ของคำตอบเดิมเก็บไว้ก่อน')), 'ลบคำตอบ', true);
    if (!ok) return;
    try {
      await call('delete_response', { id: s.id });
      st.respById.delete(s.id);
      st.data.responses = st.data.responses.filter((r) => String(r.id) !== s.id);
      toast('ลบคำตอบของ ' + s.name + ' แล้ว นักเรียนตอบใหม่ได้');
      render();
    } catch (e) { toast(e.message); }
  }

  // ---------- เริ่มต้น ----------
  K.ui.chrome({});
  (async function start() {
    if (!tok.get()) return login();
    clear(view).appendChild(loading());
    try { await loadData(); dashboard(); } catch (e) { if (tok.get()) login(e.message); }
  })();
})();
