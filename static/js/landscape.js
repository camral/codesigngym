// Animated co-design landscape (paper Figure 2): return J over policy space Π and embodiment space E.
// Step 0: fix the body, policy learning climbs one slice. Step 1: change the body, the best policy moves. Step 2: co-design climbs the whole surface.
(function () {
  const box = document.getElementById('landscape'); if (!box) return;
  const items = [...document.querySelectorAll('.slice li')];
  const cv = box.querySelector('canvas'), ctx = cv.getContext('2d');
  const W = 560, H = 440, N = 30;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // J(e, p): a tall peak (the co-design optimum) and a lower one; e = embodiment, p = policy, both in [0, 1]
  const J = (e, p) => 0.95 * Math.exp(-((e - 0.74) ** 2 / 0.03 + (p - 0.36) ** 2 / 0.03)) + 0.55 * Math.exp(-((e - 0.26) ** 2 / 0.035 + (p - 0.66) ** 2 / 0.035)) + 0.08 * (1 - (e - 0.5) ** 2 - (p - 0.5) ** 2);
  // projection: E runs down-right, Π runs down-left, height up
  const P = (e, p, z) => [W * 0.5 + (e - p) * W * 0.45, H * 0.36 + (e + p) * H * 0.27 - z * H * 0.4];
  const ramp = z => { const t = Math.max(0, Math.min(1, z / 1.0)); const a = [234, 150, 110], b = [245, 214, 140], c = [70, 160, 110]; const m = t < 0.5 ? [a, b, t / 0.5] : [b, c, (t - 0.5) / 0.5]; return `rgb(${m[0].map((v, i) => Math.round(v + (m[1][i] - v) * m[2])).join(',')})`; };
  const bg = document.createElement('canvas');
  let dpr = 1;
  function paintSurface() {
    bg.width = W * dpr; bg.height = H * dpr; const g = bg.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const quads = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const e0 = i / N, e1 = (i + 1) / N, p0 = j / N, p1 = (j + 1) / N; quads.push({ e0, e1, p0, p1, d: e0 + p0 }); }
    quads.sort((a, b) => a.d - b.d);
    quads.forEach(q => {
      const c = [[q.e0, q.p0], [q.e1, q.p0], [q.e1, q.p1], [q.e0, q.p1]].map(([e, p]) => P(e, p, J(e, p)));
      g.beginPath(); c.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
      g.fillStyle = ramp(J((q.e0 + q.e1) / 2, (q.p0 + q.p1) / 2)); g.fill(); g.strokeStyle = 'rgba(90,60,40,.28)'; g.lineWidth = 0.7; g.stroke();
    });
    // axes
    const ax = getComputedStyle(document.documentElement).getPropertyValue('--ink-2').trim() || '#45413a'; g.strokeStyle = ax; g.fillStyle = ax; g.lineWidth = 1.4; g.font = 'italic 600 17px "Source Serif 4", Georgia, serif';
    const a0 = P(0, 1.05, 0), a1 = P(1, 1.05, 0), b0 = P(1.05, 0, 0), b1 = P(1.05, 1, 0);
    [[a0, a1], [b0, b1]].forEach(([u, v]) => { g.beginPath(); g.moveTo(...u); g.lineTo(...v); g.stroke(); });
    const me = P(0.5, 1.05, 0), mp = P(1.05, 0.5, 0); g.textAlign = 'right'; g.fillText('E  embodiment', me[0] - 8, me[1] + 22); g.textAlign = 'left'; g.fillText('Π  policy', mp[0] + 8, mp[1] + 22); g.textAlign = 'left';
  }
  function resize() { dpr = Math.min(2, devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr; paintSurface(); }

  // step-2 path: gradient ascent over the whole surface, from a poor start to the global peak
  const path = (() => { let e = 0.95, p = 0.95; const out = [[e, p]]; for (let k = 0; k < 400; k++) { const h = 1e-3, ge = (J(e + h, p) - J(e - h, p)) / (2 * h), gp = (J(e, p + h) - J(e, p - h)) / (2 * h), n = Math.hypot(ge, gp) || 1; e += 0.006 * ge / n; p += 0.006 * gp / n; out.push([e, p]); if (n < 0.02) break; } return out; })();
  const argmaxP = e => { let bp = 0, bv = -1; for (let j = 0; j <= 200; j++) { const p = j / 200, v = J(e, p); if (v > bv) { bv = v; bp = p; } } return bp; };

  let step = 0, t = 0, last = 0, auto = true, visible = false;
  const DUR = [4200, 5200, 5200];
  function dot(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fffdf8'; ctx.stroke(); }
  function slice(e, color, alpha) { // the curve of J along Π at a fixed body e, plus a translucent wall
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.beginPath(); for (let j = 0; j <= 60; j++) { const [x, y] = P(e, j / 60, J(e, j / 60)); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    for (let j = 60; j >= 0; j--) { const [x, y] = P(e, j / 60, 0); ctx.lineTo(x, y); } ctx.closePath(); ctx.fillStyle = color + '22'; ctx.fill();
    ctx.beginPath(); for (let j = 0; j <= 60; j++) { const [x, y] = P(e, j / 60, J(e, j / 60)); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.strokeStyle = color; ctx.lineWidth = 3.5; ctx.stroke(); ctx.restore();
  }
  const ease = u => u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.drawImage(bg, 0, 0, W, H);
    const u = Math.min(1, t / (DUR[step] * 0.8));
    if (step === 0) { // fixed body: climb along one slice
      const e = 0.26, pb = argmaxP(e); slice(e, '#c4502f', 1);
      const p = 0.02 + (pb - 0.02) * ease(u); const [x, y] = P(e, p, J(e, p)); dot(x, y, 7, '#c4502f');
    } else if (step === 1) { // sweep the body; the best policy on each slice moves with it
      const e = 0.26 + (0.74 - 0.26) * ease(u); slice(0.26, '#c4502f', 0.35); slice(e, '#c4502f', 1);
      ctx.save(); ctx.setLineDash([4, 5]); ctx.strokeStyle = '#1f1d1a'; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let k = 0; k <= 40; k++) { const ee = 0.26 + (e - 0.26) * k / 40, pp = argmaxP(ee), [x, y] = P(ee, pp, J(ee, pp)); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore();
      const pb = argmaxP(e), [x, y] = P(e, pb, J(e, pb)); dot(x, y, 7, '#c4502f');
    } else { // co-design: climb the whole surface
      const n = Math.max(1, Math.floor(ease(u) * (path.length - 1)));
      ctx.beginPath(); for (let k = 0; k <= n; k++) { const [e, p] = path[k], [x, y] = P(e, p, J(e, p)); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.strokeStyle = '#1f6f68'; ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.stroke();
      const [e, p] = path[n], [x, y] = P(e, p, J(e, p)); dot(x, y, 8, '#1f6f68');
      if (u >= 1) { ctx.font = '600 20px Caveat, cursive'; ctx.fillStyle = '#1f6f68'; const right = x > W - 190; ctx.textAlign = right ? 'right' : 'left'; ctx.fillText('the co-design optimum', right ? x - 14 : x + 14, y - 12); ctx.textAlign = 'left'; }
    }
  }
  function setStep(s) { step = s; t = 0; items.forEach((li, i) => li.classList.toggle('on', i === s)); }
  function frame(now) {
    const dt = last ? now - last : 0; last = now;
    if (visible) { t += dt; if (t > DUR[step]) { if (auto) setStep((step + 1) % 3); else t = DUR[step]; } draw(); }
    requestAnimationFrame(frame);
  }
  items.forEach((li, i) => { li.tabIndex = 0; li.setAttribute('role', 'button'); const go = () => { auto = false; setStep(i); }; li.addEventListener('click', go); li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); });
  new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; })).observe(box);
  addEventListener('resize', resize); addEventListener('themechange', () => { paintSurface(); draw(); }); resize(); setStep(0);
  if (reduce) { auto = false; t = DUR[2]; step = 2; items.forEach((li, i) => li.classList.toggle('on', i === 2)); draw(); visible = false; items.forEach((li, i) => li.addEventListener('click', () => { t = DUR[i]; draw(); })); }
  requestAnimationFrame(frame);
})();
