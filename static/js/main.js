// Page behaviour: nav, reveal-on-scroll, visible-only video playback, environment explorer + modal, code tabs, copy buttons.
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Showdown battle replays: the client needs ~800px, so render at native size and scale to the box width
  function mountReplay(box, src, title) {
    box.innerHTML = `<iframe src="${src}" title="${title || 'Pokémon Showdown battle replay'}" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
    const f = box.querySelector('iframe');
    const fit = () => { const w = box.clientWidth, k = Math.min(1, w / 800); f.style.width = Math.max(800, w) + 'px'; f.style.transform = `scale(${k})`; box.style.height = Math.round(458 * k) + 'px'; };
    fit(); if (window.ResizeObserver) new ResizeObserver(fit).observe(box); else window.addEventListener('resize', fit);
  }
  const replayDlg = document.getElementById('replay-modal');
  window.openReplay = function (src, title, meta) {
    replayDlg.querySelector('#replay-title').textContent = title;
    replayDlg.querySelector('.replay-meta').textContent = meta || '';
    replayDlg.showModal();
    mountReplay(replayDlg.querySelector('.replay-frame'), src, title);
  };
  if (replayDlg) {
    replayDlg.addEventListener('click', e => { if (e.target === replayDlg || e.target.closest('.modal-close')) replayDlg.close(); });
    replayDlg.addEventListener('close', () => { replayDlg.querySelector('.replay-frame').innerHTML = ''; });
  }
  let replayIndex = null;
  const replays = () => replayIndex || (replayIndex = fetch('static/data/replays.json').then(r => r.json()).catch(() => ({})));
  window.getReplays = replays;

  // nav border + active section
  const nav = document.querySelector('.nav');
  const links = [...document.querySelectorAll('.nav-links a')];
  const secs = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  function onScroll() {
    nav.classList.toggle('scrolled', window.scrollY > 8);
    let on = null; secs.forEach((s, i) => { if (s.getBoundingClientRect().top < 140) on = i; });
    links.forEach((a, i) => a.classList.toggle('on', i === on));
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // reveal
  const rv = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rv.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach(el => rv.observe(el));

  // autoplay videos only while on screen (hero wall)
  const vo = new IntersectionObserver(es => es.forEach(e => { const v = e.target; if (e.isIntersecting && !reduce) v.play().catch(() => {}); else v.pause(); }), { threshold: 0.25 });
  document.querySelectorAll('video[data-autoplay]').forEach(v => vo.observe(v));

  // environment explorer
  const grid = document.getElementById('env-grid'), filters = document.getElementById('env-filters');
  if (grid && window.ENV_FAMILIES) {
    const fams = window.ENV_FAMILIES, touch = window.matchMedia('(hover: none)').matches;
    const media = f => ({ video: f.id === 'pokemon' || f.still ? null : `static/video/showcase/${f.id}.mp4`, poster: f.poster || `static/video/showcase/${f.id}.jpg` });
    const card = f => {
      const md = media(f);
      return `<button type="button" class="env reveal" data-id="${f.id}" data-tags="${f.tags.join(' ')}" aria-haspopup="dialog">
        <div class="media">${f.goalCard && window.GOALS ? `<div class="goal-art">${GOALS[f.goal].svg}</div><span class="play-hint still"><i class="fa-solid fa-bullseye"></i> goal</span>` : f.sweep ? `<img src="static/video/showcase/${f.id}_design.jpg" alt="" loading="lazy"><video muted loop playsinline preload="none" src="static/video/showcase/${f.id}_design.mp4"></video><span class="play-hint"><i class="fa-solid fa-play"></i> blue = designable links</span>` : `<img src="${md.poster}" alt="" loading="lazy">${md.video ? `<video muted loop playsinline preload="none" src="${md.video}"></video><span class="play-hint"><i class="fa-solid fa-play"></i> ${touch ? 'tap for details' : 'hover to play'}</span>` : ''}${f.replay ? '<span class="play-hint"><i class="fa-solid fa-play"></i> click to watch a battle</span>' : ''}${f.still ? '<span class="play-hint still"><i class="fa-regular fa-image"></i> still</span>' : ''}`}<span class="ids">${f.ids} id${f.ids > 1 ? 's' : ''}</span></div>
        <div class="body"><h3>${f.name}</h3><div class="sim">${f.sim}</div><p>${f.blurb}</p>
        ${f.transition ? '<span class="badge">θ can change mid-episode</span>' : ''}</div></button>`;
    };
    // all 20 families, grouped as in the paper (Figure 3)
    const GROUPS = [['native', 'Native', 'Built from scratch for co-design'], ['reframed', 'Unlocked/Reframed', 'Hidden co-design problems in trusted RL environments, now unlocked'], ['extended', 'Extended', 'Classic MuJoCo control, with reshapeable bodies']];
    grid.innerHTML = GROUPS.map(([k, n, d]) => { const fs = fams.filter(f => f.tags[0] === k); return `<div class="env-group g-${k}" data-group="${k}"><h3 class="grp-h"><span>${n}</span><em>${fs.length} families · ${d}</em></h3><div class="env-grid">${fs.map(card).join('')}</div></div>`; }).join('');
    grid.querySelectorAll('.reveal').forEach(el => rv.observe(el));
    filters.innerHTML = [['all', 'All', fams.length]].concat(GROUPS.map(([k, n]) => [k, n, fams.filter(f => f.tags[0] === k).length])).map(([k, n, c]) => `<button type="button" class="chip" data-tag="${k}" aria-pressed="${k === 'all'}">${n}<span class="n">${c}</span></button>`).join('');
    filters.addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      filters.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b));
      grid.querySelectorAll('.env-group').forEach(g => { g.hidden = !(b.dataset.tag === 'all' || g.dataset.group === b.dataset.tag); });
    });
    // hover / focus to play
    grid.querySelectorAll('.env').forEach(card => {
      const v = card.querySelector('video'); if (!v) return;
      const on = () => { if (reduce) return; card.classList.add('playing'); v.play().catch(() => {}); };
      const off = () => { card.classList.remove('playing'); v.pause(); };
      card.addEventListener('mouseenter', on); card.addEventListener('mouseleave', off); card.addEventListener('focus', on); card.addEventListener('blur', off);
    });
    // on touch screens, play cards as they scroll into the middle of the viewport
    if (window.matchMedia('(hover: none)').matches) {
      const to = new IntersectionObserver(es => es.forEach(e => { const c = e.target, v = c.querySelector('video'); if (!v) return; if (e.isIntersecting && !reduce) { c.classList.add('playing'); v.play().catch(() => {}); } else { c.classList.remove('playing'); v.pause(); } }), { rootMargin: '-35% 0px -35% 0px' });
      grid.querySelectorAll('.env').forEach(c => to.observe(c));
    }
    // modal
    const dlg = document.getElementById('env-modal');
    grid.addEventListener('click', e => {
      const card = e.target.closest('.env'); if (!card) return;
      const f = fams.find(x => x.id === card.dataset.id), md = media(f);
      dlg.classList.toggle('wide', !!f.replay);
      if (f.replay) {
        const m = dlg.querySelector('.modal-media'); m.innerHTML = '<div class="replay-frame"></div>';
        mountReplay(m.querySelector('.replay-frame'), f.replay.src, f.name + ' battle replay');
      } else if (f.sweep && !md.video) dlg.querySelector('.modal-media').innerHTML = `<video controls autoplay muted loop playsinline src="static/video/showcase/${f.id}_design.mp4"></video>`;
      else dlg.querySelector('.modal-media').innerHTML = md.video ? `<video controls autoplay muted loop playsinline poster="${md.poster}" src="${md.video}"></video>` : `<img src="${md.poster}" alt="${f.name} illustration">`;
      const goal = f.goal && window.GOALS && GOALS[f.goal];
      dlg.querySelector('.modal-body').innerHTML = `<h3 id="env-modal-title">${f.name}</h3><div class="sim">${f.sim}</div><p>${f.blurb}</p>
        ${goal ? `<h4>Goal</h4><div class="goal-box"><div class="goal-art">${goal.svg}</div><p>${goal.text}</p></div>` : ''}
        <dl class="dp"><dt class="d">design θ</dt><dd>${f.design}</dd><dt class="p">policy π</dt><dd>${f.policy}</dd></dl>
        ${f.sweep && md.video ? `<h4>Design space · blue links are designable</h4><video class="sweep" muted autoplay loop playsinline src="static/video/showcase/${f.id}_design.mp4"></video>` : ''}
        ${f.transition ? '<span class="badge">supports transition-level embodiment: step(action, embodiment)</span>' : ''}
        <h4>Presets · per-episode return window [max / min]</h4><ul class="presets">${f.presets.map(([a, b]) => `<li><span>${a}</span><span>${b}</span></li>`).join('')}</ul>
        <h4>Try it</h4><div class="snippet">env, theta0 = cg.make_vec("${f.example}", num_envs=8)</div>
        ${f.note ? `<p class="media-note">About the clip: ${f.note}</p>` : '<p class="media-note">About the clip: a final-evaluation rollout from one of our baseline runs.</p>'}
        ${goal ? '<p class="media-note">The goal diagram is an illustration, not a simulation. Design sweeps are rendered from the environment model in MuJoCo (rest pose, no policy).</p>' : ''}`;
      dlg.showModal();
    });
    dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('.modal-close')) dlg.close(); });
    dlg.addEventListener('close', () => { const v = dlg.querySelector('video'); if (v) v.pause(); if (dlg.classList.contains('wide')) dlg.querySelector('.modal-media').innerHTML = ''; });
  }

  // playground demo tabs
  const dtabs = [...document.querySelectorAll('.demo-tabs [role=tab]')];
  function showDemo(i) {
    dtabs.forEach((t, j) => { t.setAttribute('aria-selected', i === j); t.tabIndex = i === j ? 0 : -1; document.getElementById(t.getAttribute('aria-controls')).hidden = i !== j; });
    window.dispatchEvent(new Event('resize'));
  }
  dtabs.forEach((t, i) => { t.addEventListener('click', () => showDemo(i)); t.addEventListener('keydown', e => { const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (d) { const k = (i + d + dtabs.length) % dtabs.length; showDemo(k); dtabs[k].focus(); } }); });

  // code tabs
  document.querySelectorAll('[data-tabs]').forEach(box => {
    const tabs = [...box.querySelectorAll('[role=tab]')], panes = [...box.querySelectorAll('[role=tabpanel]')];
    function show(i) { tabs.forEach((t, j) => { t.setAttribute('aria-selected', i === j); t.tabIndex = i === j ? 0 : -1; }); panes.forEach((p, j) => p.hidden = i !== j); }
    tabs.forEach((t, i) => { t.addEventListener('click', () => show(i)); t.addEventListener('keydown', e => { const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (d) { const k = (i + d + tabs.length) % tabs.length; show(k); tabs[k].focus(); } }); });
    show(0);
  });

  // copy buttons
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    const src = document.querySelector(b.dataset.copy); if (!src) return;
    const text = src.getAttribute('data-raw') || src.textContent.trim();
    const done = ok => { const old = b.innerHTML; b.textContent = ok ? 'copied ✓' : 'press ⌘C'; setTimeout(() => { b.innerHTML = old; }, 1300); };
    (navigator.clipboard ? navigator.clipboard.writeText(text).then(() => done(true), () => done(false)) : done(false));
  });
})();
