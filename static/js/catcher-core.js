// Build-a-catcher: a 2D planar toy of the BallCatcher co-design problem. Pure functions, shared by the page and the Node tests.
// Design: torso height h and two arm-link lengths L1, L2. Policy: aim the hand at where the ball will be `lead` seconds from now.
// Trade-off baked into the body: joint speed falls with arm inertia, so a longer arm reaches further but moves slower.
(function (root) {
  const G = 9.81, DT = 0.01, CATCH_R = 0.14;
  const BOUNDS = { h: [0.3, 1.6], L1: [0.25, 1.3], L2: [0.25, 1.3], lead: [0, 0.8] };
  const BASE = { h: 0.9, L1: 0.55, L2: 0.5 };

  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // a fixed set of throws from a pitcher at x = 6 m: some short lobs, some long, some fast and flat
  function makeThrows(n = 20, seed = 7) {
    const r = rng(seed), out = [];
    for (let i = 0; i < n; i++) {
      const land = -0.3 + r() * 3.3, T = 0.45 + r() * 0.55, y0 = 0.8 + r() * 0.6;  // landing x, flight time, release height
      const vx = (land - 6) / T, vy = (0.5 * G * T * T - y0) / T;
      out.push({ x0: 6, y0, vx, vy, T });
    }
    return out;
  }
  const ballAt = (b, t) => ({ x: b.x0 + b.vx * t, y: b.y0 + b.vy * t - 0.5 * G * t * t });
  const omega = d => 6 / Math.pow(d.L1 + 0.6 * d.L2, 2);   // rad/s joint speed limit from a crude arm-inertia proxy

  function fk(d, q) {
    const ex = d.L1 * Math.cos(q[0]), ey = d.h + d.L1 * Math.sin(q[0]);
    return { ex, ey, tx: ex + d.L2 * Math.cos(q[0] + q[1]), ty: ey + d.L2 * Math.sin(q[0] + q[1]) };
  }
  function ik(d, x, y, q) { // both elbow branches; pick the one nearest the current joints
    let dx = x, dy = y - d.h, r = Math.hypot(dx, dy);
    const rmax = d.L1 + d.L2 - 1e-3, rmin = Math.abs(d.L1 - d.L2) + 1e-3;
    if (r > rmax) { dx *= rmax / r; dy *= rmax / r; r = rmax; } else if (r < rmin) { const k = rmin / Math.max(r, 1e-6); dx *= k; dy *= k; r = rmin; }
    const c2 = Math.max(-1, Math.min(1, (r * r - d.L1 * d.L1 - d.L2 * d.L2) / (2 * d.L1 * d.L2)));
    let best = null, bd = Infinity;
    for (const s of [1, -1]) {
      const q2 = s * Math.acos(c2), q1 = Math.atan2(dy, dx) - Math.atan2(d.L2 * Math.sin(q2), d.L1 + d.L2 * Math.cos(q2));
      const dd = Math.abs(wrap(q1 - q[0])) + Math.abs(q2 - q[1]);
      if (dd < bd) { bd = dd; best = [q[0] + wrap(q1 - q[0]), q2]; }
    }
    return best;
  }
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const Q0 = [-1.1, 0.9];

  // simulate one throw; returns {caught, t, trace?}
  function runThrow(d, lead, b, record) {
    const w = omega(d); let q = Q0.slice(), t = 0; const tr = record ? [] : null;
    while (true) {
      const p = ballAt(b, t);
      if (p.y < 0) { if (tr) tr.push({ t, q: q.slice(), p }); return { caught: false, t, trace: tr, land: p.x }; }
      const aim = ballAt(b, Math.min(t + lead, b.T)); const tgt = ik(d, aim.x, Math.max(0.05, aim.y), q);
      for (let j = 0; j < 2; j++) { const e = tgt[j] - q[j], m = w * DT; q[j] += Math.max(-m, Math.min(m, e)); }
      const f = fk(d, q);
      if (tr) tr.push({ t, q: q.slice(), p });
      if (Math.hypot(f.tx - p.x, f.ty - p.y) < CATCH_R) return { caught: true, t, trace: tr, land: p.x };
      t += DT;
    }
  }
  function score(d, lead, throws) { let n = 0; for (const b of throws) if (runThrow(d, lead, b, false).caught) n++; return n; }
  function bestLead(d, throws) { let bl = 0, bs = -1; for (let i = 0; i <= 20; i++) { const l = i * 0.04, s = score(d, l, throws); if (s > bs) { bs = s; bl = l; } } return { lead: bl, score: bs }; }
  const clampD = d => ({ h: cl(d.h, BOUNDS.h), L1: cl(d.L1, BOUNDS.L1), L2: cl(d.L2, BOUNDS.L2) });
  const cl = (v, [a, b]) => Math.max(a, Math.min(b, v));
  // design search for a fixed lead (or jointly, with lead re-tuned per candidate): random samples then local refinement, deterministic
  function searchBody(throws, lead, joint, seed = 3, samples = 160, onStep) {
    const r = rng(seed), evalD = d => joint ? bestLead(d, throws) : { lead, score: score(d, lead, throws) };
    let best = { d: { ...BASE }, ...evalD(BASE) }; const hist = [best];
    const consider = d => { const e = evalD(d); if (e.score > best.score) { best = { d, ...e }; hist.push(best); onStep && onStep(best); } };
    for (let i = 0; i < samples; i++) consider(clampD({ h: lo(BOUNDS.h) + r() * sp(BOUNDS.h), L1: lo(BOUNDS.L1) + r() * sp(BOUNDS.L1), L2: lo(BOUNDS.L2) + r() * sp(BOUNDS.L2) }));
    for (let i = 0; i < 90; i++) consider(clampD({ h: best.d.h + (r() - 0.5) * 0.3, L1: best.d.L1 + (r() - 0.5) * 0.25, L2: best.d.L2 + (r() - 0.5) * 0.25 }));
    return { best, hist };
  }
  const lo = b => b[0], sp = b => b[1] - b[0];
  const api = { G, DT, CATCH_R, BOUNDS, BASE, Q0, makeThrows, ballAt, omega, fk, ik, runThrow, score, bestLead, searchBody, clampD };
  if (typeof module !== 'undefined') module.exports = api; else root.CatcherCore = api;
})(this);
