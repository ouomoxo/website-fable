import bpy, math, mathutils
from mathutils import Vector, Matrix

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def load_one_mesh(path):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new=[o for o in bpy.data.objects if o not in before]
    meshes=[o for o in new if o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in new: o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    for o in list(new):
        if o.type!='MESH': bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    if len(meshes)>1: bpy.ops.object.join()
    obj=bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    return obj

def mesh_bounds(obj):
    mn=Vector((1e18,)*3); mx=Vector((-1e18,)*3)
    for v in obj.data.vertices:
        for i in range(3): mn[i]=min(mn[i],v.co[i]); mx[i]=max(mx[i],v.co[i])
    return mn,mx

def transform_mesh(obj, M):
    obj.data.transform(M); obj.data.update()

def stand_and_ground(obj):
    # find longest axis; rotate it to +Z
    mn,mx=mesh_bounds(obj); size=mx-mn
    la=max(range(3), key=lambda i:size[i])
    if la==0: transform_mesh(obj, Matrix.Rotation(math.radians(-90),4,'Y'))
    elif la==1: transform_mesh(obj, Matrix.Rotation(math.radians(-90),4,'X'))
    mn,mx=mesh_bounds(obj)
    # ensure "up" is correct is caller's job; ground + center xy
    c=(mn+mx)*0.5
    transform_mesh(obj, Matrix.Translation((-c.x,-c.y,-mn.z)))
    mn,mx=mesh_bounds(obj)
    return mn,mx

def set_world_hdri(path, strength=1.0, rot=0.0):
    w=bpy.data.worlds.new("W"); bpy.context.scene.world=w; w.use_nodes=True
    nt=w.node_tree; nt.nodes.clear()
    tc=nt.nodes.new("ShaderNodeTexCoord"); mp=nt.nodes.new("ShaderNodeMapping")
    mp.inputs['Rotation'].default_value[2]=rot
    tex=nt.nodes.new("ShaderNodeTexEnvironment"); tex.image=bpy.data.images.load(path)
    bg=nt.nodes.new("ShaderNodeBackground"); bg.inputs['Strength'].default_value=strength
    out=nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], tex.inputs['Vector'])
    nt.links.new(tex.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])

def marble(obj, base=(0.83,0.81,0.76)):
    m=bpy.data.materials.new("Marble"); m.use_nodes=True
    b=m.node_tree.nodes.get("Principled BSDF")
    b.inputs['Base Color'].default_value=(*base,1); b.inputs['Roughness'].default_value=0.38
    try:
        b.inputs['Subsurface Weight'].default_value=0.05
        b.inputs['Subsurface Radius'].default_value=(4,4,4)
    except Exception: pass
    obj.data.materials.clear(); obj.data.materials.append(m)
    for p in obj.data.polygons: p.use_smooth=True

def render(path,W=1000,H=1250,samples=96,exposure=0.0):
    sc=bpy.context.scene
    sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=samples
    sc.cycles.use_denoising=True
    sc.render.resolution_x=W; sc.render.resolution_y=H
    sc.view_settings.view_transform='Filmic'; sc.view_settings.exposure=exposure
    sc.render.filepath=path
    bpy.ops.render.render(write_still=True)

def normalize_height(obj, target=2.0):
    mn,mx=mesh_bounds(obj); h=(mx-mn).z
    s=target/h
    transform_mesh(obj, Matrix.Scale(s,4))
    mn,mx=mesh_bounds(obj)
    c=(mn+mx)*0.5
    transform_mesh(obj, Matrix.Translation((-c.x,-c.y,-mn.z)))
    return mesh_bounds(obj)

def bend_forward(obj, z0, z1, angle_deg, pivot_y=0.0, toward=1.0):
    """Rotate vertices with z in [z0,z1+] forward about a pivot line
    (y=pivot_y, z=z0) around X. Bend ramps 0..1 across [z0,z1] then holds.
    toward=+1 folds toward +Y, -1 toward -Y."""
    import math
    a_max=math.radians(angle_deg)*toward
    for v in obj.data.vertices:
        z=v.co.z
        if z<=z0: continue
        t=min(1.0,(z-z0)/max(1e-6,(z1-z0))); t=t*t*(3-2*t)
        a=a_max*t
        y=v.co.y-pivot_y; zz=v.co.z-z0
        ca,sa=math.cos(a),math.sin(a)
        v.co.y=pivot_y+(y*ca-zz*sa)
        v.co.z=z0+(y*sa+zz*ca)
    obj.data.update()

def ground_center(obj):
    mn,mx=mesh_bounds(obj); c=(mn+mx)*0.5
    transform_mesh(obj, Matrix.Translation((-c.x,-c.y,-mn.z)))
    return mesh_bounds(obj)

def three_quarter_cam(Hh, az_deg=35, el=0.30, dist_k=2.1, lens=58, aim_z=0.5):
    import math
    tgt=bpy.data.objects.new("t",None); bpy.context.scene.collection.objects.link(tgt)
    tgt.location=(0,0,Hh*aim_z)
    cam_d=bpy.data.cameras.new("c"); cam_d.lens=lens; cam_d.clip_start=0.01; cam_d.clip_end=1000
    cam=bpy.data.objects.new("c",cam_d); bpy.context.scene.collection.objects.link(cam)
    az=math.radians(az_deg); dist=Hh*dist_k
    cam.location=(math.sin(az)*dist, -math.cos(az)*dist, Hh*(aim_z+el))
    con=cam.constraints.new('TRACK_TO'); con.target=tgt; con.track_axis='TRACK_NEGATIVE_Z'; con.up_axis='UP_Y'
    bpy.context.scene.camera=cam
    return cam
