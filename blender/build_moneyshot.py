"""
BullzEye hero "money shot" — photoreal golf ball at the lip of the cup, golden hour.
Blender 5.2.2 LTS, Cycles GPU (Metal). Fully headless build + render.

Run:  /Applications/Blender.app/Contents/MacOS/Blender -b -P build_moneyshot.py
Output: blender/renders/moneyshot_0001.png

Turf technique: Geometry Nodes — Distribute Points on Faces -> Instance on Points
(a procedurally built bent blade mesh) -> Realize Instances, restricted to a disk
around the cup so blade count stays GPU-friendly.
"""
import bpy, bmesh, math, os, time, random

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else \
    "/Users/merlin/Developer/ClaudeCode/bullzeye-hero-webgl/blender"
RENDER_DIR = os.path.join(HERE, "renders")
os.makedirs(RENDER_DIR, exist_ok=True)
HDRI = "/Users/merlin/Developer/ClaudeCode/bullzeye-hero-webgl/public/hdri/kloppenheim_06_2k.hdr"

# ---- tunables -------------------------------------------------------------
BALL_R      = 0.02135          # 42.7mm diameter tour ball
CUP_R       = 0.054            # 108mm hole
BLADE_H     = 0.0038           # ~3.8mm mowed blade
SCATTER_R   = 0.85             # radius of densely-scattered turf disk
DENSITY     = 230000           # blades per m^2 inside the disk
SAMPLES     = 384

# ===========================================================================
# housekeeping
# ===========================================================================
def wipe():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def link(nodes_tree, a_out, b_in):
    nodes_tree.links.new(a_out, b_in)

def sock_in(node, name):
    return node.inputs[name]

def set_principled(bsdf, **kw):
    """Set Principled inputs by name, ignoring any missing on this build."""
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
        if gpu_found:
            bpy.context.scene.cycles.device = 'GPU'
        else:
            bpy.context.scene.cycles.device = 'CPU'
            used = "CPU (no METAL device)"
    except Exception as e:
        print("GPU init failed, CPU fallback:", e)
        bpy.context.scene.cycles.device = 'CPU'
        used = "CPU (exception)"
    return used

# ===========================================================================
# ground green (contoured) + hole
# ===========================================================================
def build_green():
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=220, y_subdivisions=220,
                                     size=3.0, location=(0, 0, 0))
    green = bpy.context.active_object
    green.name = "Green"
    me = green.data
    # gentle contour: low-freq undulation + a slight overall break/slope
    for v in me.vertices:
        x, y, _ = v.co
        z = (0.012 * math.sin(x * 1.3 + 0.6) * math.cos(y * 1.1)
             + 0.006 * math.sin(x * 3.1 + y * 2.2)
             + 0.028 * (x + 1.5) * 0.18)          # subtle slope rising toward +x
        v.co.z = z
    me.update()
    # shade smooth
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
    # dark interior wall
    bpy.ops.mesh.primitive_cylinder_add(radius=CUP_R - 0.002, depth=0.16, vertices=96,
                                         location=(0, 0, -0.085))
    wall = bpy.context.active_object
    wall.name = "CupWall"
    # remove top & bottom caps so we see down into it; keep as tube
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.object.mode_set(mode='OBJECT')
    for p in wall.data.polygons:
        p.use_smooth = True
    # bottom disk
    bpy.ops.mesh.primitive_circle_add(radius=CUP_R - 0.002, vertices=96, fill_type='NGON',
                                      location=(0, 0, -0.163))
    bottom = bpy.context.active_object
    bottom.name = "CupBottom"
    # metal liner rim ring just below the turf surface
    bpy.ops.mesh.primitive_torus_add(major_radius=CUP_R - 0.004, minor_radius=0.004,
                                     location=(0, 0, -0.012),
                                     major_segments=96, minor_segments=12)
    rim = bpy.context.active_object
    rim.name = "CupRim"
    for p in rim.data.polygons:
        p.use_smooth = True
    return wall, bottom, rim

def build_flag():
    # flagstick rises from cup bottom up out of frame
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0055, depth=1.05, vertices=24,
                                         location=(0, 0, 0.36))
    pin = bpy.context.active_object
    pin.name = "FlagStick"
    for p in pin.data.polygons:
        p.use_smooth = True
    # small flag near the top (likely soft / partly out of frame)
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=24, y_subdivisions=16,
                                    size=0.14, location=(0.085, 0, 0.80))
    flag = bpy.context.active_object
    flag.name = "Flag"
    flag.rotation_euler = (math.radians(90), 0, 0)
    # ripple the flag
    me = flag.data
    for v in me.vertices:
        v.co.z += 0.012 * math.sin(v.co.x * 45) * (0.5 + (v.co.x + 0.07) * 2)
    for p in me.polygons:
        p.use_smooth = True
    return pin, flag

# ===========================================================================
# golf ball with real dimples (displacement)
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
    # perch on the near lip: front half rests on the turf shoulder, back overhangs the hole
    lip_x = -(CUP_R + BALL_R * 0.30)
    ball.location = (lip_x, 0.0, BALL_R - 0.006)   # nestled ~6mm into the turf shoulder
    return ball

# ===========================================================================
# materials
# ===========================================================================
def mat_green_base():
    m = bpy.data.materials.new("GreenBase"); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 60.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.035, 0.085, 0.022, 1)
    ramp.color_ramp.elements[1].color = (0.06, 0.13, 0.035, 1)
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    link(nt, tc.outputs["Object"], noise.inputs["Vector"])
    link(nt, noise.outputs["Fac"], ramp.inputs["Fac"])
    link(nt, ramp.outputs["Color"], bsdf.inputs["Base Color"])
    link(nt, noise.outputs["Fac"], bump.inputs["Height"])
    link(nt, bump.outputs["Normal"], bsdf.inputs["Normal"])
    set_principled(bsdf, **{"Roughness": 0.85})
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
    # natural hue variation: deep green -> warm yellow-green tips
    ramp.color_ramp.elements[0].color = (0.02, 0.08, 0.015, 1)
    ramp.color_ramp.elements[1].color = (0.10, 0.17, 0.03, 1)
    link(nt, tc.outputs["Generated"], noise.inputs["Vector"])
    link(nt, noise.outputs["Fac"], ramp.inputs["Fac"])
    link(nt, ramp.outputs["Color"], pr.inputs["Base Color"])
    link(nt, ramp.outputs["Color"], trans.inputs["Color"])
    set_principled(pr, **{"Roughness": 0.62})
    link(nt, pr.outputs["BSDF"], mix.inputs[1])
    link(nt, trans.outputs["BSDF"], mix.inputs[2])
    mix.inputs[0].default_value = 0.32   # translucency amount -> golden backlight glow
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
    # dimples via Voronoi distance -> displacement
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.feature = 'F1'
    vor.distance = 'EUCLIDEAN'
    vor.inputs["Scale"].default_value = 19.0      # ~380-440 dimples over the sphere
    if "Randomness" in vor.inputs:
        vor.inputs["Randomness"].default_value = 0.4    # tidy, manufactured dimple packing
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    # crisp round wells: at a cell point (dist~0) -> black (pushed in), quick ramp to flat land
    ramp.color_ramp.interpolation = 'EASE'
    e = ramp.color_ramp.elements
    e[0].position = 0.0;  e[0].color = (0, 0, 0, 1)
    e[1].position = 0.5;  e[1].color = (1, 1, 1, 1)
    disp = nt.nodes.new("ShaderNodeDisplacement")
    disp.inputs["Scale"].default_value = 0.0016    # clear, well-defined dimple relief
    disp.inputs["Midlevel"].default_value = 0.85   # most of surface is 'land', dimples dip in
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
    w = 0.00055            # base half-width ~0.55mm
    h = BLADE_H
    bend = 0.0014          # forward lean (laid-over mowed look)
    verts = [
        (-w, 0, 0), (w, 0, 0),
        (-w * 0.55, bend, h * 0.55), (w * 0.55, bend, h * 0.55),
        (0.0, bend * 2.1, h),
    ]
    faces = [(0, 1, 3, 2), (2, 3, 4)]
    me = bpy.data.meshes.new("BladeMesh")
    me.from_pydata(verts, [], faces)
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    blade = bpy.data.objects.new("BladeSource", me)
    bpy.context.collection.objects.link(blade)
    blade.hide_render = True
    blade.hide_viewport = True
    return blade

# ===========================================================================
# geometry-nodes turf
# ===========================================================================
def build_turf(green, blade_src, blade_mat):
    ng = bpy.data.node_groups.new("TurfScatter", "GeometryNodeTree")
    iface = ng.interface
    iface.new_socket("Geometry", in_out='INPUT', socket_type='NodeSocketGeometry')
    iface.new_socket("Geometry", in_out='OUTPUT', socket_type='NodeSocketGeometry')
    nodes = ng.nodes
    gin = nodes.new("NodeGroupInput")
    gout = nodes.new("NodeGroupOutput")

    dist = nodes.new("GeometryNodeDistributePointsOnFaces")
    dist.distribute_method = 'POISSON'
    dist.inputs["Density Max"].default_value = DENSITY
    dist.inputs["Density Factor"].default_value = 1.0
    dist.inputs["Distance Min"].default_value = 0.0013
    dist.inputs["Seed"].default_value = 7

    # selection: only scatter within SCATTER_R disk of the cup
    pos = nodes.new("GeometryNodeInputPosition")
    length = nodes.new("ShaderNodeVectorMath"); length.operation = 'LENGTH'
    less = nodes.new("ShaderNodeMath"); less.operation = 'LESS_THAN'
    less.inputs[1].default_value = SCATTER_R
    link(ng, pos.outputs["Position"], length.inputs[0])
    link(ng, length.outputs["Value"], less.inputs[0])
    link(ng, less.outputs["Value"], dist.inputs["Selection"])

    obj = nodes.new("GeometryNodeObjectInfo")
    obj.inputs["Object"].default_value = blade_src
    obj.transform_space = 'RELATIVE'

    iop = nodes.new("GeometryNodeInstanceOnPoints")
    # random blade scale (height variation) — scalar broadcast into vector Scale
    rv = nodes.new("FunctionNodeRandomValue"); rv.data_type = 'FLOAT'
    rv.inputs["Min"].default_value = 0.5
    rv.inputs["Max"].default_value = 1.45
    rv.inputs["Seed"].default_value = 11

    link(ng, dist.outputs["Points"], iop.inputs["Points"])
    link(ng, obj.outputs["Geometry"], iop.inputs["Instance"])
    link(ng, dist.outputs["Rotation"], iop.inputs["Rotation"])  # align to surface normal
    link(ng, rv.outputs[0], iop.inputs["Scale"])                # active FLOAT output

    # random Z-spin so blades aren't perfectly combed
    rvz = nodes.new("FunctionNodeRandomValue"); rvz.data_type = 'FLOAT'
    rvz.inputs["Min"].default_value = 0.0
    rvz.inputs["Max"].default_value = 6.2832
    rvz.inputs["Seed"].default_value = 23
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

    mod = green.modifiers.new("Turf", 'NODES')
    mod.node_group = ng
    return ng

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
    mapping.inputs["Rotation"].default_value = (0, 0, math.radians(40))  # warm sector behind
    bg.inputs["Strength"].default_value = 0.8
    link(nt, tc.outputs["Generated"], mapping.inputs["Vector"])
    link(nt, mapping.outputs["Vector"], env.inputs["Vector"])
    link(nt, env.outputs["Color"], bg.inputs["Color"])
    link(nt, bg.outputs["Background"], out.inputs["Surface"])

def setup_sun():
    sun_data = bpy.data.lights.new("Sun", 'SUN')
    sun_data.energy = 5.5
    sun_data.color = (1.0, 0.77, 0.48)      # warm golden
    sun_data.angle = math.radians(2.0)      # soft-ish disc for soft shadows
    sun = bpy.data.objects.new("Sun", sun_data)
    bpy.context.collection.objects.link(sun)
    # low on horizon, coming from the far side -> strong rim/backlight on ball, long shadows
    sun.rotation_euler = (math.radians(80), 0, math.radians(118))

    # subtle warm rim light low behind the ball -> golden edge pop on the silhouette
    rim_data = bpy.data.lights.new("RimWarm", 'AREA')
    rim_data.shape = 'DISK'
    rim_data.size = 0.08
    rim_data.energy = 6.0
    rim_data.color = (1.0, 0.68, 0.38)
    rim = bpy.data.objects.new("RimWarm", rim_data)
    bpy.context.collection.objects.link(rim)
    rim.location = (0.14, 0.17, 0.085)
    import mathutils
    d = mathutils.Vector((-0.07, 0.0, 0.018)) - rim.location
    rim.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return sun

# ===========================================================================
# camera
# ===========================================================================
def setup_camera(ball):
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 100.0                      # telephoto compression
    cam_data.sensor_width = 36.0
    cam_data.dof.use_dof = True
    cam_data.dof.aperture_fstop = 4.0          # shallow macro DoF, ball+lip sharp
    cam = bpy.data.objects.new("Camera", cam_data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam.location = (-0.47, -0.15, 0.086)       # low & near, but back enough to see the cup
    target = (0.0, 0.0, -0.004)                # look across ball, slightly down into the hole
    # aim: point -Z of camera toward target
    import mathutils
    direction = mathutils.Vector(target) - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    # focus squarely on the ball (its near/upper hemisphere)
    ball_pt = mathutils.Vector((ball.location.x, ball.location.y, ball.location.z + BALL_R * 0.3))
    cam_data.dof.focus_distance = (ball_pt - cam.location).length
    return cam

# ===========================================================================
# render settings
# ===========================================================================
def setup_render():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.render.resolution_x = 1920
    sc.render.resolution_y = 1080
    sc.render.resolution_percentage = 100
    sc.cycles.samples = SAMPLES
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
    sc.render.filepath = os.path.join(RENDER_DIR, "moneyshot_0001")
    sc.frame_set(1)

# ===========================================================================
# main
# ===========================================================================
def main():
    t0 = time.time()
    wipe()
    gpu = setup_gpu()
    print("GPU device:", gpu)

    green = build_green()
    cut_hole(green)
    green.data.materials.append(mat_green_base())

    wall, bottom, rim = build_cup()
    wall.data.materials.append(mat_simple("CupInner", (0.015, 0.015, 0.015, 1), 0.6))
    bottom.data.materials.append(mat_simple("CupInner2", (0.01, 0.01, 0.01, 1), 0.7))
    rim.data.materials.append(mat_simple("Liner", (0.25, 0.25, 0.26, 1), 0.3, metal=0.9))

    pin, flag = build_flag()
    pin.data.materials.append(mat_simple("Pin", (0.85, 0.83, 0.78, 1), 0.45, coat=0.1))
    flag.data.materials.append(mat_simple("FlagFab", (0.75, 0.12, 0.08, 1), 0.7))

    ball = build_ball()
    ball.data.materials.append(mat_ball())

    blade_src = build_blade_source()
    blade_src.data.materials.append(mat_blade())
    build_turf(green, blade_src, bpy.data.materials["Blade"])

    setup_world()
    setup_sun()
    setup_camera(ball)
    setup_render()

    print("Build time: %.1fs" % (time.time() - t0))
    tr = time.time()
    bpy.ops.render.render(write_still=True)
    # Blender appends frame number -> moneyshot_0001.png
    print("Render time: %.1fs" % (time.time() - tr))
    print("Total: %.1fs" % (time.time() - t0))
    print("Output:", os.path.join(RENDER_DIR, "moneyshot_0001.png"))

if __name__ == "__main__":
    main()
