# Bedform Blockbench conversion

## Summary and delivery boundary

Extend Bedform's planned Blender conversion and add-on build pipeline with modern Bedrock `.bbmodel` conversion. This specification supplements `Plan/Bedform_Convert_Plan.md` and is tracked by Beads epic `MineCraft-gn5`, related to `MineCraft-5sn`.

Use a headless, Node-only `@bedform/blockbench` fork, with a conversion CLI and no MCP server. Source inspection of `Package/Blockbench` and `Reference/BlockbenchMcp` supports removing Electron and the GUI from the shipped package. Real package execution and Windows qualification remain implementation work, not established results.

Saving this specification and creating its Beads epic and descendants is the present delivery. Keep all implementation and validation entries open. Do not implement package changes, install dependencies, deploy, commit, push, or synchronize remote Dolt data as part of this planning delivery.

## Package and conversion interfaces

```text
bedform convert <model.blend|model.bbmodel> [--out <model.geo.json>] [--name <name>] [--ignore-invalid]
bedform setup blockbench [--yes|-y]

bedform-blockbench convert <model.bbmodel> [--out <model.geo.json>] [--name <name>] [--ignore-invalid] [--json]
bedform-blockbench --version [--json]
```

- Modify `Package/Blockbench` to integrate the parser, layout compatibility code, geometry helpers, and Bedrock exporter from `Reference/BlockbenchMcp`. Preserve source provenance and applicable license notices from both projects. Keep the reference clone unchanged.
- Replace the fork's desktop entry and Electron dependencies with prebuilt JavaScript and the `bedform-blockbench` executable. Build during package production; require no consumer-side `install`, `postinstall`, or `prepare` script. Exclude GUI assets, rendering engines, Bun, and MCP dependencies from the published conversion package. Signing credentials and desktop installers must not be required to install or use it.
- Initially support Windows x64 on Node 24 and 26 LTS with npm. Preserve existing repository package versions and unrelated edits. These Node branches were checked against the [Node release list](https://nodejs.org/en/about/previous-releases) during planning on November 1, 2026; qualify both explicitly rather than relying on the upstream package's broad Node engine range.
- Accept `.bbmodel` projects whose `meta.model_format` is `bedrock` or `bedrock_block`, including qualified 4.x layouts normalized in memory and the current 5.0 layout. Reject legacy `bedrock_old`, other project formats, and unsupported newer layouts with actionable diagnostics. For legacy projects, explain how to convert and resave them as modern Bedrock projects in Blockbench.
- Export static authored geometry, retaining valid cubes, bone hierarchy, pivots, rotations, UVs, material references, locators, texture dimensions, and visible bounds. Respect export flags; editor visibility alone does not exclude geometry. Use authored static geometry rather than evaluating animation clips.
- Preserve the authored geometry identifier unless `--name` overrides it; use the input filename when no identifier exists. Keep Blender's existing naming behavior. Default standalone output is the sibling `<input-basename>.geo.json`; `--out` selects a file.
- Produce geometry and UV data only. Do not export animations, extract textures, approximate meshes, or emit `poly_mesh` or texture meshes. Existing pack texture assets and references remain the add-on author's responsibility.
- Strict conversion rejects unsupported exported geometry. `--ignore-invalid` may skip unsupported geometry elements with names and reasons, but cannot suppress malformed structure, UV, dependency, or I/O failures. Require at least one exported cube.
- Audit the imported exporter against the fork's Bedrock codec and close relevant fidelity gaps. Do not inherit the plugin's permissive silent-skipping behavior. Unsupported export settings that would change the result must produce actionable failures rather than silently changing the model.
- Validate cube counts and output before atomic publication. Refuse an existing standalone destination, including one created during conversion, and never modify the input. Apply Blockbench's coordinate and model-unit conventions exactly once; do not apply the Blender axis conversion to Blockbench data.
- Provide versioned JSON results for Bedform subprocess integration, including destination, cube count, and diagnostics. Include package/protocol compatibility information in the version probe. Keep human-readable diagnostics off machine-readable stdout.

## Optional dependency, discovery, and setup

- Add `@bedform/blockbench: "^5.2.2"` to Bedform's `peerDependencies`, marked optional through `peerDependenciesMeta`. npm does not automatically install optional peers. ([npm package metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#peerdependenciesmeta))
- Resolve the converter from an explicitly configured `blockbench.packagePath`, then a project-local peer, then Bedform's own installation context, then npm's global package directory. Validate package identity, compatible version, entrypoint, and protocol. Invalid explicit configuration fails without fallback. Conversion and build commands never install packages implicitly.
- Launch the resolved JavaScript entry using Node and the shared hidden subprocess runner, with safe Windows argument handling, diagnostics, cancellation, and process-tree cleanup. Keep the fork outside Bedform's bundles and Bedrock runtime imports; integrate through its subprocess interface.
- Store machine settings at `%LOCALAPPDATA%\bedform\config.json`, using the shared atomic configuration writer and preserving unknown fields. Treat `blockbench.packagePath` as an absolute package-directory path. Configuration-only commands must not launch the converter.
- `setup blockbench` checks the global installation, installs a supported version satisfying the declared peer range through npm when missing or incompatible, verifies it, and atomically saves its package path in the existing machine configuration. Do not accept an incompatible latest release merely because npm offers it.
- Before installation or configuration changes, prompt with default **No**:

  > Install @bedform/blockbench globally and configure it? [y/N]

- `--yes` and `-y` skip that confirmation. Noninteractive use requiring changes fails without either flag. Declining makes no changes. Repeated healthy setup reports success without reinstalling or rewriting configuration. A valid local peer does not replace the requested global-install behavior of setup.
- Respect npm's configured global prefix and discover its actual package directory explicitly. Do not assume global packages resolve through local module imports, modify the global prefix silently, or depend on the executable shim being on `PATH` immediately after installation. ([npm folder layout](https://docs.npmjs.com/cli/v11/configuring-npm/folders/))
- The chosen package requires no postinstall step or elevation, so the confirmation needs neither notice. If implementation changes introduce either requirement, update the specification and prompt before accepting that change; briefly name any postinstall step in the confirmation and any elevated setup request. This plan does not authorize silently replacing the Node-only design with Electron.
- Report npm, network, permission, cancellation, and verification failures clearly. Do not silently elevate after a permissions failure. Persist configuration only after verification; if npm installation succeeds but later configuration fails, report that state and the remaining repair action accurately.

## Add-on build and saved-plan integration

- Extend the shared pipeline to stage `.bbmodel` inputs as sibling `.geo.json` files through the same validated converter used by `bedform convert`.
- Reject case-insensitive output collisions between `.blend`, `.bbmodel`, and existing `.geo.json` files before conversion, including two differently named source paths that map to the same staged destination. Exclude both source-model extensions from official packaging input.
- Require only the tools needed by discovered inputs: Blockbench-only builds need no Python, Blender, or Mcblend; Blender-only builds need no Blockbench fork; builds with neither source type need neither conversion stack.
- Preserve the base plan's owned `Intermediate\bedform` workspaces, conditional `.gitignore` update, official Microsoft build tasks, cancellation handling, diagnostic-workspace retention, and atomic archive-publication rules. Source models remain unchanged and failed builds preserve the previous published archive.
- Reconcile command documentation and the conversion, physics, and custom-model plans during the integration task. Keep `.bbmodel` conversion a geometry-export extension; do not expand particle rendering, mesh-solid physics, grabbing, or their prerequisite graphs.
- Preserve repository TSDoc, namespace-extracted nested-type, PascalCase constant, and script-owned identifier conventions in new code and generators. Keep host tools outside Bedrock runtime import paths.

## Beads work breakdown and dependencies

Use one dedicated Blockbench epic with this full specification embedded in its description and `spec_id` pointing to this file. Link it to `MineCraft-5sn` as related work; do not make the fork itself wait on Blender, spatial mathematics, physics, or particles. Each descendant needs a self-contained description, acceptance criteria, and the same specification link.

| Descendant | Responsibility | Prerequisites |
| --- | --- | --- |
| `MineCraft-gn5.1`: Node-only fork and exporter | Integrate the reference parser/exporter, audit fidelity, implement standalone CLI and JSON protocol, package prebuilt JavaScript and provenance without desktop dependencies or consumer build hooks. | None. |
| `MineCraft-gn5.2`: Bedform converter integration | Optional peer metadata, package discovery and validation, `.bbmodel` dispatch, subprocess protocol and shared publication behavior. | `MineCraft-gn5.1`; `MineCraft-5sn.1` shared CLI/config/process foundation. |
| `MineCraft-gn5.3`: Global Blockbench setup | Global npm installation, confirmation and aliases, verification, atomic configuration, idempotence, and failure handling. | `MineCraft-gn5.1`, `MineCraft-gn5.2`, and `MineCraft-5sn.1`. |
| `MineCraft-gn5.4`: Build and plan integration | Mixed-model staging, collision checks, tool isolation, archive source exclusion, and reconciliation of command documentation and affected saved plans. | `MineCraft-gn5.2`; `MineCraft-5sn.4` staging and `MineCraft-5sn.5` official packaging. |
| `MineCraft-gn5.5`: Disposable Windows qualification | Packed fork and setup on clean Windows x64 with Node 24/26 LTS, optional-peer isolation, no Electron/Bun/GUI/signing/UAC/consumer compilation, setup lifecycle and failure evidence. | `MineCraft-gn5.2`, `MineCraft-gn5.3`. |
| `MineCraft-gn5.6`: Packed official-build validation | Packed Bedform consumer outside the monorepo, mixed/isolated source types, official archive inspection, cancellation, collisions and publication preservation. | `MineCraft-gn5.4`, `MineCraft-gn5.5`. |

Update the existing shared CLI, staging, packaging, documentation, and packed-validation entries with additive Blockbench ownership/acceptance notes, preserving their original Blender requirements. Existing staging `MineCraft-5sn.4` must depend on the new converter-integration task. Existing final validation `MineCraft-5sn.8` must depend on the new packed official-build validation task. Keep `MineCraft-5sn.7` dedicated to its existing Blender/installer qualification. Do not replace existing dependency edges or introduce a cycle through the two epics.

All implementation and validation descendants remain open until their own acceptance criteria have been met. Planning alone does not establish conversion fidelity, installer behavior, packed-consumer success, or Bedrock runtime/client correctness.

## Validation and success criteria

- Verify parser compatibility, modern-format restrictions, unsupported newer/legacy formats, export flags, hidden geometry, hierarchy, mirrored axes, rotations, box/per-face UVs, locators, materials, identifiers, bounds, unsupported elements, deterministic output, existing-destination refusal, and unchanged source hashes on success and failure.
- Compare representative exports with fixtures established from the fork's Bedrock codec. Cover root cubes, nested/empty bones, export-disabled parents/children, layout normalization, and expected versus exported cube counts. A test that merely repeats the imported exporter is insufficient parity evidence.
- Test optional-peer absence, local/global discovery, explicit-path failures, protocol/version mismatches, space-containing paths, confirmation acceptance/decline, both confirmation flags, noninteractive behavior, repeated setup, and npm/configuration failures. Verify Bedrock runtime imports and Blender-only operations remain usable without the fork.
- Exercise packed packages outside the monorepo on clean Windows x64 with Node 24 and 26 LTS. Confirm operation without Electron, Bun, GUI windows, signing credentials, elevation, or install-time compilation. Inspect packaged files, runtime dependencies, and lifecycle scripts to support these claims.
- Cover Blockbench-only, Blender-only, mixed-model, and no-model builds; case-insensitive collisions; cancellation; preserved prior archives; and official archive inspection proving generated geometry is present and source models are absent.
- For the present planning delivery, read back the saved plan and Beads descriptions, verify specification links, acceptance criteria and dependency consistency, check for cycles, run Beads lint on affected issues, and run whitespace checks. Report these as planning checks rather than implementation evidence.

Success means the eventual packaged CLI converts supported modern Bedrock `.bbmodel` projects faithfully, optionally installs/configures the fork globally with the specified confirmation behavior, and integrates conversion into official add-on builds while preserving the existing Blender contracts. The fork is optional, headless, Node-only, and prebuilt for consumers. This planning delivery succeeds when the saved specification and durable epic/descendants consistently capture that work, with implementation still open and no deployment, git commit/push, or remote Dolt synchronization.
