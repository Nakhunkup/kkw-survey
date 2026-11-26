/* แบบประเมินหลักสูตร (CIPP Model) ฉบับนักเรียน: สร้างโครงสร้างแบบสอบถามจาก cipp-data.js และคำนวณสถิติ */
(function () {
  const K = window.KKW;
  const D = K.cippData;
  const DIMS = [
    { d: 'C', th: 'ด้านบริบท', label: 'ด้านบริบท (C)' },
    { d: 'I', th: 'ด้านปัจจัยนำเข้า', label: 'ด้านปัจจัยนำเข้า (I)' },
    { d: 'P', th: 'ด้านกระบวนการ', label: 'ด้านกระบวนการ (P)' },
    { d: 'O', th: 'ด้านผลผลิต', label: 'ด้านผลผลิต (P)' },
  ];
  const PASS = 3.51;
  const cache = {};

  function form(key) { return D.forms[key] || null; }
  function formForRoom(level, room, map) { return ((map || D.rooms)[level] || {})[room] || ''; }
  const shortPlan = (f) => f.plan;

  // โครงสร้างแบบสอบถามที่ K.render ใช้แสดงผลได้ทันที
  function survey(key) {
    if (cache[key]) return cache[key];
    const f = form(key);
    if (!f) return null;
    const upper = f.tier === 'upper';
    const items = [];
    DIMS.forEach((dm) => {
      const list = f.items.filter((it) => it.d === dm.d);
      if (!list.length) return;
      items.push({ group: dm.label });
      list.forEach((it) => items.push((it.s ? '◆ ' : '') + it.t));
    });
    const part1 = [
      { id: 'c_gender', no: '1.1', type: 'single', label: 'เพศ', options: ['ชาย', 'หญิง', 'ไม่ระบุ'] },
      { id: 'c_class', no: '1.2', type: 'info', label: 'ระดับชั้น', field: 'room' },
    ];
    if (upper) {
      part1.push({ id: 'c_from', no: '1.3', type: 'single', label: 'จบ ม.3 จาก', options: [{ label: 'โรงเรียนขอนแก่นวิทยายน', text: 'c_from_room', placeholder: 'ระบุห้องตอน ม.3 เช่น ม.3/5' }, 'โรงเรียนอื่น'] });
    }
    const sv = {
      key, level: upper ? 6 : 3, cipp: true,
      title: f.title, subtitle: 'ฉบับที่ ' + f.code + ' สำหรับนักเรียน',
      short: 'ประเมินหลักสูตร ' + f.plan,
      plan: f.plan,
      intro: [f.intro].concat(f.focus ? ['จุดเน้นของหลักสูตร: ' + f.focus] : []),
      sections: [
        { title: 'ข้อมูลทั่วไป', questions: part1 },
        { title: 'ความคิดเห็นต่อหลักสูตร', questions: [{ id: 'c_items', no: '2', type: 'likert', label: 'ข้อความต่อไปนี้ตรงกับความคิดเห็นของนักเรียนมากน้อยเพียงใด', hint: '5 = มากที่สุด  4 = มาก  3 = ปานกลาง  2 = น้อย  1 = น้อยที่สุด   ◆ = ข้อคำถามเฉพาะแผนการเรียน', items }] },
        { title: 'คำถามปลายเปิด', questions: f.open.map((t, i) => ({ id: 'c_open' + (i + 1), no: '3.' + (i + 1), type: 'longtext', optional: true, label: t, hint: 'ไม่บังคับตอบ' })) },
      ],
    };
    cache[key] = sv;
    return sv;
  }

  // รายการข้อตามลำดับที่เก็บใน c_items (ลำดับเดียวกับแบบสอบถาม)
  function orderedItems(key) {
    const f = form(key);
    const out = [];
    DIMS.forEach((dm) => f.items.filter((it) => it.d === dm.d).forEach((it) => out.push(it)));
    return out.map((it, i) => ({ ...it, i }));
  }

  function stat(vals) {
    const v = vals.filter((x) => x >= 1 && x <= 5);
    const n = v.length;
    if (!n) return { n: 0, mean: null, sd: null };
    const mean = v.reduce((a, b) => a + b, 0) / n;
    const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
    return { n, mean, sd };
  }
  const interpret = (m) => K.schema.interpret(m);
  const pass = (m) => m != null && m >= PASS;

  // answersList: [answers] ของฉบับเดียวกัน
  function analyze(key, answersList) {
    const items = orderedItems(key);
    const rows = answersList.map((a) => (Array.isArray(a.c_items) ? a.c_items.map(Number) : []));
    const itemStats = items.map((it) => ({ ...it, ...stat(rows.map((r) => r[it.i])) }));
    const dims = DIMS.map((dm) => {
      const its = items.filter((it) => it.d === dm.d);
      const vals = [];
      rows.forEach((r) => its.forEach((it) => vals.push(r[it.i])));
      return { ...dm, items: its.length, ...stat(vals) };
    }).filter((x) => x.items);
    const allVals = [];
    rows.forEach((r) => items.forEach((it) => allVals.push(r[it.i])));
    return { items: itemStats, dims, total: stat(allVals), n: answersList.length };
  }

  // ค่าเฉลี่ยรายด้านของนักเรียนหนึ่งคน
  function personDims(key, a) {
    const items = orderedItems(key);
    const r = Array.isArray(a.c_items) ? a.c_items.map(Number) : [];
    return DIMS.map((dm) => stat(items.filter((it) => it.d === dm.d).map((it) => r[it.i])).mean);
  }

  const keysOfTier = (tier) => Object.keys(D.forms).filter((k) => D.forms[k].tier === tier);

  K.cipp = { D, DIMS, PASS, form, formForRoom, survey, orderedItems, analyze, personDims, stat, interpret, pass, keysOfTier, shortPlan };
})();
