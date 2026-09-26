// "Bodies matter": reshape a 2D walker and compare it walking with the gait evolved for the base body (top lane) against a gait
// evolved for it (bottom lane). A leaderboard keeps every body tried; "Search bodies" runs an outer loop that evolves a gait per body.
(function () {
  const Wk = window.WalkerCore, root = document.getElementById('demo-walker');
  if (!Wk || !root) return;
  const $ = s => root.querySelector(s);
  const cv = $('canvas'), ctx = cv.getContext('2d');
  const LANE = 190, H = LANE * 2 + 8, POP = 24, GENS = 40, SEED = 1;
  let W = 960;   // logical canvas width: narrower on phones so labels and bodies stay legible
  const PRESETS = [
    ['base', 'Base body', [0.45, 0.4, 0.4, 0.4, 0.4, 0.4]], ['longshin', 'Long shins', [0.45, 0.4, 0.2, 0.9, 0.2, 0.9]],
    ['longlegs', 'Long legs', [0.45, 0.4, 0.85, 0.85, 0.85, 0.85]], ['longthigh', 'Long thighs', [0.45, 0.4, 0.9, 0.2, 0.9, 0.2]],
    ['stubby', 'Stubby', [0.45, 0.4, 0.05, 0.05, 0.05, 0.05]], ['tall', 'Tall & narrow', [0.05, 0.9, 0.6, 0.6, 0.6, 0.6]], ['wide', 'Wide & flat', [0.95, 0.2, 0.4, 0.4, 0.4, 0.4]]];
  const SL = { w: $('#wk-w'), th: $('#wk-th'), thigh: $('#wk-thigh'), shin: $('#wk-shin') };
  let dpr = 1, body = PRESETS[0][2].slice(), baseGait = null, lanes = [null, null], cam = [0, 0], busy = false, visible = true;
  const board = new Map();   // key -> {name, body, withBase, own, ownG}

  function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); W = (cv.clientWidth || 960) < 620 ? 560 : 960; cv.style.aspectRatio = `${W} / ${H}`; cv.width = W * dpr; cv.height = H * dpr; }
  const bodyKey = b => b.map(v => (+v).toFixed(2)).join(',');
  const sym = () => [+SL.w.value, +SL.th.value, +SL.thigh.value, +SL.shin.value, +SL.thigh.value, +SL.shin.value];
  function setSliders(b) { SL.w.value = b[0]; SL.th.value = b[1]; SL.thigh.value = b[2]; SL.shin.value = b[3]; labels(); }
  function labels() { const d = Wk.decode(sym().concat(Array(9).fill(0.5))); $('#wk-wv').textContent = d.w.toFixed(2) + ' m'; $('#wk-thv').textContent = d.th.toFixed(2) + ' m'; $('#wk-thighv').textContent = d.legs[0][0].toFixed(2) + ' m'; $('#wk-shinv').textContent = d.legs[0][1].toFixed(2) + ' m'; }
  function distance(g) { const s = Wk.build(g); let i = 0; for (; i < Wk.T_SIM * Wk.HZ; i++) { s.step(); if (Wk.fallen(s)) break; } return Math.max(0, s.torso.getPosition().x); }
  function lane(k, g, label) { cam[k] = 0; lanes[k] = { sim: Wk.build(g), g, fell: false, hold: 0, label, dist: distance(g) }; }
  const nameOf = b => (PRESETS.find(p => bodyKey(p[2]) === bodyKey(b)) || [0, 'Custom body'])[1];

  // evolve a gait for a fixed body, a few generations per frame so the page stays live; resolves with the best genome
  function evolveGait(b, onGen) {
    return new Promise(res => {
      const P = new Wk.Population(POP, SEED, true, b);
      (function tick() {
        const t0 = performance.now();
        while (performance.now() - t0 < 12 && P.gen < GENS) { P.evaluate(0, POP); P.next(); }
        onGen && onGen(P);
        if (P.gen < GENS) requestAnimationFrame(tick); else res(P.best.g);
      })();
    });
  }
  function ensureBase() { return baseGait ? Promise.resolve(baseGait) : evolveGait(PRESETS[0][2]).then(g => (baseGait = g.slice(6), baseGait)); }

  function showBody(b) {
    body = b.slice();
    lane(0, body.concat(baseGait), 'with the gait evolved for the base body');
    const e = board.get(bodyKey(body));
    if (e && e.own !== undefined) lane(1, e.ownG, 'with a gait evolved for this body'); else lanes[1] = null;
    $('#wk-name').textContent = nameOf(body);
  }
  function record(b, withBase, own, ownG) {
    const k = bodyKey(b), e = board.get(k) || { name: nameOf(b), body: b.slice() };
    if (withBase !== undefined) e.withBase = withBase;
    if (own !== undefined) { e.own = own; e.ownG = ownG; }
    board.set(k, e); renderBoard();
  }
  function renderBoard() {
    const rows = [...board.values()].sort((a, b) => (b.own ?? -1) - (a.own ?? -1) || (b.withBase ?? -1) - (a.withBase ?? -1));
    const top = rows.length && rows[0].own !== undefined ? rows[0] : null;
    $('#wk-board').innerHTML = `<table><thead><tr><th>Body</th><th title="walking with the gait evolved for the base body">base gait</th><th title="walking with a gait evolved for this body">own gait</th></tr></thead><tbody>${rows.map(r =>
      `<tr class="${r === top ? 'best' : ''}" data-k="${bodyKey(r.body)}" tabindex="0"><td>${sketch(r.body)}<span>${r.name}</span></td><td>${r.withBase === undefined ? '–' : r.withBase.toFixed(1) + ' m'}</td><td>${r.own === undefined ? '<em>not yet</em>' : '<b>' + r.own.toFixed(1) + ' m</b>'}</td></tr>`).join('')}</tbody></table>`;
  }
  function sketch(b) { // tiny side-view silhouette of a body
    const d = Wk.decode(b.concat(Array(9).fill(0.5))), S = 22, lh = d.legs[0][0] + d.legs[0][1], w = d.w * S, y0 = 2 + d.th * S, H2 = y0 + lh * S + 2;
    const xs = [-0.42 * w, 0.42 * w].map(x => x + 22);
    return `<svg viewBox="0 0 44 ${H2.toFixed(0)}" width="28" height="${Math.min(36, H2 * 28 / 44).toFixed(0)}" aria-hidden="true"><rect x="${(22 - w / 2).toFixed(1)}" y="2" width="${w.toFixed(1)}" height="${(d.th * S).toFixed(1)}" rx="2" fill="#1f6f68"/>${xs.map(x => `<line x1="${x.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y0 + lh * S).toFixed(1)}" stroke="#45413a" stroke-width="2.6" stroke-linecap="round"/>`).join('')}</svg>`;
  }
  $('#wk-board').addEventListener('click', e => { const tr = e.target.closest('tr[data-k]'); if (!tr || busy) return; const r = board.get(tr.dataset.k); setSliders(r.body); showBody(r.body); markPreset(); });

  // ---------------------------------------------------------------- actions
  function setBusy(b) { busy = b; root.querySelectorAll('button, input').forEach(x => x.disabled = b); root.classList.toggle('busy', b); }
  function say(h) { $('#wk-say').innerHTML = h; }
  async function evolveCurrent(quiet) {
    const b = body.slice(); if (!quiet) setBusy(true); lanes[1] = null;
    const g = await evolveGait(b, P => { $('#wk-gen').textContent = `gen ${P.gen} / ${GENS}`; if (P.best && P.gen % 8 === 0) lane(1, P.best.g, `evolving a gait for this body… generation ${P.gen}`); });
    const d = distance(g); lane(1, g, 'with a gait evolved for this body'); record(b, distance(b.concat(baseGait)), d, g); if (!quiet) setBusy(false);
    const wb = board.get(bodyKey(b)).withBase, base = board.get(bodyKey(PRESETS[0][2]));
    if (!quiet) say(`<b>${nameOf(b)}: ${d.toFixed(1)} m with its own gait</b>, against ${wb.toFixed(1)} m borrowing the base body's gait.${base && base.own !== undefined && bodyKey(b) !== bodyKey(PRESETS[0][2]) ? ` The base body manages ${base.own.toFixed(1)} m with its own.` : ''} You can only judge a body after optimizing its policy.`);
    return d;
  }
  $('#wk-evolve').addEventListener('click', () => evolveCurrent(false));
  $('#wk-search').addEventListener('click', async () => {
    // outer design loop: every preset body plus two random ones; each gets its own gait search
    const r = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
    const cands = PRESETS.map(p => p[2]).concat([0, 1].map(() => { const t = r(), s = r(); return [r(), r(), t, s, t, s].map(v => +v.toFixed(2)); }));
    let best = null; setBusy(true);
    for (let i = 0; i < cands.length; i++) {
      const b = cands[i]; setSliders(b); markPreset(); showBody(b);
      say(`Searching bodies… candidate ${i + 1} of ${cands.length}: <b>${nameOf(b)}</b>. Each body gets its own ${GENS}-generation gait search.`);
      const e = board.get(bodyKey(b));
      const d = e && e.own !== undefined ? e.own : await evolveCurrent(true);
      if (!best || d > best.d) best = { b, d };
    }
    setSliders(best.b); markPreset(); showBody(best.b); setBusy(false);
    const worst = Math.max(...[...board.values()].filter(x => bodyKey(x.body) !== bodyKey(PRESETS[0][2])).map(x => x.withBase || 0));
    say(`<b>Best body found: ${nameOf(best.b)}, ${best.d.toFixed(1)} m.</b> With the base body's gait, no other body gets past ${worst.toFixed(1)} m, so a search that tuned the gait first and then judged bodies with it would never have picked this one.`);
  });
  for (const k in SL) SL[k].addEventListener('input', () => {
    if (busy || !baseGait) return; labels(); const b = sym(); record(b, distance(b.concat(baseGait))); showBody(b); markPreset();
    say(`Custom body: it walks <b>${board.get(bodyKey(b)).withBase.toFixed(1)} m</b> with the base body's gait. Evolve a gait for it to see what it can really do.`);
  });
  $('#wk-presets').innerHTML = PRESETS.map(([k, n]) => `<button type="button" class="chip" data-p="${k}" aria-pressed="false">${n}</button>`).join('');
  function markPreset() { const k = bodyKey(sym()); $('#wk-presets').querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', bodyKey(PRESETS.find(p => p[0] === c.dataset.p)[2]) === k)); }
  $('#wk-presets').addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c || busy || !baseGait) return;
    const p = PRESETS.find(p => p[0] === c.dataset.p); setSliders(p[2]); record(p[2], distance(p[2].concat(baseGait))); showBody(p[2]); markPreset();
    say(`<b>${p[1]}</b> with the base body's gait: ${board.get(bodyKey(p[2])).withBase.toFixed(1)} m. ${board.get(bodyKey(p[2])).own !== undefined ? 'Its own evolved gait is in the bottom lane.' : 'Now evolve a gait for it.'}`);
  });

  // ---------------------------------------------------------------- drawing
  function shade(hex, k) { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const S = 70, col = ['#c4502f', '#1f6f68'];
    [0, 1].forEach(k => {
      const oy = k * (LANE + 8), gy = oy + LANE - 34, L = lanes[k], x0 = cam[k];
      ctx.fillStyle = k ? '#eef6f4' : '#fbf1ec'; ctx.fillRect(0, oy, W, LANE);
      ctx.fillStyle = '#e4d9c4'; ctx.fillRect(0, gy, W, LANE - (gy - oy));
      for (let m = Math.floor(x0 - 4); m < x0 + 12; m++) {
        const X = (m - x0) * S + W * 0.42; if (X < -20 || X > W + 20) continue;
        ctx.strokeStyle = '#cdbfa5'; ctx.beginPath(); ctx.moveTo(X, gy); ctx.lineTo(X, gy + (m % 5 ? 6 : 12)); ctx.stroke();
        if (m % 5 === 0 && m >= 0) { ctx.fillStyle = '#9b917f'; ctx.font = '11px Inter, sans-serif'; ctx.fillText(m + ' m', X - 8, gy + 25); }
      }
      ctx.fillStyle = col[k]; ctx.font = '700 13px Inter, sans-serif'; ctx.fillText(L ? L.label : (k ? 'no gait evolved for this body yet' : 'evolving the base body’s gait…'), 14, oy + 22);
      if (!L) { if (k) { ctx.fillStyle = '#766f62'; ctx.font = '12px Inter, sans-serif'; ctx.fillText('press “Evolve a gait for this body”', 14, oy + 40); } return; }
      ctx.fillStyle = '#766f62'; ctx.font = '12px Inter, sans-serif'; ctx.fillText(`walks ${L.dist.toFixed(1)} m in ${Wk.T_SIM} s`, 14, oy + 40);
      L.sim.parts.forEach(p => {
        const pos = p.b.getPosition(), a = p.b.getAngle();
        ctx.save(); ctx.translate((pos.x - x0) * S + W * 0.42, gy - pos.y * S); ctx.rotate(-a);
        ctx.fillStyle = p.kind === 'torso' ? col[k] : p.leg ? shade(col[k], -0.25) : shade(col[k], 0.25);
        ctx.strokeStyle = '#1f1d1a'; ctx.lineWidth = 1.6;
        const w = p.hw * 2 * S, h = p.hh * 2 * S; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) / 2.2) : ctx.rect(-w / 2, -h / 2, w, h); ctx.fill(); ctx.stroke(); ctx.restore();
      });
      if (L.fell) { ctx.fillStyle = '#c4502f'; ctx.font = '600 20px Caveat, cursive'; ctx.fillText('fell over', W - 110, oy + 32); }
    });
  }
  function frame() {
    lanes.forEach((L, k) => {
      if (!L) return;
      if (!L.fell && L.sim.t < Wk.T_SIM) { L.sim.step(); if (Wk.fallen(L.sim)) L.fell = true; }
      else if (!L.hold) L.hold = performance.now();
      else if (performance.now() - L.hold > 1200) { lane(k, L.g, L.label); return; }
      cam[k] += (L.sim.torso.getPosition().x - cam[k]) * 0.08;
    });
    if (visible) draw();
    requestAnimationFrame(frame);
  }

  let booting = false;
  async function boot() {
    if (booting) return; booting = true; setBusy(true); say('Evolving a gait for the base body first (it takes a second)…');
    await ensureBase(); setBusy(false);
    const b = PRESETS[0][2], d = distance(b.concat(baseGait)); record(b, d, d, b.concat(baseGait)); showBody(b); markPreset();
    say('Both lanes show the <b>base body</b> with the gait evolved for it. Pick another body (or drag the sliders): the top lane tries the same gait on it. Then evolve a gait of its own.');
  }
  new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; if (visible && !baseGait) boot(); }), { threshold: 0.05 }).observe(root);
  window.addEventListener('resize', resize);
  resize(); setSliders(body); renderBoard(); requestAnimationFrame(frame);
  window.WalkerDemo = { get board() { return [...board.values()].map(r => ({ name: r.name, withBase: r.withBase, own: r.own })); }, get busy() { return busy; } };
})();
