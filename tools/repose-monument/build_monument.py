# ═══════════════════════════════════════════════════════════════
# KLEOS — build the monument GLB (headless Blender)
#
#   pip install bpy==4.2.0
#   python build_monument.py <lucy_plain.glb> <decimate 0..1> <out.glb>
#
# Imports the Stanford "Lucy" winged-Victory scan, stands and
# normalises it, decimates for the web, sets it on a classical
# pedestal, and exports a two-part GLB (meshes: figure, pedestal).
# Run it twice (e.g. 0.55 hi, 0.30 lo), then meshopt-compress each
# with compress.mjs. Blender can't read EXT_meshopt_compression, so
# feed it a plain GLB (see decompress.mjs).
# ═══════════════════════════════════════════════════════════════
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import blender_lib as B, bpy
SRC   = sys.argv[-3]
DECIM = float(sys.argv[-2])
OUT   = sys.argv[-1]

B.reset()
obj = B.load_one_mesh(SRC)
B.stand_and_ground(obj); B.normalize_height(obj, 2.0)
obj.name = "figure"
dm = obj.modifiers.new("dec", "DECIMATE"); dm.ratio = DECIM
bpy.context.view_layer.objects.active = obj
bpy.ops.object.modifier_apply(modifier="dec")
for p in obj.data.polygons: p.use_smooth = True

# ── grand classical pedestal (stepped base, tapered shaft, cornice) ─
def box(name, w, d, h, zbot, taper_top=1.0):
    bpy.ops.mesh.primitive_cube_add(size=1); o = bpy.context.active_object; o.name = name
    for v in o.data.vertices:
        v.co.x *= w; v.co.y *= d; v.co.z = zbot + (v.co.z + 0.5) * h
    for v in o.data.vertices:
        f = (v.co.z - zbot) / h; s = 1.0 + (taper_top - 1.0) * f
        v.co.x *= s; v.co.y *= s
    o.data.update()
    return o
step  = box("step", 1.86, 1.86, 0.24, 0.00)
plin  = box("plin", 1.54, 1.54, 0.16, 0.24)
shaft = box("shaft", 1.30, 1.30, 1.58, 0.40, taper_top=0.88)
cap   = box("cap", 1.56, 1.56, 0.26, 1.98)
capTop = 2.24
bpy.ops.object.select_all(action='DESELECT')
for o in (step, plin, shaft, cap): o.select_set(True)
bpy.context.view_layer.objects.active = step
bpy.ops.object.join(); step.name = "pedestal"
for p in step.data.polygons: p.use_smooth = False

# seat the figure on the cap and bake her transform into the mesh
# (the web loader keeps geometry only, discarding node transforms)
obj.location = (0.0, 0.0, capTop - 0.04)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

obj.data.materials.clear(); step.data.materials.clear()
bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); step.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True,
    export_apply=True, export_yup=True, export_normals=True)
print("EXPORT", OUT, "figV", len(obj.data.vertices), "capTop", capTop)
