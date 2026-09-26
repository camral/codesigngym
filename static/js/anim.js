// Section transitions: staggered reveals, count-up numbers, growing bars, reading-progress bar.
// Everything is gated on the `motion` class (set in <head> unless the viewer prefers reduced motion), so without it the page is static.
(function () {
  const root = document.documentElement;
  const motion = root.classList.contains('motion');

  // reading progress
  const bar = document.createElement('div'); bar.className = 'progress'; document.body.appendChild(bar);
  const onScroll = () => { const h = root.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`; };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  // anything still waiting when the viewer reaches the bottom (short final sections never cross the reveal line) shows at once
  addEventListener('scroll', () => { if (innerHeight + scrollY >= root.scrollHeight - 4) document.querySelectorAll('.reveal:not(.in), .stagger:not(.in), .sec-head:not(.in)').forEach(e => e.classList.add('in')); }, { passive: true });
  if (!motion) return;

  // stagger siblings: every .reveal gets a delay by its position among .reveal siblings (cards, tiles, list items)
  function stagger(scope) {
    scope.querySelectorAll('.reveal').forEach(el => {
      const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
      if (sibs.length > 1) el.style.setProperty('--d', `${(sibs.indexOf(el) % 8) * 70}ms`);
    });
  }
  stagger(document);
  // children of these containers enter one by one when the container is revealed
  document.querySelectorAll('.pillars, .bignums, .take, .facts, .demo-side, .slice ol').forEach(c => { c.classList.add('stagger'); [...c.children].forEach((k, i) => k.style.setProperty('--i', i)); });
  // environment cards are rendered by main.js: stagger them once they exist
  const grid = document.getElementById('env-grid'); if (grid) stagger(grid);

  // count-up for headline numbers
  function countUp(el) {
    const node = [...el.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.textContent)); if (!node || el.dataset.counted) return;
    const m = node.textContent.match(/^(\s*[−-]?)(\d+(?:\.\d+)?)(.*)$/s); if (!m) return;
    el.dataset.counted = 1;
    const sign = m[1].includes('−') || m[1].includes('-') ? -1 : 1, target = parseFloat(m[2]), dec = (m[2].split('.')[1] || '').length, pre = m[1].replace(/[−-]/, ''), post = m[3];
    if (target === 0) return;
    const t0 = performance.now(), dur = 900 + Math.min(700, target * 4);
    (function tick(t) {
      const u = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - u, 3), v = target * e;
      node.textContent = `${pre}${sign < 0 ? '−' : ''}${v.toFixed(dec)}${post}`;
      if (u < 1) requestAnimationFrame(tick);
    })(t0);
  }
  const COUNT = '.at-hub b, .at-leaf b, .take-n, .bignums b';

  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target; el.classList.add('in');
    el.querySelectorAll(COUNT).forEach(countUp); if (el.matches(COUNT)) countUp(el);
    io.unobserve(el);
  }), { rootMargin: '0px 0px -10% 0px' });
  document.querySelectorAll('.stagger, .headroom, .leaders, .apitree, .sec-head, .bignums, .take-card').forEach(el => io.observe(el));
})();
