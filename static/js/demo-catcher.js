// Build-a-catcher UI: drag the robot to reshape it, pick how far ahead it aims, throw 20 balls, or let a search tune body / policy / both.
(function () {
  const C = window.CatcherCore, root = document.getElementById('demo-catcher');
  if (!C || !root) return;
  const $ = s => root.querySelector(s);
  const cv = $('canvas'), ctx = cv.getContext('2d');
  const throws = C.makeThrows();
  let W = 960, H = 360, S = 118, X0 = 150, Y0 = 318;     // world -> px: x' = X0 + x*S, y' = Y0 - y*S (a tighter frame on phones)
  const px = (x, y) => [X0 + x * S, Y0 - y * S], wx = (X, Y) => [(X - X0) / S, (Y0 - Y) / S];
  let dpr = 1;
  let FS = 1;   // canvas font scale: the canvas is drawn wide and shrunk on phones, so text is drawn larger there
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    [W, H, S, X0, Y0] = (cv.clientWidth || 960) < 620 ? [640, 320, 80, 96, 276] : [960, 360, 118, 150, 318];
    FS = W < 700 ? 1.5 : 1; cv.style.aspectRatio = `${W} / ${H}`; cv.width = W * dpr; cv.height = H * dpr; draw();
  }

  const st = { d: { ...C.BASE }, lead: 0, q: C.Q0.slice(), ball: null, trail: [], results: Array(throws.length).fill(null), busy: false, anim: null };
  const ui = { h: $('#cc-h'), L1: $('#cc-L1'), L2: $('#cc-L2'), lead: $('#cc-lead') };
  const fmtLead = v => (v < 0.005 ? 'chase the ball' : v.toFixed(2) + ' s ahead');
  const aimText = v => (v < 0.005 ? 'just chase the ball' : 'aim ' + v.toFixed(2) + ' s ahead');

  function syncUI() {
    for (const k of ['h', 'L1', 'L2']) { ui[k].value = st.d[k]; $(`#cc-${k}v`).textContent = st.d[k].toFixed(2) + ' m'; }
    ui.lead.value = st.lead; $('#cc-leadv').textContent = fmtLead(st.lead);
    const w = C.omega(st.d), wmax = C.omega({ L1: 0.25, L2: 0.25 });
    $('#cc-speed').style.width = Math.round(100 * Math.min(1, w / wmax)) + '%';
    $('#cc-speedv').textContent = w.toFixed(1) + ' rad/s';
    $('#cc-reach').textContent = (st.d.L1 + st.d.L2).toFixed(2) + ' m';
    $('#cc-reachbar').style.width = Math.round(100 * (st.d.L1 + st.d.L2) / (C.BOUNDS.L1[1] + C.BOUNDS.L2[1])) + '%';
  }
  function setScore(res) {
    st.results = res;
    const n = res.filter(r => r === true).length, done = res.every(r => r !== null);
    const any = res.some(r => r !== null), el = $('#cc-score'); el.textContent = n; el.classList.toggle('empty', !any && !done);
    $('#cc-dots').innerHTML = res.map((r, i) => `<i class="${r === null ? '' : r ? 'hit' : 'miss'}" title="throw ${i + 1}: ${r === null ? 'not thrown' : r ? 'caught' : 'missed'}"></i>`).join('');
  }
  function say(html) { $('#cc-say').innerHTML = html; }
  function invalidate() { setScore(Array(throws.length).fill(null)); st.ball = null; st.trail = []; st.q = C.Q0.slice(); draw(); }

  for (const k of ['h', 'L1', 'L2']) ui[k].addEventListener('input', () => { if (st.busy) return; st.d[k] = +ui[k].value; syncUI(); invalidate(); });
  ui.lead.addEventListener('input', () => { if (st.busy) return; st.lead = +ui.lead.value; syncUI(); invalidate(); });

  // ---------------------------------------------------------------- drawing
  function capsule(x1, y1, x2, y2, r, fill) {
    ctx.lineCap = 'round'; ctx.strokeStyle = '#0a0e17'; ctx.lineWidth = 2 * r + 3; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = fill; ctx.lineWidth = 2 * r; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    // sky + ground
    const g = ctx.createLinearGradient(0, 0, 0, Y0); g.addColorStop(0, '#f7f9fc'); g.addColorStop(1, '#eef2f8'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Y0);
    ctx.fillStyle = '#e4e8ef'; ctx.fillRect(0, Y0, W, H - Y0);
    ctx.strokeStyle = '#cdd5e1'; ctx.lineWidth = 1;
    ctx.textAlign = 'center'; ctx.fillStyle = '#5d6779'; ctx.font = `${11 * FS}px Inter, sans-serif`;
    for (let m = -1; m <= 7; m++) { const [x] = px(m, 0); if (x < 18 || x > W - 18) continue; ctx.beginPath(); ctx.moveTo(x, Y0); ctx.lineTo(x, Y0 + 6); ctx.stroke(); ctx.fillText(m + ' m', x, Y0 + 22); }
    ctx.textAlign = 'left';
    // reach circle (where the hand can get to)
    const [sx, sy] = px(0, st.d.h);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, Y0); ctx.clip();
    ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(37,99,235,.4)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(sx, sy, (st.d.L1 + st.d.L2) * S, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    // past landing spots
    throws.forEach((b, i) => { const r = st.results[i]; if (r !== false) return; const lx = b.x0 + b.vx * b.T; const [x] = px(lx, 0); ctx.fillStyle = '#dc2626'; ctx.font = 'bold 13px Inter, sans-serif'; ctx.fillText('×', x - 4, Y0 - 3); });
    // pitcher
    const [pxx, pyy] = px(6.05, 0);
    ctx.fillStyle = '#cdd5e1'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(pxx - 16, pyy - 64, 32, 64, 6) : ctx.rect(pxx - 16, pyy - 64, 32, 64); ctx.fill();
    ctx.fillStyle = '#5d6779'; ctx.font = `600 ${11 * FS}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('pitcher', pxx, pyy - 72); ctx.textAlign = 'left';
    // ball trail + ball
    if (st.trail.length) { ctx.strokeStyle = 'rgba(37,99,235,.35)'; ctx.lineWidth = 2; ctx.beginPath(); st.trail.forEach((p, i) => { const [x, y] = px(p.x, p.y); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); }
    // robot: pedestal, torso, arm
    const [bx, by] = px(0, 0);
    ctx.fillStyle = '#283142'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx - 34, by - 18, 68, 18, 5) : ctx.rect(bx - 34, by - 18, 68, 18); ctx.fill();
    capsule(bx, by - 14, sx, sy, 11, '#8a95a8');
    const f = C.fk(st.d, st.q), [ex, ey] = px(f.ex, f.ey), [tx, ty] = px(f.tx, f.ty);
    capsule(sx, sy, ex, ey, 9, '#283142'); capsule(ex, ey, tx, ty, 7.5, '#3b4a63');
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#0a0e17'; ctx.lineWidth = 2;
    [[sx, sy, 7], [ex, ey, 6]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.arc(tx, ty, C.CATCH_R * S * 0.62, 0, Math.PI * 2); ctx.fill(); ctx.stroke();   // the catching hand
    if (st.ball) { const [x, y] = px(st.ball.x, st.ball.y); ctx.fillStyle = st.ball.caught ? '#16a34a' : '#dc2626'; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#0a0e17'; ctx.lineWidth = 1.5; ctx.stroke(); }
    // drag handles (design mode only)
    if (!st.busy && !st.ball) {
      handles().forEach(h => { ctx.fillStyle = 'rgba(37,99,235,.12)'; ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1.6; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(h.x, h.y, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); });
      const ty2 = Math.max(26, sy - (st.d.L1 + st.d.L2) * S - 12), tx2 = Math.max(12, sx - 40);
      ctx.font = `600 ${13 * FS}px Inter, sans-serif`; ctx.lineWidth = 5; ctx.strokeStyle = '#f7f9fc'; ctx.lineJoin = 'round'; ctx.strokeText('Drag the dashed rings to reshape the robot', tx2, ty2);
      ctx.fillStyle = '#2563eb'; ctx.fillText('Drag the dashed rings to reshape the robot', tx2, ty2);
    }
  }
  // handles live on the robot in its current pose: shoulder (height), elbow (upper arm), hand (forearm)
  function handles() {
    const f = C.fk(st.d, st.q), [sx, sy] = px(0, st.d.h), [ex, ey] = px(f.ex, f.ey), [tx, ty] = px(f.tx, f.ty);
    return [{ k: 'h', x: sx, y: sy }, { k: 'L1', x: ex, y: ey }, { k: 'L2', x: tx, y: ty }];
  }
  let drag = null;
  function pos(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
  cv.addEventListener('pointerdown', e => {
    if (st.busy) return; const [X, Y] = pos(e);
    if (st.ball) { st.ball = null; st.trail = []; st.q = C.Q0.slice(); draw(); }
    const h = handles().find(h => Math.hypot(h.x - X, h.y - Y) < 22); if (!h) return;
    drag = h.k; cv.setPointerCapture(e.pointerId); e.preventDefault();
  });
  cv.addEventListener('pointermove', e => {
    const [X, Y] = pos(e);
    if (!drag) { cv.style.cursor = !st.busy && handles().some(h => Math.hypot(h.x - X, h.y - Y) < 22) ? 'grab' : 'default'; return; }
    const [x, y] = wx(X, Y), B = C.BOUNDS, f = C.fk(st.d, st.q);
    if (drag === 'h') st.d.h = Math.max(B.h[0], Math.min(B.h[1], y));
    if (drag === 'L1') st.d.L1 = Math.max(B.L1[0], Math.min(B.L1[1], Math.hypot(x, y - st.d.h)));
    if (drag === 'L2') st.d.L2 = Math.max(B.L2[0], Math.min(B.L2[1], Math.hypot(x - f.ex, y - f.ey)));
    syncUI(); invalidate();
  });
  cv.addEventListener('pointerup', () => { if (drag) { drag = null; say(bodyNote()); } });
  function bodyNote() {
    const L = st.d.L1 + st.d.L2;
    return L > 1.8 ? 'A long arm reaches far but swings slowly (see the speed bar). Chasing the ball will be too late: try aiming ahead.'
      : L < 1.0 ? 'A short arm is quick but can only reach balls that land close. Aiming ahead barely matters for it.'
        : 'Throw the 20 balls to see how this body does, then try the searches on the right.';
  }

  // ---------------------------------------------------------------- playing throws
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function stopAnim() { if (st.anim) cancelAnimationFrame(st.anim); st.anim = null; }
  function playThrow(b, speed) {
    return new Promise(res => {
      const rec = C.runThrow(st.d, st.lead, b, true).trace; let i = 0; st.trail = [];
      const res0 = C.runThrow(st.d, st.lead, b, false);
      function tick() {
        i = Math.min(rec.length - 1, i + speed);
        const fr = rec[Math.floor(i)]; st.q = fr.q; st.ball = { ...fr.p, caught: false }; st.trail.push(fr.p);
        if (i >= rec.length - 1) { st.ball.caught = res0.caught; draw(); st.anim = null; res(res0.caught); return; }
        draw(); st.anim = requestAnimationFrame(tick);
      }
      st.anim = requestAnimationFrame(tick);
    });
  }
  async function throwAll(fast) {
    setBusy(true); const res = Array(throws.length).fill(null); setScore(res);
    for (let i = 0; i < throws.length; i++) {
      if (fast) res[i] = C.runThrow(st.d, st.lead, throws[i], false).caught;
      else { res[i] = await playThrow(throws[i], 2); await sleep(140); }
      setScore(res);
    }
    if (fast) { await playThrow(throws[throws.length - 1], 3); }
    setBusy(false);
    return res.filter(Boolean).length;
  }
  function setBusy(b) { st.busy = b; root.querySelectorAll('button, input').forEach(x => { if (!x.classList.contains('keep')) x.disabled = b; }); root.classList.toggle('busy', b); draw(); }

  $('#cc-throw').addEventListener('click', async () => {
    const n = await throwAll(false);
    say(`<b>${n} of 20 caught.</b> ${n < 8 ? 'Try the searches: tune the policy for this body, the body for this policy, or both at once.' : 'Nice. Now ask whether a different body would do better with a policy tuned to it.'}`);
  });

  // ---------------------------------------------------------------- searches (animated)
  async function morphTo(target, ms = 380) {
    const a = { ...st.d }, t0 = performance.now();
    return new Promise(res => { function f() { const u = Math.max(0, Math.min(1, (performance.now() - t0) / ms)), e = u * (2 - u); for (const k of ['h', 'L1', 'L2']) st.d[k] = a[k] + (target[k] - a[k]) * e; syncUI(); draw(); u < 1 ? requestAnimationFrame(f) : res(); } requestAnimationFrame(f); });
  }
  const yieldUI = () => new Promise(r => setTimeout(r, 0));
  $('#cc-tune-pol').addEventListener('click', async () => {
    setBusy(true); invalidate(); await yieldUI();
    const before = C.score(st.d, st.lead, throws), bl = C.bestLead(st.d, throws);
    const from = st.lead, t0 = performance.now();
    await new Promise(res => { function f() { const u = Math.max(0, Math.min(1, (performance.now() - t0) / 500)); st.lead = from + (bl.lead - from) * u; syncUI(); u < 1 ? requestAnimationFrame(f) : res(); } requestAnimationFrame(f); });
    st.lead = bl.lead; syncUI(); setBusy(false);
    await throwAll(true);
    say(`<b>Policy tuned for this body:</b> ${aimText(bl.lead)}. ${bl.score} of 20 (was ${before}). ${bl.lead > 0.2 ? 'A slow arm has to start moving before the ball arrives.' : 'This quick arm does fine just chasing.'}`);
    record('policy', bl.score);
  });
  async function bodySearch(joint) {
    setBusy(true); invalidate(); await yieldUI();
    const before = C.score(st.d, st.lead, throws);
    const { best, hist } = C.searchBody(throws, st.lead, joint);
    for (const h of hist.slice(1)) { await morphTo(h.d); if (joint) { st.lead = h.lead; syncUI(); } $('#cc-score').textContent = h.score; $('#cc-score').classList.remove('empty'); await sleep(160); }
    st.d = { ...best.d }; if (joint) st.lead = best.lead; syncUI(); setBusy(false);
    const n = await throwAll(true);
    return { before, n };
  }
  $('#cc-tune-body').addEventListener('click', async () => {
    const lead = st.lead, { before, n } = await bodySearch(false);
    say(`<b>Body tuned for this policy</b> (${aimText(lead)}): ${n} of 20 (was ${before}). Now tune the policy for this new body. Does it improve much? A body sized for a fixed policy inherits that policy's limits.`);
    record('body', n);
  });
  $('#cc-codesign').addEventListener('click', async () => {
    const { before, n } = await bodySearch(true);
    say(`<b>Co-designed:</b> body and aim searched together, re-tuning the aim for every candidate body: ${n} of 20 (was ${before}). The winner pairs a ${st.d.L1 + st.d.L2 > 1.8 ? 'long, slow' : 'quick'} arm with a policy that will ${aimText(st.lead)}.`);
    record('co', n);
  });
  $('#cc-reset').addEventListener('click', () => { if (st.busy) return; st.d = { ...C.BASE }; st.lead = 0; syncUI(); invalidate(); say('Back to the starting robot: a medium arm that just chases the ball.'); });

  const best = {};
  function record(k, n) { best[k] = Math.max(best[k] || 0, n); $('#cc-board').innerHTML = [['policy', 'policy tuned'], ['body', 'body tuned'], ['co', 'co-designed']].map(([key, name]) => `<li><span>${name}</span>${best[key] === undefined ? '<b class="none">not run</b>' : '<b>' + best[key] + ' / 20</b>'}</li>`).join(''); }

  window.addEventListener('resize', resize);
  syncUI(); setScore(Array(throws.length).fill(null)); resize(); record('_', 0);
  say('A robot on a pedestal, a pitcher 6 m away. Throw 20 balls, then reshape the arm or change how far ahead it aims.');
  document.fonts && document.fonts.ready.then(draw);
})();
