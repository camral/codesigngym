// Evolve-a-walker: a small co-design GA on 2D rigid-body physics (planck.js). Shared by the page and the Node tests.
// Genome in [0,1]^15: 6 body genes (torso width/height, thigh + shin length for the front and back leg) and 9 gait genes
// (one frequency, then amplitude + phase for each of the 4 joints). The "gait only" population keeps the body genes fixed.
(function (root) {
  const planck = root.planck || (typeof require !== 'undefined' ? require('./planck.min.js') : null);
  const { World, Vec2, Box, Edge, RevoluteJoint } = planck;
  const NB = 6, NG = 9, N = NB + NG, T_SIM = 8, HZ = 60, ALIVE = 1.5;
  const BASE_BODY = [0.45, 0.4, 0.4, 0.4, 0.4, 0.4];   // a plain rectangular walker with equal legs
  // the body drifts slowly (small, rare mutations) so the gait can keep up with it: large body jumps break gaits tuned to the old body
  let BODY_RATE = 0.15, BODY_SIGMA = 0.05;
  const RANGE = { w: [0.5, 1.5], th: [0.14, 0.4], leg: [0.18, 0.75], f: [0.6, 3.0], amp: [0, 1.3] };
  const lerp = (r, u) => r[0] + (r[1] - r[0]) * u;

  function decode(g) {
    return {
      w: lerp(RANGE.w, g[0]), th: lerp(RANGE.th, g[1]), legs: [[lerp(RANGE.leg, g[2]), lerp(RANGE.leg, g[3])], [lerp(RANGE.leg, g[4]), lerp(RANGE.leg, g[5])]],
      f: lerp(RANGE.f, g[6]), joints: [0, 1, 2, 3].map(j => ({ amp: lerp(RANGE.amp, g[7 + 2 * j]), ph: g[8 + 2 * j] * 2 * Math.PI }))
    };
  }

  // build a world with one walker; returns handles to step and read it
  function build(g) {
    const d = decode(g), world = new World({ gravity: Vec2(0, -9.81) });
    world.createBody().createFixture(Edge(Vec2(-50, 0), Vec2(400, 0)), { friction: 1.0 });
    const legH = Math.max(d.legs[0][0] + d.legs[0][1], d.legs[1][0] + d.legs[1][1]);
    const y0 = legH + d.th / 2 + 0.02;
    const torso = world.createDynamicBody(Vec2(0, y0));
    torso.createFixture(Box(d.w / 2, d.th / 2), { density: 1.0, friction: 0.6, filterGroupIndex: -1 });
    const parts = [{ b: torso, hw: d.w / 2, hh: d.th / 2, kind: 'torso' }], joints = [];
    [-1, 1].forEach((side, li) => {
      const [lt, ls] = d.legs[li], hx = side * d.w * 0.42, hy = y0 - d.th / 2;
      const thigh = world.createDynamicBody(Vec2(hx, hy - lt / 2));
      thigh.createFixture(Box(0.045, lt / 2), { density: 1.0, friction: 0.6, filterGroupIndex: -1 });
      const shin = world.createDynamicBody(Vec2(hx, hy - lt - ls / 2));
      shin.createFixture(Box(0.04, ls / 2), { density: 1.0, friction: 1.2, filterGroupIndex: -1 });
      const hip = world.createJoint(RevoluteJoint({ enableMotor: true, maxMotorTorque: 60, enableLimit: true, lowerAngle: -1.3, upperAngle: 1.3 }, torso, thigh, Vec2(hx, hy)));
      const knee = world.createJoint(RevoluteJoint({ enableMotor: true, maxMotorTorque: 40, enableLimit: true, lowerAngle: -1.6, upperAngle: 0.1 }, thigh, shin, Vec2(hx, hy - lt)));
      joints.push(hip, knee);
      parts.push({ b: thigh, hw: 0.045, hh: lt / 2, kind: 'thigh', leg: li }, { b: shin, hw: 0.04, hh: ls / 2, kind: 'shin', leg: li });
    });
    let t = 0;
    function step() {
      d.joints.forEach((jd, k) => {
        const j = joints[k], tgt = jd.amp * Math.sin(2 * Math.PI * d.f * t + jd.ph) - (k % 2 ? 0.4 : 0);   // knees bias slightly bent
        j.setMotorSpeed(Math.max(-12, Math.min(12, 8 * (tgt - j.getJointAngle()))));
      });
      world.step(1 / HZ, 8, 3); t += 1 / HZ;
    }
    return { world, torso, parts, step, get t() { return t; }, x0: 0, d };
  }

  // like Gymnasium's healthy termination: the episode ends when the torso tips past MAX_TILT
  const MAX_TILT = 1.0;
  const fallen = s => Math.abs(Math.atan2(Math.sin(s.torso.getAngle()), Math.cos(s.torso.getAngle()))) > MAX_TILT;
  function fitness(g) {
    const s = build(g);
    // reward: distance walked + ALIVE per second spent upright (Gymnasium-style healthy bonus), so a lunge that falls scores poorly
    let i = 0;
    for (; i < T_SIM * HZ; i++) { s.step(); if (fallen(s)) break; }
    const x = s.torso.getPosition().x, f = x + ALIVE * (i / HZ);
    return isFinite(f) ? f : -10;
  }

  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

  // a small GA; freezeBody keeps the 6 body genes at BASE_BODY (policy-only search on a fixed design)
  function Population(size, seed, freezeBody, body) {
    const r = rng(seed), B0 = body || BASE_BODY;
    const fix = g => { if (freezeBody) for (let i = 0; i < NB; i++) g[i] = B0[i]; return g; };
    // both lanes start from the base body with random gaits (same seed -> identical starting populations), so the only
    // difference between them is whether mutation may also change the body
    this.members = Array.from({ length: size }, () => ({ g: Array.from({ length: N }, (_, i) => (i < NB ? B0[i] : r())), fit: null }));
    this.gen = 0; this.best = null; this.history = []; this.freezeBody = freezeBody;
    this.evaluate = function (from, to) { for (let i = from; i < Math.min(to, size); i++) if (this.members[i].fit === null) this.members[i].fit = fitness(this.members[i].g); };
    this.next = function () {
      const m = this.members.slice().sort((a, b) => b.fit - a.fit);
      if (!this.best || m[0].fit > this.best.fit) this.best = { g: m[0].g.slice(), fit: m[0].fit, gen: this.gen };
      this.history.push(this.best.fit);
      const elite = m.slice(0, 3).map(x => ({ g: x.g.slice(), fit: x.fit }));
      const pick = () => { const a = m[Math.floor(r() * size)], b = m[Math.floor(r() * size)]; return a.fit > b.fit ? a : b; };
      const kids = [];
      while (kids.length < size - elite.length) {
        const p1 = pick(), p2 = pick(), g = p1.g.map((v, i) => (r() < 0.5 ? v : p2.g[i]));
        for (let i = 0; i < N; i++) { const body = i < NB; if (r() < (body ? BODY_RATE : 0.25)) g[i] = Math.min(1, Math.max(0, g[i] + (body ? BODY_SIGMA : 0.12) * gauss(r))); }
        kids.push({ g: fix(g), fit: null });
      }
      this.members = elite.concat(kids); this.gen++;
    };
  }

  const api = { setBodyMutation(rate, sigma) { BODY_RATE = rate; BODY_SIGMA = sigma; }, N, NB, NG, T_SIM, HZ, ALIVE, BASE_BODY, MAX_TILT, decode, build, fitness, fallen, Population };
  if (typeof module !== 'undefined') module.exports = api; else root.WalkerCore = api;
})(this);
