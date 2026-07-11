import sys; import os as _os; sys.path.insert(0, _os.path.dirname(__file__))
import assemble_scene as S       # builds the full temple scene
import bpy, math, os
from mathutils import Vector
W = S.W

nums = [int(a) for a in sys.argv if a.isdigit()]
N     = nums[0] if len(nums) >= 1 else 84
START = nums[1] if len(nums) >= 2 else 0
END   = nums[2] if len(nums) >= 3 else N
NOVOL = "--novol" in sys.argv

# ── the emotional arc ────────────────────────────────────────
# I  in the dark   — cold, dim; she is almost lost
# II the approach  — closer, still cold
# III the kindling — the altar flame IGNITES, warm light floods her (climax)
# IV glory         — full warm light, pull back to the whole temple
def sstep(a, b, t):
    t = 0.0 if b == a else min(1.0, max(0.0, (t - a) / (b - a)))
    return t * t * (3 - 2 * t)
def mix(a, b, f): return a + (b - a) * f

# camera path — intimate and searching, holds through the kindling, then withdraws
KF = [
    (0.00, (0.55, 3.15, 1.85), (0.10, 3.45, 0.10)),
    (0.34, (0.80, 3.00, 2.55), (0.06, 3.30, 0.10)),
    (0.52, (0.98, 2.82, 3.15), (0.02, 3.20, 0.10)),
    (0.66, (1.06, 2.74, 3.60), (0.00, 3.14, 0.10)),
    (1.00, (1.62, 2.55, 9.80), (0.00, 3.00, 0.08)),
]
def lerp3(a, b, f): return tuple(a[k] + (b[k] - a[k]) * f for k in range(3))
def campath(t):
    for i in range(len(KF) - 1):
        t0, p0, l0 = KF[i]; t1, p1, l1 = KF[i + 1]
        if t <= t1 or i == len(KF) - 2:
            f = sstep(t0, t1, t)
            return lerp3(p0, p1, f), lerp3(l0, l1, f)
    return KF[-1][1], KF[-1][2]

# light rig references
emNode = next(n for n in S.flameMat.node_tree.nodes if n.type == 'EMISSION')
def light(t):
    # a ~6-stop swing so the turn is FELT: a cold ghost in the dark →
    # the flame catches → a warm flood → glory
    ignite = sstep(0.48, 0.62, t)          # the flame catches (sharp)
    flood  = sstep(0.46, 0.64, t)          # the key floods up
    warm   = sstep(0.44, 0.72, t)          # cold → firelit colour
    settle = sstep(0.64, 1.0, t)
    # key spot: a dim cold rim → a warm flood → settle
    S.spot.energy = mix(140.0, 8500.0, flood) * (1.0 - 0.28 * settle)
    S.spot.color = (mix(0.55, 1.0, warm), mix(0.68, 0.80, warm), mix(1.0, 0.52, warm))
    # the flame: dead in the dark, ignites, then holds
    emNode.inputs['Strength'].default_value = mix(0.0, 32.0, ignite)
    S.flpt.energy = mix(0.0, 300.0, ignite)
    # the raking sun: dead in the dark, rises with the flood (this is the
    # ambient that was drowning the arc when left constant)
    S.sun.energy = mix(0.0, 1.5, flood)
    S.sun.color = (mix(0.6, 1.0, warm), mix(0.72, 0.90, warm), mix(1.0, 0.74, warm))
    # the hall: near-black, lifts into the glory
    S.bg.inputs['Strength'].default_value = mix(0.03, 0.24, sstep(0.48, 1.0, t))
    S.fill.energy = mix(3.0, 52.0, warm)
    S.fill.color = (mix(0.42, 0.55, warm), mix(0.56, 0.58, warm), mix(0.95, 0.66, warm))

cam_d = bpy.data.cameras.new("c"); cam_d.lens = 42; cam_d.clip_start = 0.05; cam_d.clip_end = 200
cam = bpy.data.objects.new("c", cam_d); bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

sc = S.configure(preview=True)
sc.cycles.samples = 54
sc.render.resolution_x = 1024; sc.render.resolution_y = 640
sc.cycles.volume_bounces = 1
sc.view_settings.exposure = 0.15          # keep the darks dark for the arc
if NOVOL:
    try: S.vol.inputs['Density'].default_value = 0.0
    except Exception: pass

os.makedirs('/tmp/seq', exist_ok=True)
for i in range(START, END):
    t = i / (N - 1)
    p, l = campath(t)
    cam.location = W(*p)
    d = (W(*l) - W(*p)).normalized()
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    light(t)
    sc.render.filepath = f"/tmp/seq/f{i:03d}.png"
    bpy.ops.render.render(write_still=True)
    print("FRAME", i, "DONE")
print("SEQ DONE", START, END)
