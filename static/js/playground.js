// Toy co-design landscape: a 1-DOF body of mass m (the design) under feedback u = -g x - h v (g is the policy).
// m x'' = -c v + u. Cost J(m, g) = s0' P s0 + lam / m, with P from the closed-loop Lyapunov equation A'P + PA = -(Q + r K'K).
// Everything is exact (closed form for 2x2); no sampling. The LQStructure environments generalise this to chains with sensors/actuators.
(function () {
  const C = 0.05, H = 0.9, R = 0.4, LAM = 0.5, Q1 = 1.0, Q2 = 0.05;
  const M0 = 0.2, M1 = 4.0, G0 = 0.05, G1 = 5.0;
  const RAMP = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];

  function J(m, g) {
    if (g <= 0 || m <= 0) return Infinity;
    const a = -g / m, b = -(C + H) / m;
    const q11 = Q1 + R * g * g, q12 = R * g * H, q22 = Q2 + R * H * H;
    const p2 = -q11 / (2 * a);
    const p3 = (-q22 / 2 - p2) / b;
    const p1 = -q12 - a * p3 - b * p2;
    return p1 + LAM / m;
  }
  function argmin(f, lo, hi) { // coarse scan then golden-section refine
    let best = lo, bv = Infinity;
    for (let i = 0; i <= 200; i++) { const x = lo + (hi - lo) * i / 200, v = f(x); if (v < bv) { bv = v; best = x; } }
    let a = Math.max(lo, best - (hi - lo) / 200), b = Math.min(hi, best + (hi - lo) / 200);
    const gr = (Math.sqrt(5) - 1) / 2;
    for (let i = 0; i < 40; i++) { const c = b - gr * (b - a), d = a + gr * (b - a); if (f(c) < f(d)) b = d; else a = c; }
    return (a + b) / 2;
  }
  const gStar = m => argmin(g => J(m, g), G0, G1);   // policy best response
  const mStar = g => argmin(m => J(m, g), M0, M1);   // design best response
  let opt = { m: 1, g: 1 };
  for (let i = 0; i < 30; i++) { opt.g = gStar(opt.m); opt.m = mStar(opt.g); }
  const Jopt = J(opt.m, opt.g);

  const cv = document.getElementById('pg-canvas');
  if (!cv) return;
  const over = document.getElementById('pg-over');
  const N = 300; cv.width = N; cv.height = N;
  const ctx = cv.getContext('2d');
  const toPx = (m, g) => [(m - M0) / (M1 - M0) * N, (1 - (g - G0) / (G1 - G0)) * N];
  const fromPx = (x, y) => [M0 + x / N * (M1 - M0), G0 + (1 - y / N) * (G1 - G0)];

  // heatmap: darker = better return (lower cost). Cost clipped at J* + 2 so the valley structure is visible.
  (function paint() {
    const img = ctx.createImageData(N, N), cols = RAMP.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const [m, g] = fromPx(x + 0.5, y + 0.5);
      const t = 1 - Math.min(1, Math.max(0, (J(m, g) - Jopt) / 2.0));
      const u = Math.pow(t, 1.6) * (cols.length - 1), i = Math.floor(u), f = u - i, a = cols[i], b = cols[Math.min(i + 1, cols.length - 1)];
      const k = (y * N + x) * 4;
      img.data[k] = a[0] + (b[0] - a[0]) * f; img.data[k + 1] = a[1] + (b[1] - a[1]) * f; img.data[k + 2] = a[2] + (b[2] - a[2]) * f; img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  })();

  // overlay curves (SVG, in canvas pixel units via viewBox)
  over.setAttribute('viewBox', `0 0 ${N} ${N}`);
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent = over) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
  let dG = '', dM = '';
  for (let i = 0; i <= 80; i++) { const m = M0 + (M1 - M0) * i / 80, [x, y] = toPx(m, gStar(m)); dG += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }
  for (let i = 0; i <= 80; i++) { const g = G0 + (G1 - G0) * i / 80, [x, y] = toPx(mStar(g), g); dM += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }
  el('path', { d: dG, fill: 'none', stroke: '#fffdf8', 'stroke-width': 5, opacity: 0.9 });
  el('path', { d: dG, fill: 'none', stroke: '#eb6834', 'stroke-width': 2.5 });
  el('path', { d: dM, fill: 'none', stroke: '#fffdf8', 'stroke-width': 4.5, opacity: 0.8 });
  el('path', { d: dM, fill: 'none', stroke: '#1f1d1a', 'stroke-width': 2, 'stroke-dasharray': '6 5' });
  const [lx, ly] = toPx(3.2, gStar(3.2)); const tG = el('text', { x: lx, y: ly - 9, 'font-size': 10.5, 'font-weight': 700, fill: '#1f1d1a', 'text-anchor': 'middle', 'paint-order': 'stroke', stroke: '#fffdf8', 'stroke-width': 3 }); tG.textContent = 'best gain for each body';
  const [mx, my] = toPx(mStar(4.2), 4.2); const tM = el('text', { x: mx + 8, y: my, 'font-size': 10.5, 'font-weight': 700, fill: '#1f1d1a', 'paint-order': 'stroke', stroke: '#fffdf8', 'stroke-width': 3 }); tM.textContent = 'best body for each gain';
  const [ox, oy] = toPx(opt.m, opt.g);
  el('path', { d: star(ox, oy, 9, 4), fill: '#ffcf54', stroke: '#1f1d1a', 'stroke-width': 1.4 });
  const path = el('path', { d: '', fill: 'none', stroke: '#fffdf8', 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-dasharray': '1 0' });
  const dotRing = el('circle', { r: 8, fill: 'none', stroke: '#fffdf8', 'stroke-width': 3 });
  const dot = el('circle', { r: 6, fill: '#c4502f', stroke: '#1f1d1a', 'stroke-width': 1.2 });
  function star(x, y, R1, R2) { let d = ''; for (let i = 0; i < 10; i++) { const r = i % 2 ? R2 : R1, a = -Math.PI / 2 + i * Math.PI / 5; d += (i ? 'L' : 'M') + (x + r * Math.cos(a)).toFixed(1) + ' ' + (y + r * Math.sin(a)).toFixed(1); } return d + 'Z'; }

  // state
  let cur = { m: 3.4, g: 3.8 }, trail = [], anim = null;
  const out = { m: document.getElementById('pg-m'), g: document.getElementById('pg-g'), j: document.getElementById('pg-j') };
  const verdict = document.getElementById('pg-verdict');
  function setPoint(m, g, keepTrail) {
    cur = { m: Math.min(M1, Math.max(M0, m)), g: Math.min(G1, Math.max(G0, g)) };
    const [x, y] = toPx(cur.m, cur.g);
    dot.setAttribute('cx', x); dot.setAttribute('cy', y); dotRing.setAttribute('cx', x); dotRing.setAttribute('cy', y);
    if (!keepTrail) trail = [];
    path.setAttribute('d', trail.map((p, i) => (i ? 'L' : 'M') + toPx(p.m, p.g).map(v => v.toFixed(1)).join(' ')).join(''));
    const j = J(cur.m, cur.g);
    out.m.textContent = cur.m.toFixed(2) + ' kg'; out.g.textContent = cur.g.toFixed(2); out.j.textContent = j.toFixed(3);
    out.j.style.color = j - Jopt < 0.02 ? '#1f6f68' : '';
    sim.reset();
  }
  function say(html) { verdict.innerHTML = html; }

  // pointer: click / drag on the landscape
  let dragging = false;
  function pick(ev) {
    const r = cv.getBoundingClientRect(), p = ev.touches ? ev.touches[0] : ev;
    const [m, g] = fromPx((p.clientX - r.left) / r.width * N, (p.clientY - r.top) / r.height * N);
    stop(); setPoint(m, g);
    const gap = (J(m, g) / Jopt - 1) * 100;
    say(gap < 1 ? 'Right on the joint optimum. Now try the two-stage recipe from a bad start.' : `This pair costs <b>${gap.toFixed(0)}% more</b> than the best pair (★). Notice how the best gain depends on the mass you picked.`);
  }
  cv.addEventListener('pointerdown', e => { dragging = true; cv.setPointerCapture(e.pointerId); pick(e); });
  cv.addEventListener('pointermove', e => { if (dragging) pick(e); });
  cv.addEventListener('pointerup', () => { dragging = false; });
  cv.addEventListener('keydown', e => {
    const s = e.shiftKey ? 0.25 : 0.05, k = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] }[e.key];
    if (k) { e.preventDefault(); stop(); setPoint(cur.m + k[0] * (M1 - M0), cur.g + k[1] * (G1 - G0)); }
  });

  // animations: move along a list of waypoints
  function stop() { if (anim) cancelAnimationFrame(anim); anim = null; }
  function run(points, done) {
    stop(); trail = [{ ...cur }];
    let i = 0, t0 = null; const seg = 520;
    function step(ts) {
      if (t0 === null) t0 = ts;
      const u = Math.min(1, (ts - t0) / seg), a = points[i], b = points[i + 1], e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      setPoint(a.m + (b.m - a.m) * e, a.g + (b.g - a.g) * e, true);
      if (u >= 1) { trail.push({ ...b }); i++; t0 = null; if (i >= points.length - 1) { setPoint(b.m, b.g, true); anim = null; done && done(); return; } }
      anim = requestAnimationFrame(step);
    }
    anim = requestAnimationFrame(step);
  }

  const g0In = document.getElementById('pg-g0'), g0Out = document.getElementById('pg-g0v');
  g0In.addEventListener('input', () => { g0Out.textContent = (+g0In.value).toFixed(2); });
  document.getElementById('pg-two').addEventListener('click', () => {
    const g0 = +g0In.value, m2 = mStar(g0), g2 = gStar(m2), start = { m: cur.m, g: g0 };
    setPoint(start.m, start.g);
    run([start, { m: m2, g: g0 }, { m: m2, g: g2 }], () => {
      const gap = (J(m2, g2) / Jopt - 1) * 100;
      say(`<b>Two-stage:</b> size the body against a fixed controller (g₀ = ${g0.toFixed(2)}), then tune the controller for that body. Final cost is <b>${gap < 0.5 ? 'within 0.5%' : gap.toFixed(1) + '% above'}</b> the joint optimum${gap < 0.5 ? ', because g₀ happened to be close to right. Try a g₀ far from 1.1.' : '. The body was fixed before the controller was known, and the second stage cannot undo it.'}`);
    });
  });
  document.getElementById('pg-alt').addEventListener('click', () => {
    const pts = [{ ...cur }]; let m = cur.m, g = cur.g;
    for (let i = 0; i < 4; i++) { g = gStar(m); pts.push({ m, g }); m = mStar(g); pts.push({ m, g }); }
    run(pts, () => say(`<b>Alternating best responses</b> (tune π, then θ, repeat) zig-zag between the two curves until they cross at ★, the co-design optimum. In the real environments neither best response is cheap: each is a full RL run or a design search.`));
  });
  document.getElementById('pg-opt').addEventListener('click', () => { run([{ ...cur }, { ...opt }], () => say(`The joint optimum: m = ${opt.m.toFixed(2)} kg, g = ${opt.g.toFixed(2)}, cost ${Jopt.toFixed(3)}. It is where the two best-response curves cross.`)); });

  // mini simulation of the current (m, g): the body starts displaced by 1 and is regulated back to 0
  const sim = (function () {
    const sc = document.getElementById('pg-sim'), sx = sc.getContext('2d');
    const W = 560, Hh = 150; sc.width = W * 2; sc.height = Hh * 2; sx.scale(2, 2);
    let x, v, t, hist, raf = null;
    function reset() { x = 1; v = 0; t = 0; hist = []; if (!raf) raf = requestAnimationFrame(loop); }
    function loop() {
      for (let k = 0; k < 8; k++) { const u = -cur.g * x - H * v, a = (-C * v + u) / cur.m, dt = 0.004; v += a * dt; x += v * dt; t += dt; }
      hist.push(x); if (hist.length > 360) hist.shift();
      draw(); raf = t < 14 ? requestAnimationFrame(loop) : null;
    }
    function draw() {
      sx.clearRect(0, 0, W, Hh);
      const cy = 46, x0 = 120, scale = 90;
      sx.strokeStyle = '#d3c7b0'; sx.lineWidth = 1; sx.beginPath(); sx.moveTo(10, cy + 20); sx.lineTo(W - 10, cy + 20); sx.stroke();
      sx.setLineDash([3, 4]); sx.beginPath(); sx.moveTo(x0 + 0, cy - 26); sx.lineTo(x0 + 0, cy + 20); sx.stroke(); sx.setLineDash([]);
      const bw = 26 + 16 * Math.sqrt(cur.m), px = x0 + x * scale;
      sx.fillStyle = '#c4502f'; sx.strokeStyle = '#1f1d1a'; sx.lineWidth = 1.2;
      sx.beginPath(); sx.roundRect ? sx.roundRect(px - bw / 2, cy + 20 - bw * 0.8, bw, bw * 0.8, 4) : sx.rect(px - bw / 2, cy + 20 - bw * 0.8, bw, bw * 0.8); sx.fill(); sx.stroke();
      sx.fillStyle = '#766f62'; sx.font = '11px Inter, sans-serif'; sx.fillText('target', x0 - 16, cy - 30);
      // trace
      const ty = 118, tw = W - 20; sx.strokeStyle = '#e2d8c5'; sx.beginPath(); sx.moveTo(10, ty); sx.lineTo(10 + tw, ty); sx.stroke();
      sx.strokeStyle = '#1f1d1a'; sx.lineWidth = 1.6; sx.beginPath();
      hist.forEach((h, i) => { const X = 10 + i / 360 * tw, Y = ty - h * 26; i ? sx.lineTo(X, Y) : sx.moveTo(X, Y); }); sx.stroke();
      sx.fillStyle = '#766f62'; sx.fillText('position over time', 10, Hh - 4);
    }
    return { reset };
  })();

  setPoint(cur.m, cur.g);
  say('Click or drag anywhere on the landscape to pick a <b>body</b> (mass, x-axis) and a <b>controller</b> (gain, y-axis).');
})();
