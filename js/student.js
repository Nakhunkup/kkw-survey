/* หน้าสำหรับนักเรียน: เลือกชั้น → ค้นหาชื่อ → ยืนยันเลขประจำตัว → ยินยอม → ตอบแบบสำรวจ → ดูผล */
(function () {
  const K = window.KKW;
  const { h, append, clear, toast, modal, confirmDialog, loading, fmtDate } = K.ui;
  const S = K.schema;
  const view = document.getElementById('view');
  const SESSION = 'kkw_student';
  let openState = { 3: false, 6: false };

  function setView(...nodes) { clear(view); append(view, nodes); window.scrollTo(0, 0); const t = view.querySelector('h1, h2'); if (t) { t.tabIndex = -1; t.focus({ preventScroll: true }); } }
  function errBox(e) { return h('div.alert.error', { role: 'alert' }, e.message || String(e)); }
  const session = {
    get() { try { return JSON.parse(sessionStorage.getItem(SESSION)); } catch (e) { return null; } },
    set(v) { try { sessionStorage.setItem(SESSION, JSON.stringify(v)); } catch (e) { /* ไม่มีที่เก็บ */ } },
    clear() { try { sessionStorage.removeItem(SESSION); } catch (e) { /* ไม่มีที่เก็บ */ } },
  };
  const draftKey = (s) => 'kkw_draft_' + s.level + '_' + s.room + '_' + s.no;

  // ---------- หน้าแรก ----------
  async function home() {
    const cards = h('div.levels');
    setView(
      h('div.home-head',
        h('h1', 'แบบสำรวจความต้องการศึกษาต่อ ปีการศึกษา 2570'),
        h('p.muted', 'สำหรับนักเรียนชั้นมัธยมศึกษาปีที่ 3 และ 6 โรงเรียนขอนแก่นวิทยายน เลือกระดับชั้นของนักเรียนเพื่อค้นหาชื่อและเริ่มตอบ')),
      cards,
      h('div.panel.steps-how',
        h('h2', 'ขั้นตอนการตอบ'),
        h('ol',
          h('li', 'เลือกระดับชั้น แล้วค้นหาชื่อ ห้อง หรือเลขที่ของตนเอง'),
          h('li', 'คลิกชื่อของตนเอง แล้วกรอกเลขประจำตัวนักเรียน 5 หลักเพื่อยืนยันตัวตน'),
          h('li', 'อ่านและยินยอมการใช้ข้อมูลส่วนบุคคล แล้วตอบแบบสำรวจทีละตอนจนครบ'),
          h('li', 'กดส่งได้ครั้งเดียว หลังส่งแล้วกลับมาดูคำตอบและผลบุคลิกภาพอาชีพของตนเองได้ทุกเมื่อ')),
        K.demo ? h('p.small.muted', { style: { marginTop: '10px' } }, 'โหมดทดลอง: เลขประจำตัวสมมติ = ระดับชั้น + ห้อง 2 หลัก + เลขที่ 2 หลัก เช่น ม.3/2 เลขที่ 7 คือ 30207') : null));
    append(cards, [3, 6].map((lv) => levelCard(lv, null)));
    try {
      const c = await K.api.req('config');
      openState = c.open;
      clear(cards); append(cards, [3, 6].map((lv) => levelCard(lv, c.open[lv])));
    } catch (e) { cards.after(errBox(e)); }
  }
  function levelCard(level, open) {
    const sv = S.byLevel[level];
    return h('button.level-card', { type: 'button', 'data-level': level, onclick: () => search(level) },
      h('div.lc-top', h('div.lc-grade', 'ม.' + level), open == null ? h('span.badge.wait', 'กำลังตรวจสอบ') : open ? h('span.badge.open', 'เปิดรับคำตอบ') : h('span.badge.closed', 'ปิดรับคำตอบ')),
      h('div.lc-body', h('div.lc-title', sv.short), h('div.muted.small', sv.title)),
      h('div.lc-foot', h('span', 'ค้นหาชื่อของฉัน'), h('span', { 'aria-hidden': 'true' }, '›')));
  }

  // ---------- ค้นหาชื่อ ----------
  async function search(level) {
    const holder = h('div', loading('กำลังโหลดรายชื่อ'));
    setView(
      h('div.row', { style: { marginBottom: '14px' } }, h('button.btn.secondary.small', { type: 'button', onclick: home }, '‹ เปลี่ยนระดับชั้น')),
      h('div.panel', h('div.panel-title', h('h1', { style: { fontSize: '1.4rem' } }, 'ค้นหาชื่อนักเรียน ม.' + level), h('span.muted', S.byLevel[level].short)), holder));
    let roster;
    try { roster = (await K.api.req('roster', { level })).students; } catch (e) { clear(holder).appendChild(errBox(e)); return; }
    const rooms = [...new Set(roster.map((s) => s.room))].sort((a, b) => a - b);
    const q = h('input.input#q', { type: 'search', placeholder: 'พิมพ์ชื่อ หรือนามสกุล', autocomplete: 'off' });
    const room = h('select.input#room', h('option', { value: '' }, 'ทุกห้อง'), rooms.map((r) => h('option', { value: r }, 'ม.' + level + '/' + r)));
    const out = h('div', { 'aria-live': 'polite' });
    const norm = (s) => String(s).replace(/\s+/g, '').replace(/^(เด็กชาย|เด็กหญิง|นางสาว|นาย|นาง)/, '');
    function paint() {
      const term = q.value.trim();
      const t = norm(term);
      const digits = /^\d+$/.test(term);
      let list = roster;
      if (room.value) list = list.filter((s) => s.room === Number(room.value));
      if (t) list = list.filter((s) => digits ? String(s.no) === term : norm(s.name).includes(t) || s.name.replace(/\s+/g, '').includes(term.replace(/\s+/g, '')));
      clear(out);
      if (!room.value && !t) { out.appendChild(h('p.muted', { style: { marginTop: '14px' } }, 'พิมพ์ชื่อหรือเลือกห้องเพื่อแสดงรายชื่อ')); return; }
      if (!list.length) { out.appendChild(h('p', { style: { marginTop: '14px' } }, 'ไม่พบรายชื่อที่ตรงกัน ลองพิมพ์เฉพาะชื่อจริง หรือเลือกห้องแล้วหาจากรายการ ถ้ายังไม่พบให้แจ้งครูที่ปรึกษา')); return; }
      const shown = list.slice(0, 60);
      out.appendChild(h('table.result-table',
        h('thead', h('tr', h('th.num', 'ห้อง'), h('th.num', 'เลขที่'), h('th', 'ชื่อ–สกุล'))),
        h('tbody', shown.map((s) => {
          const go = () => verifyDialog(level, s);
          return h('tr.pick', { onclick: go },
            h('td.num', h('button', { type: 'button', 'aria-label': 'เลือก ' + s.name + ' ม.' + level + '/' + s.room + ' เลขที่ ' + s.no, onclick: (e) => { e.stopPropagation(); go(); } }, 'ม.' + level + '/' + s.room)),
            h('td.num', { style: { padding: '11px 10px' } }, s.no), h('td', { style: { padding: '11px 10px' } }, s.name));
        }))));
      if (list.length > shown.length) out.appendChild(h('p.small.muted', { style: { marginTop: '8px' } }, 'แสดง 60 จาก ' + list.length + ' รายชื่อ พิมพ์ชื่อหรือเลือกห้องเพื่อให้แคบลง'));
    }
    q.addEventListener('input', paint); room.addEventListener('change', paint);
    clear(holder);
    append(holder,
      h('div.search-bar', h('div', h('label.field', { for: 'q' }, 'ชื่อ–สกุล หรือเลขที่'), q), h('div', h('label.field', { for: 'room' }, 'ห้อง'), room)),
      out);
    paint(); q.focus();
  }

  // ---------- ยืนยันตัวตน ----------
  function verifyDialog(level, s) {
    const m = modal('ยืนยันตัวตน');
    const input = h('input.input.code#sid', { inputmode: 'numeric', autocomplete: 'off', maxlength: 5, pattern: '[0-9]*', placeholder: '•••••' });
    const msg = h('div', { 'aria-live': 'assertive' });
    const ok = h('button.btn', { type: 'submit', form: 'vf' }, 'ยืนยัน');
    const form = h('form#vf', {
      onsubmit: async (e) => {
        e.preventDefault();
        const sid = input.value.replace(/\D/g, '');
        if (sid.length !== 5) { clear(msg).appendChild(h('div.alert.error', 'กรุณากรอกเลขประจำตัวนักเรียนให้ครบ 5 หลัก')); input.focus(); return; }
        ok.disabled = true; ok.textContent = 'กำลังตรวจสอบ';
        try {
          const r = await K.api.req('verify', { level, room: s.room, no: s.no, sid });
          const st = Object.assign({}, r.student, { sid });
          session.set(st);
          m.close();
          if (r.submitted) done(st, r.response);
          else if (!r.open) closedView(st);
          else consent(st);
        } catch (err) {
          clear(msg).appendChild(h('div.alert.error', err.message)); ok.disabled = false; ok.textContent = 'ยืนยัน'; input.select();
        }
      },
    },
    h('div.who', h('span.muted', 'ม.' + level + '/' + s.room + ' เลขที่ ' + s.no), h('b', s.name)),
    h('label.field', { for: 'sid' }, 'เลขประจำตัวนักเรียน 5 หลัก'), input,
    h('p.small.muted', { style: { marginTop: '8px' } }, 'ถ้าไม่ใช่ชื่อของนักเรียน กดยกเลิกแล้วเลือกใหม่ ระบบจะล็อกชั่วคราวเมื่อกรอกผิดเกิน 5 ครั้ง'),
    msg);
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 5); });
    append(m.body, form);
    append(m.foot, h('button.btn.secondary', { type: 'button', onclick: () => m.close() }, 'ยกเลิก'), ok);
  }

  function closedView(st) {
    setView(h('div.panel',
      h('h1', { style: { fontSize: '1.4rem' } }, 'ขณะนี้ปิดรับคำตอบของชั้น ม.' + st.level),
      h('div.who', h('span.muted', 'ม.' + st.level + '/' + st.room + ' เลขที่ ' + st.no), h('b', st.name)),
      h('p', 'นักเรียนยังไม่ได้ส่งแบบสำรวจ เมื่อครูเปิดรับคำตอบแล้ว ให้กลับมาค้นหาชื่อและตอบอีกครั้ง'),
      h('button.btn.secondary', { type: 'button', onclick: () => { session.clear(); home(); } }, 'กลับหน้าแรก')));
  }

  // ---------- ความยินยอม PDPA ----------
  function consent(st) {
    const sv = S.byLevel[st.level];
    const chk = h('input#agree', { type: 'checkbox', style: { width: '20px', height: '20px', accentColor: 'var(--navy)' } });
    const go = h('button.btn', { type: 'button', disabled: true, onclick: () => survey(st) }, 'ยินยอมและเริ่มตอบ');
    chk.addEventListener('change', () => (go.disabled = !chk.checked));
    setView(h('div.panel',
      h('div.who', h('span.muted', 'ม.' + st.level + '/' + st.room + ' เลขที่ ' + st.no), h('b', st.name)),
      h('h1', { style: { fontSize: '1.35rem' } }, 'การขอความยินยอมเก็บและใช้ข้อมูลส่วนบุคคล'),
      h('div.consent', { tabindex: 0 },
        h('p', 'โรงเรียนขอนแก่นวิทยายนขอเก็บข้อมูลจาก' + sv.title + ' ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ดังนี้'),
        h('h3', 'ข้อมูลที่เก็บ'),
        h('ul', h('li', 'ชื่อ–สกุล ระดับชั้น ห้อง เลขที่ และเลขประจำตัวนักเรียน'), h('li', 'คำตอบในแบบสำรวจ เช่น เพศ ช่วงเกรดเฉลี่ย แผนการเรียนหรือคณะที่สนใจ ความสนใจด้านอาชีพ และข้อเสนอแนะ')),
        h('h3', 'วัตถุประสงค์'),
        h('ul', h('li', 'วางแผนเปิดห้องเรียนและแผนการเรียนของโรงเรียน'), h('li', 'ให้คำปรึกษาและแนะแนวการศึกษาต่อแก่นักเรียนเป็นรายบุคคล'), h('li', 'วิเคราะห์ผลในภาพรวมระดับห้องและระดับชั้น')),
        h('h3', 'ผู้เข้าถึงข้อมูลและการเก็บรักษา'),
        h('ul', h('li', 'ข้อมูลเก็บในระบบของโรงเรียน เข้าถึงได้เฉพาะครูผู้รับผิดชอบและผู้บริหารโรงเรียน'), h('li', 'จะไม่เปิดเผยข้อมูลรายบุคคลต่อบุคคลภายนอก และจะเก็บไว้เท่าที่จำเป็นต่อวัตถุประสงค์ข้างต้น')),
        h('h3', 'สิทธิของนักเรียน'),
        h('p', 'นักเรียนและผู้ปกครองมีสิทธิขอดู ขอแก้ไข หรือขอลบข้อมูลของตนเองได้ โดยติดต่อครูที่ปรึกษาหรือครูแนะแนว การไม่ยินยอมไม่มีผลต่อผลการเรียนของนักเรียน')),
      h('label.choice', { style: { marginTop: '16px' }, for: 'agree' }, chk, h('span', 'ข้าพเจ้าได้อ่านและเข้าใจข้อความข้างต้น และยินยอมให้โรงเรียนเก็บและใช้ข้อมูลตามวัตถุประสงค์ที่ระบุ')),
      h('div.nav-row', h('button.btn.secondary', { type: 'button', onclick: () => { session.clear(); home(); } }, 'ไม่ยินยอม กลับหน้าแรก'), go)));
  }

  // ---------- ตอบแบบสำรวจ ----------
  function survey(st) {
    const sv = S.byLevel[st.level];
    let answers = {};
    try { answers = JSON.parse(sessionStorage.getItem(draftKey(st))) || {}; } catch (e) { answers = {}; }
    const saveDraft = () => { try { sessionStorage.setItem(draftKey(st), JSON.stringify(answers)); } catch (e) { /* ไม่มีที่เก็บ */ } };
    let idx = 0;
    const secVisible = (i) => !sv.sections[i].showIf || sv.sections[i].showIf(answers);
    const stepper = h('ol.stepper', { 'aria-label': 'ความคืบหน้า' });
    const holder = h('div');
    const prevBtn = h('button.btn.secondary', { type: 'button' }, '‹ ตอนก่อนหน้า');
    const nextBtn = h('button.btn', { type: 'button' });
    let current = null;
    const ctx = { survey: sv, answers, student: st, onChange: () => { saveDraft(); if (current) current._refresh(); paintStepper(); } };

    function paintStepper() {
      clear(stepper);
      sv.sections.forEach((s, i) => {
        const cls = i === idx ? '.current' : !secVisible(i) ? '.skip' : i < idx ? '.done' : '';
        stepper.appendChild(h('li' + cls, { 'aria-current': i === idx ? 'step' : null }, h('div.bar'), h('div.lbl', 'ตอนที่ ' + (i + 1))));
      });
    }
    function show(i) {
      idx = i;
      const sec = sv.sections[i];
      current = K.render.renderSection(sec, ctx);
      clear(holder);
      append(holder, h('div.section-title', h('span.part', 'ตอนที่ ' + (i + 1)), h('h2', { tabindex: -1 }, sec.title)), current);
      prevBtn.hidden = i === 0;
      const last = nextIndex(i) === -1;
      nextBtn.textContent = last ? 'ตรวจทานและส่งแบบสำรวจ' : 'ตอนถัดไป ›';
      paintStepper();
      window.scrollTo(0, 0);
      holder.querySelector('h2').focus({ preventScroll: true });
    }
    function nextIndex(i) { for (let j = i + 1; j < sv.sections.length; j++) if (secVisible(j)) return j; return -1; }
    function prevIndex(i) { for (let j = i - 1; j >= 0; j--) if (secVisible(j)) return j; return -1; }

    prevBtn.addEventListener('click', () => { const p = prevIndex(idx); if (p >= 0) show(p); });
    nextBtn.addEventListener('click', async () => {
      if (!K.render.validateSection(sv.sections[idx], current, answers)) { toast('ยังตอบไม่ครบ กรุณาดูข้อที่มีข้อความสีแดง'); return; }
      const n = nextIndex(idx);
      if (n >= 0) { show(n); return; }
      // ตรวจทุกตอนอีกครั้งก่อนส่ง
      for (let i = 0; i < sv.sections.length; i++) {
        if (!secVisible(i)) continue;
        const bad = sv.sections[i].questions.find((q) => S.isVisible({ ...q, sectionShowIf: sv.sections[i].showIf }, answers) && K.render.validateQuestion(q, answers));
        if (bad) { show(i); setTimeout(() => K.render.validateSection(sv.sections[i], current, answers), 50); toast('ตอนที่ ' + (i + 1) + ' ยังตอบไม่ครบ'); return; }
      }
      const yes = await confirmDialog('ยืนยันการส่งแบบสำรวจ', h('div', h('p', 'เมื่อส่งแล้วจะแก้ไขคำตอบเองไม่ได้ หากต้องการแก้ไขภายหลังต้องติดต่อครูให้ลบคำตอบเดิมก่อน'), h('p.muted', st.name + '  ม.' + st.level + '/' + st.room + ' เลขที่ ' + st.no)), 'ส่งแบบสำรวจ');
      if (!yes) return;
      nextBtn.disabled = true; nextBtn.textContent = 'กำลังส่ง';
      const clean = K.render.cleanAnswers(sv, answers);
      try {
        const r = await K.api.req('submit', { level: st.level, room: st.room, no: st.no, sid: st.sid, answers: clean });
        try { sessionStorage.removeItem(draftKey(st)); } catch (e) { /* ไม่มีที่เก็บ */ }
        done(st, { ts: r.ts, answers: clean }, true);
      } catch (e) {
        nextBtn.disabled = false; nextBtn.textContent = 'ตรวจทานและส่งแบบสำรวจ';
        toast(e.message);
        holder.prepend(errBox(e));
      }
    });

    setView(
      h('div.survey-head', h('p.doc-title', sv.title), h('div.doc-sub', sv.subtitle)),
      h('div.who', h('span.muted', 'ม.' + st.level + '/' + st.room + ' เลขที่ ' + st.no), h('b', st.name)),
      idxIntro(sv),
      stepper,
      h('div.panel', holder, h('div.nav-row', prevBtn, nextBtn)));
    show(0);
  }
  function idxIntro(sv) {
    return h('details.panel', { style: { marginBottom: '16px', padding: '12px 18px' } },
      h('summary', { style: { cursor: 'pointer', fontWeight: 600 } }, 'คำชี้แจง'),
      h('ol', { style: { margin: '10px 0 0' } }, sv.intro.map((t) => h('li', t)), h('li', 'คำตอบจะถูกบันทึกไว้ในเครื่องชั่วคราวระหว่างตอบ ถ้าเผลอปิดหน้า ให้ค้นหาชื่อแล้วยืนยันตัวตนใหม่ คำตอบที่ทำไว้จะยังอยู่ (ถ้าใช้เบราว์เซอร์เดิมและยังไม่ปิดแท็บ)')));
  }

  // ---------- หลังส่ง / ดูย้อนหลัง ----------
  function done(st, response, justSent) {
    const sv = S.byLevel[st.level];
    const A = response.answers || {};
    const panel = h('div.panel');
    const tabs = [['riasec', 'ผลบุคลิกภาพอาชีพ (RIASEC)'], ['answers', 'คำตอบของฉัน']];
    const tabBar = h('div.tabs', { role: 'tablist' });
    function open(key) {
      tabBar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', b.dataset.key === key ? 'true' : 'false'));
      clear(panel);
      if (key === 'riasec') append(panel, h('h2', 'ผลบุคลิกภาพอาชีพของฉัน'), K.render.renderRiasec(sv, A));
      else append(panel, h('h2', 'คำตอบที่ส่งแล้ว'), h('p.muted.small', 'ส่งเมื่อ ' + fmtDate(response.ts) + ' (อ่านอย่างเดียว)'), K.render.renderAnswers(sv, A, st));
    }
    tabs.forEach(([k, label]) => tabBar.appendChild(h('button', { type: 'button', role: 'tab', 'data-key': k, onclick: () => open(k) }, label)));
    setView(
      justSent ? h('div.alert.success', { role: 'status', style: { marginBottom: '16px' } }, 'ส่งแบบสำรวจเรียบร้อยแล้ว ขอบคุณที่ให้ความร่วมมือ') : null,
      h('div.row', { style: { marginBottom: '16px' } },
        h('div.grow', h('div.who', { style: { margin: 0 } }, h('span.muted', 'ม.' + st.level + '/' + st.room + ' เลขที่ ' + st.no + '  ส่งเมื่อ ' + fmtDate(response.ts)), h('b', st.name))),
        h('button.btn.secondary.no-print', { type: 'button', onclick: () => window.print() }, 'พิมพ์ / บันทึก PDF'),
        h('button.btn.secondary.no-print', { type: 'button', onclick: () => { session.clear(); home(); } }, 'ออกจากระบบ')),
      tabBar, panel);
    open('riasec');
  }

  K.ui.chrome({});
  // ถ้ายังอยู่ในแท็บเดิมหลังยืนยันตัวตน ให้กลับไปที่เดิมโดยตรวจสอบกับระบบอีกครั้ง
  (async function start() {
    const st = session.get();
    if (!st) return home();
    setView(loading());
    try {
      const r = await K.api.req('verify', { level: st.level, room: st.room, no: st.no, sid: st.sid });
      if (r.submitted) done(st, r.response); else if (!r.open) closedView(st); else consent(st);
    } catch (e) { session.clear(); home(); }
  })();
})();
