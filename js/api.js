/* เรียกหลังบ้าน: ถ้ามี API_URL จะส่งไป Google Apps Script ถ้าไม่มีจะใช้หลังบ้านจำลอง (โหมดทดลอง) */
(function () {
  const K = (window.KKW = window.KKW || {});
  const url = (window.KKW_CONFIG && window.KKW_CONFIG.API_URL || '').trim();
  K.demo = !url;

  async function call(action, data) {
    const body = Object.assign({ action }, data || {});
    if (K.demo) {
      await new Promise((r) => setTimeout(r, 250));
      return K.mock.handle(JSON.parse(JSON.stringify(body)));
    }
    let res;
    try {
      // ส่งเป็น text/plain เพื่อไม่ให้เบราว์เซอร์ส่งคำขอ preflight ไปที่ Apps Script
      res = await fetch(url, { method: 'POST', body: JSON.stringify(body), redirect: 'follow' });
    } catch (e) {
      throw new Error('เชื่อมต่อระบบไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง');
    }
    if (!res.ok) throw new Error('ระบบตอบกลับผิดพลาด (' + res.status + ') ลองอีกครั้งในอีกสักครู่');
    const out = await res.json();
    return out;
  }

  // คืนค่า data เมื่อสำเร็จ หรือโยน Error พร้อมข้อความภาษาไทย
  async function req(action, data) {
    const out = await call(action, data);
    if (!out || !out.ok) {
      const err = new Error((out && out.error) || 'เกิดข้อผิดพลาด');
      err.code = out && out.error;
      throw err;
    }
    return out;
  }

  K.api = { req };
})();
