# Plan: BDS `server.properties` Intellisense (library + two VS Code extensions)

Use only `MAJOR.MINOR.PATCH` in symbol-level `@since` tags. Prerelease suffixes (`-alpha.*`, `-beta.*`, `-rc.*`, or any other prerelease identifier) and build metadata (`+...`) must never appear in `@since` tags; for example, package version `1.0.0-alpha.1` uses `@since 1.0.0`.

Module TSDoc headers must not contain `@category` or `@since`; these tags apply only to symbol documentation. Follow the repository's TypeScript module header format for file-level metadata.

## Context

`server.properties` files for Bedrock Dedicated Server are edited by hand, and their keys and allowed values change between BDS releases (for example `transport`, `server-ip` and `server-udp-ports` arrived with NetherNet in 1.26.x). We want version-aware completion, hover help and validation in VS Code:

- **`Package/BDSIntellisense`** (new library, npm name `bds-intellisense`): parsing, versioned schemas, version detection and analysis, plus a VS Code adapter that both extensions call.
- **`Package/BDSIntellisenseCodeExtension`** (new extension "Bedrock Dedicated Server Intellisense", ID `GageSorrell.bedrock-dedicated-server-intellisense`): the main consumer.
- **`Package/BedformCodeExtension`** (existing, currently a hello-world scaffold): registers the same features unless the dedicated extension is installed.

Decisions already made: schemas are **generated from official BDS zips**; the range is **1.16.0 → latest**; the publisher is **`GageSorrell`**.

Facts this plan relies on:
- On this machine, `C:\MineCraft\Server\bedrock_server.exe` (232 MB) reports `FileVersion 1.26.63.1` in its PE VERSIONINFO.
- `behavior_packs/vanilla_1.26.63` and similar folders appear in every BDS install, including Linux.
- Each property in a default `server.properties` is a `key=value` line, or `# key=` when the property is optional. Comment lines follow, including an `# Allowed values: …` line, and a blank line ends the block.

## 1. `Package/BDSIntellisense` (library)

Layout follows `Package/BedrockServerManager`: `Source/`, `Distribution/`, `Test/`, `Tool/`, with `tsconfig.json` (NodeNext, `rootDir` Source, `outDir` Distribution, `declaration`) and `tsconfig.tools.json`.

`package.json`: `"name": "bds-intellisense"`, `"version": "1.0.0"`, `"type": "module"`, MIT. It has two exports:
- `"."`: the core, with no dependency on `vscode`.
- `"./VSCode"`: the adapter. `@types/vscode` is a dev dependency only; at runtime the extension host provides `vscode`, and the extensions' esbuild configs mark it external.

Scripts: `build`, `typecheck`, `lint`, `test` (`node --import tsx --test Test/*.test.mts`), `fetch` and `generate`.

### Core modules (`Source/`)
- `Version.ts`: `BdsVersion` (2–4 numeric parts) with `Parse`, `Compare`, `Format` and `Latest`.
- `Parser.ts`: turns document text into entries. Each entry has a line, the key and value text with their character ranges, a commented-out flag and the comment block attached to it. Lines ending in `\` are not continuations: BDS reads only one line per entry.
- `Schema/Types.ts`: `PropertySchema` (key, description, default, `Type`, `Optional`, `Repeatable` for `server-udp-ports`) and `PropertyType`, a discriminated union of `Boolean`, `Integer {Minimum?, Maximum?}`, `Enum {Values}` and `String {Pattern?, Forbidden?}`. Any object-typed members go in namespaces, as CLAUDE.md requires.
- `Schema/Generated/Schemas.generated.ts`: generated and tracked. Identical property definitions are shared across versions. The file holds one entry per *distinct* schema, keyed by the first BDS version that shipped it.
- `Tool/overrides.mts` (implemented there rather than in `Source/`, because only the generator uses it): hand-written corrections, keyed by property and an optional version range, for any `Allowed values` text the heuristics can't type.
- `Schema/index.ts`: `KnownSchemaVersions`, `LatestSchemaVersion` and `SchemaFor(version)`. `SchemaFor` returns the greatest schema whose version ≤ the given version, and the oldest schema when the version is older than all of them.
- `Detection.ts`: `DetectServerVersion(propertiesPath)` returns `{ Version, Source: "Executable" | "VanillaPacks" }` or `undefined`. It checks in this order:
  1. `bedrock_server.exe` next to the file → `PeVersion.ts`.
  2. The highest `vanilla_X.Y.Z` folder in `behavior_packs` or `resource_packs`. This covers Linux `bedrock_server` builds, which carry no version resource.

  If neither check succeeds, the folder isn't a BDS install, and detection returns `undefined`.
- `PeVersion.ts`: reads only the PE headers, then the `.rsrc` section, finds `VS_FIXEDFILEINFO` (signature `0xFEEF04BD`) and reads `dwFileVersionMS/LS`. It never reads the whole 232 MB file.
- `Analysis.ts`: pure functions that return plain data with 0-based ranges:
  - `Validate(text, schema)` reports:
    - unknown keys, with a "did you mean" suggestion based on edit distance;
    - keys that the selected version doesn't support but another known version does (for example "added in 1.26.0");
    - values with the wrong type, outside the allowed range, or not in the enum;
    - `;` in strings where the schema forbids it;
    - duplicate keys, except for repeatable keys;
    - lines that are neither entries nor comments.
  - `Complete(text, position, schema)`:
    - At the start of a line, it offers keys not yet present, as a `key=${default}` snippet.
    - After `=`, it offers enum values, `true`/`false`, or the default.
  - `Hover(text, position, schema)` shows the description, allowed values, default and the "since" version.
- `Keys.ts`: frozen `as const` records for setting names, command IDs and the diagnostic codes `Setting`, `Command` and `DiagnosticCode`, all in PascalCase.

### VS Code adapter (`Source/VSCode/index.ts`)
`RegisterServerPropertiesIntellisense(context, { ConfigurationSection, CommandPrefix })` returns a `Disposable`. It works as follows:
- The document selector is `{ scheme: "file", pattern: "**/server.properties" }`. Matching is by file name rather than language ID, so the built-in `properties` highlighting is kept.
- It registers completion (triggered by `=`), hover, diagnostics (on open, change with a debounce, and close), and quick fixes. The fixes replace a misspelt key, replace an invalid enum value with the closest one, and remove a duplicate.
- **Schema resolution per document**, from highest priority to lowest:
  1. A session override picked with the *Select Schema Version* command.
  2. If `detectVersion` is true, the detected version.
  3. `fallbackVersion`, where `"latest"` means `LatestSchemaVersion`.

  Detection results are cached per server folder, keyed by the exe's mtime. A `FileSystemWatcher` on `bedrock_server.exe` and `behavior_packs/vanilla_*` clears the cache and re-validates.
- A status bar item appears while a `server.properties` editor is active. It shows text such as `BDS 1.26.63.1 (detected)`, `(fallback)` or `(manual)`, and clicking it runs *Select Schema Version*.
- Commands: `<prefix>.selectSchemaVersion` opens a quick pick of the known versions, plus "Use detection / fallback". `<prefix>.redetectVersion` re-runs detection.

### Generator (`Tool/`)
Both stages are split so that regeneration works offline.
- `Tool/versions.json`: the list of BDS releases from 1.16.0 to the current 1.26.63.1. It is filled in by research during implementation, and it is the one place to add a version later.
- `Tool/fetch.mts` (needs network):
  - For each version without a saved file, it fetches `https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-<v>.zip`. It uses HTTP Range requests (the end-of-central-directory record, then the central directory, then the one local entry) and inflates `server.properties` with `node:zlib`.
  - If the server doesn't support Range requests, it downloads the whole zip. If the Windows zip is missing, it tries `bin-linux`.
  - Each result is written to the tracked folder `Data/Pristine/<v>.properties`. Versions it can't find are reported and skipped.
  - It sends a generic User-Agent.
- `Tool/generate.mts` (offline): parses each pristine file. It types the `Allowed values` text with these heuristics, then applies `Overrides.ts`:
  - `"true" or "false"` → Boolean
  - a quoted list → Enum
  - `Any positive integer` → Integer with minimum 1
  - `Integers in the range [a, b]` → Integer with that range
  - `Any string without semicolon` → String with `;` forbidden

  It then removes duplicate schemas and writes `Schemas.generated.ts`. Schemas are keyed by their first release's three-part version (for example `1.26.60`), so that pack-folder detection, which yields three parts, selects the same schema as the executable. Every default file must validate under its own schema, and `--check` reports a stale module. That file starts with the exact header from CLAUDE.md: note `Tool/generate.mts`, `@module bds-intellisense/Source/Schema/Generated/Schemas.generated`, `@file Schemas.generated.ts`, then `/* eslint-disable */`.
- Add `Package/BDSIntellisense/Source/Schema/Generated/**/*.ts` to the first block of root `eslint.config.ts` (`reportUnusedDisableDirectives: "off"`).

## 2. `Package/BDSIntellisenseCodeExtension`

Scaffold it like `Package/BedformCodeExtension`: `esbuild.js` (CJS bundle, `vscode` external), `tsconfig.json`, `.vscodeignore`, `README.md`, `CHANGELOG.md`, `src/extension.ts` and `src/test/`.

`package.json`:
- Identity: `name: bedrock-dedicated-server-intellisense`, `displayName: Bedrock Dedicated Server Intellisense`, `publisher: GageSorrell`, `version: 1.0.0`, `engines.vscode: ^1.145.0`.
- Dependencies: `bds-intellisense`. `compile` and `package` first build that workspace (`npm run build --workspace bds-intellisense`).
- `activationEvents`: `workspaceContains:**/server.properties` and `onLanguage:properties`.
- `contributes.configuration` (`bdsIntellisense.*`, resource scope):
  - `detectVersion` (boolean, **default `true`**): whether opening a `server.properties` file detects the version of the BDS install it belongs to and uses that version's schema.
  - `fallbackVersion` (string, default `"latest"`, pattern `^(latest|\d+(\.\d+){1,3})$`): the schema version used when detection is disabled or fails. Setting `detectVersion: false` together with a specific `fallbackVersion` forces that version.
  - `diagnostics.enabled` (boolean, default `true`).
- `contributes.commands`: *Select server.properties Schema Version* and *Re-detect BDS Version*.

`src/extension.ts`: `activate` calls `RegisterServerPropertiesIntellisense(context, { ConfigurationSection: "bdsIntellisense", CommandPrefix: "bdsIntellisense" })`.

## 3. `Package/BedformCodeExtension` changes
- In `package.json`:
  - Add `publisher: GageSorrell` and the dependency on `bds-intellisense`, with the same pre-build step.
  - Add the same activation events.
  - Mirror the three settings under `bedform.serverProperties.*` and the two commands under `bedform.serverProperties.*`.
- Rewrite `src/extension.ts` to follow the repository conventions. If `vscode.extensions.getExtension("GageSorrell.bedrock-dedicated-server-intellisense")` is installed, it doesn't register, so completions and diagnostics aren't duplicated. Otherwise it registers with section `bedform.serverProperties`. It keeps the existing hello-world command. TSDoc `@since 0.0.1`.

## Conventions to apply
- TSDoc on every symbol, without `@param` or `@returns`, ending with `@category` and `@since` (library 1.0.0, extension 1.0.0, Bedform 0.0.1).
- No inline object types in interfaces, PascalCase constants and frozen key records, as CLAUDE.md requires.
- Tracked in Beads epic **MineCraft-4pz0**: `.1` core modules → `.2` version detection and `.3` fetcher and generator → `.4` VS Code adapter → `.5` dedicated extension and `.6` Bedform integration. Claim and close each bead as it is done. Do not commit or push unless asked.

## Verification
1. `npm run fetch --workspace bds-intellisense`, then `npm run generate --workspace bds-intellisense`. Check that `Data/Pristine/` holds the files, that the generated header is exact, and that there is a reasonable number of distinct schemas. The fetch report lists any missing versions.
2. `npm test --workspace bds-intellisense` with unit tests for:
   - `Version` ordering;
   - `SchemaFor` boundaries (older than the oldest schema, exact match, between two schemas, newer than the latest);
   - the parser on the real `C:\MineCraft\Server\server.properties`, which must give zero errors with the 1.26.63.1 schema;
   - `Validate` on bad fixtures, with a typo key, a bad enum, an out-of-range port and a duplicate key;
   - `Complete` and `Hover` positions;
   - `PeVersion` against `C:\MineCraft\Server\bedrock_server.exe` (expects `1.26.63.1`, and skipped if the file is absent);
   - the vanilla-pack fallback on a temporary folder.
3. `npm run lint` at the root, plus `tsc --noEmit` in each extension.
4. Run `@vscode/test-cli` in `BDSIntellisenseCodeExtension` against a fixture workspace (a fake server folder with `behavior_packs/vanilla_1.20.0` and `server.properties`). Check the completions, that a 1.26-only key is reported as unsupported on 1.20, and that turning `detectVersion` off with `fallbackVersion` set to `latest` clears that diagnostic.
5. Manually press F5 on the extension and open `C:\MineCraft\Server\server.properties`. The status bar should read `BDS 1.26.63.1 (detected)`, and hover and completion should work.
