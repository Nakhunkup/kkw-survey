/* แสดงแบบสำรวจ ตรวจคำตอบ แสดงคำตอบย้อนหลัง และผล RIASEC (ใช้ร่วมกันทั้งหน้านักเรียนและแอดมิน) */
(function () {
  const K = (window.KKW = window.KKW || {});
  const { h, append, clear } = K.ui;
  const S = K.schema;

  // ---------- ฟอร์มคำถามหนึ่งตอน ----------
  // ctx = { survey, answers, student, onChange }
  function renderSection(section, ctx) {
    const wrap = h('div');
    const blocks = section.questions.map((q) => {
      const block = h('div.q', { 'data-q': q.id });
      if (q.pre) append(block, h('div.q-pre', q.pre));
      const labelId = 'lbl-' + q.id;
      append(block, h('div.q-label', { id: labelId }, h('span.no', q.no), h('span', q.label)));
      if (q.hint) append(block, h('div.q-hint', q.hint));
      const body = h('div.q-body');
      body.appendChild(renderInput(q, ctx, labelId));
      append(block, body);
      if (q.note) append(block, h('div.q-note', q.note));
      append(block, h('div.q-error', { role: 'alert', hidden: true }));
      return { q, block };
    });
    blocks.forEach((b) => wrap.appendChild(b.block));
    function refresh() {
      blocks.forEach(({ q, block }) => {
        block.hidden = !S.isVisible(q, ctx.answers);
        if (block.classList.contains('has-error') && !validateQuestion(q, ctx.answers)) {
          block.classList.remove('has-error');
          const box = block.querySelector('.q-error'); box.hidden = true; box.textContent = '';
        }
      });
    }
    refresh();
    wrap._refresh = refresh;
    return wrap;
  }

  function emit(ctx) { if (ctx.onChange) ctx.onChange(); }

  function renderInput(q, ctx, labelId) {
    const A = ctx.answers;
    switch (q.type) {
      case 'info': {
        const s = ctx.student || {};
        if (q.field === 'room') return h('div', h('b', 'ม.' + s.level + '/' + s.room), h('span.muted', '  เลขที่ ' + s.no));
        return h('div', h('div', h('span.muted', 'ชื่อ–สกุล  '), h('b', s.name)), h('div', h('span.muted', 'ห้อง  '), h('b', 'ม.' + s.level + '/' + s.room), h('span.muted', '   เลขที่  '), h('b', s.no)),
          h('div.small.muted', 'ข้อมูลนี้ระบบกรอกให้จากรายชื่อของโรงเรียน'));
      }
      case 'single':
      case 'multi': {
        const multi = q.type === 'multi';
        const box = h('div', { role: multi ? 'group' : 'radiogroup', 'aria-labelledby': labelId });
        let lastGroup = null;
        S.realOptions(q.options).forEach((o) => {
          if (o.group && o.group !== lastGroup) { box.appendChild(h('div.opt-group', o.group)); lastGroup = o.group; }
          const checked = multi ? (A[q.id] || []).includes(o.value) : A[q.id] === o.value;
          const input = h('input', { type: multi ? 'checkbox' : 'radio', name: q.id, value: o.value, checked });
          const row = h('label.choice' + (checked ? '.checked' : ''), input, h('span', o.label, o.desc ? h('span.desc', o.desc) : null));
          let extra = null;
          if (o.text) {
            extra = h('input.input', { type: 'text', placeholder: o.placeholder || 'โปรดระบุ', value: A[o.text] || '', maxlength: 200, 'aria-label': o.label + ' ' + (o.placeholder || '') });
            extra.addEventListener('input', () => { A[o.text] = extra.value; emit(ctx); });
          }
          const extraWrap = extra ? h('div.choice-extra', { hidden: !checked }, extra) : null;
          input.addEventListener('change', () => {
            if (multi) {
              const set = new Set(A[q.id] || []);
              input.checked ? set.add(o.value) : set.delete(o.value);
              A[q.id] = [...set].sort((x, y) => x - y);
              row.classList.toggle('checked', input.checked);
              if (extraWrap) { extraWrap.hidden = !input.checked; if (input.checked) extra.focus(); }
            } else {
              A[q.id] = o.value;
              box.querySelectorAll('.choice').forEach((c) => c.classList.toggle('checked', c.contains(input)));
              box.querySelectorAll('.choice-extra').forEach((x) => (x.hidden = true));
              if (extraWrap) { extraWrap.hidden = false; extra.focus(); }
            }
            emit(ctx);
          });
          box.appendChild(row);
          if (extraWrap) box.appendChild(extraWrap);
        });
        return box;
      }
      case 'rank3': {
        const opts = S.realOptions(q.options);
        A[q.id] = A[q.id] || [null, null, null];
        const summary = h('div.rank-summary', { 'aria-live': 'polite' });
        const list = h('div');
        const rows = [];
        function paint() {
          clear(summary);
          [0, 1, 2].forEach((r) => {
            const v = A[q.id][r];
            const o = opts.find((x) => x.value === v);
            summary.appendChild(h('div' + (o ? '.filled' : ''), h('b', 'อันดับ ' + (r + 1)), o ? o.label : 'ยังไม่ได้เลือก'));
          });
          rows.forEach(({ o, row, btns }) => {
            const rank = A[q.id].indexOf(o.value);
            row.classList.toggle('ranked', rank >= 0);
            btns.forEach((b, i) => b.setAttribute('aria-pressed', rank === i ? 'true' : 'false'));
          });
        }
        let lastGroup = null;
        opts.forEach((o) => {
          if (o.group && o.group !== lastGroup) { list.appendChild(h('div.opt-group', o.group)); lastGroup = o.group; }
          const btns = [0, 1, 2].map((r) => h('button', {
            type: 'button', 'aria-label': 'อันดับ ' + (r + 1) + ' ' + o.label,
            onclick: () => {
              const cur = A[q.id];
              if (cur[r] === o.value) cur[r] = null; // กดซ้ำเพื่อยกเลิก
              else {
                const had = cur.indexOf(o.value);
                if (had >= 0) cur[had] = null;
                cur[r] = o.value;
              }
              paint(); emit(ctx);
            },
          }, 'อันดับ ' + (r + 1)));
          btns.forEach((b, i) => (b.textContent = String(i + 1)));
          const row = h('div.rank-row', h('span', o.label), h('div.rank-btns', btns));
          rows.push({ o, row, btns });
          list.appendChild(row);
        });
        paint();
        return h('div', summary, h('div.small.muted', { style: { marginBottom: '8px' } }, 'กดปุ่ม 1, 2 หรือ 3 ท้ายแผนการเรียนที่ต้องการ กดซ้ำเพื่อยกเลิก'), list);
      }
      case 'likert': {
        const items = q.items;
        const n = items.filter((i) => typeof i === 'string').length;
        A[q.id] = A[q.id] || new Array(n).fill(null);
        const tbody = h('tbody');
        let idx = 0;
        items.forEach((it) => {
          if (typeof it !== 'string') { tbody.appendChild(h('tr.group', h('td', { colspan: 6 }, it.group))); return; }
          const i = idx++;
          const tr = h('tr', { 'data-i': i });
          const itemId = q.id + '-i' + i;
          tr.appendChild(h('td.item', { id: itemId }, h('span.n', (i + 1) + '.'), it));
          const btns = [];
          [5, 4, 3, 2, 1].forEach((v, k) => {
            const b = h('button.scale-btn', {
              type: 'button', role: 'radio', 'aria-checked': A[q.id][i] === v ? 'true' : 'false', 'aria-label': v + ' ' + S.SCALE5[k],
              tabindex: (A[q.id][i] === v || (A[q.id][i] == null && v === 5)) ? '0' : '-1',
              onclick: () => {
                A[q.id][i] = v;
                btns.forEach((x) => { const on = x === b; x.setAttribute('aria-checked', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1; });
                tr.classList.remove('missing');
                emit(ctx);
              },
              onkeydown: (e) => { // ลูกศรซ้าย/ขวาเลื่อนระหว่างคะแนน
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
                e.preventDefault();
                const dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
                const nb = btns[(k + dir + 5) % 5]; nb.focus(); nb.click();
              },
            }, String(v));
            btns.push(b);
            tr.appendChild(h('td.cell', b, h('span.cap', S.SCALE5[k])));
          });
          const group = h('td', { hidden: true });
          tr.setAttribute('role', 'radiogroup'); tr.setAttribute('aria-labelledby', itemId);
          tr.appendChild(group);
          tbody.appendChild(tr);
        });
        const head = h('thead', h('tr', h('th.item-h', 'ข้อความ'), S.SCALE5.map((s, k) => h('th', h('div', String(5 - k)), s))));
        return h('table.likert', head, tbody);
      }
      case 'matrix': {
        A[q.id] = A[q.id] || new Array(q.rows.length).fill(null);
        const tbody = h('tbody');
        q.rows.forEach((row, i) => {
          const tr = h('tr', { 'data-i': i, role: 'radiogroup', 'aria-label': row });
          tr.appendChild(h('td.item', row));
          const btns = [];
          q.cols.forEach((c, k) => {
            const b = h('button.scale-btn', {
              type: 'button', role: 'radio', 'aria-checked': A[q.id][i] === k + 1 ? 'true' : 'false', style: { width: 'auto', padding: '0 10px', minWidth: '96px' },
              onclick: () => { A[q.id][i] = k + 1; btns.forEach((x) => x.setAttribute('aria-checked', x === b ? 'true' : 'false')); tr.classList.remove('missing'); emit(ctx); },
            }, c);
            btns.push(b);
            tr.appendChild(h('td.cell', { style: { width: 'auto' } }, b));
          });
          tbody.appendChild(tr);
        });
        return h('table.likert.matrix', h('thead', h('tr', h('th.item-h', 'รอบ'), q.cols.map((c) => h('th', c)))), tbody);
      }
      case 'text': {
        const inp = h('input.input', { type: 'text', value: A[q.id] || '', maxlength: 300, 'aria-labelledby': labelId });
        inp.addEventListener('input', () => { A[q.id] = inp.value; emit(ctx); });
        return inp;
      }
      case 'longtext': {
        const ta = h('textarea.input', { maxlength: 2000, 'aria-labelledby': labelId });
        ta.value = A[q.id] || '';
        ta.addEventListener('input', () => { A[q.id] = ta.value; emit(ctx); });
        return ta;
      }
      case 'textgroup': {
        const box = h('div.stack');
        q.fields.forEach((f) => {
          const id = 'f-' + f.key;
          const inp = h('input.input', { id, type: 'text', value: A[f.key] || '', maxlength: 200 });
          inp.addEventListener('input', () => { A[f.key] = inp.value; emit(ctx); });
          box.appendChild(h('div', h('label.field', { for: id }, f.label, f.optional ? h('span.muted', ' (ไม่บังคับ)') : ''), inp));
        });
        return box;
      }
      default: return h('div');
    }
  }

  // ---------- ตรวจคำตอบ ----------
  function validateQuestion(q, A) {
    const filled = (s) => typeof s === 'string' && s.trim().length > 0;
    switch (q.type) {
      case 'single': {
        if (!A[q.id]) return 'กรุณาเลือกคำตอบ';
        const o = S.realOptions(q.options)[A[q.id] - 1];
        if (o && o.text && !filled(A[o.text])) return 'กรุณาพิมพ์ระบุในช่องที่เลือก';
        return null;
      }
      case 'multi': {
        const v = A[q.id] || [];
        if (!v.length) return 'กรุณาเลือกอย่างน้อย 1 ข้อ';
        const opts = S.realOptions(q.options);
        if (v.some((x) => opts[x - 1] && opts[x - 1].text && !filled(A[opts[x - 1].text]))) return 'กรุณาพิมพ์ระบุในช่องที่เลือก';
        return null;
      }
      case 'rank3': {
        const v = A[q.id] || [];
        const miss = [0, 1, 2].filter((i) => !v[i]).map((i) => i + 1);
        return miss.length ? 'กรุณาเลือกอันดับ ' + miss.join(', ') : null;
      }
      case 'likert': case 'matrix': {
        const v = A[q.id] || [];
        const n = q.type === 'matrix' ? q.rows.length : q.items.filter((i) => typeof i === 'string').length;
        const miss = []; for (let i = 0; i < n; i++) if (!v[i]) miss.push(i + 1);
        return miss.length ? 'ยังไม่ได้ตอบข้อย่อยที่ ' + miss.join(', ') : null;
      }
      case 'text': return q.optional || filled(A[q.id]) ? null : 'กรุณาพิมพ์คำตอบ';
      case 'longtext': return q.optional || filled(A[q.id]) ? null : 'กรุณาพิมพ์คำตอบ';
      case 'textgroup': return q.fields.some((f) => !f.optional && !filled(A[f.key])) ? 'กรุณากรอกช่องที่ไม่ได้ระบุว่า "ไม่บังคับ" ให้ครบ' : null;
      default: return null;
    }
  }
  // ตรวจทั้งตอน แสดงข้อความผิดพลาดบนหน้า คืนค่า true ถ้าผ่าน
  function validateSection(section, wrap, A) {
    let firstBad = null;
    section.questions.forEach((q) => {
      const block = wrap.querySelector('[data-q="' + q.id + '"]');
      if (!block) return;
      const err = S.isVisible(q, A) ? validateQuestion(q, A) : null;
      const box = block.querySelector('.q-error');
      block.classList.toggle('has-error', !!err);
      box.hidden = !err; box.textContent = err || '';
      if ((q.type === 'likert' || q.type === 'matrix') && err) {
        block.querySelectorAll('tbody tr[data-i]').forEach((tr) => tr.classList.toggle('missing', !(A[q.id] || [])[Number(tr.dataset.i)]));
      }
      if (err && !firstBad) firstBad = block;
    });
    if (firstBad) { firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' }); const f = firstBad.querySelector('input, button, textarea'); if (f) setTimeout(() => f.focus({ preventScroll: true }), 300); }
    return !firstBad;
  }

  // ลบคำตอบของข้อที่ถูกข้าม และช่องระบุที่ไม่ได้เลือก ก่อนส่ง
  function cleanAnswers(survey, A) {
    const out = {};
    S.allQuestions(survey).forEach((q) => {
      if (!S.isVisible(q, A) || q.type === 'info') return;
      if (q.type === 'textgroup') { q.fields.forEach((f) => { if (A[f.key] && A[f.key].trim()) out[f.key] = A[f.key].trim(); }); return; }
      const v = A[q.id];
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) return;
      out[q.id] = typeof v === 'string' ? v.trim() : v;
      if (q.options) {
        S.realOptions(q.options).forEach((o) => {
          const sel = Array.isArray(v) ? v.includes(o.value) : v === o.value;
          if (o.text && sel && A[o.text]) out[o.text] = String(A[o.text]).trim();
        });
      }
    });
    return out;
  }

  // ---------- แปลงคำตอบเป็นข้อความ ----------
  function formatAnswer(q, A) {
    const opts = q.options ? S.realOptions(q.options) : [];
    const withText = (o) => o.label + (o.text && A[o.text] ? ' — ' + A[o.text] : '');
    const v = A[q.id];
    switch (q.type) {
      case 'single': { const o = opts[v - 1]; return o ? withText(o) : null; }
      case 'multi': return Array.isArray(v) && v.length ? v.map((x) => opts[x - 1] && '• ' + withText(opts[x - 1])).join('\n') : null;
      case 'rank3': return Array.isArray(v) && v[0] ? v.map((x, i) => 'อันดับ ' + (i + 1) + ': ' + (opts[x - 1] ? opts[x - 1].label : '-')).join('\n') : null;
      case 'likert': {
        if (!Array.isArray(v)) return null;
        const items = q.items.filter((i) => typeof i === 'string');
        return items.map((t, i) => (i + 1) + '. ' + t + '  →  ' + (v[i] ? v[i] + ' (' + S.SCALE5[5 - v[i]] + ')' : '-')).join('\n');
      }
      case 'matrix': return Array.isArray(v) ? q.rows.map((r, i) => r + ': ' + (q.cols[v[i] - 1] || '-')).join('\n') : null;
      case 'text': case 'longtext': return v ? String(v) : null;
      case 'textgroup': { const lines = q.fields.filter((f) => A[f.key]).map((f) => f.label + ': ' + A[f.key]); return lines.length ? lines.join('\n') : null; }
      default: return null;
    }
  }

  function renderAnswers(survey, A, student) {
    const dl = h('dl');
    survey.sections.forEach((sec, si) => {
      dl.appendChild(h('div.a-sec', 'ตอนที่ ' + (si + 1) + '  ' + sec.title));
      sec.questions.forEach((q) => {
        let val;
        if (q.type === 'info') val = student ? student.name + '\nม.' + student.level + '/' + student.room + ' เลขที่ ' + student.no : '';
        else val = formatAnswer(q, A);
        const skipped = q.type !== 'info' && !S.isVisible({ ...q, sectionShowIf: sec.showIf }, A);
        dl.appendChild(h('div.a-row', h('dt', h('span.no', q.no), q.label),
          h('dd', skipped ? h('span.skipped', 'ข้ามตามเงื่อนไขของแบบสำรวจ') : (val || h('span.skipped', 'ไม่ได้ตอบ')))));
      });
    });
    return h('div.answers', dl);
  }

  // ---------- ผล RIASEC ----------
  function renderRiasec(survey, A, opts = {}) {
    const scores = S.riasecScores(A[survey.riasecKey]);
    if (!scores) return h('p.muted', 'ไม่มีข้อมูลข้อ ' + (survey.level === 3 ? '3.1' : '4.1'));
    const code = S.riasecCode(scores);
    const canvas = h('canvas', { role: 'img', 'aria-label': 'กราฟคะแนน RIASEC ' + scores.map((s) => s.code + ' ' + s.score).join(', ') });
    const top = code.split('').map((c) => scores.find((s) => s.code === c));
    const cards = top.map((t, i) => h('div.type-card.rank-' + (i + 1),
      h('div.letter', t.code),
      h('div', h('b', t.th + ' (' + t.en + ')'), h('div.sub', t.desc), h('div.sub', (survey.level === 3 ? 'แผนการเรียนที่มักสอดคล้อง: ' : 'คณะที่มักสอดคล้อง: ') + (survey.level === 3 ? t.m3 : t.m6))),
      h('div.score', t.score + '/10')));
    const table = h('table.data-table', { style: { marginTop: '14px' } },
      h('thead', h('tr', h('th', 'แบบ'), h('th', 'ความหมาย'), h('th.n', 'คะแนน (2–10)'))),
      h('tbody', scores.map((s) => h('tr', h('td', h('b', s.code), ' ' + s.en), h('td', s.th), h('td.n', s.score)))));
    const el = h('div.riasec-wrap',
      h('div', h('div.chart-box', { style: { height: '320px' } }, canvas)),
      h('div',
        h('div.muted.small', 'รหัสบุคลิกภาพอาชีพ 3 ด้านที่เด่นที่สุด'),
        h('div.riasec-code', code),
        h('p.small.muted', { style: { margin: '6px 0 14px' } }, 'คำนวณจากข้อ ' + (survey.level === 3 ? '3.1' : '4.1') + ' ตามแนวคิดของ Holland (1997) แต่ละด้านรวมคะแนน 2 ข้อ ใช้เป็นแนวทางประกอบการตัดสินใจ ไม่ใช่เกณฑ์ตายตัว'),
        cards,
        opts.table === false ? null : table));
    setTimeout(() => K.charts && K.charts.radar(canvas, scores), 0);
    return el;
  }

  K.render = { renderSection, validateSection, validateQuestion, cleanAnswers, formatAnswer, renderAnswers, renderRiasec };
})();
