/* ส่งออก Excel (SheetJS) */
(function () {
  const K = window.KKW;
  const S = K.schema;

  // สร้างรายการคอลัมน์ของแบบสำรวจ: 1 แถวต่อ 1 คน
  function columns(sv) {
    const cols = [];
    S.allQuestions(sv).forEach((q) => {
      const opts = q.options ? S.realOptions(q.options) : [];
      const p = q.no + ' ';
      switch (q.type) {
        case 'single':
          cols.push({ h: p + q.label, get: (A) => (opts[A[q.id] - 1] || {}).label || '' });
          opts.filter((o) => o.text).forEach((o) => cols.push({ h: p + o.label + ' (ระบุ)', get: (A) => A[o.text] || '' }));
          break;
        case 'multi':
          opts.forEach((o) => cols.push({ h: p + o.label, get: (A) => (A[q.id] ? ((A[q.id] || []).includes(o.value) ? 1 : 0) : '') }));
          opts.filter((o) => o.text).forEach((o) => cols.push({ h: p + o.label + ' (ระบุ)', get: (A) => A[o.text] || '' }));
          break;
        case 'rank3':
          [0, 1, 2].forEach((i) => cols.push({ h: p + 'อันดับ ' + (i + 1), get: (A) => (A[q.id] && opts[A[q.id][i] - 1] ? opts[A[q.id][i] - 1].label : '') }));
          break;
        case 'likert':
          q.items.filter((i) => typeof i === 'string').forEach((t, i) => cols.push({ h: q.no + '.' + (i + 1) + ' ' + t, get: (A) => (A[q.id] ? A[q.id][i] || '' : '') }));
          break;
        case 'matrix':
          q.rows.forEach((r, i) => cols.push({ h: p + r, get: (A) => (A[q.id] ? q.cols[A[q.id][i] - 1] || '' : '') }));
          break;
        case 'text': case 'longtext':
          cols.push({ h: p + q.label, get: (A) => A[q.id] || '' });
          break;
        case 'textgroup':
          q.fields.forEach((f) => cols.push({ h: p + f.label, get: (A) => A[f.key] || '' }));
          break;
        default: break;
      }
    });
    S.RIASEC.forEach((t, i) => cols.push({ h: 'RIASEC ' + t.code + ' (' + t.en + ')', get: (A) => { const s = S.riasecScores(A[sv.riasecKey]); return s ? s[i].score : ''; } }));
    cols.push({ h: 'รหัส RIASEC 3 ด้านเด่น', get: (A) => S.riasecCode(S.riasecScores(A[sv.riasecKey])) });
    return cols;
  }

  const stamp = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + 543 + '' + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); };
  const tsText = (iso) => K.ui.fmtDate(iso);
  function sheetFromRows(header, rows, widths) {
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = header.map((hh, i) => ({ wch: widths && widths[i] ? widths[i] : Math.min(40, Math.max(10, String(hh).length * 0.9)) }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) };
    ws['!freeze'] = { xSplit: 4, ySplit: 1 };
    return ws;
  }
  const sortSt = (a, b) => a.level - b.level || a.room - b.room || a.no - b.no;

  // students: รายชื่อ (ผ่านตัวกรองแล้ว), respById: Map
  function ready() { if (window.XLSX) return true; K.ui.toast('หน้านี้ดาวน์โหลดไฟล์ไม่ได้ กรุณาเปิดจากเว็บไซต์ของโรงเรียน'); return false; }
  function exportAll(students, respById, label) {
    if (!ready()) return;
    const wb = XLSX.utils.book_new();
    [3, 6].forEach((lv) => {
      const list = students.filter((s) => s.level === lv && respById.has(s.id)).sort(sortSt);
      if (!students.some((s) => s.level === lv)) return;
      const sv = S.byLevel[lv];
      const cols = columns(sv);
      const header = ['ระดับชั้น', 'ห้อง', 'เลขที่', 'เลขประจำตัว', 'ชื่อ–สกุล', 'เวลาที่ส่ง', ...cols.map((c) => c.h)];
      const rows = list.map((s) => { const r = respById.get(s.id); return ['ม.' + lv, s.room, s.no, s.id, s.name, tsText(r.ts), ...cols.map((c) => c.get(r.answers || {}))]; });
      XLSX.utils.book_append_sheet(wb, sheetFromRows(header, rows, [9, 6, 6, 11, 30, 18]), 'คำตอบ ม.' + lv);
    });
    const status = students.slice().sort(sortSt).map((s) => ['ม.' + s.level, s.room, s.no, s.id, s.name, respById.has(s.id) ? 'ส่งแล้ว' : 'ยังไม่ส่ง', respById.has(s.id) ? tsText(respById.get(s.id).ts) : '']);
    XLSX.utils.book_append_sheet(wb, sheetFromRows(['ระดับชั้น', 'ห้อง', 'เลขที่', 'เลขประจำตัว', 'ชื่อ–สกุล', 'สถานะ', 'เวลาที่ส่ง'], status, [9, 6, 6, 11, 30, 10, 20]), 'สถานะการส่ง');
    const legend = [
      ['ไฟล์ส่งออกจากระบบแบบสำรวจความต้องการศึกษาต่อ โรงเรียนขอนแก่นวิทยายน'],
      ['ขอบเขต: ' + label], ['ส่งออกเมื่อ: ' + tsText(new Date().toISOString())], [''],
      ['คำอธิบายคอลัมน์'],
      ['ข้อเลือกได้หลายคำตอบ: แยกคอลัมน์ละตัวเลือก 1 = เลือก, 0 = ไม่เลือก, ว่าง = ข้อนี้ถูกข้ามตามเงื่อนไข'],
      ['ข้อมาตรวัด 5 ระดับ: 5 = มากที่สุด, 4 = มาก, 3 = ปานกลาง, 2 = น้อย, 1 = น้อยที่สุด'],
      ['RIASEC: แต่ละด้านรวมคะแนน 2 ข้อ (ช่วง 2–10) R = ข้อ 1, 7 | I = 2, 8 | A = 3, 9 | S = 4, 10 | E = 5, 11 | C = 6, 12'],
      ['ช่องว่าง: นักเรียนไม่ได้ตอบ หรือข้อนั้นถูกข้ามตามเงื่อนไขของแบบสำรวจ'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(legend); ws['!cols'] = [{ wch: 110 }];
    XLSX.utils.book_append_sheet(wb, ws, 'คำอธิบาย');
    XLSX.writeFile(wb, 'แบบสำรวจศึกษาต่อ_' + label.replace(/[\\/:*?"<>|\s]+/g, '_') + '_' + stamp() + '.xlsx');
  }

  function exportOne(st, resp) {
    if (!ready()) return;
    const sv = S.byLevel[st.level];
    const A = resp.answers || {};
    const rows = [
      ['แบบสำรวจ', sv.title], ['', sv.subtitle], ['ชื่อ–สกุล', st.name], ['ห้อง', 'ม.' + st.level + '/' + st.room], ['เลขที่', st.no], ['เลขประจำตัว', st.id], ['เวลาที่ส่ง', tsText(resp.ts)], ['', ''],
    ];
    sv.sections.forEach((sec, si) => {
      rows.push(['ตอนที่ ' + (si + 1) + ' ' + sec.title, '']);
      sec.questions.forEach((q) => {
        if (q.type === 'info') return;
        const vis = S.isVisible({ ...q, sectionShowIf: sec.showIf }, A);
        rows.push([q.no + ' ' + q.label, vis ? (K.render.formatAnswer(q, A) || 'ไม่ได้ตอบ') : 'ข้ามตามเงื่อนไข']);
      });
      rows.push(['', '']);
    });
    const sc = S.riasecScores(A[sv.riasecKey]);
    if (sc) {
      rows.push(['ผล RIASEC', 'รหัส 3 ด้านเด่น: ' + S.riasecCode(sc)]);
      sc.forEach((s) => rows.push([s.code + ' ' + s.en + ' (' + s.th + ')', s.score]));
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 60 }, { wch: 80 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'คำตอบรายบุคคล');
    XLSX.writeFile(wb, 'คำตอบ_ม' + st.level + '-' + st.room + '_เลขที่' + st.no + '_' + st.name.replace(/\s+/g, '_') + '.xlsx');
  }

  K.exporter = { columns, exportAll, exportOne };
})();
