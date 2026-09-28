import sys, inspect, numpy as np, mujoco
import os; sys.path.insert(0, os.environ.get('CODESIGN_GYM_SRC', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'codesign-gym', 'src')))
from envs.panel_cleaner import vector_env as V, config as C
def build(preset='REACH'):
    cls = V.PanelCleanParallelEnv
    kw = {k: p.default for k, p in inspect.signature(cls.__init__).parameters.items() if p.default is not inspect._empty}; kw.update(getattr(C, preset))
    o = object.__new__(cls)
    o._xmls = (kw['ant_xml'], kw['arm_xml'], kw['scene_xml'])
    o._roller = dict(radius=kw['roller_radius'], width=kw['roller_width'], mass=kw['roller_mass'], solref=tuple(kw['roller_solref']), friction=tuple(kw['roller_friction']))
    o._panels = dict(rows=kw['panel_rows'], cols=kw['panel_cols'], first_pos=tuple(kw['first_panel_pos']), length=kw['panel_length'], width=kw['panel_width'], height=kw['panel_height'], tilt_degs=kw['panel_tilt_degs'],
                     n_sensor_rows=kw['n_sensor_rows'], n_sensor_cols=kw['n_sensor_cols'], thickness=kw['panel_thickness'], gap_x=kw['panel_gap_x'], gap_y=kw['panel_gap_y'], collide_roller_only=kw['collide_roller_only'])
    o.midpoints = kw['midpoints']; o.panel_traversal = kw['panel_traversal']; o.midpoint_y_offset = kw['midpoint_y_offset']
    o.field_pos = np.asarray(kw['field_pos'], float); o.field_size = np.asarray(kw['field_size'], float); o.terrain = False; o.timestep = kw['timestep']
    spec = cls._build_base_spec(o); m = spec.compile()
    return m, o.grid, kw
if __name__ == '__main__':
    m, grid, kw = build()
    print('nbody', m.nbody, 'njnt', m.njnt, 'nu', m.nu, 'ngeom', m.ngeom, 'spawn_offset', kw.get('spawn_offset'))
    print('joints', [(mujoco.mj_id2name(m, 3, j), int(m.jnt_type[j])) for j in range(m.njnt)])
    print('cells', len(grid.cells), list(grid.cells.items())[:2], list(grid.cell_pos.items())[:2])
    print('roller geom?', [mujoco.mj_id2name(m, 5, g) for g in range(m.ngeom) if 'roll' in (mujoco.mj_id2name(m, 5, g) or '')])
