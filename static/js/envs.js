// Environment families shown in the explorer. Facts (presets, return windows) follow the codesign-gym README.
// video: showcase clip; note: how the clip was made (every clip without a note is an eval rollout from the baseline runs).
window.ENV_FAMILIES = [
  {
    id: 'ballcatcher', name: 'Ball Catcher', sim: 'ball_catcher · MuJoCo Warp', tags: ['native', 'manip', 'loco'], ids: 3,
    blurb: 'Catch a thrown ball in a glove while staying upright.',
    design: 'geometry of every leg and arm link (stretch or shrink in body-frame axes)', policy: 'joint torques to intercept the throw',
    presets: [['Pitch: close, low, spread laterally', '+10 / 0'], ['Arc: farther, lofted', '+10 / 0'], ['Fielding: distant, high, wide variance', '+10 / 0']],
    example: 'BallCatcher-Pitch',
  },
  {
    id: 'solar', name: 'Solar Panel Cleaner', sim: 'panel_cleaner · MuJoCo Warp', tags: ['native', 'manip', 'loco'], ids: 3,
    blurb: 'Walk to the panels and sweep them clean. Only the roller may touch.',
    design: 'every leg and arm link, deformed independently', policy: 'walk to the array, then sweep with the roller',
    presets: [['Reach: tall, far panels (arm-dominant)', '+10 / 0'], ['Stability: rolling terrain, shoves (leg-dominant)', '+10 / 0'], ['Traverse: packed array, plates are obstacles', '+10 / 0']],
    example: 'SolarCleanerTraverse',
  },
  {
    id: 'truck', name: 'Truck Unloading Line', sim: 'truck_unload · MuJoCo Warp', tags: ['native', 'manip', 'multi'], ids: 2,
    blurb: 'One policy runs a whole line of robots unloading and sorting boxes.',
    design: 'column + two arm-link lengths per robot, each robot independent', policy: 'arms, mobile bases and adhesion grippers, jointly',
    presets: [['Single: one stacker shelving red boxes', 'max 10'], ['Multi: shelf + flat 3×3 area, two stackers', 'max 10']],
    example: 'TruckUnloadSingle',
  },
  {
    id: 'nerograsp', goal: 'nerograsp', goalCard: true, name: 'Grasping Small Objects', sim: 'nerograsp · MuJoCo Warp', tags: ['native', 'manip'], ids: 13,
    blurb: 'Lift tiny tools and hardware with fingertips you get to redesign.',
    design: 'full-mesh index and thumb fingertips', policy: 'reach, close, lift',
    presets: [['Tiny: randomized fastener', '≈+13 / 0'], ['Small: randomized elongated tool', '≈+13 / 0'], ['Thin: a washer', '≈+13 / 0'], ['All: every object above', '≈+13 / 0'], ['+ one id per object', '']],
    example: 'NeroGraspTiny',
  },
  {
    id: 'rotateinhand', name: 'In-Hand Rotation', sim: 'rotate_in_hand · MuJoCo Warp', tags: ['native', 'manip'], ids: 1, transition: true,
    blurb: 'Turn an object to a stream of goal orientations with a hand that reshapes itself.',
    design: '216 pad-cell heights in [0, 1] + 3 finger-link offsets', policy: '19 hand actuators',
    presets: [['RotateInHand: box, goals 1 rad apart, 15 s', '+10 per goal / 0']],
    example: 'RotateInHand',
    note: 'Design sweep rendered from the env\u2019s hand model in MuJoCo: the 216 pad heights blend between random valid designs. Not a trained policy.'
  },
  {
    id: 'handpickup', name: 'Hand Pick Up', sim: 'hand_pick_up · MuJoCo Warp', tags: ['native', 'manip'], ids: 3, transition: true,
    blurb: 'Lift a cube, ball or hammer off a table, then pose it, with the same shape-shifting hand.',
    design: '216 pad-cell heights + 3 finger-link offsets', policy: '19 hand actuators, palm down over the table',
    presets: [['HandPickUp-Cube', '+9 per goal, +1 tip / 0'], ['HandPickUp-SquashBall', '+9 per goal, +1 tip / 0'], ['HandPickUp-Hammer', '+10 / 0']],
    example: 'HandPickUp-Cube', still: true, poster: 'static/images/envs/fig3/handpickup.jpg',
    note: 'Still from the paper (Figure 3).'
  },
  {
    id: 'softwalker', goal: 'softwalker', goalCard: true, name: 'Soft Robot Walker', sim: 'soft_walker · native Warp soft-body engine', tags: ['native', 'soft', 'loco'], ids: 15,
    blurb: 'Evolve a soft body and its gait over flat, stepped or gapped terrain.',
    design: 'per cell: occupancy, stiffness, density, actuator strength, fibre direction, channel, Poisson ratio', policy: 'actuation channels over time',
    presets: [['Spring lattice (2D)', 'flat / stairs / gaps'], ['MPM (2D) and MPM (3D)', 'flat / stairs / gaps'], ['Timoshenko beam lattice (3D)', 'flat / stairs / gaps'], ['Hexahedral FEM, neo-Hookean (3D)', 'flat / stairs / gaps']],
    example: 'SoftWalkerHexFEM3D-Gaps',
    note: 'Render from the environment (HexFEM 3D on the Gaps terrain), not a baseline run. Baselines on SoftWalkerBeam3D (CMA-ES, FastTD3, PPO+NGOpt; 5 seeds) are in the results explorer. Return windows are not yet characterised.'
  },
  {
    id: 'lq', goal: 'lq', goalCard: true, name: 'LQ Structure', sim: 'lq_structure · python-control + cvxpy', tags: ['reframed', 'control'], ids: 3,
    blurb: 'A mass-spring chain with an exact optimum: a sanity check for co-design.',
    design: 'masses, stiffness, damping, actuator + sensor placement', policy: 'regulate against disturbances (LQR / LQG / QP)',
    presets: [['LQR: continuous design, unconstrained control', '0 / −∞'], ['LQG: placement under process + sensor noise', '0 / −∞'], ['QP: actuator saturation, mass/authority budget', '0 / −∞']],
    example: 'LQStructure-LQR-v0',
  },
  {
    id: 'microgrid', goal: 'microgrid', goalCard: true, name: 'Microgrid Sizing & Dispatch', sim: 'microgrid · python-microgrid', tags: ['reframed', 'infra'], ids: 5,
    blurb: 'Size the solar, battery and diesel, then dispatch against real demand.',
    design: 'solar kW, battery kWh, genset kW', policy: 'charge, discharge, curtail, import',
    presets: [['Random: one building, grid-tied, 24 h', '+720 / ≈−270k'], ['Forecast: + noisy forecasts', '+720 / ≈−270k'], ['Campus: several buildings', '+2,880 / ≈−1.08M'], ['Off-grid: solar + battery + genset, 72 h', '0 / ≈−378k'], ['Off-grid campus', '0 / ≈−1.51M']],
    example: 'MicrogridRandom',
  },
  {
    id: 'network', goal: 'network', goalCard: true, name: 'Wireless Network Placement', sim: 'mobile_env · mobile-env', tags: ['reframed', 'infra'], ids: 3,
    blurb: 'Place base stations, then hand moving users between them.',
    design: 'number, position and transmit power of base stations (count + power budgets)', policy: 'user-to-cell association',
    presets: [['Urban: pedestrians, 3–8 small cells', '+100 / −100'], ['Suburban: mixed mobility, 3–7 cells', '+100 / −100'], ['Motorway: sparse, fast, 1–4 macro cells', '+100 / −100']],
    example: 'NetworkUrban',
  },
  {
    id: 'racing', name: 'Vehicle Setup (Racing)', sim: 'f1tenth · f1tenth_gym_jax (JAX)', tags: ['reframed', 'games'], ids: 2, transition: true,
    blurb: 'Tune grip, stiffness and power, then drive the fastest lap.',
    design: 'tyre grip, cornering stiffness, drive power, weight distribution (mass is derived)', policy: 'steering + throttle',
    presets: [['Spielberg time trial', '±343 m (one lap)'], ['Levine time trial', '±63 m (one lap)']],
    example: 'RacingSpielberg',
  },
  {
    id: 'warehouse', goal: 'warehouse', goalCard: true, name: 'Warehouse Layout', sim: 'robot_warehouse · Jumanji (JAX)', tags: ['reframed', 'multi'], ids: 3,
    blurb: 'Lay out the shelves, then coordinate the robot fleet.',
    design: 'combinatorial shelf placement', policy: 'joint navigation for the whole fleet',
    presets: [['Small: 10×10, 2 robots, 25 shelves', '+1000 / 0'], ['Medium: 16×16, 4 robots, 115 shelves', '+1000 / 0'], ['Congested: 20×22, 8 robots, 264 shelves', '+1000 / 0']],
    example: 'WarehouseSmall',
  },
  {
    id: 'halfcheetah', goal: 'locomotion', sweep: true, name: 'Half-Cheetah', sim: 'half_cheetah · MuJoCo Warp', tags: ['extended', 'loco'], ids: 1,
    blurb: "A planar runner whose six leg segments you can reshape.",
    design: "each leg segment’s length and angle, head and torso halves (16-dim)", policy: '6 leg joints',
    presets: [['HalfCheetah-v4', 'unbounded return']],
    example: 'HalfCheetah-v4',
    note: "Real eval rollout (PPO+NGOpt): this co-designed cheetah flipped and kept going."
  },
  {
    id: 'hopper', goal: 'locomotion', sweep: true, name: 'Hopper', sim: 'hopper · MuJoCo Warp', tags: ['extended', 'loco'], ids: 1,
    blurb: "Hop forward without falling, on a leg you design.",
    design: "thigh, leg, torso and foot lengths + angles (8-dim)", policy: 'thigh, leg and foot joints',
    presets: [['Hopper-v4', 'unbounded return']],
    example: 'Hopper-v4',
    note: "Real eval rollout (CMA-ES), follow-cropped around the robot."
  },
  {
    id: 'walker2d', goal: 'locomotion', sweep: true, name: 'Walker-2D', sim: 'walker2d · MuJoCo Warp', tags: ['extended', 'loco'], ids: 1,
    blurb: "Two legs, designed independently: asymmetric walkers allowed.",
    design: "thigh, leg and foot of both legs + torso halves (12-dim)", policy: '6 leg joints',
    presets: [['Walker2d-v4', 'unbounded return']],
    example: 'Walker2d-v4', still: true, poster: 'static/images/envs/fig3/walker2d.jpg',
    note: "Still from the paper (Figure 3): the fixed eval camera loses this robot within about a second."
  },
  {
    id: 'swimmer', goal: 'swim', sweep: true, name: 'Swimmer', sim: 'swimmer · MuJoCo Warp', tags: ['extended', 'loco'], ids: 1,
    blurb: "Swim through viscous fluid with links you get to reshape.",
    design: "all three links’ length and angle (6-dim)", policy: '2 inter-link joints',
    presets: [['Swimmer-v4', 'unbounded return']],
    example: 'Swimmer-v4',
    note: "Real eval rollout (FastTD3), follow-cropped around the robot."
  },
  {
    id: 'ant', goal: 'locomotion', sweep: true, name: 'Ant', sim: 'ant · MuJoCo Warp', tags: ['extended', 'loco'], ids: 1,
    blurb: "A 3D quadruped where every leg link is a design variable.",
    design: "3D length and orientation of all 12 leg links (36-dim)", policy: '8 leg joints',
    presets: [['Ant-v4', 'unbounded return']],
    example: 'Ant-v4', still: true, poster: 'static/images/envs/fig3/ant.jpg',
    note: "Still from the paper (Figure 3): the fixed eval camera loses this robot within about a second."
  },
  {
    id: 'humanoid', goal: 'locomotion', sweep: true, name: 'Humanoid', sim: 'humanoid · MuJoCo Warp', tags: ['extended', 'loco'], ids: 1,
    blurb: "Run with limbs, hands and feet you can resize.",
    design: "3D limbs plus hand and foot radii (28-dim)", policy: '17 joints',
    presets: [['Humanoid-v4', 'unbounded return']],
    example: 'Humanoid-v4',
    note: "Real eval rollout (FastTD3, return 5,956), follow-cropped around the robot."
  },
  {
    id: 'humanoidstandup', goal: 'standup', sweep: true, name: 'Humanoid Standup', sim: 'humanoid_standup · MuJoCo Warp', tags: ['extended', 'loco'], ids: 1,
    blurb: "Get up off the floor, with the same 28-dim design space.",
    design: "3D limbs plus hand and foot radii (28-dim)", policy: '17 joints',
    presets: [['HumanoidStandup-v4', 'unbounded return']],
    example: 'HumanoidStandup-v4',
    note: "Real eval rollout (FastTD3), follow-cropped around the robot."
  },
  {
    id: 'pokemon', name: 'Pokémon Showdown', sim: 'pokenv · Pokémon Showdown + poke-env', tags: ['reframed', 'games'], ids: 23,
    blurb: 'Build a team of six, then learn to win with it.',
    design: 'the team: species, moves, EVs, item, nature, ability × 6 slots', policy: 'the battle strategy, turn by turn',
    presets: [['Random / MaxPower / Heuristic opponent', '+28 / −28'], ['League G1–G9, fixed gauntlet', '+140 / −28'], ['League …H: team state carries over', '+140 / −28'], ['League Rand / RandH: random generation', '+140 / −28']],
    example: 'PokenvRandom',
    poster: 'static/images/envs/pokenv.svg', replay: { src: 'static/replays/PokenvMaxPower/fasttd3-best.html' },
    note: 'A real final-evaluation battle (FastTD3 on PokenvMaxPower, best seed), replayed by the Pokémon Showdown client. Only the text battle log is hosted here; the client and its artwork load from play.pokemonshowdown.com. Press Play.'
  }
];

window.ENV_TAGS = [['all', 'All'], ['native', 'Native'], ['reframed', 'Unlocked/Reframed'], ['extended', 'Extended']];
