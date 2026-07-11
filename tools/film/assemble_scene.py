import sys; import os as _os; sys.path.insert(0, _os.path.dirname(__file__))
import blender_lib as B, setlib, bpy, math
from mathutils import Vector, Matrix

# coordinate map from the web scene (X, up=Y, depthZ) to Blender (X, Y=depth, Z=up):
#   blender_x = web_x ; blender_y = -web_z ; blender_z = web_y
def W(x, y, z):  # web (x, up, depthTowardCamera+) -> blender vector
    return Vector((x, -z, y))

def marble(name, base, rough, sss=0.10, ssr=(0.9,0.6,0.45)):
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes.get("Principled BSDF")
    b.inputs['Base Color'].default_value=(*base,1); b.inputs['Roughness'].default_value=rough
    try:
        b.inputs['Subsurface Weight'].default_value=sss
        b.inputs['Subsurface Radius'].default_value=ssr
        b.inputs['Subsurface Scale'].default_value=0.12
    except Exception: pass
    return m

def emit(name, color, strength):
    m=bpy.data.materials.new(name); m.use_nodes=True
    nt=m.node_tree; nt.nodes.clear()
    e=nt.nodes.new("ShaderNodeEmission"); e.inputs['Color'].default_value=(*color,1); e.inputs['Strength'].default_value=strength
    o=nt.nodes.new("ShaderNodeOutputMaterial"); nt.links.new(e.outputs['Emission'], o.inputs['Surface'])
    return m

B.reset()

# ── materials ────────────────────────────────────────────────
figMarble = marble("figMarble",(0.82,0.80,0.75),0.34, sss=0.14, ssr=(1.1,0.7,0.5))
colMarble = marble("colMarble",(0.80,0.79,0.75),0.42, sss=0.06, ssr=(0.6,0.4,0.3))
pedMarble = marble("pedMarble",(0.78,0.76,0.71),0.46, sss=0.05)
fragStone = marble("fragStone",(0.52,0.49,0.44),0.72, sss=0.03)
floorMat  = marble("floorMat",(0.24,0.23,0.21),0.42, sss=0.0)
flameMat  = emit("flameMat",(1.0,0.58,0.24),22.0)

# ── figure + pedestal ────────────────────────────────────────
fig=B.load_one_mesh(_os.environ.get("LUCY_PLAIN_GLB","lucy_plain.glb"))
B.stand_and_ground(fig); B.normalize_height(fig,2.0)
fig.data.materials.clear(); fig.data.materials.append(figMarble)
for p in fig.data.polygons: p.use_smooth=True

def box(name,w,d,h,zbot,taper=1.0,mat=None):
    bpy.ops.mesh.primitive_cube_add(size=1); o=bpy.context.active_object; o.name=name
    for v in o.data.vertices:
        v.co.x*=w; v.co.y*=d; v.co.z=zbot+(v.co.z+0.5)*h
    for v in o.data.vertices:
        f=(v.co.z-zbot)/h; s=1.0+(taper-1.0)*f; v.co.x*=s; v.co.y*=s
    o.data.update()
    if mat: o.data.materials.append(mat)
    return o
step =box("step",1.86,1.86,0.24,0.00,mat=pedMarble)
plin =box("plin",1.54,1.54,0.16,0.24,mat=pedMarble)
shaft=box("shaft",1.30,1.30,1.58,0.40,taper=0.88,mat=pedMarble)
cap  =box("cap",1.56,1.56,0.26,1.98,mat=pedMarble)
capTop=2.24
fig.location=(0,0,capTop-0.04)

# ── colonnade (linked duplicates) + architrave ───────────────
col=setlib.build_column(); col.data.materials.clear(); col.data.materials.append(colMarble)
for p in col.data.polygons: p.use_smooth=True
col.location=(999,999,0)   # hide the master out of frame
ROWS=[-3.75,3.75]; YS=[-3.4,0.9,5.2,9.5,13.8]
n=0
for x in ROWS:
    for y in YS:
        o=bpy.data.objects.new(f"col{n}", col.data); bpy.context.scene.collection.objects.link(o)
        o.location=(x,y,0); o.rotation_euler=(0,0,(n%3-1)*0.04); n+=1
# architrave beams
zA=(YS[0]+YS[-1])/2; dY=abs(YS[0]-YS[-1])+1.4
for x in ROWS:
    box("arch",1.0,dY,0.72,4.80,mat=colMarble).location=(x,zA,0)

# ── fragments ────────────────────────────────────────────────
def frag(geo,x,y,rx,ry,rz,sc=1.0):
    o=bpy.data.objects.new("frag",geo); bpy.context.scene.collection.objects.link(o)
    o.location=(x,y,0); o.rotation_euler=(rx,ry,rz); o.scale=(sc,sc,sc)
    o.data.materials.clear(); o.data.materials.append(fragStone)
    for p in o.data.polygons: p.use_smooth=True
drum=setlib.build_drum(); drum.location=(999,999,0)
capf=setlib.build_fallen_capital(); capf.location=(999,999,0)
frag(drum.data,-2.3,-3.1,math.pi/2,0.4,0,1.0)
frag(drum.data, 3.0, 2.2,math.pi/2,-0.7,0.1,0.92)
frag(drum.data,-3.4, 6.6,math.pi/2,1.2,0,0.85)
frag(capf.data, 2.35,-3.7,0,0.6,0,0.95)

# ── altar + flame ────────────────────────────────────────────
alt=setlib.build_altar(); alt.data.materials.clear(); alt.data.materials.append(pedMarble)
for p in alt.data.polygons: p.use_smooth=True
alt.location=(-1.75,-2.5,0)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.09, location=(-1.75,-2.5,1.02))
fl=bpy.context.active_object; fl.name="flame"; fl.data.materials.append(flameMat)
for p in fl.data.polygons: p.use_smooth=True

# ── floor ────────────────────────────────────────────────────
bpy.ops.mesh.primitive_plane_add(size=120, location=(0,0,0))
gp=bpy.context.active_object; gp.data.materials.append(floorMat)

# ── lighting: a warm shaft-key on the hero, a cool rake, a cool fill ─
# the shaft: a bright warm spot from high front, aimed at the figure —
# the volumetric haze turns it into a visible god-ray
spot=bpy.data.lights.new("key","SPOT"); spot.energy=7200; spot.spot_size=math.radians(46)
spot.spot_blend=0.55; spot.color=(1.0,0.88,0.68); spot.shadow_soft_size=0.6
sk=bpy.data.objects.new("key",spot); bpy.context.scene.collection.objects.link(sk)
sk.location=W(-0.6, 11.5, 1.2)
skt=bpy.data.objects.new("kt",None); bpy.context.scene.collection.objects.link(skt); skt.location=W(0,3.2,0.1)
c1=sk.constraints.new('TRACK_TO'); c1.target=skt; c1.track_axis='TRACK_NEGATIVE_Z'; c1.up_axis='UP_Y'

# a warm sun raking the colonnade from the same side (crisp shafts through gaps)
sun=bpy.data.lights.new("sun","SUN"); sun.energy=1.6; sun.angle=math.radians(2.0); sun.color=(1.0,0.9,0.74)
so=bpy.data.objects.new("sun",sun); bpy.context.scene.collection.objects.link(so)
so.rotation_euler=(math.radians(60), math.radians(8), math.radians(-40))
# cool fill so the shadow side keeps marble form
fill=bpy.data.lights.new("fill","AREA"); fill.energy=48; fill.size=10; fill.color=(0.5,0.62,0.85)
fo=bpy.data.objects.new("fill",fill); bpy.context.scene.collection.objects.link(fo)
fo.location=W(5,4,-9); fo.rotation_euler=(math.radians(62),0,math.radians(28))

# world: dim cool sky + volumetric haze so the shaft/sun read as light
w=bpy.data.worlds.new("W"); bpy.context.scene.world=w; w.use_nodes=True
nt=w.node_tree; nt.nodes.clear()
bg=nt.nodes.new("ShaderNodeBackground"); bg.inputs['Color'].default_value=(0.03,0.045,0.07,1); bg.inputs['Strength'].default_value=0.28
vol=nt.nodes.new("ShaderNodeVolumeScatter"); vol.inputs['Density'].default_value=0.020; vol.inputs['Anisotropy'].default_value=0.4
out=nt.nodes.new("ShaderNodeOutputWorld")
nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
nt.links.new(vol.outputs['Volume'], out.inputs['Volume'])

# the flame casts its own warm pool
flpt=bpy.data.lights.new("flpt","POINT"); flpt.energy=140; flpt.color=(1.0,0.6,0.28); flpt.shadow_soft_size=0.15
flo=bpy.data.objects.new("flpt",flpt); bpy.context.scene.collection.objects.link(flo)
flo.location=(-1.75,-2.5,1.05)

# cheap depth fog via the mist pass (no volume-bounce cost): distant
# columns dissolve into the dark, restoring atmosphere when the
# volumetric haze is disabled for fast sequence rendering
def setup_mist(fog=(0.020,0.028,0.045), start=2.0, depth=30.0):
    vl=bpy.context.view_layer; vl.use_pass_mist=True
    try:
        ms=bpy.context.scene.world.mist_settings
        ms.start=start; ms.depth=depth; ms.falloff='QUADRATIC'
    except Exception: pass
    sc=bpy.context.scene; sc.use_nodes=True
    tree=sc.node_tree; tree.nodes.clear()
    rl=tree.nodes.new('CompositorNodeRLayers')
    mix=tree.nodes.new('CompositorNodeMixRGB'); mix.blend_type='MIX'
    mix.inputs[2].default_value=(*fog,1)
    comp=tree.nodes.new('CompositorNodeComposite')
    tree.links.new(rl.outputs['Image'], mix.inputs[1])
    if 'Mist' in rl.outputs: tree.links.new(rl.outputs['Mist'], mix.inputs[0])
    tree.links.new(mix.outputs['Image'], comp.inputs['Image'])
setup_mist(fog=(0.010,0.013,0.022), start=1.5, depth=24.0)

# shared render config helper (used by both this file and render_seq.py)
def configure(preview=False):
    sc=bpy.context.scene
    sc.render.engine='CYCLES'; sc.cycles.device='CPU'
    sc.cycles.samples = 64 if preview else 180
    sc.cycles.use_denoising=True
    sc.cycles.volume_bounces=2; sc.cycles.transparent_max_bounces=8
    if preview: sc.render.resolution_x=1120; sc.render.resolution_y=720
    else:       sc.render.resolution_x=1400; sc.render.resolution_y=900
    try:
        sc.view_settings.view_transform='AgX'
        sc.view_settings.look='AgX - Medium High Contrast'
    except Exception:
        sc.view_settings.view_transform='Filmic'
    sc.view_settings.exposure=0.35
    return sc

if __name__ == "__main__":
    cam_d=bpy.data.cameras.new("c"); cam_d.lens=42; cam_d.clip_start=0.05; cam_d.clip_end=200
    cam=bpy.data.objects.new("c",cam_d); bpy.context.scene.collection.objects.link(cam)
    cam.location=W(1.55,2.35,7.7)
    tgt=bpy.data.objects.new("t",None); bpy.context.scene.collection.objects.link(tgt); tgt.location=W(0,3.0,0.1)
    con=cam.constraints.new('TRACK_TO'); con.target=tgt; con.track_axis='TRACK_NEGATIVE_Z'; con.up_axis='UP_Y'
    bpy.context.scene.camera=cam
    sc=configure("--preview" in sys.argv)
    sc.render.filepath="/tmp/cyc_hero.png"
    bpy.ops.render.render(write_still=True)
    print("CYC HERO DONE")
