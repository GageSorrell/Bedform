# Spatial React TSX builds

`bedform build` uses the single `bedform/Spatial/React` port for automatic JSX.
Normal builds select `react-jsx` and its `jsx-runtime`; `--development` selects
`react-jsxdev` and `jsx-dev-runtime`. TypeScript and esbuild receive the same
selection. Legacy DDUI strict settings do not select the JSX engine or mode.
Removing the remaining DDUI declarative exports and strict configuration is owned
by `9rdk.12`; imperative DDUI forms remain independent.

For editor checking, set the same default in your project:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "jsx": "react-jsx",
    "jsxImportSource": "bedform/Spatial/React",
    "strict": true
  }
}
```

The CLI overrides project-wide JSX settings for its selected build mode. It writes
an inherited compiler config only inside its build workspace, preserving authored
files and inherited aliases. Individual source files can select another JSX engine
with a pragma, including imported files:

```tsx
/** @jsxImportSource @bedrock-core/ui */
```

That file's type declarations and generated runtime import both use its selected
engine. The qualification fixture supplies an independent engine under that package
name to test override routing; it does not certify every third-party engine API.

## Entries and output paths

For a single script behavior pack and script module, one conventional
`Script/main.ts`, `Script/main.tsx`, `scripts/main.ts` or `scripts/main.tsx` supplies
the manifest's JavaScript entry. A `.ts` entry can import `.tsx` modules. Multiple
existing candidates, including `main.ts` together with `main.tsx`, fail before
staging and preserve the previous archive. Case-equivalent paths on Windows count
as one file.

Use explicit mappings when both entries are intentional, or when multiple script
modules or custom output paths exist:

```json
{
  "build": {
    "scripts": [
      {
        "entry": "Source/widget.tsx",
        "output": "behavior_packs/example/custom/widget.js"
      }
    ]
  }
}
```

Paths are relative to the selected configuration file. Each output must uniquely
match a discovered behavior-pack manifest script entry. The archive contains those
JavaScript outputs, without source `.ts`/`.tsx`, generated source directories or
tooling imports. Microsoft’s official bundle and ZIP tasks still produce the staged
packs and add-on archive.

## Canvas image descriptors

Register PNGs through the existing `Canvas.Images` configuration:

```json
{
  "Canvas": {
    "Namespace": "example",
    "Images": [{ "Name": "Status", "Source": "Asset/status.png" }]
  }
}
```

Then import the compiler's virtual catalogue in TS or TSX:

```tsx
import { View, Image, Text } from "bedform/Spatial/Components";
import { Images } from "../generated/canvas/images.js";

export function App() {
  return <View Dimension="minecraft:overworld">
    <Image Source={Images.Status} />
    <Text>Status</Text>
  </View>;
}
```

Render `<App />` through an explicitly initialized renderer root. Building or
importing it creates no runtime or native resources. All display text remains in
`Text`; bare container strings/numbers fail typechecking.

The existing image compiler runs once before script typechecking. TypeScript and
esbuild consume its same virtual `generated/canvas/images.ts` module; repeated
imports share descriptor identity inside each script bundle. Only its PNG/particle
assets are staged into the selected resource pack. The diagnostic source copy stays
inside `Intermediate/bedform/build-*/canvas/images.ts`; no generated directory is
written into your source tree. React adds no image registry or second PNG compiler.
See [Canvas images](canvas-images.md) for animation, validation and resource selection.

## Qualification

`Test/SpatialBuildPacked.mts` runs inside the independent offline installed-consumer
fixture, through its installed CLI and official archives. It checks both modes and
JSON/TS configurations, inherited aliases, per-file engine routing, typed image
descriptors, React element identity, source preservation, failure on ambiguous
entries, explicit disambiguation, `.ts` importing `.tsx`, and multiple manifest-mapped
outputs. Archive scripts execute in a realm that rejects Node/browser globals.
Source checking includes negative child/prop cases for both engines. These are build
and package checks; native drawing/input and physical-client appearance belong to
their rendering and component qualification issues.
