// Theme mockup picker: Current / Tech / Arena / Academic. Persists in localStorage and ?theme= links.
(function () {
  const root = document.documentElement, T = [['current', 'Current'], ['tech', 'Tech'], ['arena', 'Arena'], ['academic', 'Academic']];
  const box = document.createElement('div'); box.className = 'theme-pick'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Design mockup');
  box.innerHTML = '<span>Theme</span>' + T.map(([k, n]) => `<button type="button" data-t="${k}">${n}</button>`).join('');
  document.body.appendChild(box);
  function set(k, save) {
    if (k === 'current') delete root.dataset.theme; else root.dataset.theme = k;
    box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === k));
    if (save) { try { localStorage.setItem('cg-theme', k); } catch (e) {} const u = new URL(location.href); if (k === 'current') u.searchParams.delete('theme'); else u.searchParams.set('theme', k); history.replaceState(null, '', u); }
    window.dispatchEvent(new Event('themechange'));
  }
  box.addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (b) set(b.dataset.t, true); });
  set(root.dataset.theme || 'current', false);
})();
