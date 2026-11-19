# Shared project configuration

`bedform/Config` is a host-only entrypoint backed by upstream `effect/Schema`.
Install the optional `effect` peer when using it in Node. Keep this entrypoint out
of Bedrock scripts; the runtime root does not import it.

```ts
import { BedformConfig } from "bedform/Config";

export default BedformConfig({
    DDUI: { StrictMode: false },
    build: {
        behaviorPacks: ["behavior_packs/example"],
        resourcePacks: ["resource_packs/example"],
        scripts: [{ entry: "Script/main.tsx", output: "behavior_packs/example/scripts/main.js" }]
    }
});
```

All top-level sections are optional. The constructor copies validated settings
and supplies `DDUI.StrictMode: false` and
`Development.AllowDevelopmentModulesInProduction: false`, including when those
sections are absent. It rejects
unknown properties and invalid values without coercing them. `build` retains the
lowercase spelling specified by the add-on build plan. Omitted build settings
use conventional pack and script discovery.

`Physics` accepts the existing standalone physics compiler configuration:
`schemaVersion: 1`, `namespace`, `behaviorPack`, `resourcePack`, and `models`.
Cuboid and particle registrations retain their existing property names, optional
physical defaults, and recursive collision shapes. Mass and density are mutually
exclusive. Asset existence, geometry validity, collider limits, and other
compilation checks remain the physics compiler's responsibility.

`Canvas` registers shared static PNGs and vertical flipbooks through `Namespace`,
`Images` and an optional `ResourcePack` destination. Sources and destination paths
are config-relative. Builds provide virtual `generated/canvas/images.ts` descriptors
and stage textures and particles without writing generated source files. See
[Canvas images](canvas-images.md) for registration, frame timing, destination
selection and the updated packaged editor schema.

The build automatically includes the [shared Canvas packs](canvas-packs.md) for
surviving asset-backed runtime features, independently of image registrations.

The shared loader, validation command, and add-on build support JSON and TypeScript
files. A present `Physics` section compiles before script checking and bundling;
omitting it skips physics compilation. Standalone physics configurations retain
their overlay-only publication mode with a migration notice.

## Loading and validating files

```text
bedform config validate [source-directory] [--config <file>]
```

The source directory defaults to the current directory. Automatic discovery
checks that root for `bedform.config.json` and `bedform.config.ts`; it does not
search parent directories. When neither file exists, loading uses defaults. If both files exist, specify
`--config` to choose one. Explicit relative paths resolve from the source
directory; a missing or invalid explicit file fails without falling back.

The command prints JSON containing the selected absolute `file` (or `null` for
defaults), its `directory`, and validated effective `config`. It exits nonzero
on discovery, parse, import, evaluation, or schema errors, including the selected
path in diagnostics. It does not build, stage, install, or write configuration.
Machine-local executable settings are separate from this project configuration.

The same host loader is available to build tooling:

```ts
import { loadProjectConfig } from "bedform/Config/Loader";

const loaded = await loadProjectConfig({ root: process.cwd(), config: "settings/project.ts" });
```

`loaded.input` retains authored values and omitted properties, excluding the
JSON `$schema` hint. `loaded.config` is branded and includes defaults. It resolves
build pack directories, script entry/output paths, physics pack roots, and
particle mesh-solid/renderer descriptor paths from the selected configuration
file's directory. Cuboid geometry and texture asset references retain their
resource-pack-relative meaning. Asset files need not exist during config loading;
their compilation checks remain with the build stages.

TypeScript files must default-export a plain configuration object. They may
import local TS files, Node built-ins such as `node:fs` and `node:path`, and
installed dependencies through normal Node resolution, including upstream
`effect` and `@effect/platform-node`. Top-level `await` may initialize settings;
a default-exported function or promise is not a configuration object. The
packaged Jiti dependency is loaded only for TypeScript evaluation; it does not
install global Node hooks or write transpilation caches. As with `bedform/Config`,
install the optional `effect` host peer for the loader/validation command; install
`@effect/platform-node` in projects whose configuration imports it. These imports
are for Node tooling; Bedrock runtime entrypoints do not import the loader.

## Strict-mode build preflight

The host parser accepts `--ddui-strict`, `--ddui-strict=true`, and
`--ddui-strict=false`. Omission uses the configured `DDUI.StrictMode`, defaulting
to false. Invalid boolean text and repeated flags fail before loading config.
When an explicit flag replaces a present setting, preflight logs
`DDUI.StrictMode override: config=true, --ddui-strict=false` to stderr, including
when both values match. Diagnostics precede staging or compilation.

Host integrations can use `parseBuildArguments`, `prepareBuild`, and
`resolveBuildSettings` from `bedform/Build/Settings`. `prepareBuild` loads the
project and returns its authored input plus effective settings before any writes.
The returned `bundle` options select automatic JSX, the development source
metadata flag, and a literal build-mode substitution together. `typescript`
contains the matching JSX settings. The pure `bedform/DDUI/BuildMode` entrypoint
exposes the substituted boolean with an unbundled false default. The published
`bedform/DDUI/jsx-runtime` and `jsx-dev-runtime` use this same selection.

## Script add-on builds

Run `bedform build [source-directory] [--config <file>] [--out <file-or-directory>]`.
The source defaults to the working directory. The default archive is
`dist/<unscoped-package-name>.mcaddon`, falling back to the directory name.
The build discovers immediate packs under `behavior_packs` and `resource_packs`,
or uses the config-relative `build.behaviorPacks` and `build.resourcePacks` arrays.

For one script behavior pack with one script module, exactly one conventional
`Script/main.ts`, `Script/main.tsx`, `scripts/main.ts`, or `scripts/main.tsx`
can supply its manifest entry. Otherwise the build uses existing manifest-entry
JavaScript, or explicit `build.scripts` mappings:

```json
{
  "build": {
    "behaviorPacks": ["packs/behavior"],
    "resourcePacks": ["packs/resources"],
    "scripts": [{
      "entry": "Source/main.tsx",
      "output": "packs/behavior/scripts/main.js"
    }]
  }
}
```

Every output must uniquely match a discovered behavior-pack script-module entry.
Dependencies resolve from the original project; builds do not install packages.
When a root `tsconfig.json` exists, the build checks its sources and mapped entries
with the effective DDUI JSX settings. A strict-aware esbuild pass compiles JSX
and substitutes the runtime mode before Microsoft's `bundleTask` bundles scripts.
Native Minecraft modules remain external; Node and host configuration/build
imports fail. The pure JSX runtimes create function-component descriptors;
native controls, rendering, hooks, and diagnostics remain separate work.

Each build owns a fresh `Intermediate/bedform/build-*` workspace. Pack assets,
UUIDs and script-module paths are retained. Staged manifests preserve authored
fields and dependencies while adding the corresponding BedformCommon dependency;
authored manifest files remain unchanged. TypeScript, dependency trees, Git
metadata, intermediate directories, and old archives are excluded.
Source links and overlapping pack roots are rejected. Existing root `.gitignore`
files receive `/Intermediate/` only when needed, preserving encoding and line
endings. A missing `.gitignore` is left absent.

Official archive tasks create one `.mcpack` per consumer pack and an outer `.mcaddon`
containing those packs plus `bedform-common-bp.mcpack` and `bedform-common-rp.mcpack`.
Both shared packs are always included, even for content-only, behavior-only or
resource-only builds, independently of runtime imports, strict mode and development
mode. There is no configuration switch. See [Common packs](common-packs.md) for
identities, dependency reuse and conflicts, packaged artifacts and release maintenance.
Publication replaces the destination only after all stages succeed. Failed staged
builds retain their workspace and report its path; the prior archive survives
errors and cancellation. Inspect retained workspaces before removing them.

**Integration boundary:** builds reject unconverted `.blend` and `.bbmodel`
inputs explicitly. Model conversion, Prototype generation settings and engine
qualification, model/Prototype asset and startup injection, and native DDUI rendering are pending. Standalone
JSON with a top-level `schemaVersion`, supplied without a source-directory or
strict flag, retains the legacy physics overlay build path and includes no common
packs or manifest dependency injection. Shared JSON/TS configurations
use the add-on pipeline even when the strict flag is omitted.

## Development-module boundary

Ordinary `bedform build` runs in production mode. Reachable runtime imports from
`bedform/Prototype` and every Prototype subpath fail with guidance by default.
The check follows the bundler's real dependency graph, including transitive,
literal dynamic, aliased, and direct file imports into Bedform's Prototype modules.
Type-only imports erased by compilation are permitted. Unrelated application
folders named `Prototype` are unaffected.

Use `bedform build --development` for a development build. This is independent
of `--ddui-strict`: development mode permits development modules; DDUI strict
selection controls its diagnostics and JSX source metadata.

An intentional production consumer can set:

```json
{
  "Development": {
    "AllowDevelopmentModulesInProduction": true
  }
}
```

The flag `--allow-development-modules-in-production` is equivalent to `=true`;
`=false` overrides an authored true setting. Omission uses the configuration,
defaulting to false. Repeated flags and malformed values fail before config
evaluation. Every explicit replacement of an authored permission logs its setting
path, configured value, and flag value before checking or staging, even when equal.
`--development` is a presence-only flag, and production permission applies only
when development mode is off.

Neither permission mechanism injects Prototype items, textures, native dependencies,
experiments, startup, or a world definition. Those belong to the future dedicated
Prototype build target. Runtime initialization remains explicit. The remaining
Prototype configuration/engine qualification work is tracked by `MineCraft-s80.4`;
its production boundary child is `MineCraft-s80.4.1`.

## Physics compilation and migration

Move the entire standalone configuration under `Physics` in a shared JSON or TS
configuration. For example, a project-root configuration can include:

```json
{
  "Physics": {
    "schemaVersion": 1,
    "namespace": "example",
    "behaviorPack": "behavior_packs/example",
    "resourcePack": "resource_packs/example",
    "models": [{
      "name": "crate",
      "representation": "cuboid",
      "geometry": "models/crate.geo.json",
      "geometryIdentifier": "geometry.crate",
      "textures": { "default": "textures/crate" },
      "materials": { "default": "entity_alphatest" }
    }]
  }
}
```

Run `bedform build` to create the complete add-on. Physics pack roots must match
discovered behavior and resource packs; select custom pack roots through `build`
when needed. Both roots, particle `meshSolid`, and `rendererDescriptor` paths
resolve from the chosen configuration's directory. Cuboid geometry and texture
names remain relative to its resource pack. Renderer descriptor assets retain
their descriptor-relative interpretation.

Scripts can import `Models` from `../generated/physics/catalog/models.js` when
their entry is in `Script/`. That project-root catalog is virtual: TypeScript
checks it and the bundler includes its runtime data without writing a generated
directory into source. Authored TS or JS at that reserved catalog path fails
explicitly. With no `Physics` section, the build supplies no virtual catalog.

Generated entities, visual geometry, animations, and render controllers are added
only to the selected staged packs. Generated paths cannot replace authored assets.
Compiler catalogs and renderer descriptors are retained under the build workspace's
`physics/catalog` directory for inspection; they are not copied wholesale into packs.
Manifests and UUIDs are preserved. Configure the existing physics runtime explicitly
in script; building assets does not start simulations or change worlds.

The legacy command `bedform build --config physics.json --out overlay-directory`
still compiles and publishes the original owned overlay layout. It prints guidance
to move the fields under `Physics` and use the shared add-on build. Source-directory
arguments or shared build flags with a standalone file fail with that migration guidance.
Combining top-level standalone `schemaVersion` with `Physics`, `DDUI`, `Development`, `Canvas`, or `build`
is rejected as ambiguous. Existing host users of `compile`/`publish` retain their
API; `compileConfig(input, directory)` also accepts an in-memory physics section
with the same validation and no filesystem writes.

## Branding and JSON

The exported `TypeId` is a unique-symbol TypeScript type whose runtime value is
`Symbol.for("~bedform/Config")`. Constructed values carry that non-enumerable,
non-writable property; it does not appear in object spreads or JSON. The function
and resulting type are both named `BedformConfig`. `BedformConfig.Input` excludes
the brand and `$schema`; editor hints belong only to JSON configurations.

```ts
import { writeFile } from "node:fs/promises";
import { stringifyConfig } from "bedform/Config";

await writeFile("bedform.config.json", stringifyConfig({ DDUI: { StrictMode: true } }));
```

`stringifyConfig` validates inputs and includes the exported `JsonSchemaUrl` as
`$schema`, enabling editors to validate settings and show descriptions. The
[published schema](https://gist.github.com/GageSorrell/2e9570e389f016ebb456af97e55cbbf0)
uses a revision-pinned raw URL. The same schema is packaged as
`bedform/bedform.config.schema.json`. The future migration target is
`https://bedform.sorrell.sh/bedform.config.schema.json`; that URL is reserved and
is not the current published endpoint.

## Maintaining generated files

Edit `Source/ConfigSchema.ts`, then run `npm run generate:config --workspace bedform`.
The generator uses schema descriptions to emit `Source/Config.ts` declarations
and property TSDoc, as well as `bedform.config.schema.json`. It extracts object
shapes into interfaces and namespaces and fails on unsupported schema forms.
`npm run check:config --workspace bedform` detects stale generated artifacts.

After validating a changed schema, update the public gist through `gh gist edit`,
read its new raw revision URL through `gh api`, update
`Tool/config-schema-publication.json`, and regenerate. Retain immutable raw URLs
for already-generated configurations. Run `npm run test:config --workspace bedform`
and `npm run typecheck:tools --workspace bedform`: these check defaults, validation,
branding, JSON Schema agreement through an independent Draft 2020-12 validator,
and bidirectional assignability between generated, inferred, and legacy physics types.
`npm run test:config:packed --workspace bedform` additionally installs local package
tarballs offline with install scripts disabled in a disposable external consumer.
It exercises the actual CLI with async Node/Effect/platform imports, runtime
dependency isolation, both common packs, staged manifest dependencies and failure
paths that preserve authored manifests and previous output.
