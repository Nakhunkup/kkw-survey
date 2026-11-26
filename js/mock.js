/* หลังบ้านจำลองสำหรับโหมดทดลอง — ใช้รายชื่อสมมติเท่านั้น ไม่มีข้อมูลนักเรียนจริง */
(function () {
  const K = (window.KKW = window.KKW || {});
  const STORE = 'kkw_demo_v2';
  const DEMO_ROOMS = { 3: { 1: 'L_SMTE', 2: 'L_GIFTED', 3: 'L_GOLD', 4: 'L_EP' }, 6: { 1: 'U_SMTE', 2: 'U_PSCI', 3: 'U_GMATH', 4: 'U_PMATH' } };
  const DEMO_USER = 'demo', DEMO_PASS = 'demo';

  let seed = 20570;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const randInt = (a, b) => a + Math.floor(rnd() * (b - a + 1));

  const FIRST_M = ['ธนกร', 'ภูมิพัฒน์', 'กิตติพัศ', 'ณัฐวุฒิ', 'ปัณณวัฒน์', 'ศุภกฤต', 'วรเมธ', 'ชยพล', 'ธีรภัทร', 'พีรพัฒน์', 'อนุวัฒน์', 'กฤตเมธ'];
  const FIRST_F = ['ณัฐธิดา', 'ปุณยวีร์', 'กชกร', 'พิมพ์ชนก', 'ธัญชนก', 'ชนิดา', 'วรินทร', 'ภัทรวดี', 'อรนลิน', 'ศิรประภา', 'ปวริศา', 'กัญญาณัฐ'];
  const LAST = ['ใจดี', 'ศรีสุข', 'บุญมา', 'แก้วประเสริฐ', 'ทองคำ', 'พรหมวงศ์', 'สายสุวรรณ', 'จันทร์เพ็ญ', 'มณีรัตน์', 'วงศ์ไทย', 'ชัยมงคล', 'คำแสน'];

  function demoId(level, room, no) { return String(level) + String(room).padStart(2, '0') + String(no).padStart(2, '0'); }

  function buildRoster() {
    const list = [];
    [3, 6].forEach((level) => {
      for (let room = 1; room <= 4; room++) {
        for (let no = 1; no <= 12; no++) {
          const male = rnd() < 0.45;
          const prefix = level === 3 ? (male ? 'เด็กชาย' : 'เด็กหญิง') : (male ? 'นาย' : 'นางสาว');
          list.push({ level, room, no, id: demoId(level, room, no), name: prefix + pick(male ? FIRST_M : FIRST_F) + ' ' + pick(LAST), male });
        }
      }
    });
    return list;
  }

  // สร้างคำตอบสุ่มที่ถูกต้องตามโครงสร้างแบบสำรวจ (ใช้ทำข้อมูลตัวอย่างและทดสอบ)
  function randomAnswers(survey, male) {
    const S = K.schema;
    const a = {};
    const bias = randInt(0, 5); // ให้แต่ละคนมีด้าน RIASEC เด่นต่างกัน
    S.allQuestions(survey).forEach((q) => {
      if (!S.isVisible(q, a)) return;
      const opts = S.realOptions(q.options);
      switch (q.type) {
        case 'single': {
          let v = randInt(1, opts.length);
          if (q.id === 'q1_2') v = male ? 1 : (rnd() < 0.95 ? 2 : 3);
          if (q.id === 'q2_1' && survey.level === 3) v = rnd() < 0.7 ? 1 : (rnd() < 0.6 ? 2 : 3);
          if (q.id === 'q2_1' && survey.level === 6) v = rnd() < 0.8 ? 1 : randInt(2, 6);
          if (q.id === 'q1_3' && survey.level === 6) v = randInt(1, 14);
          a[q.id] = v;
          const o = opts[v - 1];
          if (o && o.text) a[o.text] = 'ตัวอย่างข้อความ';
          break;
        }
        case 'multi': {
          const n = randInt(1, Math.min(3, opts.length));
          const set = new Set();
          while (set.size < n) set.add(randInt(1, opts.length - (opts[opts.length - 1].text ? 1 : 0)));
          a[q.id] = [...set].sort((x, y) => x - y);
          break;
        }
        case 'rank3': {
          const set = new Set();
          while (set.size < 3) set.add(randInt(1, Math.min(opts.length, survey.level === 3 ? 14 : 28)));
          a[q.id] = [...set];
          break;
        }
        case 'likert': {
          const items = q.items.filter((i) => typeof i === 'string');
          a[q.id] = items.map((_, i) => {
            let base = randInt(2, 5);
            if (q.id === survey.riasecKey && (i % 6) === bias) base = randInt(4, 5);
            return base;
          });
          break;
        }
        case 'matrix': a[q.id] = q.rows.map(() => randInt(1, q.cols.length)); break;
        case 'text': a[q.id] = pick(['แพทย์', 'วิศวกร', 'ครู', 'ยังไม่แน่ใจ', 'นักพัฒนาซอฟต์แวร์', 'พยาบาล', 'นักบัญชี']); break;
        case 'textgroup': q.fields.forEach((f) => { if (!f.optional || rnd() < 0.5) a[f.key] = pick(['มหาวิทยาลัยขอนแก่น', 'จุฬาลงกรณ์มหาวิทยาลัย', 'มหาวิทยาลัยมหิดล', 'มหาวิทยาลัยเชียงใหม่']); }); a.q2_3_fac = pick(['แพทยศาสตร์', 'วิศวกรรมคอมพิวเตอร์', 'พยาบาลศาสตร์', 'นิติศาสตร์']); break;
        case 'longtext': if (rnd() < 0.3) a[q.id] = 'อยากให้มีกิจกรรมแนะแนวเพิ่มขึ้น'; break;
        default: break;
      }
    });
    return a;
  }

  function load() {
    try { const s = JSON.parse(localStorage.getItem(STORE)); if (s && s.students) return s; } catch (e) { /* ใช้ค่าเริ่มต้น */ }
    const students = buildRoster();
    const responses = [];
    students.forEach((s) => {
      if (rnd() < 0.65) {
        const d = new Date(Date.now() - randInt(1, 72) * 3600e3);
        responses.push({ id: s.id, ts: d.toISOString(), answers: randomAnswers(K.schema.byLevel[s.level], s.male) });
      }
    });
    const cippResponses = [];
    students.forEach((s) => {
      const form = DEMO_ROOMS[s.level][s.room];
      if (form && rnd() < 0.6) {
        const n = K.cipp.orderedItems(form).length;
        const base = randInt(3, 4);
        const a = { c_gender: s.male ? 1 : 2, c_items: Array.from({ length: n }, () => Math.max(1, Math.min(5, base + randInt(-1, 1)))) };
        if (s.level === 6) a.c_from = rnd() < 0.7 ? 1 : 2;
        if (a.c_from === 1) a.c_from_room = 'ม.3/' + randInt(1, 20);
        if (rnd() < 0.4) a.c_open1 = pick(['ได้ลงมือทำจริง', 'ครูใส่ใจ', 'กิจกรรมหลากหลาย']);
        if (rnd() < 0.4) a.c_open2 = pick(['เวลาเรียนแน่น', 'อุปกรณ์ไม่พอ', 'การบ้านเยอะ']);
        cippResponses.push({ id: s.id, ts: new Date(Date.now() - randInt(1, 48) * 3600e3).toISOString(), form, answers: a });
      }
    });
    return { students: students.map(({ male, ...s }) => s), responses, open: { 3: true, 6: true }, cippResponses, cippOpen: { 3: true, 6: true } };
  }
  let db = null;
  const getDb = () => (db = db || load());
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(db)); } catch (e) { /* เก็บในหน่วยความจำต่อ */ } };
  let token = null;

  function checkStudent(r) {
    const st = getDb().students.find((s) => s.level === Number(r.level) && s.room === Number(r.room) && s.no === Number(r.no));
    if (!st) throw new Error('ไม่พบรายชื่อนักเรียน');
    if (st.id !== String(r.sid || '').trim()) throw new Error('เลขประจำตัวไม่ตรงกับรายชื่อ');
    return st;
  }
  const admin = (r) => { if (!token || r.token !== token) throw new Error('SESSION_EXPIRED'); };

  const actions = {
    config: () => ({ ok: true, open: getDb().open, cippOpen: getDb().cippOpen }),
    roster: (r) => ({ ok: true, students: getDb().students.filter((s) => s.level === Number(r.level)).map((s) => ({ room: s.room, no: s.no, name: s.name })) }),
    verify: (r) => {
      const st = checkStudent(r);
      const resp = getDb().responses.find((x) => x.id === st.id);
      const cr = getDb().cippResponses.find((x) => x.id === st.id);
      return { ok: true, student: { level: st.level, room: st.room, no: st.no, name: st.name }, submitted: !!resp, response: resp || null, open: getDb().open[st.level],
        cipp: { form: DEMO_ROOMS[st.level][st.room] || '', open: getDb().cippOpen[st.level], submitted: !!cr, response: cr || null } };
    },
    cipp_submit: (r) => {
      const st = checkStudent(r);
      if (!getDb().cippOpen[st.level]) return { ok: false, error: 'ขณะนี้ปิดรับแบบประเมินหลักสูตรของชั้น ม.' + st.level + ' แล้ว' };
      if (getDb().cippResponses.find((x) => x.id === st.id)) return { ok: false, error: 'นักเรียนส่งแบบประเมินหลักสูตรไปแล้ว หากต้องการแก้ไขกรุณาติดต่อครู' };
      const ts = new Date().toISOString(); const form = DEMO_ROOMS[st.level][st.room];
      getDb().cippResponses.push({ id: st.id, ts, form, answers: r.answers }); save();
      return { ok: true, ts, form };
    },
    cipp_set_open: (r) => { admin(r); getDb().cippOpen[Number(r.level)] = !!r.open; save(); return { ok: true, cippOpen: getDb().cippOpen }; },
    cipp_delete: (r) => { admin(r); const d = getDb(); const b = d.cippResponses.length; d.cippResponses = d.cippResponses.filter((x) => x.id !== String(r.id)); save(); return { ok: true, removed: b - d.cippResponses.length }; },
    submit: (r) => {
      const st = checkStudent(r);
      if (!getDb().open[st.level]) return { ok: false, error: 'ขณะนี้ปิดรับคำตอบของชั้น ม.' + st.level + ' แล้ว' };
      if (getDb().responses.find((x) => x.id === st.id)) return { ok: false, error: 'นักเรียนส่งแบบสำรวจไปแล้ว หากต้องการแก้ไขกรุณาติดต่อครู' };
      const ts = new Date().toISOString();
      getDb().responses.push({ id: st.id, ts, answers: r.answers });
      save();
      return { ok: true, ts };
    },
    login: (r) => {
      if (r.username !== DEMO_USER || r.password !== DEMO_PASS) return { ok: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
      token = 'demo-' + Date.now();
      return { ok: true, token };
    },
    admin_data: (r) => { admin(r); const d = getDb(); return { ok: true, students: d.students, responses: d.responses, open: d.open, cippResponses: d.cippResponses, cippOpen: d.cippOpen, roomMap: DEMO_ROOMS }; },
    set_open: (r) => { admin(r); getDb().open[Number(r.level)] = !!r.open; save(); return { ok: true, open: getDb().open }; },
    delete_response: (r) => { admin(r); const d = getDb(); const before = d.responses.length; d.responses = d.responses.filter((x) => x.id !== String(r.id)); save(); return { ok: true, removed: before - d.responses.length }; },
  };

  function handle(body) {
    try {
      const fn = actions[body.action];
      if (!fn) return { ok: false, error: 'ไม่รู้จักคำสั่งนี้' };
      return fn(body);
    } catch (e) { return { ok: false, error: e.message }; }
  }
  function reset() { try { localStorage.removeItem(STORE); } catch (e) { /* ไม่มีที่เก็บ */ } db = null; }

  K.mock = { handle, randomAnswers, reset, demoId, DEMO_USER, DEMO_PASS };
})();
