/* หน้าแอดมิน: แบบประเมินหลักสูตร (CIPP) */
(function () {
  const K = window.KKW;
  const { h, append, clear, toast, modal, confirmDialog, fmtDate } = K.ui;
  const C = K.cipp;
  const CH = K.charts;
  const f2 = (v) => (v == null ? '–' : v.toFixed(2));
  const passCell = (m) => (m == null ? h('td', '–') : h('td', h('span.' + (C.pass(m) ? 'pass-y' : 'pass-n'), C.pass(m) ? 'ผ่าน' : 'ไม่ผ่าน')));
  const levelTier = (lv) => (lv === 3 ? 'lower' : 'upper');

  // api: { st, call, later, scopeStudents, scopeLabel, rerender }
  function render(body, api) {
    const { st } = api;
    st.cippTab = st.cippTab || 'overview';
    const tabs = [['overview', 'ภาพรวมการส่ง'], ['analysis', 'วิเคราะห์รายแผน'], ['compare', 'เปรียบเทียบข้ามแผน'], ['list', 'รายชื่อและคำตอบ']];
    append(body, h('div.tabs', { role: 'tablist' }, tabs.map(([k, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': st.cippTab === k ? 'true' : 'false', onclick: () => { st.cippTab = k; api.rerender(); } }, l))));
    const inner = h('div');
    body.appendChild(inner);
    ({ overview, analysis, compare, list })[st.cippTab](inner, api);
  }

  const formOf = (api, s) => C.formForRoom(s.level, s.room, api.st.data.roomMap);
  const byId = (api) => api.st.cippById;

  // ---------- ภาพรวมการส่ง ----------
  function overview(body, api) {
    const { st } = api;
    const list = api.scopeStudents();
    const sent = list.filter((s) => byId(api).has(s.id)).length;
    const noForm = list.filter((s) => !formOf(api, s)).length;
    append(body, h('div.tiles',
      tile('นักเรียนทั้งหมด', list.length, api.scopeLabel()),
      tile('ส่งแล้ว', sent, CH.pct(sent, list.length) + '% ของทั้งหมด'),
      tile('ยังไม่ส่ง', list.length - sent, noForm ? noForm + ' คนอยู่ในห้องที่ยังไม่กำหนดแผน' : 'คลิกห้องในตารางเพื่อดูรายชื่อ')));
    body.appendChild(h('div.panel', h('div.panel-title', h('h2', 'เปิด–ปิดรับแบบประเมินหลักสูตร')),
      [3, 6].map((lv) => {
        const on = !!st.data.cippOpen[lv];
        return h('div.switch-row',
          h('div', h('b', 'ม.' + lv + (lv === 3 ? '  ฉบับ ม.ต้น (6 แผน)' : '  ฉบับ ม.ปลาย (13 แผน)')), h('div', on ? h('span.badge.open', 'กำลังเปิดรับคำตอบ') : h('span.badge.closed', 'ปิดรับคำตอบ'))),
          h('button.btn' + (on ? '.danger' : ''), {
            type: 'button',
            onclick: async (e) => {
              const ok = await confirmDialog((on ? 'ปิด' : 'เปิด') + 'รับแบบประเมินหลักสูตร ม.' + lv, on ? 'นักเรียนที่ยังไม่ส่งจะส่งไม่ได้จนกว่าจะเปิดอีกครั้ง' : 'นักเรียน ม.' + lv + ' จะเริ่มตอบแบบประเมินหลักสูตรได้ทันที แบบสำรวจศึกษาต่อไม่ได้รับผลกระทบ', on ? 'ปิดรับคำตอบ' : 'เปิดรับคำตอบ', on);
              if (!ok) return;
              e.target.disabled = true;
              try { const r = await api.call('cipp_set_open', { level: lv, open: !on }); st.data.cippOpen = r.cippOpen; toast((r.cippOpen[lv] ? 'เปิด' : 'ปิด') + 'รับแบบประเมินหลักสูตร ม.' + lv + ' แล้ว'); api.rerender(); } catch (err) { toast(err.message); e.target.disabled = false; }
            },
          }, on ? 'ปิดรับคำตอบ' : 'เปิดรับคำตอบ'));
      })));
    const map = new Map();
    list.forEach((s) => {
      const key = 'ม.' + s.level + '/' + s.room;
      if (!map.has(key)) map.set(key, { label: key, level: s.level, room: s.room, form: formOf(api, s), total: 0, sent: 0 });
      const g = map.get(key); g.total++; if (byId(api).has(s.id)) g.sent++;
    });
    const groups = [...map.values()];
    body.appendChild(h('div.panel', { style: { marginTop: '18px', padding: 0, overflow: 'auto' } }, h('table.data-table',
      h('thead', h('tr', h('th', 'ห้อง'), h('th', 'แผนการเรียน (ฉบับ)'), h('th.n', 'ทั้งหมด'), h('th.n', 'ส่งแล้ว'), h('th.n', 'ยังไม่ส่ง'), h('th', 'ความคืบหน้า'))),
      h('tbody', groups.map((g) => {
        const f = g.form && C.form(g.form);
        return h('tr.clickable', { onclick: () => { api.st.level = g.level; api.st.room = g.room; api.st.cippTab = 'list'; api.st.cippStatus = 'wait'; api.rerender(); } },
          h('td', h('b', g.label)), h('td', f ? f.plan + ' (' + f.code + ')' : h('span.pass-n', 'ยังไม่กำหนด')),
          h('td.n', g.total), h('td.n', g.sent), h('td.n', g.total - g.sent),
          h('td', h('div.row', h('div.progress', { style: { flex: 1 } }, h('span', { style: { width: CH.pct(g.sent, g.total) + '%' } })), h('span.small', CH.pct(g.sent, g.total) + '%'))));
      })))));
    body.appendChild(h('p.small.muted', { style: { marginTop: '10px' } }, 'แผนการเรียนของแต่ละห้องแก้ได้ในแผ่นงาน "ห้อง-แผนการเรียน" ของ Google Sheet'));
  }
  function tile(label, value, sub) { return h('div.tile', h('div.t-label', label), h('div.t-value', Number(value).toLocaleString('th-TH')), h('div.t-sub', sub)); }

  // คำตอบในขอบเขตที่เลือก แยกตามฉบับ
  function responsesByForm(api) {
    const out = {};
    api.scopeStudents().forEach((s) => {
      const r = byId(api).get(s.id);
      if (!r) return;
      (out[r.form] = out[r.form] || []).push({ s, r });
    });
    return out;
  }

  // ---------- วิเคราะห์รายแผน ----------
  function analysis(body, api) {
    const { st } = api;
    const groups = responsesByForm(api);
    const scopeForms = [...new Set(api.scopeStudents().map((s) => formOf(api, s)).filter(Boolean))];
    const forms = Object.keys(C.D.forms).filter((k) => scopeForms.includes(k) || groups[k]);
    if (!forms.length) { body.appendChild(h('div.alert', 'ไม่มีแผนการเรียนในขอบเขตที่เลือก')); return; }
    if (!forms.includes(st.cippForm)) st.cippForm = forms.find((k) => groups[k]) || forms[0];
    const sel = h('select.input#formSel', { style: { maxWidth: '520px' }, onchange: (e) => { st.cippForm = e.target.value; api.rerender(); } },
      forms.map((k) => h('option', { value: k, selected: k === st.cippForm }, C.form(k).code + ' ' + C.form(k).plan + ' (' + (C.form(k).tier === 'upper' ? 'ม.ปลาย' : 'ม.ต้น') + ') — ผู้ตอบ ' + (groups[k] || []).length + ' คน')));
    append(body, h('div', { style: { marginBottom: '14px' } }, h('label.field', { for: 'formSel' }, 'แผนการเรียน / ฉบับแบบประเมิน'), sel));
    const f = C.form(st.cippForm);
    const rs = groups[st.cippForm] || [];
    body.appendChild(h('p.muted', f.title + ' ฉบับที่ ' + f.code + ' สำหรับนักเรียน  ผู้ตอบ ', h('b', rs.length + ' คน'), ' (' + api.scopeLabel() + ')'));
    if (!rs.length) { body.appendChild(h('div.alert', 'ยังไม่มีผู้ตอบฉบับนี้ในขอบเขตที่เลือก')); return; }
    const A = C.analyze(st.cippForm, rs.map((x) => x.r.answers || {}));

    const canvas = h('canvas', { role: 'img', 'aria-label': 'ค่าเฉลี่ยรายด้าน' });
    body.appendChild(h('div.chart-card',
      h('h3', 'ผลการประเมินรายด้าน'), h('div.meta', 'เกณฑ์ผ่านรายด้าน: ค่าเฉลี่ย ≥ 3.51 (ระดับมากขึ้นไป)'),
      h('div.chart-box', canvas),
      h('div', { style: { overflowX: 'auto', marginTop: '12px' } }, h('table.data-table',
        h('thead', h('tr', h('th', 'ด้าน'), h('th.n', 'จำนวนข้อ'), h('th.n', 'x̄'), h('th.n', 'S.D.'), h('th', 'ระดับ'), h('th', 'ผลการประเมิน'))),
        h('tbody', A.dims.map((d) => h('tr', h('td', d.label), h('td.n', d.items), h('td.n', f2(d.mean)), h('td.n', f2(d.sd)), h('td', C.interpret(d.mean)), passCell(d.mean))),
          h('tr', h('td', h('b', 'ภาพรวม')), h('td.n', A.items.length), h('td.n', h('b', f2(A.total.mean))), h('td.n', f2(A.total.sd)), h('td', h('b', C.interpret(A.total.mean))), passCell(A.total.mean)))))));
    api.later(() => CH.hbar(canvas, A.dims.map((d) => d.label), A.dims.map((d) => +(d.mean || 0).toFixed(2)), A.n, { max: 5, fmt: (v) => v.toFixed(2) + ' ' + C.interpret(v), wrap: 30 }));

    const c2 = h('canvas', { role: 'img', 'aria-label': 'ค่าเฉลี่ยรายข้อ' });
    const tbody = h('tbody');
    C.DIMS.forEach((dm) => {
      const its = A.items.filter((it) => it.d === dm.d);
      if (!its.length) return;
      const ds = A.dims.find((x) => x.d === dm.d);
      tbody.appendChild(h('tr', h('td', { colspan: 2, style: { background: 'var(--page)', fontWeight: 700 } }, dm.label), h('td.n', { style: { background: 'var(--page)', fontWeight: 700 } }, f2(ds.mean)), h('td', { style: { background: 'var(--page)' } }, f2(ds.sd)), h('td', { style: { background: 'var(--page)', fontWeight: 700 } }, C.interpret(ds.mean)), h('td', { style: { background: 'var(--page)' } })));
      its.forEach((it) => tbody.appendChild(h('tr', h('td.n', it.i + 1), h('td', it.s ? h('span.diamond', '◆ ') : null, it.t), h('td.n', f2(it.mean)), h('td.n', f2(it.sd)), h('td.interp', C.interpret(it.mean)), h('td.small.muted', it.s ? 'เฉพาะแผน' : (it.core ? 'แกนกลาง' : '')))));
    });
    body.appendChild(h('div.chart-card',
      h('h3', 'ผลการประเมินรายข้อ'), h('div.meta', '◆ = ข้อคำถามเฉพาะแผนการเรียน'),
      h('div.chart-box', c2),
      h('div', { style: { overflowX: 'auto', marginTop: '12px' } }, h('table.data-table.mean-table', h('thead', h('tr', h('th.n', 'ข้อ'), h('th', 'รายการประเมิน'), h('th.n', 'x̄'), h('th.n', 'S.D.'), h('th', 'ระดับ'), h('th', 'ประเภท'))), tbody)),
      h('p.small.muted', { style: { marginTop: '6px' } }, 'เกณฑ์แปลผล (บุญชม ศรีสะอาด, 2556): 4.51–5.00 มากที่สุด, 3.51–4.50 มาก, 2.51–3.50 ปานกลาง, 1.51–2.50 น้อย, 1.00–1.50 น้อยที่สุด')));
    api.later(() => CH.hbar(c2, A.items.map((it) => (it.i + 1) + '. ' + (it.s ? '◆ ' : '') + it.t), A.items.map((it) => +(it.mean || 0).toFixed(2)), A.n, { max: 5, fmt: (v) => v.toFixed(2), wrap: 46 }));

    const gender = ['ชาย', 'หญิง', 'ไม่ระบุ'].map((g, i) => rs.filter((x) => (x.r.answers || {}).c_gender === i + 1).length);
    const extra = [h('span', 'เพศ: ' + ['ชาย', 'หญิง', 'ไม่ระบุ'].map((g, i) => g + ' ' + gender[i]).join(', '))];
    if (f.tier === 'upper') {
      const kkw = rs.filter((x) => (x.r.answers || {}).c_from === 1).length;
      extra.push(h('span', '  |  จบ ม.3 จากขอนแก่นวิทยายน ' + kkw + ' คน, โรงเรียนอื่น ' + rs.filter((x) => (x.r.answers || {}).c_from === 2).length + ' คน'));
    }
    body.appendChild(h('div.chart-card', h('h3', 'ข้อมูลทั่วไปของผู้ตอบ'), h('p', extra)));

    body.appendChild(h('div.chart-card', h('h3', 'คำถามปลายเปิด'),
      f.open.map((q, i) => {
        const items = rs.filter((x) => (x.r.answers || {})['c_open' + (i + 1)]).map((x) => ({ s: x.s, t: x.r.answers['c_open' + (i + 1)] }));
        return h('div', { style: { marginTop: '12px' } }, h('div', { style: { fontWeight: 600 } }, (i + 1) + '. ' + q + ' (' + items.length + ' คำตอบ)'),
          items.length ? h('details', { style: { marginTop: '6px' } }, h('summary', { style: { cursor: 'pointer', color: 'var(--navy)', fontWeight: 600 } }, 'ดูคำตอบทั้งหมด'),
            h('div.text-answers', { style: { marginTop: '8px' } }, items.map((x) => h('div', h('small', 'ม.' + x.s.level + '/' + x.s.room + ' เลขที่ ' + x.s.no + '  ' + x.s.name), x.t)))) : h('p.small.muted', 'ยังไม่มีคำตอบ'));
      })));
  }

  // ---------- เปรียบเทียบข้ามแผน ----------
  function compare(body, api) {
    const { st } = api;
    const groups = responsesByForm(api);
    const tiers = st.level === 'all' ? ['lower', 'upper'] : [levelTier(st.level)];
    if (st.room) body.appendChild(h('div.alert.warn', { style: { marginBottom: '12px' } }, 'กำลังกรองเฉพาะห้องเดียว เลือก "ทุกห้อง" เพื่อเปรียบเทียบหลายแผน'));
    tiers.forEach((tier) => {
      const keys = C.keysOfTier(tier).filter((k) => (groups[k] || []).length);
      body.appendChild(h('h2.chart-section-title', tier === 'upper' ? 'ม.ปลาย (ผู้ตอบ ม.6)' : 'ม.ต้น (ผู้ตอบ ม.3)'));
      if (!keys.length) { body.appendChild(h('p.muted', 'ยังไม่มีผู้ตอบ')); return; }
      const an = {}; keys.forEach((k) => { an[k] = C.analyze(k, groups[k].map((x) => x.r.answers || {})); });
      // ตารางรายด้าน
      body.appendChild(h('div.chart-card', h('h3', 'ค่าเฉลี่ยรายด้านของแต่ละแผนการเรียน'), h('div.meta', 'ค่าในช่องสีแดงต่ำกว่าเกณฑ์ผ่าน 3.51'),
        h('div', { style: { overflowX: 'auto' } }, h('table.data-table',
          h('thead', h('tr', h('th', 'แผนการเรียน'), h('th.n', 'ผู้ตอบ'), C.DIMS.map((d) => h('th.n', d.label)), h('th.n', 'ภาพรวม'))),
          h('tbody', keys.map((k) => h('tr', h('td', C.form(k).code + ' ' + C.form(k).plan), h('td.n', an[k].n),
            C.DIMS.map((d) => { const x = an[k].dims.find((y) => y.d === d.d); return meanCell(x && x.mean); }), meanCell(an[k].total.mean))))))));
      // ข้อที่ใช้ถ้อยคำเดียวกันข้ามแผน
      const shared = new Map();
      keys.forEach((k) => an[k].items.forEach((it) => { if (it.k) { if (!shared.has(it.k)) shared.set(it.k, { k: it.k, d: it.d, core: it.core, by: {} }); shared.get(it.k).by[k] = it.mean; } }));
      const rows = [...shared.values()].filter((x) => Object.keys(x.by).length >= 2).sort((a, b) => 'CIPO'.indexOf(a.d) - 'CIPO'.indexOf(b.d));
      if (rows.length) {
        body.appendChild(h('div.chart-card', h('h3', tier === 'upper' ? 'ข้อคำถามแกนกลาง (ถ้อยคำเดียวกันทุกแผน)' : 'ข้อคำถามที่ใช้ถ้อยคำเดียวกันตั้งแต่ 2 แผนขึ้นไป'),
          h('div.meta', 'ช่องว่าง = แผนนั้นไม่มีข้อนี้  {แผน} = ชื่อห้องของแต่ละแผน'),
          h('div.table-scroll', h('table.data-table',
            h('thead', h('tr', h('th', 'ด้าน'), h('th', 'รายการประเมิน'), keys.map((k) => h('th.n', { title: C.form(k).plan }, C.form(k).code)))),
            h('tbody', rows.map((x) => h('tr', h('td', x.d === 'O' ? 'P (ผลผลิต)' : x.d), h('td', x.k), keys.map((k) => (k in x.by ? meanCell(x.by[k]) : h('td', '')))))))),
          h('p.small.muted', { style: { marginTop: '6px' } }, 'รหัสฉบับ: ' + keys.map((k) => C.form(k).code + ' = ' + C.form(k).plan).join(', '))));
      }
      // คู่แผนคู่ขนาน
      C.D.pairs.filter((p) => C.form(p[0]).tier === tier).forEach(([a, b]) => {
        const fa = C.form(a), fb = C.form(b);
        if (!an[a] || !an[b]) { body.appendChild(h('div.chart-card', h('h3', 'คู่ขนาน: ' + fa.plan + ' กับ ' + fb.plan), h('p.muted', 'ต้องมีผู้ตอบทั้งสองแผนจึงจะเปรียบเทียบได้'))); return; }
        const ib = new Map(an[b].items.map((it) => [it.k || it.t, it]));
        const pairRows = an[a].items.map((it) => ({ a: it, b: ib.get(it.k || it.t) })).filter((x) => x.b);
        const onlyA = an[a].items.filter((it) => !ib.has(it.k || it.t) && it.s), onlyB = an[b].items.filter((it) => it.s && !an[a].items.some((x) => (x.k || x.t) === (it.k || it.t)));
        body.appendChild(h('div.chart-card', h('h3', 'คู่ขนาน: ' + fa.plan + ' (' + an[a].n + ' คน) กับ ' + fb.plan + ' (' + an[b].n + ' คน)'),
          h('table.data-table', h('thead', h('tr', h('th', 'ด้าน / ข้อ'), h('th.n', fa.code), h('th.n', fb.code), h('th.n', 'ผลต่าง'))),
            h('tbody',
              C.DIMS.map((d) => { const x = an[a].dims.find((y) => y.d === d.d), y = an[b].dims.find((z) => z.d === d.d); return x && y ? h('tr', h('td', h('b', d.label)), meanCell(x.mean), meanCell(y.mean), h('td.n', diff(x.mean, y.mean))) : null; }),
              pairRows.map((x) => h('tr', h('td', x.a.t), meanCell(x.a.mean), meanCell(x.b.mean), h('td.n', diff(x.a.mean, x.b.mean)))))),
          (onlyA.length || onlyB.length) ? h('details', { style: { marginTop: '10px' } }, h('summary', { style: { cursor: 'pointer', color: 'var(--navy)', fontWeight: 600 } }, 'ข้อเฉพาะแผนที่ถ้อยคำต่างกัน (' + (onlyA.length + onlyB.length) + ' ข้อ)'),
            h('table.data-table', h('tbody', onlyA.map((it) => h('tr', h('td', fa.code), h('td', '◆ ' + it.t), meanCell(it.mean))), onlyB.map((it) => h('tr', h('td', fb.code), h('td', '◆ ' + it.t), meanCell(it.mean)))))) : null));
      });
    });
  }
  function meanCell(m) { return h('td.n', m == null ? '–' : h('span.' + (C.pass(m) ? 'x' : 'pass-n'), m.toFixed(2))); }
  function diff(a, b) { if (a == null || b == null) return '–'; const d = a - b; return (d > 0 ? '+' : '') + d.toFixed(2); }

  // ---------- รายชื่อและคำตอบ ----------
  function list(body, api) {
    const { st } = api;
    const q = h('input.input#clq', { type: 'search', placeholder: 'ค้นหาชื่อ หรือเลขประจำตัว', value: st.cippQuery || '', style: { maxWidth: '320px' } });
    const status = h('select.input#cls', { style: { maxWidth: '200px' } }, [['', 'ทุกสถานะ'], ['sent', 'ส่งแล้ว'], ['wait', 'ยังไม่ส่ง']].map(([v, l]) => h('option', { value: v, selected: (st.cippStatus || '') === v }, l)));
    const holder = h('div');
    function paint() {
      st.cippQuery = q.value; st.cippStatus = status.value;
      const term = q.value.replace(/\s+/g, '');
      const rows = api.scopeStudents().filter((s) => {
        const sent = byId(api).has(s.id);
        if (status.value === 'sent' && !sent) return false;
        if (status.value === 'wait' && sent) return false;
        return !term || s.name.replace(/\s+/g, '').includes(term) || s.id.includes(term);
      }).sort((a, b) => a.level - b.level || a.room - b.room || a.no - b.no);
      clear(holder);
      holder.appendChild(h('p.small.muted', 'แสดง ' + rows.length + ' คน'));
      holder.appendChild(h('div.table-scroll', h('table.data-table',
        h('thead', h('tr', h('th', 'ห้อง'), h('th.n', 'เลขที่'), h('th', 'เลขประจำตัว'), h('th', 'ชื่อ–สกุล'), h('th', 'แผน'), h('th', 'สถานะ'), h('th', 'เวลาที่ส่ง'), h('th', 'จัดการ'))),
        h('tbody', rows.map((s) => {
          const r = byId(api).get(s.id);
          const fk = r ? r.form : formOf(api, s);
          return h('tr', h('td', 'ม.' + s.level + '/' + s.room), h('td.n', s.no), h('td', s.id), h('td', s.name), h('td.small', fk ? C.form(fk).code : '–'),
            h('td', r ? h('span.badge.ok', 'ส่งแล้ว') : h('span.badge.wait', 'ยังไม่ส่ง')), h('td.small', r ? fmtDate(r.ts) : ''),
            h('td', r ? h('div.actions',
              h('button.btn.small.secondary', { type: 'button', onclick: () => view(api, s) }, 'ดูคำตอบ'),
              h('button.btn.small.secondary', { type: 'button', onclick: () => exportOne(s, r) }, 'Excel'),
              h('button.btn.small.danger', { type: 'button', onclick: () => remove(api, s) }, 'ลบคำตอบ')) : ''));
        })))));
    }
    q.addEventListener('input', paint); status.addEventListener('change', paint);
    append(body, h('div.row', { style: { marginBottom: '12px' } }, h('label.sr-only', { for: 'clq' }, 'ค้นหา'), q, h('label.sr-only', { for: 'cls' }, 'สถานะ'), status), holder);
    paint();
  }

  function view(api, s) {
    const r = byId(api).get(s.id);
    const sv = C.survey(r.form);
    const pd = C.personDims(r.form, r.answers || {});
    const m = modal(s.name + '  ม.' + s.level + '/' + s.room + ' เลขที่ ' + s.no, { wide: true });
    append(m.body, h('p.small.muted', 'ฉบับที่ ' + C.form(r.form).code + ' ' + C.form(r.form).plan + '  ส่งเมื่อ ' + fmtDate(r.ts)),
      h('p.small', 'ค่าเฉลี่ยรายด้านของนักเรียนคนนี้: ' + C.DIMS.map((d, i) => d.d + ' ' + f2(pd[i])).join('  ')),
      K.render.renderAnswers(sv, r.answers || {}, s));
    append(m.foot,
      h('button.btn.danger', { type: 'button', onclick: () => { m.close(); remove(api, s); } }, 'ลบคำตอบ'),
      h('button.btn.secondary', { type: 'button', onclick: () => exportOne(s, r) }, 'ดาวน์โหลด Excel'),
      h('button.btn', { type: 'button', onclick: () => m.close() }, 'ปิด'));
  }

  async function remove(api, s) {
    const ok = await confirmDialog('ลบคำตอบแบบประเมินหลักสูตร', h('div',
      h('p', 'ลบคำตอบแบบประเมินหลักสูตรของ ', h('b', s.name), ' (ม.' + s.level + '/' + s.room + ' เลขที่ ' + s.no + ')'),
      h('p', 'คำตอบจะถูกลบออกจาก Google Sheet ถาวร และนักเรียนจะตอบใหม่ได้ แบบสำรวจศึกษาต่อของนักเรียนไม่ถูกลบ แนะนำให้ดาวน์โหลด Excel ของคำตอบเดิมเก็บไว้ก่อน')), 'ลบคำตอบ', true);
    if (!ok) return;
    try {
      await api.call('cipp_delete', { id: s.id });
      byId(api).delete(s.id);
      api.st.data.cippResponses = api.st.data.cippResponses.filter((r) => String(r.id) !== s.id);
      toast('ลบคำตอบแบบประเมินหลักสูตรของ ' + s.name + ' แล้ว');
      api.rerender();
    } catch (e) { toast(e.message); }
  }

  // ---------- Excel ----------
  const stamp = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + 543 + '' + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); };
  const ready = () => { if (window.XLSX) return true; toast('หน้านี้ดาวน์โหลดไฟล์ไม่ได้ กรุณาเปิดจากเว็บไซต์ของโรงเรียน'); return false; };
  const r2 = (v) => (v == null ? '' : Math.round(v * 100) / 100);
  function sheet(rows, widths) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = rows[0].map((x, i) => ({ wch: widths && widths[i] ? widths[i] : Math.min(40, Math.max(8, String(x).length * 0.9)) }));
    return ws;
  }
  function exportAll(api) {
    if (!ready()) return;
    const wb = XLSX.utils.book_new();
    const groups = responsesByForm(api);
    const summary = [['ฉบับ', 'แผนการเรียน', 'ระดับ', 'ผู้ตอบ', ...C.DIMS.flatMap((d) => [d.label + ' x̄', 'S.D.', 'ระดับ', 'ผล']), 'ภาพรวม x̄', 'S.D.', 'ระดับ', 'ผล']];
    Object.keys(C.D.forms).filter((k) => groups[k]).forEach((k) => {
      const f = C.form(k), rs = groups[k].sort((a, b) => a.s.room - b.s.room || a.s.no - b.s.no);
      const items = C.orderedItems(k);
      const A = C.analyze(k, rs.map((x) => x.r.answers || {}));
      summary.push([f.code, f.plan, f.tier === 'upper' ? 'ม.ปลาย' : 'ม.ต้น', A.n, ...C.DIMS.flatMap((d) => { const x = A.dims.find((y) => y.d === d.d); return x ? [r2(x.mean), r2(x.sd), C.interpret(x.mean), C.pass(x.mean) ? 'ผ่าน' : 'ไม่ผ่าน'] : ['', '', '', '']; }), r2(A.total.mean), r2(A.total.sd), C.interpret(A.total.mean), C.pass(A.total.mean) ? 'ผ่าน' : 'ไม่ผ่าน']);
      const head = ['ระดับชั้น', 'ห้อง', 'เลขที่', 'เลขประจำตัว', 'ชื่อ–สกุล', 'เวลาที่ส่ง', 'เพศ'];
      if (f.tier === 'upper') head.push('จบ ม.3 จาก', 'ห้องตอน ม.3');
      items.forEach((it) => head.push((it.d === 'O' ? 'O' : it.d) + (it.i + 1) + (it.s ? ' ◆ ' : ' ') + it.t));
      C.DIMS.forEach((d) => head.push('x̄ ' + d.label));
      f.open.forEach((q, i) => head.push('ปลายเปิด ' + (i + 1) + ' ' + q));
      const rows = rs.map(({ s, r }) => {
        const a = r.answers || {};
        const row = ['ม.' + s.level, s.room, s.no, s.id, s.name, fmtDate(r.ts), ['', 'ชาย', 'หญิง', 'ไม่ระบุ'][a.c_gender] || ''];
        if (f.tier === 'upper') row.push(['', 'ขอนแก่นวิทยายน', 'โรงเรียนอื่น'][a.c_from] || '', a.c_from_room || '');
        items.forEach((it) => row.push((a.c_items || [])[it.i] || ''));
        C.personDims(k, a).forEach((v) => row.push(r2(v)));
        f.open.forEach((q, i) => row.push(a['c_open' + (i + 1)] || ''));
        return row;
      });
      const ws = sheet([head, ...rows], [9, 6, 6, 11, 30, 18, 8]);
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: head.length - 1 } }) };
      XLSX.utils.book_append_sheet(wb, ws, ((f.tier === 'upper' ? 'ปลาย ' : 'ต้น ') + f.code + ' ' + f.plan).replace(/[\\/?*[\]:]/g, '').slice(0, 31));
    });
    XLSX.utils.book_append_sheet(wb, sheet(summary, [8, 34, 8, 8]), 'สรุปรายด้าน');
    wb.SheetNames.unshift(wb.SheetNames.pop());
    const status = api.scopeStudents().sort((a, b) => a.level - b.level || a.room - b.room || a.no - b.no).map((s) => {
      const r = byId(api).get(s.id); const fk = r ? r.form : formOf(api, s);
      return ['ม.' + s.level, s.room, s.no, s.id, s.name, fk ? C.form(fk).plan : '', r ? 'ส่งแล้ว' : 'ยังไม่ส่ง', r ? fmtDate(r.ts) : ''];
    });
    XLSX.utils.book_append_sheet(wb, sheet([['ระดับชั้น', 'ห้อง', 'เลขที่', 'เลขประจำตัว', 'ชื่อ–สกุล', 'แผนการเรียน', 'สถานะ', 'เวลาที่ส่ง'], ...status], [9, 6, 6, 11, 30, 30, 10, 18]), 'สถานะการส่ง');
    XLSX.utils.book_append_sheet(wb, sheet([['คำอธิบาย'], ['ไฟล์ส่งออกแบบประเมินหลักสูตร (CIPP Model) ฉบับนักเรียน โรงเรียนขอนแก่นวิทยายน'], ['ขอบเขต: ' + api.scopeLabel() + '  ส่งออกเมื่อ ' + fmtDate(new Date().toISOString())],
      ['คะแนน 5 = มากที่สุด 4 = มาก 3 = ปานกลาง 2 = น้อย 1 = น้อยที่สุด  ◆ = ข้อคำถามเฉพาะแผนการเรียน'], ['ค่าเฉลี่ยรายด้านในชีตสรุป คำนวณจากคะแนนทุกข้อของทุกคนในด้านนั้น เกณฑ์ผ่านรายด้าน x̄ ≥ 3.51'],
      ['เกณฑ์แปลผล (บุญชม ศรีสะอาด, 2556): 4.51–5.00 มากที่สุด, 3.51–4.50 มาก, 2.51–3.50 ปานกลาง, 1.51–2.50 น้อย, 1.00–1.50 น้อยที่สุด']], [110]), 'คำอธิบาย');
    XLSX.writeFile(wb, 'แบบประเมินหลักสูตร_' + api.scopeLabel().replace(/[\\/:*?"<>|\s]+/g, '_') + '_' + stamp() + '.xlsx');
    toast('กำลังดาวน์โหลดไฟล์ Excel');
  }
  function exportOne(s, r) {
    if (!ready()) return;
    const f = C.form(r.form), sv = C.survey(r.form), a = r.answers || {};
    const rows = [['แบบประเมิน', f.title], ['ฉบับที่', f.code + ' สำหรับนักเรียน'], ['ชื่อ–สกุล', s.name], ['ห้อง', 'ม.' + s.level + '/' + s.room], ['เลขที่', s.no], ['เลขประจำตัว', s.id], ['เวลาที่ส่ง', fmtDate(r.ts)], ['', '']];
    sv.sections.forEach((sec, si) => sec.questions.forEach((q) => { if (q.type !== 'info') rows.push([q.no + ' ' + q.label, K.render.formatAnswer(q, a) || 'ไม่ได้ตอบ']); }));
    rows.push(['', '']);
    C.personDims(r.form, a).forEach((v, i) => rows.push(['ค่าเฉลี่ย' + C.DIMS[i].label, r2(v)]));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet(rows, [60, 90]), 'คำตอบรายบุคคล');
    XLSX.writeFile(wb, 'ประเมินหลักสูตร_ม' + s.level + '-' + s.room + '_เลขที่' + s.no + '_' + s.name.replace(/\s+/g, '_') + '.xlsx');
  }

  K.cippAdmin = { render, exportAll };
})();
