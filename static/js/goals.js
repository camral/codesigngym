// Animated goal diagrams (SVG + SMIL): what each environment is trying to achieve, for families without a telling rollout.
// Illustrations only, not simulation. window.GOALS[id] = { text, svg }.
(function () {
  const B = '#2563eb', INK = '#0a0e17', MUT = '#8b97ad', LINE = '#cdd5e1', OK = '#16a34a', BG = '#f7f9fc';
  const wrap = (body, label) => `<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}" font-family="Inter, sans-serif"><rect width="320" height="200" fill="${BG}"/>${body}</svg>`;
  const tag = t => `<g><rect x="10" y="10" rx="3" width="${t.length * 7.4 + 18}" height="20" fill="${INK}"/><text x="18" y="24" font-size="11" font-weight="700" fill="#fff" letter-spacing=".04em">${t}</text></g>`;
  const loop = 'dur="4s" repeatCount="indefinite"';

  const G = {};
  G.nerograsp = { text: 'Close the redesigned fingertips on a tiny part, lift it off the table and hold it steady.',
    svg: wrap(`${tag('LIFT & HOLD')}
      <rect x="0" y="160" width="320" height="40" fill="#e4e8ef"/>
      <g><animateTransform attributeName="transform" type="translate" values="0 0;0 38;0 38;0 -10;0 -10;0 0" keyTimes="0;.25;.4;.65;.9;1" ${loop}/>
        <rect x="150" y="20" width="20" height="56" rx="3" fill="#8a95a8"/>
        <g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;9 0;9 0;9 0;0 0" keyTimes="0;.25;.4;.65;.9;1" ${loop}/><rect x="128" y="70" width="12" height="46" rx="5" fill="${B}"/></g>
        <g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;-9 0;-9 0;-9 0;0 0" keyTimes="0;.25;.4;.65;.9;1" ${loop}/><rect x="180" y="70" width="12" height="46" rx="5" fill="${B}"/></g></g>
      <g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 0;0 -48;0 -48;0 0" keyTimes="0;.25;.4;.65;.9;1" ${loop}/>
        <rect x="152" y="148" width="16" height="12" rx="2" fill="${INK}"/><rect x="156" y="140" width="8" height="8" fill="${INK}"/></g>
      <text x="310" y="190" font-size="10" fill="${MUT}" text-anchor="end">success = a sustained, stable lift</text>`, 'A gripper closes on a small part and lifts it') };

  G.softwalker = { text: 'Evolve a body made of soft material cells, and its actuation pattern, so it travels as far forward as possible.',
    svg: wrap(`${tag('WALK FORWARD')}
      <rect x="0" y="158" width="120" height="42" fill="#e4e8ef"/><rect x="140" y="158" width="60" height="42" fill="#e4e8ef"/><rect x="220" y="158" width="100" height="42" fill="#e4e8ef"/>
      <g><animateTransform attributeName="transform" type="translate" values="20 0;230 0" dur="6s" repeatCount="indefinite"/>
        <g transform="translate(0 158)"><g><animateTransform attributeName="transform" type="scale" values="1 1;1.18 .84;1 1;.9 1.1;1 1" dur="0.8s" repeatCount="indefinite"/>
          ${[0, 1, 2, 3].map(c => [0, 1, 2].map(r => `<rect x="${c * 12}" y="${-12 * (r + 1)}" width="11" height="11" rx="1.5" fill="${(c + r) % 2 ? B : '#60a5fa'}"/>`).join('')).join('')}
          <rect x="0" y="-12" width="11" height="11" fill="#1d4ed8"/><rect x="36" y="-12" width="11" height="11" fill="#1d4ed8"/></g></g></g>
      <path d="M232 60 h56" stroke="${B}" stroke-width="3" marker-end="url(#ah)"/><defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="${B}"/></marker></defs>
      <text x="310" y="190" font-size="10" fill="${MUT}" text-anchor="end">flat · stairs · gaps</text>`, 'A soft cell body squashes and stretches as it moves forward over gaps') };

  G.lq = { text: 'Choose masses, springs, dampers and where the actuators and sensors go, then regulate the chain back to rest after a disturbance.',
    svg: wrap(`${tag('REGULATE TO REST')}
      <rect x="20" y="70" width="8" height="80" fill="#8a95a8"/>
      ${[0, 1, 2].map(i => { const x = 70 + i * 80; return `<g><animateTransform attributeName="transform" type="translate" values="0 0;${18 - i * 3} 0;${-12 + i * 2} 0;${7 - i} 0;-3 0;1 0;0 0;0 0" keyTimes="0;.12;.26;.4;.54;.68;.8;1" ${loop}/>
        <rect x="${x}" y="95" width="36" height="30" rx="3" fill="${i === 1 ? '#dc2626' : B}"/><text x="${x + 18}" y="114" font-size="10" fill="#fff" text-anchor="middle" font-weight="700">m${i + 1}</text></g>`; }).join('')}
      <path d="M28 110 l8 -8 l8 16 l8 -16 l8 16 l8 -8" fill="none" stroke="${INK}" stroke-width="1.5"/>
      <path d="M106 110 l8 -8 l8 16 l8 -16 l8 16 l8 -8 l8 0" fill="none" stroke="${INK}" stroke-width="1.5"/><path d="M186 110 l8 -8 l8 16 l8 -16 l8 16 l8 -8 l8 0" fill="none" stroke="${INK}" stroke-width="1.5"/>
      <g><animate attributeName="opacity" values="1;0;0" keyTimes="0;.12;1" ${loop}/><path d="M88 60 v26" stroke="#f59e0b" stroke-width="3" marker-end="url(#ah2)"/><text x="96" y="58" font-size="10" fill="#b45309">disturbance</text></g>
      <defs><marker id="ah2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#f59e0b"/></marker></defs>
      <text x="310" y="190" font-size="10" fill="${MUT}" text-anchor="end">red = actuated mass · exact optimum known</text>`, 'A mass-spring chain is kicked and settles back to rest') };

  G.microgrid = { text: 'Size the solar array, battery and diesel generator, then dispatch energy hour by hour so demand is always met at the lowest cost.',
    svg: wrap(`${tag('MEET DEMAND, CHEAPLY')}
      <circle cx="46" cy="62" r="14" fill="#f59e0b"/><rect x="30" y="92" width="34" height="18" fill="${B}" transform="skewX(-15)"/><text x="46" y="128" font-size="9" fill="${MUT}" text-anchor="middle">solar</text>
      <rect x="36" y="146" width="24" height="34" rx="3" fill="none" stroke="${INK}" stroke-width="2"/><rect x="39" y="160" width="18" height="17" fill="${OK}"><animate attributeName="height" values="6;26;26;10;6" ${loop}/><animate attributeName="y" values="171;151;151;167;171" ${loop}/></rect><text x="48" y="194" font-size="9" fill="${MUT}" text-anchor="middle">battery</text>
      <rect x="120" y="150" width="30" height="24" rx="3" fill="#8a95a8"/><text x="135" y="188" font-size="9" fill="${MUT}" text-anchor="middle">diesel</text>
      <path d="M232 110 l30 -26 l30 26 v48 h-60z" fill="none" stroke="${INK}" stroke-width="2"/><text x="262" y="176" font-size="9" fill="${MUT}" text-anchor="middle">demand</text>
      <path id="p1" d="M70 100 C 140 90, 180 110, 232 128" fill="none" stroke="${LINE}" stroke-width="2"/><path id="p2" d="M64 160 C 140 150, 190 150, 232 140" fill="none" stroke="${LINE}" stroke-width="2"/><path id="p3" d="M150 160 C 190 160, 210 150, 232 146" fill="none" stroke="${LINE}" stroke-width="2"/>
      ${[0, 1, 2].map(k => `<circle r="4" fill="#f59e0b"><animateMotion dur="1.6s" begin="${k * 0.5}s" repeatCount="indefinite"><mpath href="#p1"/></animateMotion></circle>`).join('')}
      ${[0, 1].map(k => `<circle r="4" fill="${OK}"><animateMotion dur="2s" begin="${k}s" repeatCount="indefinite"><mpath href="#p2"/></animateMotion></circle>`).join('')}
      <circle r="4" fill="#8a95a8"><animateMotion dur="2.4s" repeatCount="indefinite"><mpath href="#p3"/></animateMotion></circle>`, 'Solar, battery and diesel feed a building; battery level rises and falls') };

  G.network = { text: 'Choose how many base stations to build, where and how loud, then hand each moving user to a station so everyone gets good service.',
    svg: wrap(`${tag('COVER EVERY USER')}
      ${[[90, 110], [230, 90]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="62" fill="${B}" fill-opacity=".07" stroke="${B}" stroke-opacity=".35" stroke-dasharray="4 4"/><path d="M${x - 7} ${y + 10} l7 -20 l7 20" fill="none" stroke="${INK}" stroke-width="2"/><circle cx="${x}" cy="${y - 12}" r="3" fill="${INK}"/>`).join('')}
      ${[[40, 150, 280, 150, '6s'], [150, 40, 150, 170, '5s'], [260, 170, 60, 60, '7s']].map(([x1, y1, x2, y2, d], i) => `<g>
        <line stroke="${OK}" stroke-width="1.5"><animate attributeName="x1" values="${x1};${x2};${x1}" dur="${d}" repeatCount="indefinite"/><animate attributeName="y1" values="${y1};${y2};${y1}" dur="${d}" repeatCount="indefinite"/>
          <animate attributeName="x2" values="${x1 < 160 ? 90 : 230};${x2 < 160 ? 90 : 230};${x1 < 160 ? 90 : 230}" calcMode="discrete" dur="${d}" repeatCount="indefinite"/><animate attributeName="y2" values="${x1 < 160 ? 98 : 78};${x2 < 160 ? 98 : 78};${x1 < 160 ? 98 : 78}" calcMode="discrete" dur="${d}" repeatCount="indefinite"/></line>
        <circle r="5" fill="#dc2626"><animate attributeName="cx" values="${x1};${x2};${x1}" dur="${d}" repeatCount="indefinite"/><animate attributeName="cy" values="${y1};${y2};${y1}" dur="${d}" repeatCount="indefinite"/></circle></g>`).join('')}
      <text x="310" y="190" font-size="10" fill="${MUT}" text-anchor="end">design = stations · policy = who connects where</text>`, 'Users move between two base stations and hand over') };

  G.warehouse = { text: 'Lay out the shelves on the floor, then coordinate the robot fleet to fetch requested shelves and deliver them to the goals.',
    svg: wrap(`${tag('DELIVER SHELVES')}
      ${[0, 1, 2, 3, 4].map(c => [0, 1, 2].map(r => `<rect x="${60 + c * 44}" y="${48 + r * 32}" width="30" height="20" rx="2" fill="${c === 3 && r === 1 ? '#f59e0b' : '#cdd5e1'}"/>`).join('')).join('')}
      <rect x="130" y="160" width="60" height="26" rx="3" fill="${OK}" fill-opacity=".85"/><text x="160" y="177" font-size="10" fill="#fff" text-anchor="middle" font-weight="700">GOAL</text>
      <g><animateTransform attributeName="transform" type="translate" values="0 0;66 0;66 -36;66 -36;66 0;0 0;0 0" keyTimes="0;.2;.35;.45;.6;.8;1" dur="5s" repeatCount="indefinite"/>
        <rect x="129" y="126" width="22" height="22" rx="5" fill="${B}"/></g>
      <g><animate attributeName="opacity" values="0;0;1;1;1;0" keyTimes="0;.44;.45;.6;.8;.81" dur="5s" repeatCount="indefinite"/>
        <animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 36;-66 36;-66 36" keyTimes="0;.45;.6;.8;1" dur="5s" repeatCount="indefinite"/><rect x="192" y="81" width="30" height="20" rx="2" fill="#f59e0b"/></g>
      <text x="310" y="195" font-size="10" fill="${MUT}" text-anchor="end">aisles emerge wherever shelves are not</text>`, 'A robot fetches a requested shelf and carries it to the goal') };

  const walker = (label, body) => wrap(`${tag(label)}
      <rect x="0" y="160" width="320" height="40" fill="#e4e8ef"/>
      <g>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<line x1="${i * 50}" y1="160" x2="${i * 50}" y2="168" stroke="${LINE}"/>`).join('')}<animateTransform attributeName="transform" type="translate" values="0 0;-50 0" dur="0.9s" repeatCount="indefinite"/></g>
      ${body}
      <path d="M230 70 h56" stroke="${B}" stroke-width="3" marker-end="url(#ah3)"/><defs><marker id="ah3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="${B}"/></marker></defs>
      <text x="310" y="190" font-size="10" fill="${MUT}" text-anchor="end">blue = designable links</text>`, label);
  const legs = `<g transform="translate(150 0)"><line x1="0" y1="80" x2="0" y2="118" stroke="#8a95a8" stroke-width="10" stroke-linecap="round"/>
      <g><animateTransform attributeName="transform" type="rotate" values="-25 0 118;25 0 118;-25 0 118" dur="0.9s" repeatCount="indefinite"/><line x1="0" y1="118" x2="0" y2="160" stroke="${B}" stroke-width="8" stroke-linecap="round"/></g>
      <g><animateTransform attributeName="transform" type="rotate" values="25 0 118;-25 0 118;25 0 118" dur="0.9s" repeatCount="indefinite"/><line x1="0" y1="118" x2="0" y2="160" stroke="#1d4ed8" stroke-width="8" stroke-linecap="round"/></g></g>`;
  G.locomotion = { text: 'Move forward as fast as possible without falling, on a body whose limbs you design.', svg: walker('RUN FORWARD', legs) };
  G.swim = { text: 'Swim forward through viscous fluid, with link lengths and angles you design.', svg: walker('SWIM FORWARD', `<g transform="translate(110 110)"><path fill="none" stroke="${B}" stroke-width="9" stroke-linecap="round"><animate attributeName="d" values="M0 0 L40 -10 L80 0 L120 -10;M0 -10 L40 0 L80 -10 L120 0;M0 0 L40 -10 L80 0 L120 -10" dur="1.2s" repeatCount="indefinite"/></path></g>`) };
  G.standup = { text: 'Start lying on the floor and stand up, as high as possible, with a body you design.',
    svg: wrap(`${tag('STAND UP')}<rect x="0" y="160" width="320" height="40" fill="#e4e8ef"/>
      <g><animateTransform attributeName="transform" type="rotate" values="-90 160 158;-90 160 158;0 160 158;0 160 158;-90 160 158" keyTimes="0;.2;.6;.85;1" ${loop}/>
        <line x1="160" y1="158" x2="160" y2="118" stroke="${B}" stroke-width="9" stroke-linecap="round"/><line x1="160" y1="118" x2="160" y2="80" stroke="#8a95a8" stroke-width="12" stroke-linecap="round"/><circle cx="160" cy="66" r="11" fill="#8a95a8"/>
        <line x1="160" y1="92" x2="140" y2="116" stroke="${B}" stroke-width="7" stroke-linecap="round"/><line x1="160" y1="92" x2="180" y2="116" stroke="${B}" stroke-width="7" stroke-linecap="round"/></g>
      <text x="310" y="190" font-size="10" fill="${MUT}" text-anchor="end">reward = height of the torso</text>`, 'A humanoid rises from lying to standing') };
  window.GOALS = G;
})();
