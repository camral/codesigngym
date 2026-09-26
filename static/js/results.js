// Interactive baseline results: seed-mean eval return +- std over a 4 h wall-clock budget (data exported from the paper's make_figures.py).
(function () {
  const root = document.getElementById('results');
  if (!root) return;
  const DASH = { cmaes: '', fasttd3: '7 4', ppo_ngopt: '9 3 2 3', loki: '2 3' };
  const $ = s => root.querySelector(s);
  let D = null, V = {}, cur = null, hidden = new Set();

  Promise.all([fetch('static/data/results.json').then(r => r.json()), fetch('static/data/videos.json').then(r => r.json()).catch(() => ({}))]).then(([d, v]) => {
    D = d; V = v;
    buildPicker(); buildWins();
    select(new URLSearchParams(location.hash.split('?')[1] || '').get('preset') || 'BallCatcher-Pitch');
  }).catch(() => { $('.chart').innerHTML = '<p class="muted">Could not load results data (open the page through a web server, not file://).</p>'; });

  const fmt = x => {
    if (x === null || x === undefined || !isFinite(x)) return '–';
    if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e5) return (x / 1e3).toFixed(0) + 'k';
    if (a >= 1000) return x.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (a >= 100) return x.toFixed(0);
    if (a >= 10) return x.toFixed(1);
    if (a >= 1) return x.toFixed(2);
    return x.toFixed(3);
  };
  const methodName = id => D.methods.find(m => m.id === id).name;
  const pretty = p => p.id.replace(/-v4$/, '').replace('HumanoidStandup', 'Humanoid Standup').replace(/^Pokenv/, 'Pokémon ').replace(/^BallCatcher-/, 'Ball Catcher ').replace(/^NeroGrasp/, 'NeroGrasp ')
    .replace(/^SolarCleaner/, 'Solar Cleaner ').replace(/^TruckUnload/, 'Truck Unload ').replace(/^Racing/, 'Racing ').replace(/^Warehouse/, 'Warehouse ').replace(/^Network/, 'Network ')
    .replace(/^Microgrid/, 'Microgrid ').replace('OffGridSingle', 'Off-grid').replace('OffGridCampus', 'Off-grid Campus').replace('MaxPower', 'Max Power').replace(/\s+/g, ' ').trim();
  const tickFmt = (v, step) => { if (Math.abs(v) < step * 1e-6) return '0'; const a = Math.abs(v); if (a >= 1e5) return (v / 1e3).toFixed(0) + 'k'; const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9)); return v.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  const color = id => D.methods.find(m => m.id === id).color;

  function buildPicker() {
    const list = $('.picker .list'), sel = $('.picker select');
    let html = '', opts = '', last = null;
    const groups = { Native: 'Native environments', Extended: 'Classic locomotion, co-designed', Reframed: 'Reframed problems' };
    const order = ['Native', 'Extended', 'Reframed'];
    order.forEach(g => {
      const ps = D.presets.filter(p => p.group === g);
      html += `<h4>${groups[g]}</h4>`; opts += `<optgroup label="${groups[g]}">`;
      ps.forEach(p => { html += `<button type="button" data-p="${p.id}" aria-pressed="false">${pretty(p)}${p.loki ? '' : ' <small>· 3 methods</small>'}</button>`; opts += `<option value="${p.id}">${pretty(p)}</option>`; });
      opts += '</optgroup>';
    });
    list.innerHTML = html; sel.innerHTML = opts;
    list.addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if (b) select(b.dataset.p); });
    sel.addEventListener('change', () => select(sel.value));
  }

  function buildWins() {
    const wins = {}; D.methods.forEach(m => wins[m.id] = { n: 0, of: 0 });
    D.presets.forEach(p => {
      const f = Object.entries(p.methods).filter(([, v]) => v.final).map(([k, v]) => [k, v.final.mean]);
      f.forEach(([k]) => wins[k].of++);
      const top = Math.max(...f.map(x => x[1])), best = f.filter(x => x[1] === top);
      if (best.length === 1) wins[best[0][0]].n++;
    });
    $('.wins').innerHTML = D.methods.map(m => `<div class="win" style="--c:${m.color}"><strong>${m.name}</strong><b>${wins[m.id].n}</b><span>best final mean on ${wins[m.id].n} of the ${wins[m.id].of} presets it ran</span></div>`).join('');
  }

  function select(id) {
    const p = D.presets.find(x => x.id === id) || D.presets[0];
    cur = p;
    root.querySelectorAll('.picker button[data-p]').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === p.id));
    $('.picker select').value = p.id;
    $('.chart-head h3').textContent = pretty(p);
    $('.chart-head .grp').textContent = `${p.id} · ${Object.keys(p.methods).length} methods · 5 seeds each`;
    buildLegend(); draw(); table(); rollouts();
  }

  function buildLegend() {
    const lg = $('.legend');
    lg.innerHTML = Object.keys(cur.methods).map(m => `<button type="button" data-m="${m}" aria-pressed="${!hidden.has(m)}"><svg viewBox="0 0 26 10"><line x1="1" y1="5" x2="25" y2="5" stroke="${color(m)}" stroke-width="2.5" stroke-dasharray="${DASH[m]}"/></svg><span>${methodName(m)}</span></button>`).join('');
    lg.onclick = e => { const b = e.target.closest('button[data-m]'); if (!b) return; const m = b.dataset.m; hidden.has(m) ? hidden.delete(m) : hidden.add(m); if (hidden.size >= Object.keys(cur.methods).length) hidden.delete(m); buildLegend(); draw(); };
  }

  function draw() {
    const narrow = $('.chart').clientWidth < 560, W = narrow ? 440 : 760, H = narrow ? 330 : 380, L = narrow ? 50 : 62, Rr = narrow ? 88 : 112, T = 16, B = 42, pw = W - L - Rr, ph = H - T - B;
    const t = D.t, ms = Object.keys(cur.methods).filter(m => !hidden.has(m));
    let lo = Infinity, hi = -Infinity;
    ms.forEach(m => { const c = cur.methods[m].curve; if (!c) return; c.mean.forEach((v, i) => { if (v === null) return; const s = c.std[i] || 0; lo = Math.min(lo, v - s); hi = Math.max(hi, v + s); }); });
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    const ticks = niceTicks(lo, hi, 5); lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
    const X = h => L + h / D.budget_h * pw, Y = v => T + (1 - (v - lo) / (hi - lo)) * ph;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Eval return over wall-clock hours for ${pretty(cur)}">`;
    ticks.forEach(v => { s += `<line x1="${L}" x2="${L + pw}" y1="${Y(v)}" y2="${Y(v)}" stroke="#ece4d4" stroke-width="1"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="#766f62">${tickFmt(v, ticks[1] - ticks[0])}</text>`; });
    [0, 1, 2, 3, 4].forEach(h => { s += `<text x="${X(h)}" y="${T + ph + 18}" text-anchor="middle" font-size="11" fill="#766f62">${h} h</text>`; });
    s += `<line x1="${L}" x2="${L + pw}" y1="${T + ph}" y2="${T + ph}" stroke="#b9ad96"/>`;
    s += `<text x="${L + pw / 2}" y="${H - 4}" text-anchor="middle" font-size="11.5" fill="#45413a">wall-clock time (4 h budget)</text>`;
    s += `<text transform="translate(14 ${T + ph / 2}) rotate(-90)" text-anchor="middle" font-size="11.5" fill="#45413a">eval return (mean ± std over seeds)</text>`;
    if (ms.includes('loki')) s += `<rect x="${X(0)}" y="${T}" width="${X(D.loki_prep_h) - X(0)}" height="${ph}" fill="#4a3aa7" opacity="0.05"/><text x="${X(0.5)}" y="${T + 13}" text-anchor="middle" font-size="10" fill="#4a3aa7">LOKI prep</text>`;
    const ends = [];
    ms.forEach(m => {
      const c = cur.methods[m].curve; if (!c) return;
      let band = '', line = '', seg = [];
      const flush = () => { if (seg.length > 1) { band += 'M' + seg.map(i => `${X(t[i]).toFixed(1)} ${Y(c.mean[i] + (c.std[i] || 0)).toFixed(1)}`).join('L') + 'L' + seg.slice().reverse().map(i => `${X(t[i]).toFixed(1)} ${Y(c.mean[i] - (c.std[i] || 0)).toFixed(1)}`).join('L') + 'Z'; line += 'M' + seg.map(i => `${X(t[i]).toFixed(1)} ${Y(c.mean[i]).toFixed(1)}`).join('L'); } seg = []; };
      c.mean.forEach((v, i) => { if (v === null) flush(); else seg.push(i); }); flush();
      s += `<path d="${band}" fill="${color(m)}" opacity="0.13"/>`;
      s += `<path d="${line}" fill="none" stroke="${color(m)}" stroke-width="2" stroke-dasharray="${DASH[m]}" stroke-linejoin="round"/>`;
      let li = -1; c.mean.forEach((v, i) => { if (v !== null) li = i; });
      if (li >= 0) ends.push({ m, x: X(t[li]), y: Y(c.mean[li]), v: c.mean[li] });
    });
    // end markers + de-overlapped direct labels
    ends.sort((a, b) => a.y - b.y);
    const ly = ends.map(e => e.y); for (let k = 1; k < ly.length; k++) ly[k] = Math.max(ly[k], ly[k - 1] + 15);
    for (let k = ly.length - 2; k >= 0; k--) ly[k] = Math.min(ly[k], ly[k + 1] - 15);
    ends.forEach((e, k) => {
      s += `<circle cx="${e.x}" cy="${e.y}" r="4.5" fill="${color(e.m)}" stroke="#fffdf8" stroke-width="2"/>`;
      s += `<line x1="${e.x + 6}" y1="${e.y}" x2="${L + pw + 10}" y2="${ly[k]}" stroke="#d3c7b0" stroke-width="1"/>`;
      s += `<text x="${L + pw + 14}" y="${ly[k] + 4}" font-size="11.5" font-weight="600" fill="#1f1d1a">${methodName(e.m)}</text>`;
    });
    s += `<line class="xh" x1="0" x2="0" y1="${T}" y2="${T + ph}" stroke="#1f1d1a" stroke-width="1" opacity="0"/><g class="xdots"></g>`;
    s += `<rect class="hit" x="${L}" y="${T}" width="${pw}" height="${ph}" fill="transparent"/></svg>`;
    const box = $('.chart');
    box.innerHTML = s + '<div class="tip" role="status"></div>';
    const svg = box.querySelector('svg'), tip = box.querySelector('.tip'), xh = svg.querySelector('.xh'), xd = svg.querySelector('.xdots');
    function hover(ev) {
      const r = svg.getBoundingClientRect(), sx = (ev.clientX - r.left) / r.width * W;
      const h = Math.max(0, Math.min(D.budget_h, (sx - L) / pw * D.budget_h));
      const i = Math.round(h / D.budget_h * (t.length - 1)), px = X(t[i]);
      xh.setAttribute('x1', px); xh.setAttribute('x2', px); xh.setAttribute('opacity', 0.35);
      let rows = '', dots = '';
      ms.forEach(m => { const c = cur.methods[m].curve; const v = c && c.mean[i]; if (v !== null && v !== undefined) dots += `<circle cx="${px}" cy="${Y(v)}" r="4" fill="${color(m)}" stroke="#fffdf8" stroke-width="1.5"/>`; rows += `<div class="row"><span><i style="background:${color(m)}"></i>${methodName(m)}</span><span class="v">${v === null || v === undefined ? (m === 'loki' && t[i] < D.loki_prep_h ? 'prep' : '–') : fmt(v) + ' ± ' + fmt(c.std[i])}</span></div>`; });
      xd.innerHTML = dots;
      tip.innerHTML = `<b>${t[i].toFixed(2)} h</b>${rows}`;
      const bx = box.getBoundingClientRect(); let left = ev.clientX - bx.left + 14; if (left + 190 > bx.width) left = ev.clientX - bx.left - 200;
      tip.style.left = Math.max(0, left) + 'px'; tip.style.top = Math.max(0, ev.clientY - bx.top - 30) + 'px'; tip.classList.add('on');
    }
    const hit = svg.querySelector('.hit');
    hit.addEventListener('pointermove', hover); hit.addEventListener('pointerdown', hover);
    hit.addEventListener('pointerleave', () => { tip.classList.remove('on'); xh.setAttribute('opacity', 0); xd.innerHTML = ''; });
  }

  function niceTicks(lo, hi, n) {
    const span = hi - lo, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0))), f = step0 / mag;
    const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag, out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return out;
  }

  function table() {
    const rows = Object.entries(cur.methods).filter(([, v]) => v.final);
    const top = Math.max(...rows.map(([, v]) => v.final.mean)), nTop = rows.filter(([, v]) => v.final.mean === top).length;
    let notes = [];
    const body = rows.map(([m, v]) => {
      const f = v.final, best = nTop === 1 && f.mean === top;
      if (f.rejection === 1) notes.push(`${methodName(m)}: every proposed design failed structural validation, so every eval episode received the rejection reward.`);
      else if (v.rejected_evals) notes.push(`${methodName(m)}: ${v.rejected_evals} eval point(s) had every design rejected and are gaps in the curve.`);
      return `<tr class="${best ? 'best' : ''}"><td><span class="dot" style="background:${color(m)}"></span>${methodName(m)}</td><td>${fmt(f.mean)} ± ${fmt(f.std)}</td><td>${f.n}</td><td>${f.rejection === null || f.rejection === undefined ? '–' : Math.round(f.rejection * 100) + '%'}</td></tr>`;
    }).join('');
    $('.final-wrap').innerHTML = `<table class="final"><thead><tr><th>Method</th><th>Final return</th><th title="seeds">n</th><th title="share of final-eval designs rejected">Rejected</th></tr></thead><tbody>${body}</tbody></table>` + (notes.length ? `<p class="chart-foot">${notes.join(' ')}</p>` : '');
  }

  function rollouts() {
    const v = V[cur.id] || {};
    const box = $('.rollouts');
    box.innerHTML = Object.keys(cur.methods).map(m => {
      const r = v[m];
      const lab = `<div class="lab" style="--c:${color(m)}"><b>${methodName(m)}</b><span>${r ? 'seed ' + r.seed + ' · ' + fmt(r.ret) : ''}</span></div>`;
      return r ? `<div class="rollout"><video muted loop playsinline preload="none" poster="${r.poster}" src="${r.src}" aria-label="${methodName(m)} rollout on ${pretty(cur)}"></video>${lab}</div>`
        : `<div class="rollout"><div class="none">No rollout video was logged for this run${cur.id.startsWith('Pokenv') ? ' (battles have no renderer)' : ''}.</div>${lab}</div>`;
    }).join('');
    $('.roll-bar .hint').textContent = Object.keys(v).length ? 'Best seed per method, final evaluation. Short clips loop.' : '';
    if (autoplay) playAll();
  }
  let autoplay = false;
  function playAll() { root.querySelectorAll('.rollouts video').forEach(vd => { vd.currentTime = 0; vd.play().catch(() => {}); }); }
  $('.play-all').addEventListener('click', () => { autoplay = !autoplay; $('.play-all').innerHTML = autoplay ? '<i class="fa-solid fa-pause"></i> Pause' : '<i class="fa-solid fa-play"></i> Play all four'; if (autoplay) playAll(); else root.querySelectorAll('.rollouts video').forEach(vd => vd.pause()); });
  let rw = 0; window.addEventListener('resize', () => { const w = $('.chart').clientWidth; if (cur && Math.abs(w - rw) > 40) { rw = w; draw(); } });
  $('.tbl-toggle').addEventListener('click', () => { const w = $('.final-wrap'); w.hidden = !w.hidden; $('.tbl-toggle').textContent = w.hidden ? 'Show final numbers as a table' : 'Hide table'; });
})();
