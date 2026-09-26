// Environment families shown in the explorer. Facts (presets, return windows, credits) follow the codesign-gym README.
// video: showcase clip; note: how the clip was made (every clip without a note is an eval rollout from the baseline runs).
window.ENV_FAMILIES = [
  {
    id: 'ballcatcher', name: 'Ball Catcher', sim: 'ball_catcher · MuJoCo Warp', tags: ['native', 'manip', 'loco'], ids: 3,
    blurb: 'Catch a thrown ball in a glove while staying upright.',
    design: 'geometry of every leg and arm link (stretch or shrink in body-frame axes)', policy: 'joint torques to intercept the throw',
    presets: [['Pitch: close, low, spread laterally', '+10 / 0'], ['Arc: farther, lofted', '+10 / 0'], ['Fielding: distant, high, wide variance', '+10 / 0']],
    example: 'BallCatcher-Pitch', credit: 'Yordan Tsvetkov, Rika Antonova, Leonard Pleiss; integrated by Leonard Pleiss and Aviraj Newatia.'
  },
  {
    id: 'solar', name: 'Solar Panel Cleaner', sim: 'panel_cleaner · MuJoCo Warp', tags: ['native', 'manip', 'loco'], ids: 3,
    blurb: 'Walk to the panels and sweep them clean. Only the roller may touch.',
    design: 'every leg and arm link, deformed independently', policy: 'walk to the array, then sweep with the roller',
    presets: [['Reach: tall, far panels (arm-dominant)', '+10 / 0'], ['Stability: rolling terrain, shoves (leg-dominant)', '+10 / 0'], ['Traverse: packed array, plates are obstacles', '+10 / 0']],
    example: 'SolarCleanerTraverse', credit: 'Yordan Tsvetkov, Rika Antonova; integrated by Aviraj Newatia.'
  },
  {
    id: 'truck', name: 'Truck Unloading Line', sim: 'truck_unload · MuJoCo Warp', tags: ['native', 'manip', 'multi'], ids: 2,
    blurb: 'One policy runs a whole line of robots unloading and sorting boxes.',
    design: 'column + two arm-link lengths per robot, each robot independent', policy: 'arms, mobile bases and adhesion grippers, jointly',
    presets: [['Single: one stacker shelving red boxes', 'max 10'], ['Multi: shelf + flat 3×3 area, two stackers', 'max 10']],
    example: 'TruckUnloadSingle', credit: 'Yordan Tsvetkov (multi-robot manipulation); ported from rl-curr-replay.'
  },
  {
    id: 'nerograsp', name: 'Grasping Small Objects', sim: 'nerograsp · MuJoCo Warp', tags: ['native', 'manip'], ids: 13,
    blurb: 'Lift tiny tools and hardware with fingertips you get to redesign.',
    design: 'full-mesh index and thumb fingertips', policy: 'reach, close, lift',
    presets: [['Tiny: randomized fastener', '≈+13 / 0'], ['Small: randomized elongated tool', '≈+13 / 0'], ['Thin: a washer', '≈+13 / 0'], ['All: every object above', '≈+13 / 0'], ['+ one id per object', '']],
    example: 'NeroGraspTiny', credit: 'Aviraj Newatia, Rika Antonova (earlier contributions from Austin Yang).'
  },
  {
    id: 'hand', name: 'Shape-shifting Hand', sim: 'rotate_in_hand · hand_pick_up · MuJoCo Warp', tags: ['native', 'manip'], ids: 4, transition: true,
    blurb: 'A hand that reshapes itself, even mid-episode, to turn or pick up objects.',
    design: '216 pad-cell heights in [0, 1] + 3 finger-link offsets', policy: '19 hand actuators',
    presets: [['RotateInHand: box, goals 1 rad apart', '+10 per goal / 0'], ['HandPickUp-Cube', '+9 per goal, +1 tip / 0'], ['HandPickUp-SquashBall', '+9 per goal, +1 tip / 0'], ['HandPickUp-Hammer', '+10 / 0']],
    example: 'RotateInHand', credit: 'Yordan Tsvetkov; ported from rl-curr-replay.',
    note: 'Design sweep rendered from the env’s hand model in MuJoCo: the 216 pad heights blend between random valid designs. Not a trained policy.'
  },
  {
    id: 'gym', name: 'Classic Locomotion, Co-Designed', sim: 'half_cheetah … humanoid_standup · MuJoCo Warp', tags: ['extended', 'loco'], ids: 7,
    blurb: 'HalfCheetah, Hopper, Ant, Humanoid and friends, with reshapeable bodies.',
    design: 'link lengths (3D length + orientation for Ant and Humanoid, 28-dim)', policy: 'the familiar v4 joint torques',
    presets: [['HalfCheetah-v4 · Hopper-v4 · Walker2d-v4', 'planar'], ['Swimmer-v4', 'fluid drag'], ['Ant-v4', '12 leg links, 3D'], ['Humanoid-v4 · HumanoidStandup-v4', '28-dim design']],
    example: 'Hopper-v4', credit: 'Ported into MuJoCo Warp and co-design by Aviraj Newatia (XML vendored from Gymnasium, MIT).',
    note: 'Four eval rollouts: Hopper, HalfCheetah (it flipped: a real PPO+NGOpt outcome), Swimmer, HumanoidStandup. Fixed-camera clips are follow-cropped around the robot.'
  },
  {
    id: 'softwalker', name: 'Soft Robot Walker', sim: 'soft_walker · native Warp soft-body engine', tags: ['native', 'soft', 'loco'], ids: 15,
    blurb: 'Evolve a soft body and its gait over flat, stepped or gapped terrain.',
    design: 'per cell: occupancy, stiffness, density, actuator strength, fibre direction, channel, Poisson ratio', policy: 'actuation channels over time',
    presets: [['Spring lattice (2D)', 'flat / stairs / gaps'], ['MPM (2D) and MPM (3D)', 'flat / stairs / gaps'], ['Timoshenko beam lattice (3D)', 'flat / stairs / gaps'], ['Hexahedral FEM, neo-Hookean (3D)', 'flat / stairs / gaps']],
    example: 'SoftWalkerHexFEM3D-Gaps', credit: 'Engine by Andrew Spielberg; integrated by Aviraj Newatia.',
    note: 'Render from the environment (HexFEM 3D on the Gaps terrain), not a baseline run. Baselines on SoftWalkerBeam3D (CMA-ES, FastTD3, PPO+NGOpt; 5 seeds) are in the results explorer. Return windows are not yet characterised.'
  },
  {
    id: 'lq', name: 'LQ Structure', sim: 'lq_structure · python-control + cvxpy', tags: ['reframed', 'control'], ids: 3,
    blurb: 'A mass-spring chain with an exact optimum: a sanity check for co-design.',
    design: 'masses, stiffness, damping, actuator + sensor placement', policy: 'regulate against disturbances (LQR / LQG / QP)',
    presets: [['LQR: continuous design, unconstrained control', '0 / −∞'], ['LQG: placement under process + sensor noise', '0 / −∞'], ['QP: actuator saturation, mass/authority budget', '0 / −∞']],
    example: 'LQStructure-LQR-v0', credit: 'Aviraj Newatia.'
  },
  {
    id: 'microgrid', name: 'Microgrid Sizing & Dispatch', sim: 'microgrid · python-microgrid', tags: ['reframed', 'infra'], ids: 5,
    blurb: 'Size the solar, battery and diesel, then dispatch against real demand.',
    design: 'solar kW, battery kWh, genset kW', policy: 'charge, discharge, curtail, import',
    presets: [['Random: one building, grid-tied, 24 h', '+720 / ≈−270k'], ['Forecast: + noisy forecasts', '+720 / ≈−270k'], ['Campus: several buildings', '+2,880 / ≈−1.08M'], ['Off-grid: solar + battery + genset, 72 h', '0 / ≈−378k'], ['Off-grid campus', '0 / ≈−1.51M']],
    example: 'MicrogridRandom', credit: 'Aviraj Newatia; built on python-microgrid (pymgrid).'
  },
  {
    id: 'network', name: 'Wireless Network Placement', sim: 'mobile_env · mobile-env', tags: ['reframed', 'infra'], ids: 3,
    blurb: 'Place base stations, then hand moving users between them.',
    design: 'number, position and transmit power of base stations (count + power budgets)', policy: 'user-to-cell association',
    presets: [['Urban: pedestrians, 3–8 small cells', '+100 / −100'], ['Suburban: mixed mobility, 3–7 cells', '+100 / −100'], ['Motorway: sparse, fast, 1–4 macro cells', '+100 / −100']],
    example: 'NetworkUrban', credit: 'Aviraj Newatia; built on mobile-env.'
  },
  {
    id: 'racing', name: 'Vehicle Setup (Racing)', sim: 'f1tenth · f1tenth_gym_jax (JAX)', tags: ['reframed', 'games'], ids: 2, transition: true,
    blurb: 'Tune grip, stiffness and power, then drive the fastest lap.',
    design: 'tyre grip, cornering stiffness, drive power, weight distribution (mass is derived)', policy: 'steering + throttle',
    presets: [['Spielberg time trial', '±343 m (one lap)'], ['Levine time trial', '±63 m (one lap)']],
    example: 'RacingSpielberg', credit: 'Aviraj Newatia; built on f1tenth_gym_jax.'
  },
  {
    id: 'warehouse', name: 'Warehouse Layout', sim: 'robot_warehouse · Jumanji (JAX)', tags: ['reframed', 'multi'], ids: 3,
    blurb: 'Lay out the shelves, then coordinate the robot fleet.',
    design: 'combinatorial shelf placement', policy: 'joint navigation for the whole fleet',
    presets: [['Small: 10×10, 2 robots, 25 shelves', '+1000 / 0'], ['Medium: 16×16, 4 robots, 115 shelves', '+1000 / 0'], ['Congested: 20×22, 8 robots, 264 shelves', '+1000 / 0']],
    example: 'WarehouseSmall', credit: 'Aviraj Newatia; built on Jumanji RobotWarehouse.'
  },
  {
    id: 'pokemon', name: 'Pokémon Showdown', sim: 'pokenv · Pokémon Showdown + poke-env', tags: ['reframed', 'games'], ids: 23,
    blurb: 'Build a team of six, then learn to win with it.',
    design: 'the team: species, moves, EVs, item, nature, ability × 6 slots', policy: 'the battle strategy, turn by turn',
    presets: [['Random / MaxPower / Heuristic opponent', '+28 / −28'], ['League G1–G9, fixed gauntlet', '+140 / −28'], ['League …H: team state carries over', '+140 / −28'], ['League Rand / RandH: random generation', '+140 / −28']],
    example: 'PokenvRandom', credit: 'Aviraj Newatia; built on Pokémon Showdown and poke-env.',
    poster: 'static/images/envs/pokenv.svg', replay: { src: 'static/replays/PokenvMaxPower/fasttd3-best.html' },
    note: 'A real final-evaluation battle (FastTD3 on PokenvMaxPower, best seed), replayed by the Pokémon Showdown client. Only the text battle log is hosted here; the client and its artwork load from play.pokemonshowdown.com. Press Play.'
  }
];

window.ENV_TAGS = [['all', 'All'], ['native', 'Native'], ['extended', 'Extended'], ['reframed', 'Reframed']];
