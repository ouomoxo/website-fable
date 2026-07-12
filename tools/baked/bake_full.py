import sys; import os as _o; sys.path.insert(0,_o.path.dirname(__file__))
import assemble_scene as S      # builds the temple scene + light rig
import bpy, math, os
from mathutils import Vector

os.makedirs('/tmp/lm', exist_ok=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
sc.render.bake.margin = 16
sc.render.bake.use_clear = True
try: sc.view_settings.view_transform = 'AgX'
except Exception: pass
sc.view_settings.exposure = 0.5

fig = S.fig; fig.name = 'figure'
flame = S.fl                       # emissive sphere — light source, not baked

# ── join architecture (everything but figure, flame, floor) ──
arch_objs = []
for ob in list(bpy.data.objects):
    if ob.type != 'MESH': continue
    if ob is fig or ob is flame: continue
    if ob is S.gp: continue        # floor handled in real-time
    arch_objs.append(ob)
bpy.ops.object.select_all(action='DESELECT')
for ob in arch_objs: ob.select_set(True)
arch = arch_objs[0]
bpy.context.view_layer.objects.active = arch
bpy.ops.object.join(); arch.name = 'arch'
print('ARCH verts', len(arch.data.vertices))

# ── UV unwrap both ───────────────────────────────────────────
def unwrap(obj, angle=1.15, margin=0.02):
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=angle, island_margin=margin)
    bpy.ops.object.mode_set(mode='OBJECT')
unwrap(fig, margin=0.02)
unwrap(arch, margin=0.015)

# a reusable image-texture node on every material, so a bake writes to
# whatever image we point it at
def prep(obj):
    nodes = []
    for mat in obj.data.materials:
        nt = mat.node_tree
        n = nt.nodes.new('ShaderNodeTexImage')
        nt.nodes.active = n; nodes.append(n)
    return nodes
fig_nodes = prep(fig)
arch_nodes = prep(arch)

def bake(obj, nodes, name, size, samples):
    img = bpy.data.images.new(name, size, size)
    for n, mat in zip(nodes, obj.data.materials):
        n.image = img
        mat.node_tree.nodes.active = n
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    sc.cycles.samples = samples; sc.cycles.use_denoising = True
    bpy.ops.object.bake(type='COMBINED')
    img.filepath_raw = f'/tmp/lm/{name}.png'; img.file_format = 'PNG'; img.save()
    print('BAKED', name)

emNode = next(n for n in S.flameMat.node_tree.nodes if n.type == 'EMISSION')
def light_state(which):
    if which == 'glory':
        S.spot.energy = 6600; S.spot.color = (1.0, 0.9, 0.66)
        S.sun.energy = 1.5;   S.sun.color = (1.0, 0.9, 0.74)
        S.fill.energy = 52;   S.fill.color = (0.55, 0.58, 0.66)
        S.bg.inputs['Strength'].default_value = 0.24
        emNode.inputs['Strength'].default_value = 26.0; S.flpt.energy = 300.0
    else:  # dark
        S.spot.energy = 150;  S.spot.color = (0.72, 0.82, 1.0)
        S.sun.energy = 0.0
        S.fill.energy = 5;    S.fill.color = (0.42, 0.56, 0.95)
        S.bg.inputs['Strength'].default_value = 0.05
        emNode.inputs['Strength'].default_value = 0.0; S.flpt.energy = 0.0

for state in ('glory', 'dark'):
    light_state(state)
    bake(fig,  fig_nodes,  f'figure_{state}', 2048, 128)
    bake(arch, arch_nodes, f'arch_{state}',   4096, 72)

# ── export geometry (UVs only; materials cleared) ────────────
fig.data.materials.clear(); arch.data.materials.clear()
bpy.ops.object.select_all(action='DESELECT'); fig.select_set(True); arch.select_set(True)
bpy.ops.export_scene.gltf(filepath='/tmp/lm/baked.glb', export_format='GLB',
    use_selection=True, export_apply=True, export_yup=True,
    export_normals=True, export_texcoords=True, export_materials='NONE')
print('EXPORT DONE fig', len(fig.data.vertices), 'arch', len(arch.data.vertices))
