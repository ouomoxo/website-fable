import sys; import os as _o; sys.path.insert(0,_o.path.dirname(__file__))
import blender_lib as B, bpy, bmesh, math
from mathutils import Vector, Matrix

def new_mesh(name):
    me=bpy.data.meshes.new(name); ob=bpy.data.objects.new(name,me)
    bpy.context.scene.collection.objects.link(ob); return ob, me

def ring(bm, z, R, flutes, depth):
    verts=[]; spf=5; N=flutes*spf
    for i in range(N):
        a=2*math.pi*i/N
        fp=(i % spf)/spf
        s=math.sin(math.pi*fp)          # concave scallop, 0 at arris
        r=R - depth*s
        verts.append(bm.verts.new((r*math.cos(a), r*math.sin(a), z)))
    return verts

def bridge(bm, ra, rb):
    n=len(ra)
    for i in range(n):
        j=(i+1)%n
        bm.faces.new((ra[i], ra[j], rb[j], rb[i]))

def build_column():
    ob,me=new_mesh("column"); bm=bmesh.new()
    flutes=20; depth=0.028
    # base: square plinth + rounded torus
    def slab(cx,cy,z0,z1,hw):
        vs=[bm.verts.new((cx-hw,cy-hw,z0)),bm.verts.new((cx+hw,cy-hw,z0)),
            bm.verts.new((cx+hw,cy+hw,z0)),bm.verts.new((cx-hw,cy+hw,z0)),
            bm.verts.new((cx-hw,cy-hw,z1)),bm.verts.new((cx+hw,cy-hw,z1)),
            bm.verts.new((cx+hw,cy+hw,z1)),bm.verts.new((cx-hw,cy+hw,z1))]
        f=[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]
        for a,b,c,d in f: bm.faces.new((vs[a],vs[b],vs[c],vs[d]))
    slab(0,0,0.0,0.16,0.50)             # plinth
    # torus ring (flared collar) from plinth to shaft
    prev=None
    for k in range(9):
        t=k/8; z=0.20+t*0.16
        R=0.58-0.14*t
        rr=[bm.verts.new((R*math.cos(2*math.pi*i/40), R*math.sin(2*math.pi*i/40), z)) for i in range(40)]
        if prev: bridge(bm, prev, rr)
        prev=rr
    # fluted shaft with entasis
    z0=0.36; H=4.0; rings=[]
    steps=26
    for k in range(steps+1):
        t=k/steps
        # entasis: slight bulge ~1/3 up then taper
        R=0.44*(1.0 - 0.16*t + 0.03*math.sin(math.pi*t))
        rings.append(ring(bm, z0+t*H, R, flutes, depth*(1-0.3*t)))
    # connect torus(40) to first flute ring by a short collar (skip precise match; cap)
    for k in range(steps):
        bridge(bm, rings[k], rings[k+1])
    # echinus (Doric cushion): flare from shaft top R to abacus
    ztop=z0+H; Rt=0.44*(1.0-0.16+0.03*math.sin(math.pi))
    prev=None; ech=[]
    for k in range(7):
        t=k/6; z=ztop+t*0.26
        R=Rt + (0.66-Rt)*(t**0.7)
        rr=[bm.verts.new((R*math.cos(2*math.pi*i/40), R*math.sin(2*math.pi*i/40), z)) for i in range(40)]
        if prev: bridge(bm, prev, rr)
        prev=rr
    # abacus square slab
    slab(0,0,ztop+0.26,ztop+0.44,0.60)
    bm.normal_update(); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth=True
    # sharpen the slabs by marking? leave smooth; ok
    return ob

def build_fallen_capital():
    ob,me=new_mesh("capital_fallen"); bm=bmesh.new()
    # a Doric capital lying on its side (axis along Y): echinus cushion
    # closed at the neck, an abacus slab on the wide end
    seg=32; prev=None
    neck=[bm.verts.new((0.30*math.cos(2*math.pi*i/seg), 0.0, 0.30*math.sin(2*math.pi*i/seg))) for i in range(seg)]
    c0=bm.verts.new((0,0,0));
    for i in range(seg): bm.faces.new((neck[i], neck[(i+1)%seg], c0))   # neck cap
    prev=neck
    for k in range(1,7):
        t=k/6; y=t*0.30
        R=0.30 + (0.62-0.30)*(t**0.7)
        rr=[bm.verts.new((R*math.cos(2*math.pi*i/seg), y, R*math.sin(2*math.pi*i/seg))) for i in range(seg)]
        bridge(bm, prev, rr); prev=rr
    # abacus slab on the wide end
    hw=0.60; y0=0.30; y1=0.46
    vs=[bm.verts.new((-hw,y0,-hw)),bm.verts.new((hw,y0,-hw)),bm.verts.new((hw,y0,hw)),bm.verts.new((-hw,y0,hw)),
        bm.verts.new((-hw,y1,-hw)),bm.verts.new((hw,y1,-hw)),bm.verts.new((hw,y1,hw)),bm.verts.new((-hw,y1,hw))]
    for a,b,c,d in [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]:
        bm.faces.new((vs[a],vs[b],vs[c],vs[d]))
    bm.normal_update(); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth=True
    return ob

def build_drum():
    ob,me=new_mesh("drum"); bm=bmesh.new()
    # a broken fluted column drum lying on its side (axis along Y)
    flutes=20; depth=0.026; prev=None
    for k in range(9):
        t=k/8; y=t*0.9
        R=0.42
        rr=[]
        spf=5; N=flutes*spf
        for i in range(N):
            a=2*math.pi*i/N; fp=(i%spf)/spf; s=math.sin(math.pi*fp); r=R-depth*s
            rr.append(bm.verts.new((r*math.cos(a), y, r*math.sin(a))))
        if prev: bridge(bm, prev, rr)
        prev=rr
    bm.normal_update(); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth=True
    return ob

def build_altar():
    ob,me=new_mesh("altar"); bm=bmesh.new()
    def cyl(z0,z1,R0,R1,seg=36):
        prev=None
        for k in range(2):
            z=z0 if k==0 else z1; R=R0 if k==0 else R1
            rr=[bm.verts.new((R*math.cos(2*math.pi*i/seg), R*math.sin(2*math.pi*i/seg), z)) for i in range(seg)]
            if prev: bridge(bm,prev,rr)
            prev=rr
        return prev
    cyl(0.0,0.10,0.55,0.55)     # base pad
    cyl(0.10,0.72,0.34,0.30)    # column body
    cyl(0.72,0.86,0.34,0.52)    # flared bowl rim
    bm.normal_update(); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth=True
    return ob

