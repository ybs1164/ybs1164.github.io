"""Render the original rulebook compositions with the physical arrow tile model.

python scripts/render-gyeol-rules.py --source <Desktop/결>
Uses the source project's real mesh construction and materials without editing it.
The numbered reference illustrations define tile positions and annotations. The
current facing rule is retained: a newly placed tile points at the rotated tile.
"""
import argparse
import math
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
NAMES = ("setting", "first", "goal", "do", "turn", "turnlimit", "put",
         "fivelimit", "follow", "swap", "turnoff")
REFERENCES = dict(zip(NAMES, (
    "1_setting.png", "2_first.png", "3_goal.png", "4_do.png", "6_turn.png",
    "7_turnlimit.png", "8_put.png", "10_fivelimit.png", "11_follow.png",
    "12_swap.png", "5_turnoff.png",
)))
# (owner, direction); directions are north/east/south/west = 0/1/2/3.
# Original green arrows map to dark outlines, terracotta to white outlines.
CONTEXT = ((-1.5, -1, 1, 2), (-.5, -1, -1, 1), (.5, -1, 1, 3),
           (-1.5, 0, 1, 1), (-.5, 0, -1, 2), (-.5, 1, 1, 0))
GOAL = (
    ((-1, 0), (-1, 3), (1, 3), (-1, 0), (1, 3)),
    ((1, 0), (1, 3), (-1, 2), (1, 2), (-1, 3)),
    ((-1, 1), (1, 0), (1, 1), (-1, 3), (1, 2)),
    ((1, 3), (-1, 0), (-1, 0), (1, 0), (1, 1)),
    ((1, 1), (1, 2), (1, 0), (-1, 3), (1, 0)),
)
PASS = (
    ((1, 3), (-1, 0), (-1, 2), (1, 0), None),
    ((-1, 2), (-1, 0), (1, 3), (-1, 2), (1, 0)),
    ((1, 1), (1, 2), (-1, 0), (1, 0), (-1, 2)),
    ((1, 0), (-1, 2), (-1, 2), (1, 0), (-1, 0)),
    (None, (1, 3), (-1, 3), (-1, 0), (1, 1)),
)
GOAL_LOSER_OPACITY = .22


def arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path.home() / "Desktop" / "결")
    parser.add_argument("--output", type=Path, default=ROOT / "assets/gyeol/rules")
    parser.add_argument("--only", choices=NAMES)
    parser.add_argument("--samples", type=int, default=16)
    parser.add_argument("--resolution", type=int, default=1200)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None)


def render(args):
    import bpy
    from mathutils import Vector
    sys.path.insert(0, str(args.source))
    import arrow_tile as base
    import arrow_tile_mdf as tile_model

    base.reset_scene()
    prototype = tile_model.make_tile()
    prototype.hide_render = True
    prototype.hide_set(True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    scene.cycles.adaptive_threshold = .08
    scene.cycles.adaptive_min_samples = 4
    scene.cycles.max_bounces = 3
    scene.render.resolution_x = args.resolution
    scene.render.resolution_y = round(args.resolution * 5 / 7)
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0

    world = bpy.data.worlds.new("White studio")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = .4
    scene.world = world

    def material(name, color):
        mat = bpy.data.materials.new(name)
        mat.diffuse_color = (*base.srgb(color), 1)
        mat.use_nodes = True
        node = mat.node_tree.nodes["Principled BSDF"]
        node.inputs["Base Color"].default_value = mat.diffuse_color
        node.inputs["Roughness"].default_value = .8
        return mat

    ink = material("Annotation / warm charcoal", "474139")
    cream = material("Annotation / white", "FFFFFF")
    red = material("Annotation / unavailable", "A34B36")
    faint = material("Annotation / empty cell", "A69B8C")
    bpy.ops.mesh.primitive_plane_add(size=2)
    floor = bpy.context.object
    floor.name = "White shadow catcher"
    floor.is_shadow_catcher = True
    floor.data.materials.append(cream)

    for location, energy, size in [((-.09, -.10, .22), .35, .10), ((.12, .04, .18), .10, .18)]:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.rotation_euler = (-Vector(location)).to_track_quat("-Z", "Y").to_euler()

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.clip_start = .001
    scene.camera = camera
    scene.view_layers[0].use_pass_object_index = True

    # Composite the real contact shadows onto pure white, so the image joins the page.
    scene.use_nodes = True
    nodes = scene.node_tree.nodes
    nodes.clear()
    layer = nodes.new("CompositorNodeRLayers")
    over = nodes.new("CompositorNodeAlphaOver")
    over.inputs[1].default_value = (1, 1, 1, 1)
    scene.node_tree.links.new(layer.outputs["Image"], over.inputs[2])
    composite = nodes.new("CompositorNodeComposite")
    loser_mask = nodes.new("CompositorNodeIDMask")
    loser_mask.index = 1
    loser_mask.use_antialiasing = True
    scene.node_tree.links.new(layer.outputs["IndexOB"], loser_mask.inputs[0])
    fade_amount = nodes.new("CompositorNodeMath")
    fade_amount.operation = "MULTIPLY"
    fade_amount.inputs[1].default_value = 1 - GOAL_LOSER_OPACITY
    scene.node_tree.links.new(loser_mask.outputs[0], fade_amount.inputs[0])
    fade = nodes.new("CompositorNodeMixRGB")
    fade.inputs[2].default_value = (1, 1, 1, 1)
    scene.node_tree.links.new(fade_amount.outputs[0], fade.inputs[0])
    scene.node_tree.links.new(over.outputs[0], fade.inputs[1])
    scene.node_tree.links.new(fade.outputs[0], composite.inputs[0])

    props = []
    pitch = .023
    ghost_materials = {}

    def ghost(mat):
        if mat.name not in ghost_materials:
            copy = mat.copy()
            # A pale material keeps the wood and carved outline readable without
            # noisy refraction through the mesh's front and back surfaces.
            fade = .15 if "line_front" in mat.name else .42
            for node in copy.node_tree.nodes:
                if node.type == "VALTORGB":
                    for stop in node.color_ramp.elements:
                        stop.color = tuple(v*(1-fade)+fade for v in stop.color[:3]) + (1,)
            ghost_materials[mat.name] = copy
        return ghost_materials[mat.name]

    def tile(c, r, owner, direction, z=0, tilt=(0, 0), preview=False, yaw=0, faded=False):
        obj = prototype.copy()
        obj.data = prototype.data
        bpy.context.collection.objects.link(obj)
        obj.hide_render = False
        obj.hide_set(False)
        obj.rotation_euler = ((0 if owner == 1 else math.pi) + tilt[0], tilt[1], math.pi / 2 - direction * math.pi / 2 + yaw)
        obj.location = (c * pitch, -r * pitch, base.H / 2 + z)
        if preview:
            obj.data = obj.data.copy()
            for slot in obj.material_slots:
                slot.material = ghost(slot.material)
        elif faded:
            # Apply opacity after lighting for a clean silhouette and arrow,
            # without noisy transparency or a visible reverse-side arrow.
            obj.pass_index = 1
            obj.visible_shadow = False
        props.append(obj)
        return obj

    def curve(points, mat=ink, width=.00022, z=.0038, arrow=False, dashed=False):
        points = [Vector((c * pitch, -r * pitch, z)) for c, r in points]
        segments = []
        if dashed:
            for a, b in zip(points, points[1:]):
                steps = max(1, math.ceil((b-a).length / .0017))
                for i in range(0, steps, 2):
                    segments.append([a.lerp(b, i/steps), a.lerp(b, min(i+1, steps)/steps)])
        else:
            segments = [points]
        for segment in segments:
            data = bpy.data.curves.new("Rule annotation", "CURVE")
            data.dimensions = "3D"
            data.bevel_depth = width
            data.bevel_resolution = 3
            spline = data.splines.new("POLY")
            spline.points.add(len(segment)-1)
            for point, coord in zip(spline.points, segment):
                point.co = (*coord, 1)
            obj = bpy.data.objects.new("Rule annotation", data)
            bpy.context.collection.objects.link(obj)
            obj.data.materials.append(mat)
            props.append(obj)
        if arrow:
            end = points[-1]
            direction = (end-points[-2]).normalized()
            side = Vector((-direction.y, direction.x, 0))
            vertices = [end, end-direction*.002+side*.00085, end-direction*.002-side*.00085]
            mesh = bpy.data.meshes.new("Arrow head")
            mesh.from_pydata(vertices, [], [(0, 1, 2)])
            obj = bpy.data.objects.new("Arrow head", mesh)
            bpy.context.collection.objects.link(obj)
            mesh.materials.append(mat)
            props.append(obj)

    def frame(c, r, dashed=False, mat=ink, z=.0044):
        extent = .49
        radius = .10
        points = []
        for cx, cy, start in [(extent-radius, extent-radius, 0), (-extent+radius, extent-radius, 90),
                              (-extent+radius, -extent+radius, 180), (extent-radius, -extent+radius, 270)]:
            for i in range(9):
                a = math.radians(start+i*90/8)
                points.append((c+cx+radius*math.cos(a), r+cy+radius*math.sin(a)))
        curve(points+[points[0]], mat, .0002, z, dashed=dashed)

    def cross(c, r, z=.006):
        curve([(c-.16, r-.16), (c+.16, r+.16)], cream, .00065, z)
        curve([(c-.16, r+.16), (c+.16, r-.16)], cream, .00065, z)
        curve([(c-.16, r-.16), (c+.16, r+.16)], red, .00038, z+.0007)
        curve([(c-.16, r+.16), (c+.16, r-.16)], red, .00038, z+.0007)

    def path(points, dashed=False, arrow=True, z=.006):
        # Light stroke with an ink edge stays distinct from either arrow color.
        curve(points, ink, .00055, z, dashed=dashed)
        curve(points, cream, .00032, z+.0007, arrow=arrow, dashed=dashed)

    def arc(c, r, rx, ry, start, end, z=.007):
        points = [(c+rx*math.cos(math.radians(start+(end-start)*i/48)),
                   r+ry*math.sin(math.radians(start+(end-start)*i/48))) for i in range(49)]
        path(points, z=z)

    def context():
        for c, r, owner, direction in CONTEXT:
            tile(c, r, owner, direction)

    def badge(c, r, number):
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=.0032, depth=.0006, location=(c*pitch, -r*pitch, .009))
        obj = bpy.context.object
        obj.data.materials.append(cream)
        props.append(obj)
        bpy.ops.object.text_add(location=(c*pitch, -r*pitch, .0094))
        obj = bpy.context.object
        obj.data.body = str(number)
        obj.data.align_x = "CENTER"
        obj.data.align_y = "CENTER"
        obj.data.size = .004
        obj.data.materials.append(ink)
        props.append(obj)

    def setup(name):
        for obj in props:
            bpy.data.objects.remove(obj, do_unlink=True)
        props.clear()
        target = Vector((0, 0, .002))
        camera.location = (0, -.035, .30)
        camera.rotation_euler = (target-camera.location).to_track_quat("-Z", "Y").to_euler()
        camera.data.ortho_scale = .10
        if name == "setting":
            for column in range(5):
                for layer in range(5):
                    tile((column-2)*1.1, 0, 1 if (column+layer)%2 == 0 else -1,
                         (0, 0, 0, 2, 3)[column], z=layer*base.H)
            target = Vector((0, 0, .007))
            camera.location = (.105, -.15, .17)
            camera.rotation_euler = (target-camera.location).to_track_quat("-Z", "Y").to_euler()
            camera.data.ortho_scale = .17
        elif name == "first":
            tile(-.5, 0, 1, 1); tile(.5, 0, -1, 3)
            camera.data.ortho_scale = .073
        elif name in ("goal", "turnoff"):
            for r, row in enumerate(GOAL if name == "goal" else PASS):
                for c, value in enumerate(row):
                    if value is None:
                        frame(c-2, r-2, True, faint)
                        cross(c-2, r-2)
                    else:
                        tile(c-2, r-2, *value, faded=name == "goal" and value[0] == -1)
            camera.data.ortho_scale = .18
        elif name == "do":
            context()
            tile(.5, 0, -1, 0, z=.0008, yaw=math.radians(-35))
            tile(1.5, 0, 1, 3, preview=True)
            frame(1.5, 0, True, faint)
            arc(.5, 0, .76, .76, -105, -5)
            badge(-.02, -.53, 1)
            badge(1.83, -.53, 2)
            camera.data.ortho_scale = .145
        elif name == "turn":
            context()
            tile(.5, 0, -1, 0, z=.0008, yaw=math.radians(-35))
            arc(.5, 0, .76, .76, -105, 8)
            camera.data.ortho_scale = .13
        elif name == "turnlimit":
            tile(0,0,-1,0)
            cross(0,-.95)
            for dx,dy in [(-1,0),(1,0),(0,1)]:
                curve([(.65*dx,.65*dy),(1.05*dx,1.05*dy)], arrow=True, z=.0008)
        elif name == "put":
            context()
            tile(.5, 0, -1, 1)
            frame(.5, 0)
            tile(1.5, 0, 1, 3, preview=True)
            frame(1.5, 0, True, faint)
            tile(.5, 1, 1, 0, preview=True)
            frame(.5, 1, True, faint)
            camera.data.ortho_scale = .145
        elif name == "fivelimit":
            for c in range(5):
                tile(c-2,0,(1,-1,1,-1,-1)[c],(0,1,2,0,2)[c])
            for c in [-3,3]:
                frame(c,0,True,faint);cross(c,0)
            camera.data.ortho_scale = .19
        elif name in ("follow", "swap"):
            for c,r,owner,direction in [(-1,.5,1,1),(0,.5,-1,1),(1,.5,-1,0),(1,-.5,-1,3),(0,-.5,1,0)]:
                tilts = {(0,.5):(-16,0), (1,.5):(0,-18), (1,-.5):(18,0)}
                tilt = tuple(math.radians(a) for a in tilts.get((c,r),(0,0))) if name=="swap" else (0,0)
                tile(c,r,1 if name=="swap" else owner,direction,
                     z=.001 if name=="swap" and owner==-1 else 0, tilt=tilt)
            frame(-1,.5)
            if name == "follow":
                path([(-.72,.5),(1,.5),(1,-.25)])
                path([(.78,-.5),(.12,-.5)], dashed=True)
            else:
                frame(0,-.5)
                arc(0,.5,.10,.37,65,-130,z=.009)
                arc(1,.5,.37,.10,170,5,z=.009)
                arc(1,-.5,.10,.37,65,-130,z=.009)
            camera.data.ortho_scale = .105

    args.output.mkdir(parents=True, exist_ok=True)
    for name in ([args.only] if args.only else NAMES):
        if not (args.source / REFERENCES[name]).is_file():
            raise FileNotFoundError(f"Missing rulebook reference: {REFERENCES[name]}")
        setup(name)
        scene.render.filepath = str(args.output / f"{name}.png")
        bpy.ops.render.render(write_still=True)
        print(f"Finished rule render: {name} (reference: {REFERENCES[name]})", flush=True)


def build(args):
    import subprocess
    import tempfile
    from PIL import Image
    candidates = [Path(os.environ.get("BLENDER_EXE", "blender")),
                  Path("C:/Program Files/Blender Foundation/Blender 4.2/blender.exe")]
    executable = next((str(p) for p in candidates if p.is_file()), "blender")
    with tempfile.TemporaryDirectory(prefix="gyeol-3d-rules-") as temporary:
        command = [executable, "--background", "--python-exit-code", "1", "--python", str(Path(__file__).resolve()), "--",
                   "--source", str(args.source), "--output", temporary, "--samples", str(args.samples),
                   "--resolution", str(args.resolution)]
        if args.only:
            command += ["--only", args.only]
        log_path = Path(tempfile.gettempdir()) / "gyeol-3d-render.log"
        print("Rendering physical 3D tiles; Blender log:", log_path, flush=True)
        with log_path.open("w", encoding="utf-8") as log:
            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                       text=True, encoding="utf-8", errors="replace")
            for line in process.stdout:
                log.write(line)
                log.flush()
                if line.startswith("Finished rule render:"):
                    print(line.strip(), flush=True)
            if process.wait() != 0:
                raise subprocess.CalledProcessError(process.returncode, command)
        args.output.mkdir(parents=True, exist_ok=True)
        for name in ([args.only] if args.only else NAMES):
            with Image.open(Path(temporary) / f"{name}.png") as image:
                image.convert("RGB").save(args.output / f"{name}.webp", quality=92, method=6)
    print("3D rule images saved to", args.output, flush=True)


if __name__ == "__main__":
    args = arguments()
    try:
        import bpy
    except ImportError:
        build(args)
    else:
        render(args)
