"""
BullzEye hero — FULL 6-BEAT NARRATIVE as 6 photoreal stills, one hero frame per beat.
Blender 5.2.2 LTS, Cycles GPU (Metal). Fully headless build + render.

Run (all 6 beats, full quality):
    /Applications/Blender.app/Contents/MacOS/Blender -b -P build_beats.py

Render a subset / test quality (args after `--`):
    Blender -b -P build_beats.py -- 1 6            # only beats 1 and 6
    Blender -b -P build_beats.py -- --samples 96   # faster preview, all beats
    Blender -b -P build_beats.py -- --test 6       # 1280x720 @ 96 spp, beat 6

Output: blender/renders/beat_1.png ... beat_6.png

Scene is built ONCE (one world, one sun, one turf) and shot from 6 cinematic cameras
so all beats read as one continuous golden-hour environment seen from 6 angles.

CAMERA RIG (see CAMERAS list below) — each beat is a dict:
    name, loc (xyz), target (look-at xyz), lens (mm), fstop, focus (optional xyz)
The NEXT step after client approval is to interpolate between these 6 cameras and
render a 150-240 frame scroll-scrub sequence. make_animated_camera() already does that
(keyframes one camera through all 6 beats) — set env RENDER_SEQUENCE=1 to use it.

Turf technique: Geometry Nodes — Distribute Points on Faces (distance-based density
falloff so the near-hole turf is dense for macro shots and thins out for the wide
reveal, keeping blade count GPU-friendly) -> Instance a procedural bent blade ->
Realize. A denser "collar" scatter rings the hole lip so the ball nestles in grass.
"""
import bpy, bmesh, math, os, sys, time, random
import mathutils

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else \
    "/Users/merlin/Developer/ClaudeCode/bullzeye-hero-webgl/blender"
RENDER_DIR = os.path.join(HERE, "renders")
os.makedirs(RENDER_DIR, exist_ok=True)
HDRI = "/Users/merlin/Developer/ClaudeCode/bullzeye-hero-webgl/public/hdri/kloppenheim_06_2k.hdr"

# ---- tunables -------------------------------------------------------------
BALL_R      = 0.02135          # 42.7mm diameter tour ball
CUP_R       = 0.054            # 108mm hole
BLADE_H     = 0.0038           # ~3.8mm mowed blade
SCATTER_R   = 1.8              # turf extends this far (big green for wide reveal)
DENSITY     = 200000           # peak blades per m^2 near the hole
FULL_R      = 0.5              # full density inside this radius, taper beyond
FAR_FACTOR  = 0.06             # density factor at SCATTER_R (thin, distant turf)
GREEN_SIZE  = 8.0              # green plane span (m) so its edge is far off-frame
SAMPLES     = 256
RES_X, RES_Y = 1920, 1080

# ===========================================================================
# ground contour — factored so we can sit the ball exactly ON the surface
# ===========================================================================
def green_z(x, y):
    return (0.012 * math.sin(x * 1.3 + 0.6) * math.cos(y * 1.1)
            + 0.006 * math.sin(x * 3.1 + y * 2.2)
            + 0.028 * (x + 1.5) * 0.18)          # subtle slope rising toward +x

# ===========================================================================
# housekeeping
# ===========================================================================
def wipe():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def link(nt, a_out, b_in):
    nt.links.new(a_out, b_in)

def set_principled(bsdf, **kw):
    for k, v in kw.items():
        if k in bsdf.inputs:
            try:
                bsdf.inputs[k].default_value = v
            except Exception as e:
                print("  principled set skip", k, e)

# ===========================================================================
# GPU
# ===========================================================================
def setup_gpu():
    prefs = bpy.context.preferences.addons['cycles'].preferences
    used = "CPU"
    try:
        prefs.compute_device_type = 'METAL'
        prefs.refresh_devices()
        gpu_found = False
        for d in prefs.devices:
            if d.type == 'METAL':
                d.use = True
                gpu_found = True
                used = d.name
            else:
                d.use = False
        bpy.context.scene.cycles.device = 'GPU' if gpu_found else 'CPU'
        if not gpu_found:
            used = "CPU (no METAL device)"
    except Exception as e:
        print("GPU init failed, CPU fallback:", e)
        bpy.context.scene.cycles.device = 'CPU'
        used = "CPU (exception)"
    return used

# ===========================================================================
# ground green (contoured, large) + hole
# ===========================================================================
def build_green():
    subdiv = int(GREEN_SIZE / 0.03)   # ~3cm spacing
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=subdiv, y_subdivisions=subdiv,
                                     size=GREEN_SIZE, location=(0, 0, 0))
    green = bpy.context.active_object
    green.name = "Green"
    me = green.data
    for v in me.vertices:
        v.co.z = green_z(v.co.x, v.co.y)
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    return green

def cut_hole(green):
    bpy.ops.mesh.primitive_cylinder_add(radius=CUP_R, depth=0.30, vertices=96,
                                        location=(0, 0, -0.14))
    cutter = bpy.context.active_object
    cutter.name = "HoleCutter"
    m = green.modifiers.new("cut", 'BOOLEAN')
    m.operation = 'DIFFERENCE'
    m.solver = 'EXACT'
    m.object = cutter
    bpy.context.view_layer.objects.active = green
    bpy.ops.object.modifier_apply(modifier="cut")
    bpy.data.objects.remove(cutter, do_unlink=True)

# ===========================================================================
# cup interior, liner, flagstick, flag
# ===========================================================================
def build_cup():
    # dark interior wall — lines the hole from the grass lip DOWN (no see-through gap,
    # so the hole never reads as a floating tube from elevated/low angles). Deep, matte.
    lip_z = green_z(0, 0)                 # grass surface height at the hole
    top_z = lip_z + 0.004                 # wall top just at the lip
    bot_z = -0.165
    depth = top_z - bot_z
    bpy.ops.mesh.primitive_cylinder_add(radius=CUP_R - 0.001, depth=depth, vertices=96,
                                         location=(0, 0, (top_z + bot_z) / 2))
    wall = bpy.context.active_object
    wall.name = "CupWall"
    for p in wall.data.polygons:
        p.use_smooth = True
    bpy.ops.mesh.primitive_circle_add(radius=CUP_R - 0.001, vertices=96, fill_type='NGON',
                                      location=(0, 0, bot_z + 0.002))
    bottom = bpy.context.active_object
    bottom.name = "CupBottom"
    # metal liner rim — RECESSED deeper & smaller so turf overhangs it (no bright ring)
    bpy.ops.mesh.primitive_torus_add(major_radius=CUP_R - 0.009, minor_radius=0.0032,
                                     location=(0, 0, -0.022),
                                     major_segments=96, minor_segments=12)
    rim = bpy.context.active_object
    rim.name = "CupRim"
    for p in rim.data.polygons:
        p.use_smooth = True
    return wall, bottom, rim

def build_flag():
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0055, depth=1.05, vertices=24,
                                         location=(0, 0, 0.36))
    pin = bpy.context.active_object
    pin.name = "FlagStick"
    for p in pin.data.polygons:
        p.use_smooth = True
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=24, y_subdivisions=16,
                                    size=0.14, location=(0.085, 0, 0.80))
    flag = bpy.context.active_object
    flag.name = "Flag"
    flag.rotation_euler = (math.radians(90), 0, 0)
    me = flag.data
    for v in me.vertices:
        v.co.z += 0.012 * math.sin(v.co.x * 45) * (0.5 + (v.co.x + 0.07) * 2)
    for p in me.polygons:
        p.use_smooth = True
    return pin, flag

# ===========================================================================
# golf ball with real dimples — sits ON the turf at the near lip
# ===========================================================================
def build_ball():
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=BALL_R,
                                         location=(0, 0, 0))
    ball = bpy.context.active_object
    ball.name = "GolfBall"
    for p in ball.data.polygons:
        p.use_smooth = True
    sub = ball.modifiers.new("subsurf", 'SUBSURF')
    sub.levels = 3
    sub.render_levels = 4
    # rest on the turf shoulder just outside the near lip; a touch overhangs the hole
    bx = -(CUP_R + BALL_R * 0.32)
    by = 0.0
    sink = 0.0035   # nestle a few mm into the grass layer (blades fringe over it)
    bz = green_z(bx, by) + BALL_R - sink
    ball.location = (bx, by, bz)
    return ball

# ===========================================================================
# materials
# ===========================================================================
def mat_green_base():
    # Sunlit mown-turf base: bright enough that the bare plane reads as continuous
    # green out to the horizon (beyond the scattered blades), with only subtle
    # mow-stripe / mottle variation — NOT the dark noisy surface that read as rocks.
    m = bpy.data.materials.new("GreenBase"); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 14.0
    noise.inputs["Detail"].default_value = 2.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    # healthy sunlit bent-grass green, mid value so distant turf is clearly green
    ramp.color_ramp.elements[0].color = (0.085, 0.175, 0.055, 1)
    ramp.color_ramp.elements[1].color = (0.15, 0.27, 0.085, 1)
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    link(nt, tc.outputs["Object"], noise.inputs["Vector"])
    link(nt, noise.outputs["Fac"], ramp.inputs["Fac"])
    link(nt, ramp.outputs["Color"], bsdf.inputs["Base Color"])
    link(nt, noise.outputs["Fac"], bump.inputs["Height"])
    link(nt, bump.outputs["Normal"], bsdf.inputs["Normal"])
    set_principled(bsdf, **{"Roughness": 0.78})
    link(nt, bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m

def mat_blade():
    m = bpy.data.materials.new("Blade"); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    pr = nt.nodes.new("ShaderNodeBsdfPrincipled")
    trans = nt.nodes.new("ShaderNodeBsdfTranslucent")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 8.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.035, 0.11, 0.022, 1)
    ramp.color_ramp.elements[1].color = (0.13, 0.22, 0.045, 1)
    link(nt, tc.outputs["Generated"], noise.inputs["Vector"])
    link(nt, noise.outputs["Fac"], ramp.inputs["Fac"])
    link(nt, ramp.outputs["Color"], pr.inputs["Base Color"])
    link(nt, ramp.outputs["Color"], trans.inputs["Color"])
    set_principled(pr, **{"Roughness": 0.62})
    link(nt, pr.outputs["BSDF"], mix.inputs[1])
    link(nt, trans.outputs["BSDF"], mix.inputs[2])
    mix.inputs[0].default_value = 0.32
    link(nt, mix.outputs["Shader"], out.inputs["Surface"])
    return m

def mat_ball():
    m = bpy.data.materials.new("BallCover"); m.use_nodes = True
    m.displacement_method = 'BOTH'
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    set_principled(bsdf, **{
        "Base Color": (0.92, 0.92, 0.90, 1),
        "Roughness": 0.33,
        "Coat Weight": 0.28,
        "Coat Roughness": 0.1,
        "Specular IOR Level": 0.5,
    })
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.feature = 'F1'; vor.distance = 'EUCLIDEAN'
    vor.inputs["Scale"].default_value = 19.0
    if "Randomness" in vor.inputs:
        vor.inputs["Randomness"].default_value = 0.4
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = 'EASE'
    e = ramp.color_ramp.elements
    e[0].position = 0.0;  e[0].color = (0, 0, 0, 1)
    e[1].position = 0.5;  e[1].color = (1, 1, 1, 1)
    disp = nt.nodes.new("ShaderNodeDisplacement")
    disp.inputs["Scale"].default_value = 0.0016
    disp.inputs["Midlevel"].default_value = 0.85
    link(nt, tc.outputs["Generated"], vor.inputs["Vector"])
    link(nt, vor.outputs["Distance"], ramp.inputs["Fac"])
    link(nt, ramp.outputs["Color"], disp.inputs["Height"])
    link(nt, disp.outputs["Displacement"], out.inputs["Displacement"])
    link(nt, bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m

def mat_simple(name, color, rough, metal=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    set_principled(bsdf, **{"Base Color": color, "Roughness": rough, "Metallic": metal,
                            "Coat Weight": coat})
    return m

# ===========================================================================
# blade mesh (a single bent, tapered blade) used as GN instance
# ===========================================================================
def build_blade_source():
    w = 0.00055; h = BLADE_H; bend = 0.0014
    verts = [(-w, 0, 0), (w, 0, 0),
             (-w * 0.55, bend, h * 0.55), (w * 0.55, bend, h * 0.55),
             (0.0, bend * 2.1, h)]
    faces = [(0, 1, 3, 2), (2, 3, 4)]
    me = bpy.data.meshes.new("BladeMesh")
    me.from_pydata(verts, [], faces); me.update()
    for p in me.polygons:
        p.use_smooth = True
    blade = bpy.data.objects.new("BladeSource", me)
    bpy.context.collection.objects.link(blade)
    blade.hide_render = True; blade.hide_viewport = True
    return blade

# ===========================================================================
# geometry-nodes turf  (distance-based density falloff)
# ===========================================================================
def build_turf_group(blade_src, blade_mat, name,
                     density, dist_min, scale_min, scale_max,
                     full_r, far_r, far_factor, seed):
    ng = bpy.data.node_groups.new(name, "GeometryNodeTree")
    iface = ng.interface
    iface.new_socket("Geometry", in_out='INPUT', socket_type='NodeSocketGeometry')
    iface.new_socket("Geometry", in_out='OUTPUT', socket_type='NodeSocketGeometry')
    nodes = ng.nodes
    gin = nodes.new("NodeGroupInput")
    gout = nodes.new("NodeGroupOutput")

    dist = nodes.new("GeometryNodeDistributePointsOnFaces")
    dist.distribute_method = 'POISSON'
    dist.inputs["Density Max"].default_value = density
    dist.inputs["Distance Min"].default_value = dist_min
    dist.inputs["Seed"].default_value = seed

    # radial distance from hole center
    pos = nodes.new("GeometryNodeInputPosition")
    length = nodes.new("ShaderNodeVectorMath"); length.operation = 'LENGTH'
    link(ng, pos.outputs["Position"], length.inputs[0])

    # density falloff: 1.0 inside full_r -> far_factor at far_r (clamped)
    mr = nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = full_r
    mr.inputs["From Max"].default_value = far_r
    mr.inputs["To Min"].default_value = 1.0
    mr.inputs["To Max"].default_value = far_factor
    mr.clamp = True
    link(ng, length.outputs["Value"], mr.inputs["Value"])
    link(ng, mr.outputs["Result"], dist.inputs["Density Factor"])

    # selection: only scatter within far_r disk
    less = nodes.new("ShaderNodeMath"); less.operation = 'LESS_THAN'
    less.inputs[1].default_value = far_r
    link(ng, length.outputs["Value"], less.inputs[0])
    link(ng, less.outputs["Value"], dist.inputs["Selection"])

    obj = nodes.new("GeometryNodeObjectInfo")
    obj.inputs["Object"].default_value = blade_src
    obj.transform_space = 'RELATIVE'

    iop = nodes.new("GeometryNodeInstanceOnPoints")
    rv = nodes.new("FunctionNodeRandomValue"); rv.data_type = 'FLOAT'
    rv.inputs["Min"].default_value = scale_min
    rv.inputs["Max"].default_value = scale_max
    rv.inputs["Seed"].default_value = seed + 4

    link(ng, dist.outputs["Points"], iop.inputs["Points"])
    link(ng, obj.outputs["Geometry"], iop.inputs["Instance"])
    link(ng, dist.outputs["Rotation"], iop.inputs["Rotation"])
    link(ng, rv.outputs[0], iop.inputs["Scale"])

    rvz = nodes.new("FunctionNodeRandomValue"); rvz.data_type = 'FLOAT'
    rvz.inputs["Min"].default_value = 0.0
    rvz.inputs["Max"].default_value = 6.2832
    rvz.inputs["Seed"].default_value = seed + 9
    cz = nodes.new("ShaderNodeCombineXYZ")
    link(ng, rvz.outputs[0], cz.inputs["Z"])
    rot = nodes.new("GeometryNodeRotateInstances")
    rot.inputs["Local Space"].default_value = True
    link(ng, iop.outputs["Instances"], rot.inputs["Instances"])
    link(ng, cz.outputs["Vector"], rot.inputs["Rotation"])

    realize = nodes.new("GeometryNodeRealizeInstances")
    setmat = nodes.new("GeometryNodeSetMaterial")
    setmat.inputs["Material"].default_value = blade_mat

    link(ng, gin.outputs[0], dist.inputs["Mesh"])
    link(ng, rot.outputs["Instances"], realize.inputs["Geometry"])
    link(ng, realize.outputs["Geometry"], setmat.inputs["Geometry"])
    link(ng, setmat.outputs["Geometry"], gout.inputs[0])
    return ng

def add_turf_modifier(obj, ng, name="Turf"):
    mod = obj.modifiers.new(name, 'NODES')
    mod.node_group = ng

def build_collar(blade_src, blade_mat, green_base_mat):
    """Dense taller grass ring hugging the hole lip so the ball nestles in turf."""
    # annulus cross-section: a circle grid, then knock out the inner hole radius
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=120, y_subdivisions=120,
                                    size=0.26, location=(0, 0, 0))
    collar = bpy.context.active_object
    collar.name = "Collar"
    me = collar.data
    # follow ground contour, lift 1mm to avoid z-fight with the green
    bm = bmesh.new(); bm.from_mesh(me)
    kill = []
    for v in bm.verts:
        r = math.hypot(v.co.x, v.co.y)
        if r < CUP_R - 0.001 or r > 0.12:
            kill.append(v)
        else:
            v.co.z = green_z(v.co.x, v.co.y) + 0.001
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(me); bm.free(); me.update()
    for p in me.polygons:
        p.use_smooth = True
    collar.data.materials.append(green_base_mat)
    ng = build_turf_group(blade_src, blade_mat, "CollarScatter",
                          density=460000, dist_min=0.001,
                          scale_min=0.8, scale_max=1.55,
                          full_r=0.12, far_r=0.13, far_factor=1.0, seed=31)
    add_turf_modifier(collar, ng, "Collar")
    return collar

# ===========================================================================
# world (HDRI) + sun
# ===========================================================================
def setup_world():
    w = bpy.data.worlds.new("GoldenHour")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(HDRI)
    mapping = nt.nodes.new("ShaderNodeMapping")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mapping.inputs["Rotation"].default_value = (0, 0, math.radians(40))
    bg.inputs["Strength"].default_value = 0.85
    link(nt, tc.outputs["Generated"], mapping.inputs["Vector"])
    link(nt, mapping.outputs["Vector"], env.inputs["Vector"])
    link(nt, env.outputs["Color"], bg.inputs["Color"])
    link(nt, bg.outputs["Background"], out.inputs["Surface"])

def setup_sun():
    sun_data = bpy.data.lights.new("Sun", 'SUN')
    sun_data.energy = 5.5
    sun_data.color = (1.0, 0.77, 0.48)
    sun_data.angle = math.radians(2.0)
    sun = bpy.data.objects.new("Sun", sun_data)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(80), 0, math.radians(118))

    rim_data = bpy.data.lights.new("RimWarm", 'AREA')
    rim_data.shape = 'DISK'; rim_data.size = 0.08
    rim_data.energy = 6.0; rim_data.color = (1.0, 0.68, 0.38)
    rim = bpy.data.objects.new("RimWarm", rim_data)
    bpy.context.collection.objects.link(rim)
    rim.location = (0.14, 0.17, 0.085)
    d = mathutils.Vector((-0.07, 0.0, 0.018)) - rim.location
    rim.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

    # soft shadow fill from the camera side so backlit beats (dive, line) keep
    # detail on the ball's shadowed face without flattening the golden key.
    fill_data = bpy.data.lights.new("Fill", 'AREA')
    fill_data.shape = 'DISK'; fill_data.size = 1.2
    fill_data.energy = 20.0; fill_data.color = (0.82, 0.86, 1.0)  # soft sky fill
    fill = bpy.data.objects.new("Fill", fill_data)
    bpy.context.collection.objects.link(fill)
    fill.location = (-0.7, -0.5, 0.5)
    df = mathutils.Vector((-0.05, 0.0, 0.02)) - fill.location
    fill.rotation_euler = df.to_track_quat('-Z', 'Y').to_euler()
    return sun

# ===========================================================================
# CAMERA RIG  — the 6 beats.  Edit here; next step interpolates between them.
#   name   : beat label
#   loc    : camera position (scene metres)
#   target : look-at point
#   lens   : focal length (mm) on a 36mm sensor
#   fstop  : aperture (lower = shallower DoF)
#   focus  : optional explicit focus point (defaults to target)
# ===========================================================================
def _ball_pt():
    bx = -(CUP_R + BALL_R * 0.32)
    return (bx, 0.0, green_z(bx, 0.0) + BALL_R - 0.0035 + BALL_R * 0.3)

BALL = _ball_pt()
HOLE = (0.0, 0.0, -0.008)

CAMERAS = [
    # 1 MACRO — close-up of ball resting on turf, flagstick soft behind, intimate DoF.
    # Raised a touch & aimed slightly down so the backdrop is out-of-focus grass, not sky.
    dict(name="macro", loc=(-0.33, -0.12, 0.052), target=(BALL[0] + 0.02, 0.0, BALL[2] - 0.004),
         lens=95.0, fstop=3.2, focus=(BALL[0] - BALL_R * 0.4, 0.0, BALL[2])),
    # 2 AERIAL REVEAL — raised 3/4 reveal: dense turf fills the frame, ball + flag in
    # context, only sky + distant treeline above (lower/tighter so the HDRI rocks recede).
    dict(name="aerial", loc=(-1.05, -0.80, 0.175), target=(0.07, 0.02, 0.05),
         lens=34.0, fstop=10.0, focus=(0.0, 0.0, 0.03)),
    # 3 TERRAIN READ — raking low angle across the contours toward the hole (room for grid)
    dict(name="terrain", loc=(-1.25, -0.62, 0.075), target=(0.12, 0.10, 0.012),
         lens=50.0, fstop=5.6, focus=(-0.3, 0.0, 0.02)),
    # 4 THE LINE — elevated, behind the ball, reading the putt down the break to the cup.
    # Ball sharp in the foreground, hole + flag readable beyond (room for trajectory line).
    dict(name="line", loc=(-0.40, 0.02, 0.115), target=(0.03, -0.01, -0.006),
         lens=52.0, fstop=4.5, focus=BALL),
    # 5 DIVE — low tracking behind the ball, wide lens: ball in the foreground, dramatic
    # foreshortening rushing toward the hole + flag beyond.
    dict(name="dive", loc=(-0.215, -0.02, 0.060), target=(0.05, 0.0, -0.004),
         lens=28.0, fstop=3.5, focus=BALL),
    # 6 MONEY SHOT — the fixed ball-at-the-lip hero, ball dropping into the cup
    dict(name="money", loc=(-0.47, -0.15, 0.086), target=(0.0, 0.0, -0.004),
         lens=100.0, fstop=4.0, focus=BALL),
]

def make_camera():
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.sensor_width = 36.0
    cam_data.dof.use_dof = True
    cam = bpy.data.objects.new("Camera", cam_data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    return cam

def set_camera(cam, beat):
    """Point the single camera at beat `beat` (a CAMERAS dict)."""
    cam.location = beat["loc"]
    direction = mathutils.Vector(beat["target"]) - mathutils.Vector(beat["loc"])
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = beat["lens"]
    cam.data.dof.aperture_fstop = beat["fstop"]
    focus = mathutils.Vector(beat.get("focus", beat["target"]))
    cam.data.dof.focus_distance = (focus - mathutils.Vector(beat["loc"])).length

# ---- ANIMATION HOOK (next step: scroll-scrub frame sequence) --------------
def make_animated_camera(frames_total=180):
    """Keyframe ONE camera through all 6 beats for a scroll-scrubbable sequence.
    Enable with env RENDER_SEQUENCE=1. Render with e.g.:
        Blender -b -P build_beats.py
    after setting scene.frame_end; this just lays down the keyframes."""
    cam = make_camera()
    sc = bpy.context.scene
    seg = frames_total // (len(CAMERAS) - 1)
    for i, beat in enumerate(CAMERAS):
        f = 1 + i * seg
        sc.frame_set(f)
        set_camera(cam, beat)
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_euler", frame=f)
        cam.data.keyframe_insert("lens", frame=f)
        cam.data.dof.keyframe_insert("focus_distance", frame=f)
        cam.data.dof.keyframe_insert("aperture_fstop", frame=f)
    # smooth easing between beats
    for fc in (cam.animation_data.action.fcurves if cam.animation_data else []):
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'
    sc.frame_start = 1
    sc.frame_end = 1 + (len(CAMERAS) - 1) * seg
    return cam

# ===========================================================================
# render settings
# ===========================================================================
def setup_render(samples, res_x, res_y):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.render.resolution_x = res_x
    sc.render.resolution_y = res_y
    sc.render.resolution_percentage = 100
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.01
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception as e:
        print("denoiser set skip:", e)
    sc.cycles.max_bounces = 8
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception as e:
        print("look set skip:", e)
    sc.view_settings.exposure = -0.15
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.image_settings.compression = 15
    sc.frame_set(1)

# ===========================================================================
# scene build
# ===========================================================================
def build_scene():
    green = build_green()
    cut_hole(green)
    gbase = mat_green_base()
    green.data.materials.append(gbase)

    wall, bottom, rim = build_cup()
    wall.data.materials.append(mat_simple("CupInner", (0.022, 0.022, 0.020, 1), 0.9))
    bottom.data.materials.append(mat_simple("CupInner2", (0.015, 0.015, 0.014, 1), 0.95))
    rim.data.materials.append(mat_simple("Liner", (0.09, 0.09, 0.095, 1), 0.55, metal=0.4))

    pin, flag = build_flag()
    pin.data.materials.append(mat_simple("Pin", (0.85, 0.83, 0.78, 1), 0.45, coat=0.1))
    flag.data.materials.append(mat_simple("FlagFab", (0.75, 0.12, 0.08, 1), 0.7))

    ball = build_ball()
    ball.data.materials.append(mat_ball())

    blade_src = build_blade_source()
    blade_src.data.materials.append(mat_blade())
    blade_mat = bpy.data.materials["Blade"]

    main_ng = build_turf_group(blade_src, blade_mat, "TurfScatter",
                              density=DENSITY, dist_min=0.0013,
                              scale_min=0.5, scale_max=1.45,
                              full_r=FULL_R, far_r=SCATTER_R, far_factor=FAR_FACTOR,
                              seed=7)
    add_turf_modifier(green, main_ng, "Turf")
    build_collar(blade_src, blade_mat, gbase)

    setup_world()
    setup_sun()
    return ball

# ===========================================================================
# args
# ===========================================================================
def parse_args():
    beats = []; samples = SAMPLES; res = (RES_X, RES_Y)
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--samples":
            samples = int(argv[i + 1]); i += 2; continue
        if a == "--test":
            samples = 96; res = (1280, 720); i += 1; continue
        if a.isdigit():
            beats.append(int(a))
        i += 1
    if not beats:
        beats = [1, 2, 3, 4, 5, 6]
    return beats, samples, res

# ===========================================================================
# main
# ===========================================================================
def main():
    t0 = time.time()
    beats, samples, res = parse_args()
    wipe()
    gpu = setup_gpu()
    print("GPU device:", gpu)

    build_scene()
    cam = make_camera()
    setup_render(samples, *res)

    print("Build time: %.1fs" % (time.time() - t0))
    print("Rendering beats:", beats, "| samples", samples, "| res", res)
    sc = bpy.context.scene
    timings = {}
    for b in beats:
        beat = CAMERAS[b - 1]
        set_camera(cam, beat)
        sc.render.filepath = os.path.join(RENDER_DIR, "beat_%d" % b)
        tr = time.time()
        bpy.ops.render.render(write_still=True)
        dt = time.time() - tr
        timings[b] = dt
        print("  beat %d (%s): %.1fs -> beat_%d.png" % (b, beat["name"], dt, b))
    print("Per-beat:", {b: round(t, 1) for b, t in timings.items()})
    print("Render total: %.1fs" % sum(timings.values()))
    print("Total: %.1fs" % (time.time() - t0))

if __name__ == "__main__":
    main()
