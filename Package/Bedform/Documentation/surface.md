# Canvas particle surfaces

`bedform/Canvas/Surface` draws flat, textured, tintable rectangles in the world with
BedformCanvas particles. It needs no React root, JSX runtime or image compiler, and
importing it starts nothing: every native capability is passed in explicitly. React
hosts, glyph rendering, canonical frames, Intent bubbles and Windows build on it.

```ts
import { MolangVariableMap, system } from "@minecraft/server";
import * as Surface from "bedform/Canvas/Surface";

const panel = Surface.Create({
    System: system,
    Audience: () => [ player ],              // private; read every tick
    Dimension: player.dimension.id,
    CreateVariables: () => new MolangVariableMap(),
    Pose: { Position: { x: 0.5, y: 70, z: 0.5 }, Scale: 1 / 32,
        Orientation: { Right: { x: 1, y: 0, z: 0 }, Up: { x: 0, y: 1, z: 0 } } },
    Content: { Kind: "viewport", Clip: { X: 0, Y: 0, Width: 64, Height: 32 }, Children: [
        Surface.Fill({ X: 0, Y: 0, Width: 64, Height: 32 }, "#202020", { Key: "background" }),
        Surface.Fill({ X: 4, Y: 4, Width: 24, Height: 8 }, { red: 0.2, green: 0.7, blue: 1, alpha: 0.8 },
            { Key: "button", Layer: 1 })
    ] },
    OnError: (error) => console.warn(error.message)
});

panel.Update({ Content: /* new tree */ });
panel.Dispose();
```

## Content and clipping

Content is a tree measured in surface pixels, with X increasing to the right and Y downward.

- A `Sprite` names a base particle and a `UV` rectangle in that particle's texture texels.
  It also has `Bounds`, an optional tint, a `Layer` and a `Key`. `Fill` makes a sprite of
  Canvas's plain rectangle particle (`bedform_canvas:rectangle`, a 16 × 16 white texture).
- A `Viewport` clips its children to `Clip`, given in parent coordinates. Its `Offset`
  (for example a scroll position) and `Scale` place its children:
  parent X = `Clip.X + Offset.X + child.X × Scale`, and the same for Y.

`Flatten` resolves the tree into sprites in paint order. A clipped sprite keeps its UVs in
proportion, so the visible texels stay where they were. A sprite with no visible area is
removed entirely, so it can never become an invisible interactive target. Trees are
limited to 8,192 nodes and 32 levels.

## Poses

`Position` is the world point of surface pixel `Pivot` (0, 0 by default), and `Scale` is
blocks per pixel. The orientation is one of:

- **Fixed:** give the surface's world `Right` and `Up` directions. Up is orthogonalized
  against Right, and the normal is Right × Up.
- **`"FaceViewer"`:** the surface turns toward each viewer's head separately, keeping
  world up. Intent bubbles use this.

`Layer` moves a sprite `LayerDepth` blocks (0.002 by default) per layer along the normal,
toward the viewer side, so overlapping content separates in depth deliberately.

### Depth writing

The default particles use the vanilla `particles_blend` material, which blends but has
`DisableDepthWrite` in the client's `particles.material`. Layer offsets therefore do not
order overlapping blended particles. They draw in the client's own particle order, which
changes as the viewer moves and as sprites are re-spawned each tick, so stacked content
flickers like z-fighting.

`Pose.DepthWrite: true` spawns the `_oriented_depth` variants instead. These use
`particles_alpha`: alpha-tested (pixels are either drawn or cut, so a partial alpha such as
`#00000080` does not blend) and depth-writing, so layer offsets decide what is in front.

Unlike `particles_blend`, `particles_alpha` does not disable culling, so these quads may
show only one face. Whether depth variants stop the flicker, and which face they show, are
pending client checks. The widget demonstration's `/scriptevent widget_demo:depth` toggles
between the two variants.

## Emission and audiences

Every sprite is sent to each viewer separately with `Player.spawnParticle`, which keeps
private and shared surfaces isolated. A viewer must be valid, in the surface's dimension
and within `MaxDistance` (64 blocks by default). An empty or unreadable audience renders
nothing; it never falls back to public emission.

Each spawn sets the Molang variables in `ParticleVariable`:

| Variable | Set with | Meaning |
| --- | --- | --- |
| U, V, UV width, UV height | `setFloat` | Texture region, in texels |
| Size X, size Y | `setFloat` | Half-extents, in blocks |
| Roll | `setFloat` | Rotation about the facing axis, in degrees |
| `variable.color` | `setColorRGBA` | Tint |
| Direction | `setVector3` | Facing direction of the `_oriented` particle variant that surfaces spawn |

Tint defaults to `#4D4D4D` at alpha 1. Any explicit RGB, RGBA or `#RRGGBB[AA]` value wins
and is never rounded to a `§` palette colour. Alpha multiplies the texture's own alpha.

## Limits, failures and lifetime

- **`MaxSprites`** (512 by default): sprites past this limit are dropped in paint order.
  `Rendered()` lists only the sprites actually emitted, for hit-testing.
- **`MaxSpawns`** (2,048 by default, per emission): a viewer gets a whole frame or none.
  Viewers are served nearest first. `VisibleTo(id)` reports whether a viewer received the
  last frame.
- **Failures:** if `spawnParticle` throws for one viewer, only that viewer's frame stops.
- **Managed surfaces** (`Create`) emit nothing until the next tick, then refresh every
  tick. Capacity and per-viewer failures are reported once and retried every tick; a
  failure that recurs after recovering is reported again.
- **Updates:** `Update` validates the change completely before replacing what is shown.
- **Lifetime:** particles live `LifetimeTicks` (2 ticks). A changed or removed sprite stays
  visible for at most two ticks.
- **Disposal:** `Dispose` stops refreshing and can be called repeatedly; any later
  `Update` throws.

`Emit` performs one frame without a scheduler and returns the same report.

## Particles

BedformCanvas generates three variants of every surface particle: a camera-facing
definition, an `_oriented` definition that faces `Direction`, and an `_oriented_depth`
copy of it that writes depth (see [Depth writing](#depth-writing)). The shared serializer's
`ParticleVariants` lists them. That includes the plain rectangle and the
glyph pages E2 to EB. They share the variable contract above and read `variable.color`
for tint. `bedform-canvas/Public/Glyph` re-exports `ParticleVariable`, `Tint` and
`DefaultTint` from this module.

## Unverified native assumptions

Host tests use fakes that behave like the native API. These assumptions have not yet been
checked on BDS or a real client, and need native and client acceptance:

- The billboard `size` values are half-extents.
- The texture's up is aligned with world up projected onto the surface plane (world −Z for
  horizontal planes), which is the reference the `Roll` calculation assumes.
- The texture's horizontal direction on direction-facing particles.
- Molang variables are copied when `spawnParticle` is called, which lets one variable map
  be reused for every spawn.
- How the client appears to treat alpha and depth.
