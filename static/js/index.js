// copy-to-clipboard for pip pill, code blocks, bibtex
document.addEventListener('DOMContentLoaded', function () {
  function flash(btn, ok) {
    const prev = btn.dataset.label || btn.textContent;
    btn.dataset.label = prev;
    btn.textContent = ok ? 'copied' : 'press ⌘C';
    setTimeout(() => { btn.textContent = prev; }, 1400);
  }
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const sel = btn.getAttribute('data-copy');
      const el = document.querySelector(sel);
      const text = el ? (el.getAttribute('data-raw') || el.textContent.trim()) : '';
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => flash(btn, true), () => flash(btn, false));
      } else { flash(btn, false); }
    });
  });
});
