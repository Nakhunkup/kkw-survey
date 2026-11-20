/* ตัวช่วยสร้างหน้าเว็บ */
(function () {
  const K = (window.KKW = window.KKW || {});

  // h('div.cls#id', {attrs}, ...children)
  function h(tag, attrs, ...kids) {
    const m = tag.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
    const el = document.createElement(m[1] || 'div');
    (m[2].match(/[.#][\w-]+/g) || []).forEach((p) => (p[0] === '.' ? el.classList.add(p.slice(1)) : (el.id = p.slice(1))));
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (v == null || v === false) return;
        if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'class') el.className += ' ' + v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k in el && typeof v !== 'string') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    append(el, kids);
    return el;
  }
  function append(el, ...kids) {
    kids.flat(Infinity).forEach((c) => {
      if (c == null || c === false) return;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  let toastTimer;
  function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = h('div.toast', { role: 'status' }); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3200);
  }

  // กล่องโต้ตอบ: คืน { close, body, foot }
  function modal(title, opts = {}) {
    const prev = document.activeElement;
    const body = h('div.dialog-body');
    const foot = h('div.dialog-foot');
    const titleId = 'dlg-' + Math.random().toString(36).slice(2);
    const closeBtn = h('button.x-btn', { type: 'button', 'aria-label': 'ปิด', onclick: () => close() }, '×');
    const dlg = h('div.dialog' + (opts.wide ? '.wide' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      h('div.dialog-head', h('h2', { id: titleId }, title), closeBtn), body, foot);
    const ov = h('div.overlay', { onclick: (e) => { if (e.target === ov && !opts.sticky) close(); } }, dlg);
    const onKey = (e) => {
      if (e.key === 'Escape' && !opts.sticky) close();
      if (e.key === 'Tab') { // วนโฟกัสอยู่ในกล่อง
        const f = [...dlg.querySelectorAll('button, input, select, textarea, a[href]')].filter((x) => !x.disabled && x.offsetParent);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    setTimeout(() => { const first = body.querySelector('input, select, textarea') || (opts.wide ? closeBtn : foot.querySelector('button')) || closeBtn; first.focus(); }, 30);
    function close() {
      document.removeEventListener('keydown', onKey);
      ov.remove(); document.body.style.overflow = '';
      if (opts.onClose) opts.onClose();
      if (prev && prev.focus) prev.focus();
    }
    return { close, body, foot, dialog: dlg };
  }

  function confirmDialog(title, message, okLabel, danger) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal(title, { onClose: () => { if (!done) resolve(false); } });
      append(m.body, typeof message === 'string' ? h('p', message) : message);
      append(m.foot,
        h('button.btn.secondary', { type: 'button', onclick: () => m.close() }, 'ยกเลิก'),
        h('button.btn' + (danger ? '.danger-solid' : ''), { type: 'button', onclick: () => { done = true; m.close(); resolve(true); } }, okLabel));
    });
  }

  function loading(text) { return h('div.loading-block', h('span.spinner'), ' ', text || 'กำลังโหลดข้อมูล'); }

  function chrome(opts) {
    const root = document.getElementById('app-chrome');
    clear(root);
    if (K.demo) {
      append(root, h('div.demo-banner', h('div', opts.demoText || 'โหมดทดลอง: ใช้รายชื่อสมมติ คำตอบเก็บไว้ในเบราว์เซอร์นี้เท่านั้น ยังไม่ได้เชื่อมกับ Google Sheet ของโรงเรียน')));
    }
  }

  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  };

  K.ui = { h, append, clear, toast, modal, confirmDialog, loading, chrome, fmtDate };
})();
