import sys; import os as _os; sys.path.insert(0, _os.path.dirname(__file__))
import assemble_scene as S       # builds the full temple scene
import bpy, math, os
from mathutils import Vector
W = S.W

# args: render_seq.py <N> <start> <end> [--novol]
def argint(i, d):
    try: return int(sys.argv[i])
    except Exception: return d
N     = argint(-3, 72) if len(sys.argv) >= 4 and sys.argv[-3].lstrip("-").isdigit() else argint(-1, 72)
# simpler positional parse
nums = [int(a) for a in sys.argv if a.isdigit()]
N     = nums[0] if len(nums) >= 1 else 72
START = nums[1] if len(nums) >= 2 else 0
END   = nums[2] if len(nums) >= 3 else N
NOVOL = "--novol" in sys.argv

# a single continuous move: intimate on the torch/face → pull back and
# rise through the colonnade to the whole temple
KF = [
    (0.00, (0.55, 3.55, 1.50), (0.18, 4.05, 0.15)),
    (0.30, (0.90, 3.10, 2.40), (0.10, 3.55, 0.12)),
    (0.62, (1.20, 2.62, 4.30), (0.03, 3.15, 0.10)),
    (1.00, (1.62, 2.50, 9.80), (0.00, 3.00, 0.08)),
]
def smooth(t): return t * t * (3 - 2 * t)
def lerp3(a, b, f): return tuple(a[k] + (b[k] - a[k]) * f for k in range(3))
def sample(t):
    for i in range(len(KF) - 1):
        t0, p0, l0 = KF[i]; t1, p1, l1 = KF[i + 1]
        if t <= t1 or i == len(KF) - 2:
            f = smooth((t - t0) / max(1e-6, (t1 - t0)))
            return lerp3(p0, p1, f), lerp3(l0, l1, f)
    return KF[-1][1], KF[-1][2]

cam_d = bpy.data.cameras.new("c"); cam_d.lens = 42; cam_d.clip_start = 0.05; cam_d.clip_end = 200
cam = bpy.data.objects.new("c", cam_d); bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

sc = S.configure(preview=True)
sc.cycles.samples = 52
sc.render.resolution_x = 1024; sc.render.resolution_y = 640
sc.cycles.volume_bounces = 1
if NOVOL:
    try: S.vol.inputs['Density'].default_value = 0.0
    except Exception: pass

os.makedirs('/tmp/seq', exist_ok=True)
for i in range(START, END):
    t = i / (N - 1)
    p, l = sample(t)
    cam.location = W(*p)
    d = (W(*l) - W(*p)).normalized()
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = f"/tmp/seq/f{i:03d}.png"
    bpy.ops.render.render(write_still=True)
    print("FRAME", i, "DONE")
print("SEQ DONE", START, END)
