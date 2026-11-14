'use strict';

/* ============================================================
   NOVA — boot
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  init().catch((err) => {
    console.error(err);
    try {
      toast('تعذّر بدء الواجهة: ' + (err && err.message ? err.message : String(err)), 'error', 9000);
    } catch {
      // UI may not be ready
    }
    setStatus('خطأ', 'error');
  });
});
