import sys; import os as _o; sys.path.insert(0,_o.path.dirname(__file__))
import blender_lib as B, setlib, bpy, bmesh, math
from mathutils import Vector, Matrix

# coordinate map from the web scene (X, up=Y, depthZ) to Blender (X, Y=depth, Z=up):
#   blender_x = web_x ; blender_y = -web_z ; blender_z = web_y
def W(x, y, z):  # web (x, up, depthTowardCamera+) -> blender vector
    return Vector((x, -z, y))

# ── procedural marble ────────────────────────────────────────
# A flat base colour reads as cardboard once baked. Real stone needs
# three things: veining (wandering darker streaks), a broad warm/cool
# tone drift across the block, and a faint micro-relief so raking light
# grazes it. All of this bakes into the COMBINED lightmap for free.
def marble_proc(name, light, dark, rough=0.42, sss=0.06,
                vscale=1.9, dist=13.0, tone_warm=(0.05,0.02,-0.03),
                bump=0.05, ssr=(0.9,0.6,0.45)):
    m=bpy.data.materials.new(name); m.use_nodes=True
    nt=m.node_tree; N=nt.nodes; K=nt.links
    b=N.get("Principled BSDF")
    tc=N.new("ShaderNodeTexCoord")
    mp=N.new("ShaderNodeMapping"); mp.inputs['Scale'].default_value=(vscale,vscale,vscale)
    K.new(tc.outputs['Object'], mp.inputs['Vector'])

    # wandering vein bands
    wv=N.new("ShaderNodeTexWave"); wv.wave_type='BANDS'; wv.bands_direction='DIAGONAL'
    wv.wave_profile='SIN'
    wv.inputs['Scale'].default_value=1.0
    wv.inputs['Distortion'].default_value=dist
    wv.inputs['Detail'].default_value=3.0
    wv.inputs['Detail Scale'].default_value=1.5
    K.new(mp.outputs['Vector'], wv.inputs['Vector'])
    # thin dark vein only where the band crests
    cr=N.new("ShaderNodeValToRGB"); ramp=cr.color_ramp
    ramp.elements[0].position=0.32; ramp.elements[0].color=(*light,1)
    ramp.elements[1].position=0.50; ramp.elements[1].color=(*dark,1)
    e=ramp.elements.new(0.66); e.color=(*light,1)
    K.new(wv.outputs['Fac'], cr.inputs['Fac'])

    # broad warm/cool tone drift over the block
    nz=N.new("ShaderNodeTexNoise"); nz.inputs['Scale'].default_value=0.7
    nz.inputs['Detail'].default_value=2.0
    K.new(mp.outputs['Vector'], nz.inputs['Vector'])
    warm=(min(1,light[0]+tone_warm[0]), min(1,light[1]+tone_warm[1]), max(0,light[2]+tone_warm[2]))
    tm=N.new("ShaderNodeMixRGB"); tm.blend_type='MIX'
    dmul=N.new("ShaderNodeMath"); dmul.operation='MULTIPLY'; dmul.inputs[1].default_value=0.35
    K.new(nz.outputs['Fac'], dmul.inputs[0]); K.new(dmul.outputs['Value'], tm.inputs['Fac'])
    K.new(cr.outputs['Color'], tm.inputs['Color1']); tm.inputs['Color2'].default_value=(*warm,1)
    K.new(tm.outputs['Color'], b.inputs['Base Color'])

    # micro-relief so raking light catches the surface
    fn=N.new("ShaderNodeTexNoise"); fn.inputs['Scale'].default_value=42.0; fn.inputs['Detail'].default_value=4.0
    K.new(mp.outputs['Vector'], fn.inputs['Vector'])
    bmp=N.new("ShaderNodeBump"); bmp.inputs['Strength'].default_value=bump; bmp.inputs['Distance'].default_value=0.004
    K.new(fn.outputs['Fac'], bmp.inputs['Height']); K.new(bmp.outputs['Normal'], b.inputs['Normal'])

    b.inputs['Roughness'].default_value=rough
    try:
        b.inputs['Subsurface Weight'].default_value=sss
        b.inputs['Subsurface Radius'].default_value=ssr
        b.inputs['Subsurface Scale'].default_value=0.12
    except Exception: pass
    return m

# flat fallback (floor only — it is drawn plain at runtime, never baked)
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

# bevel every hard edge into the mesh so it catches a highlight instead
# of reading as a razor-sharp CG crease (baked in — no runtime cost)
def bevel_mesh(o, width=0.012, segs=2, profile=0.55):
    bm=bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.bevel(bm, geom=bm.edges[:]+bm.verts[:], offset=width, segments=segs,
                    affect='EDGES', profile=profile, clamp_overlap=True)
    bm.to_mesh(o.data); bm.free()
    for p in o.data.polygons: p.use_smooth=True

def emit(name, color, strength):
    m=bpy.data.materials.new(name); m.use_nodes=True
    nt=m.node_tree; nt.nodes.clear()
    e=nt.nodes.new("ShaderNodeEmission"); e.inputs['Color'].default_value=(*color,1); e.inputs['Strength'].default_value=strength
    o=nt.nodes.new("ShaderNodeOutputMaterial"); nt.links.new(e.outputs['Emission'], o.inputs['Surface'])
    return m

B.reset()

# ── materials (procedural marble; restrained veins + tone drift) ─────
# the hero is clean luminous marble — only a whisper of veining, no bump
# (the scan already carries surface detail); the architecture is MATTE
# marble (high roughness, tiny bump) so it never reads as wet plastic.
# the hero is the detailed Stanford scan — it carries its own surface;
# procedural veining only mottles it, so keep it clean flat marble
figMarble = marble("figMarble",(0.85,0.83,0.78),0.36, sss=0.16, ssr=(1.1,0.7,0.5))
colMarble = marble_proc("colMarble",(0.80,0.78,0.73),(0.70,0.67,0.62), rough=0.60,
                        sss=0.03, vscale=1.7, dist=9.0, bump=0.02)
pedMarble = marble_proc("pedMarble",(0.50,0.47,0.42),(0.39,0.36,0.32), rough=0.58,
                        sss=0.03, vscale=2.1, dist=11.0, tone_warm=(0.05,0.02,-0.03), bump=0.03)
fragStone = marble_proc("fragStone",(0.49,0.46,0.41),(0.36,0.33,0.29), rough=0.78,
                        sss=0.02, vscale=2.6, dist=8.0, bump=0.05)
floorMat  = marble("floorMat",(0.24,0.23,0.21),0.42, sss=0.0)
flameMat  = emit("flameMat",(1.0,0.58,0.24),22.0)

# ── figure + pedestal ────────────────────────────────────────
fig=B.load_one_mesh(_o.environ.get('LUCY_PLAIN_GLB','lucy_plain.glb'))
B.stand_and_ground(fig); B.normalize_height(fig,2.0)
B.transform_mesh(fig, Matrix.Rotation(math.pi,4,'Z'))   # her front is +Y in the scan; turn it to -Y (the camera)
fig.data.materials.clear(); fig.data.materials.append(figMarble)
for p in fig.data.polygons: p.use_smooth=True

def box(name,w,d,h,zbot,taper=1.0,mat=None,bevel=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1); o=bpy.context.active_object; o.name=name
    for v in o.data.vertices:
        v.co.x*=w; v.co.y*=d; v.co.z=zbot+(v.co.z+0.5)*h
    for v in o.data.vertices:
        f=(v.co.z-zbot)/h; s=1.0+(taper-1.0)*f; v.co.x*=s; v.co.y*=s
    o.data.update()
    if mat: o.data.materials.append(mat)
    if bevel: bevel_mesh(o, width=bevel)
    return o
# a proper pedestal: plinth → flaring base course → tapered die →
# projecting cornice → top slab. Each course beveled to catch the key.
step =box("ped_plinth", 1.92,1.92,0.22,0.00,          mat=pedMarble, bevel=0.016)
base2=box("ped_base",   1.66,1.66,0.14,0.22,taper=0.92,mat=pedMarble, bevel=0.018)
shaft=box("ped_die",    1.34,1.34,1.42,0.36,taper=0.90,mat=pedMarble, bevel=0.012)
neck =box("ped_neck",   1.42,1.42,0.10,1.78,taper=1.12,mat=pedMarble, bevel=0.016)
cap  =box("ped_cornice",1.70,1.70,0.20,1.88,          mat=pedMarble, bevel=0.020)
ptop =box("ped_top",    1.48,1.48,0.14,2.08,taper=0.94,mat=pedMarble, bevel=0.014)
capTop=2.22
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
fill=bpy.data.lights.new("fill","AREA"); fill.energy=44; fill.size=10; fill.color=(0.5,0.62,0.85)
fo=bpy.data.objects.new("fill",fill); bpy.context.scene.collection.objects.link(fo)
fo.location=W(5,4,-9); fo.rotation_euler=(math.radians(62),0,math.radians(28))
# a tight warm rim from high behind, so the hero's silhouette separates
# from the dark and the wing edges glow — the classic monument read
rim=bpy.data.lights.new("rim","AREA"); rim.energy=150; rim.size=2.2; rim.color=(1.0,0.9,0.74)
ro=bpy.data.objects.new("rim",rim); bpy.context.scene.collection.objects.link(ro)
ro.location=W(1.4,5.2,-4.2)
rt=bpy.data.objects.new("rimt",None); bpy.context.scene.collection.objects.link(rt); rt.location=W(0.2,3.4,0.0)
cr=ro.constraints.new('TRACK_TO'); cr.target=rt; cr.track_axis='TRACK_NEGATIVE_Z'; cr.up_axis='UP_Y'

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
