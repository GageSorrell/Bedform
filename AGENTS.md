# Agent Instructions

## TSDoc conventions

Use only `MAJOR.MINOR.PATCH` in symbol-level `@since` tags. Prerelease suffixes (`-alpha.*`, `-beta.*`, `-rc.*`, or any other prerelease identifier) and build metadata (`+...`) must never appear in `@since` tags; for example, package version `1.0.0-alpha.1` uses `@since 1.0.0`.

Give every symbol flagged by `jsdoc/require-jsdoc` a TSDoc comment. Do not use `@param` or `@returns`; describe relevant behavior in prose. For `@throws`, state the type in braces with spaces inside, for example `@throws { Error }`. End every symbol-level TSDoc comment with a blank line, an appropriate `@category` tag, and then `@since` with the current version of the relevant add-on or package from its `package.json`. Never use `@category` or `@since` in a module's TSDoc header comment; those tags describe symbols only.

### TSDoc `@category` Conventions

When writing or modifying TSDoc comments for public APIs, follow the semantic categorization conventions used by the [Effect](https://github.com/Effect-TS/effect) TypeScript library, with the naming rules defined below taking precedence.

The purpose of `@category` is to organize exported APIs into meaningful, consistent groups based on their **semantic purpose**, rather than their implementation details, names, or source locations.

#### Naming Rules

- Use exactly one `@category` tag per documented public API.
- **Always use `PascalCase`** for category names (e.g., `Constructor`, `Mapping`, `UtilityType`).
- **Prefer singular nouns** over plural nouns (e.g., `Model` instead of `Models`, `Guard` instead of `Guards`, `Constant` instead of `Constants`).
- Use plural nouns only when the singular form would be semantically incorrect, unnatural, or misleading.
- Prefer **gerunds** for families of operations (e.g., `Mapping`, `Filtering`, `Converting`, `Combining`).
- Use `PascalCase` for multiword categories, without spaces or separators (e.g., `ErrorHandling`, `ResourceManagement`, `UtilityType`).
- Preserve conventional acronym capitalization where appropriate (e.g., `TypeID`, `JSONSchema`).
- Reuse established category names across packages whenever their meanings are equivalent.
- Do not create a new category when an existing category accurately describes the API.
- Avoid vague categories such as `Utility`, `Helper`, `Common`, `Miscellaneous`, or `Other`.
- Do not use the enclosing module, namespace, or package name as the category merely because the API belongs to it.

#### Common Categories

Prefer these categories when applicable:

- **Types and definitions:** `Model`, `UtilityType`, `Schema`, `Interface`, `Symbol`, `TypeID`
- **Creation and values:** `Constructor`, `Constant`, `Instance`, `Factory`
- **Inspection and extraction:** `Guard`, `Predicate`, `Getter`, `Accessor`
- **General operations:** `Combinator`, `Mapping`, `Filtering`, `Combining`, `Merging`, `Zipping`, `Sequencing`, `Folding`, `Splitting`
- **Transformations:** `Converting`, `Transforming`, `Encoding`, `Decoding`, `Serialization`
- **Control flow:** `Generator`, `PatternMatching`, `ErrorHandling`, `Repetition`, `Running`
- **Effect and dependency management:** `Service`, `Tag`, `Layer`, `Context`, `ResourceManagement`
- **Additional concepts:** `Error`, `Configuration`, `Annotation`, `Tracing`, `Metric`, `Logging`, `Testing`

These categories are examples, not an exhaustive or mandatory list. Prefer a more specific established category when it better communicates the API's purpose.

#### Semantic Distinctions

Choose categories according to what the API does or represents:

- `Model`: Types, interfaces, and classes representing domain data or primary API structures.
- `UtilityType`: Type-level transformations, extraction helpers, and other TypeScript type utilities.
- `Schema`: Schema definitions, builders, and schema-related APIs.
- `Constructor`: Functions or values used to create instances of a type or abstraction.
- `Factory`: Functions that produce or configure objects, services, or other reusable abstractions.
- `Combinator`: Functions that compose or combine abstractions when no more specific operation category is appropriate.
- `Guard`: Functions that narrow TypeScript types through type predicates.
- `Predicate`: Functions that test conditions and return booleans without necessarily narrowing types.
- `Getter`: Functions that retrieve or extract values.
- `Accessor`: Functions that provide access to contextual services or environmental dependencies.
- `Converting`: Functions that convert between representations or abstractions.
- `Mapping`: Functions that map or transform contained values while preserving the surrounding abstraction.
- `Filtering`: Functions that selectively retain, remove, or partition values.
- `Error`: Error types, classes, and data structures.
- `ErrorHandling`: Functions that recover from, catch, or otherwise handle failures.
- `Service`: Service abstractions and contracts.
- `Tag`: Dependency-injection tags identifying services.
- `Layer`: Definitions that construct or provide services and their dependencies.

#### Choosing a Category

Before assigning an `@category`:

1. Determine the API's primary purpose from its public contract and behavior.
2. Examine related exports in the same module and neighboring modules for established categories.
3. Prefer an existing, semantically accurate category over introducing a new one.
4. When multiple categories are plausible, choose the one that most accurately describes how consumers use the API.
5. Prefer the singular form of a noun unless the singular would be unnatural, misleading, or semantically incorrect.
6. Introduce domain-specific categories only when they represent a meaningful, reusable group of related APIs and improve documentation navigation.
7. Keep category terminology consistent across the entire monorepo, including package boundaries.

**Do not invent categories merely to make an API appear uniquely classified.** Categories should represent coherent families of APIs, not individual functions.

#### Examples

```ts
/**
 * Creates a new instance.
 *
 * @category Constructor
 */
export const make = ...

/**
 * Determines whether the value satisfies a type predicate.
 *
 * @category Guard
 */
export const isSome = ...

/**
 * Maps a function over the contained value.
 *
 * @category Mapping
 */
export const map = ...

/**
 * Filters values according to a predicate.
 *
 * @category Filtering
 */
export const filter = ...

/**
 * Represents the configuration of a service.
 *
 * @category Model
 */
export interface ServiceConfig
{
    // ...
}

/**
 * Represents an error encountered during parsing.
 *
 * @category Error
 */
export class ParseError
{
    // ...
}
```

When modifying existing documentation, preserve established categories unless they are incorrect or inconsistent with these conventions. If an existing category uses lowercase, spaces, or an unnecessarily plural noun, normalize it to the prescribed `PascalCase`, singular-preferred form.

## TypeScript module headers

Every TypeScript module in `Addon/` and `Package/`, including tools, tests, TSX and declarations, must begin with a TSDoc header containing a meaningful description specific to that module:

```ts
/**
 * Strict rigid Bedrock cuboid ingestion and one-time coordinate conversion.
 *
 * @module bedform/Build/Geometry
 *
 * @file      Geometry.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
```

Set `@module` to the owning `package.json` name followed by the module's path relative to its `src/` or `Source/` directory. When there is no such source directory, use the path relative to the package root, retaining directories such as `Script/`, `Test/`, `Tool/` or `Public/`. Use forward slashes, omit the TypeScript extension (including `.d.ts` or `.d.mts` for declarations), and retain filename components such as `.generated`, `.test` and `.types`. Set `@file` to the actual filename, including its extension. Align the values of the final four tags exactly as shown. The `@author` and `@copyright` lines must always be exactly as shown, including the fixed year 2026. Preserve the applicable license and any upstream attribution separately. Never put `@category` or `@since` in a module header. Keep an executable's required shebang as the first line, immediately followed by its module header; otherwise the header is the first content, before imports, lint directives and reference directives.

## Auto-generated TypeScript module headers

Every new or modified generator that emits TypeScript modules belonging to this monorepo must emit the following header at the very beginning of each module. This includes generated declarations and modules internal to packages such as Bedform. Bedform generators that emit modules for arbitrary consumer add-ons are outside this requirement.

```ts
/**
 * A meaningful description of the module.
 *
 * This module is auto-generated by Tool/generate.mts.
 *
 * @module PACKAGE_NAME/PATH/FROM/PACKAGE/ROOT/TO/MODULE/WITHOUT/FILE/EXTENSION
 *
 * @file      FILE_NAME.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint-disable */

export const Example = "generated code starts here";
```

Use the actual generator's path relative to its add-on or package root in the auto-generation note. Set `@module` and `@file` according to the TypeScript module header rules above, stripping a leading `src/` or `Source/` directory from the output path. Always emit exactly `@author    Gage Sorrell <gage@sorrell.sh>` and `@copyright (c) 2026 Gage Sorrell`. Module headers must not contain `@category` or `@since` tags.

Preserve the blank comment line between the auto-generation note and `@module`, the blank line after the closing TSDoc comment, and the blank line after `/* eslint-disable */` before generated code. Implement the header in the generator itself, then regenerate tracked outputs; editing only generated files is insufficient. Keep the blanket lint exemption even when a particular generated module currently has no lint violations, and configure unused-disable reporting for the generated output if necessary.

## Nested object types

Do not give a property of an interface or object type alias an inline object type. Declare that type as an interface in a namespace with the same name as the containing type, placed directly above the containing type and its TSDoc comment, and use it as `Owner.Member`:

```ts
export namespace Settings
{
    /**
     * Server settings; unknown existing fields are retained on writes.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Server
    {
        path?: string;
    }
}

/** Nested user settings. */
export interface Settings
{
    server?: Settings.Server;
}
```

- Name the interface after the property in PascalCase: `"minecraft:block_placer"` becomes `MinecraftBlockPlacer`.
- Apply the rule recursively. An object type inside an extracted interface goes in a nested namespace named after that interface, referenced from it as `Server.Member`.
- Export the namespace exactly when the containing type is exported; TypeScript requires merged declarations to agree. The interfaces inside are always exported, so each one needs TSDoc as described above.
- Put the namespace's opening brace on its own line. Write the interface body in the surrounding file's brace and line style.
- If a file is generated, change its generator to emit the same declarations.
- A type declared inside a function cannot merge with a namespace, so leave such a type as it is.

## Identifier constants

Name constants in PascalCase, never UPPER_SNAKE_CASE.

Write each key that scripts own exactly once, as a member of an exported record that is frozen and `as const`. Everywhere else, import the record instead of repeating the string literal:

```ts
export const EntityProperty = Object.freeze({
    Sequence: "bedform:physics_sequence",
    Reset: "bedform:physics_reset"
} as const);

entity.setProperty(EntityProperty.Sequence, sequence);
```

- Script-owned keys are dynamic-property identifiers and prefixes, tag and ticking-area prefixes, script-event identifiers, scoreboard objectives and server-variable names.
- Group keys by kind (`EntityProperty`, `DynamicProperty`, `DynamicPropertyPrefix`, `TagPrefix` and so on) in the package's or add-on's `keys.ts` next to its scripts, such as `Package/Bedform/Source/keys.ts`. Keys that only GameTests use go in `GameTest/keys.ts`. Keys of a public contract that other packs consume go in that contract's `Public/` module.
- Build a suffixed key from its prefix member, for example `DynamicPropertyPrefix.Machine + id`.
- Worlds store dynamic-property keys. Changing a key's text changes saved data, so migrate the existing worlds in the same change, after backing them up.
- A single identifier constant that belongs to no group is a PascalCase string `as const`, for example `export const Probe = "bedform:probe" as const;`. Content identifiers defined by pack JSON, such as block, item and entity IDs and block-state names, may stay literals.

## Windows test servers

Run BDS tests through the package runners. Windows Firewall approval is tied to the executable path: use each runner's fixed `dist/bds-runtime/bedrock_server.exe`, never a fresh executable path per test run. `Package/Bedform`, `Package/Effect` and `Addon/BedformCanvas` are covered by `npm run firewall:configure` at the repository root. This explicit one-time setup installs program-specific allow rules and requires Windows administrator approval; ordinary tests must not elevate. Repeat setup after moving the repository. See [test firewall setup](Script/TestFirewall.md). Preserve this fixed-path design when adding or changing test runners.

## Text rendering in the world

Before writing code that places, measures or styles `TextPrimitive` text (Bedform's terminal and Diagetic displays included), read [Rendering text with `TextPrimitive`](Documentation/TextPrimitive.md): fonts and widths, line layout, limits, yaw, depth, custom glyph pages and the two-layer fine-pixel overlay. Add new client findings there.

## Repository layout

- `Package/Bedform` is `bedform`, the framework and CLI. `Package/Effect` is `@bedform/effect`, the self-contained Effect port that every Bedform package builds on.
- `Package/Cinnabar` is the vendored Cinnabar Rust/Go native client fork, not an npm mirror. Its source, licenses, build conventions and checked compatibility manifest live together there. Native outputs, downloaded game assets, authentication data and captures stay untracked; native support requires the exact loader/SDK compatibility gate to pass.
- Every other directory directly under `Package/` (except `Deprecated/`) is a `@bedform/<name>` mirror of an `@minecraft/<name>` npm package. A mirror re-exports its first-party counterpart, and Bedform's extensions to that module live in the mirror. For example, `@bedform/server` exports everything from `@minecraft/server`, with Bedform's extended `world` and `InputButton` shadowing the native ones.
- `Addon/BedformCommon` and `Addon/BedformCanvas` are the packs that `bedform` ships as `Asset/*.mcaddon`. Their builders and `Package/Bedform` import each other through relative paths, so keep `Package/Bedform` and `Addon/Bedform*` side by side. The other add-ons are demonstrations and probes of Bedform features.
- `Package/Deprecated/*` and `Script/Deprecated/*` are kept for reference and for existing consumers, such as the MineCraft monorepo's install pipeline, which uses the published `bedrock-server-manager`. Do not build new features on them.

## Build & Test

Use Node 24.19.0 and run `npm install` at the repository root. Then:

- `npm run verify --workspace bedform`, `npm run verify --workspace @bedform/effect` and `npm run verify --workspace @bedform/server` run each package's typecheck, tests and lint.
- `npm run typecheck:tools` typechecks the root `Script/` tools and every workspace's tools.
- `npm run mirrors:sync` creates any missing mirror and rewrites existing mirrors' versions, their exact first-party pins and the workspace pins that depend on them. It never touches mirror sources, so hand-written extensions survive. `npm run mirrors:sync -- --check` fails if anything is out of date.
- `node --import tsx ../../Script/bump-version.mts` (from an add-on directory) bumps the add-on's `package.json` and pack manifests together, because clients reuse a cached pack whose UUID and version are unchanged. Validators read the expected version from `package.json`, so never hard-code a pack version in tooling.

### Branches, versions and publishing

- `Master` is the default branch. Its mirrors are versioned `<first-party version>-dev.N` and publish under the npm `dev` tag.
- `Beta` carries the same code with mirrors versioned `<first-party version>-beta.N`, published under the npm `beta` tag. Merge `Master` into `Beta`, then run `npm run mirrors:sync` on `Beta` to restore its suffixes.
- A mirror's first-party version is that package's `latest` release when it is stable, and its `beta` release otherwise, with the suffix appended to the full version (for example `1.0.0-beta.1.26.66-stable-dev.1`). Symbol-level `@since` tags in a mirror use the `MAJOR.MINOR.PATCH` of the mirror's version, such as `@since 2.11.0` in `@bedform/server`.
- Publish with `npm run publish:packages` from a clean `Master` checkout, then again from `Beta`. It publishes dependencies first (`@bedform/effect`, then the mirrors, then `bedform`, then `bedrock-server-manager`), skips versions already on npm so an interrupted run can be repeated, and tags mirrors with the branch channel. Other prereleases publish under their prerelease identifier, such as `alpha`; releases under `latest`. Add `-- --dry-run` to preview.

This project uses **bd** (beads) for issue tracking. Run `bd prime` for full workflow context.

> **Architecture in one line:** Issues live in a local Dolt database
> (`.beads/dolt/`); cross-machine sync uses `bd dolt push/pull` (a
> git-compatible protocol), stored under `refs/dolt/data` on your git
> remote — separate from `refs/heads/*` where your code lives.
> `.beads/issues.jsonl` is a passive export, not the wire protocol.
>
> See [sync-concepts](https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md)
> for the one-screen overview and anti-patterns (don't treat JSONL as the
> source of truth; don't `bd import` during normal operation; don't
> reach for third-party Dolt hosting before trying the default).

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd dolt push          # Push beads data to remote
```

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:1105d646 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->
