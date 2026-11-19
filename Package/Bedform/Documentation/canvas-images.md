# Canvas images

`Canvas.Images` compiles static PNGs and equal-height vertical flipbooks into a
consumer resource pack. Intent, imperative surfaces and future spatial React
components share the public `ImageDescriptor` at `bedform/Canvas/Image`. Image
compilation starts no Intent, React, display or VM runtime.

```json
{
  "$schema": "./node_modules/bedform/bedform.config.schema.json",
  "Canvas": {
    "Namespace": "example",
    "ResourcePack": "resource_packs/main",
    "Images": [
      { "Name": "Logo", "Source": "Asset/logo.png" },
      {
        "Name": "Spinner",
        "Source": "Asset/spinner.png",
        "FrameCount": 6,
        "FrameTicks": 4
      }
    ]
  }
}
```

Source and resource-pack paths are relative to the **selected configuration file**,
including when it is in a subdirectory. JSON and asynchronous TypeScript configs
use the same schema and path resolution. `ResourcePack` must match a discovered
resource-pack directory. It can be omitted when there is exactly one destination;
multiple resource packs require an explicit selection. Configuring images without
a destination resource pack fails before staging.

`Namespace` is a custom lowercase namespace of at most 24 characters. `Images`
contains 1–256 registrations. Each `Name` is a PascalCase record key of at most
24 characters. Duplicate names, including names differing only by case, fail.
`FrameCount` defaults to 1 and is an integer from 1 through 4096. `FrameTicks`
defaults to 1 and is a positive integer. The PNG height must be divisible by the
frame count; horizontal strips and unequal frame sizes are not inferred.

The compiler reads PNG contents rather than a runtime URL. It accepts at most
64 MiB of encoded input and 16,777,216 pixels per image. It emits canonical RGBA
PNGs preserving decoded color and alpha, including nearly transparent pixels.
Descriptor `Width` and `Height` describe one frame; no aspect-ratio distortion,
trimming or automatic square padding is applied.

## Virtual descriptors

Build scripts can import the generated record relative to the project root:

```ts
// In Script/main.ts:
import { Images } from "../generated/canvas/images.js";
import { FrameAt, type ImageDescriptor } from "bedform/Canvas/Image";
import * as Intent from "bedform/Spatial/Intent";

const image: ImageDescriptor = Images.Spinner;
const frame = FrameAt(image, elapsedTicks);
// frame: { Index, U, V, Width, Height } in source texels
await intents.Set(entity, Images.Spinner);
```

`intents`, `entity` and `elapsedTicks` above belong to the caller. An image descriptor
is an inert frozen value: importing it makes no requests or native registrations.
The virtual module and its entries are frozen and contain only the shared descriptor
fields: `Kind: "image"`, `Version: 1`, namespaced `Id`/`Particle`, `Width`, `Height`,
`FrameCount` and `FrameTicks`.

TypeScript checking and esbuild see the same virtual module. Use a relative `.js`
or `.ts` import; no authored generated file or tsconfig path override is needed.
The module exists only during the build. A copy is retained in the owned intermediate
workspace at `canvas/images.ts`, with the consuming package's module name, license
and release-core version in its TSDoc. No generated directory is written into the
project's source tree. Source files at that reserved module path are conflicts.

`FrameAt` computes `floor(elapsedTicks / FrameTicks) % FrameCount` and returns the
frame's source texel rectangle. It accepts finite nonnegative elapsed ticks and
rejects invalid geometry or timing. The Intent renderer uses this same helper.
Particle refresh does not restart the frame clock; callers of imperative surfaces
retain their own elapsed feature time. Static images always select frame zero.

## Generated assets and ownership

For `Namespace: "example"` and `Name: "Spinner"`, the selected resource pack gets:

```text
textures/example/canvas/images/spinner.png
particles/canvas/images/spinner.json
particles/canvas/images/spinner_oriented.json
```

The descriptor identifies `example:spinner` and particle
`example:canvas_image_spinner`. The camera-facing particle uses `rotate_xyz`;
the `_oriented` variant uses the shared surface direction and roll contract.
Both use shared Surface Molang keys for size, UVs and RGBA tint, live for two
ticks and use the depth-tested `particles_blend` material. The compiler shares
its particle serializer with Canvas glyphs and surfaces.

The PNG has its authored colors. Tint multiplies those colors and texture alpha;
use white tint to preserve them, as Intent does. White source artwork can receive
arbitrary RGB/RGBA tint through the existing Surface APIs. An imperative sprite's
UV rectangle comes from `FrameAt`; its display bounds should preserve
`image.Width / image.Height` if distortion is unwanted.

Authored textures and generated filenames are never overwritten. Particle
identifiers are also checked across all discovered resource packs, including
JSONC definitions under unrelated filenames. Links and junctions in image/output
paths fail. Exclusive staged writes protect against conflicts introduced by
other generators. Failures preserve existing published archives. Virtual Physics
and Canvas catalogues coexist in one build without changing either source tree.

Outputs are deterministically regenerated from registrations and source pixels on
each build; no source-path or timestamp metadata enters descriptors. Consumers
still own resource-pack version bumps so clients receive changed textures.
Surviving Intent or other asset-backed runtime use automatically includes the
[shared Canvas dependency](canvas-packs.md). Image registrations alone are
self-contained and do not force the shared packs.

## Validation and schema availability

`npm run test:canvas-images --workspace bedform` exercises configuration, PNGs,
alpha, frames, virtual modules, conflicts, source preservation and real builds.
`npm run verify --workspace bedform` additionally checks generated schema freshness,
types, lint and an independently installed offline consumer using the packaged CLI.
Canvas's own `check` verifies that the shared serializer retains existing glyph
and Intent artwork outputs. These are host/packaging checks; native appearance
and client acceptance remain separately tracked.

The packaged `bedform.config.schema.json` includes Canvas. The immutable hosted
schema URL in `JsonSchemaUrl` still identifies the earlier publication. Use the
packaged path shown above, adjusted relative to your config file, for editor
validation of the new section until a new hosted revision is published.
