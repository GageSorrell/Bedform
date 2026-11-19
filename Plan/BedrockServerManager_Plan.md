# BedrockServerManager CLI

## Summary

Create `Package/BedrockServerManager` as an npm workspace package named `bedrock-server-manager`. Both `bds` and `bedrock-server-manager` will point to `./Distribution/index.js`.

Use TypeScript, ESM, Effect 4.0.5, `effect/cli`, and `@effect/platform-node`, matching the repository. All filesystem operations and path manipulation—including test fixtures—will use Effect’s `FileSystem` and `Path` services. Use `fflate` for archive processing on byte arrays.

## CLI interface

Provide nested command help, version output, actionable errors, and nonzero exit codes on failure.

| Command | Behavior |
|---|---|
| `addon install <source>` | Install a local folder, `.mcpack`, `.mcaddon`, or `.zip`; enable its packs by default. Support `--no-enable`. |
| `addon list`, alias `ls` | Show installed bundles, IDs, versions, pack locations, and activation status in the selected world. |
| `addon show <addon>` | Show manifests, member packs, dependencies, installation locations, and remembered source. |
| `addon update <addon> [--source <path>]` | Replace a bundle using its remembered source or a replacement source; preserve activation state and update affected world references. |
| `addon remove <addon>`, alias `rm` | Disable the bundle in every affected world and remove its installed packs. |
| `addon enable <addon>` | Enable the bundle and its installed pack dependencies in the selected world. |
| `addon disable <addon>` | Disable the bundle in the selected world. |
| `addon validate [<addon>]` | Check manifests, pack dependencies, duplicate identities, missing script entrypoints, and world activation references. Without an argument, inspect the selected world’s inventory. |
| `addon export <addon> --output <file>` | Write a portable `.mcaddon` containing the bundle’s packs; refuse to overwrite an existing file. |
| `config get [<key>]` | Read one setting, or print all settings when no key is supplied. |
| `config set <key> <value>` | Validate and persist a setting. Also support `config set <key> --unset`. |

Addon commands accept:

- `--server <directory>` / `-s`: explicit server directory.
- `--world <name>` / `-w`: override the world selected by `level-name` in `server.properties`.
- `--scope shared|world`: select the pack location when necessary. Installation defaults to shared folders; discovery includes shared and selected-world packs.
- `--json` on `list`, `show`, and `validate` for machine-readable output.

Selectors accept the bundle ID printed by `ls`, a member pack UUID, or an exact unique name. Ambiguous selectors fail with matching candidates.

## Configuration and addon behavior

**User configuration**

Store nested JSON settings outside the npm installation directory:

- Windows: `%APPDATA%\bedrock-server-manager\config.json`.
- macOS: `~/Library/Application Support/bedrock-server-manager/config.json`.
- Linux: `$XDG_CONFIG_HOME/bedrock-server-manager/config.json`, falling back to `~/.config/bedrock-server-manager/config.json`.

Support `BDS_CONFIG_PATH` as an explicit file override for portable use and isolated testing. Initialize configuration only when writing; missing configuration is an empty object. Invalid existing JSON produces an error without overwriting it.

Initially register `server.path` as an optional, nonempty directory path. Resolve relative paths against the working directory when setting them and persist the absolute result. Reject unsupported keys.

Resolve the server as **explicit `--server` → saved `server.path` → actionable missing-path error**. Do not silently use the working directory. Configuration and help commands work without a server.

**Bundles and locations**

- Treat every installed source as one bundle, retaining its pack membership and absolute source path in a versioned per-server registry under `.bedrock-server-manager/`.
- Discover standalone pack folders, addon folders with `behavior_packs` and `resource_packs`, archive wrapper directories, and `.mcaddon` files containing nested `.mcpack` files.
- Recognize existing shared and world-local packs without requiring prior installation through this CLI. Present unregistered packs as standalone addons; updates can register them using an explicit source.
- Install shared packs into the server’s top-level pack directories. With `--scope world`, install into the selected world’s pack directories. Determine behavior/resource classification from manifest modules.
- Support stable manifest format 2, preserving unrecognized manifest fields. Reject unsupported pack kinds or manifest formats clearly.

**Activation and dependencies**

Use `world_behavior_packs.json` and `world_resource_packs.json` to manage activation. Preserve unrelated entries and their order; avoid duplicate registrations.

Enable installed UUID dependencies recursively, including valid mutually dependent pack groups. Missing or mismatched dependencies block activation. Treat `module_name` dependencies as scripting API requirements, report them, and do not attempt to install them.

Block disable or removal when another enabled addon requires the affected packs. Validate an update against every affected world before writing it. Shared-pack updates refresh references across all affected worlds; world-local updates affect their owning world.

An update preserves the bundle ID, may change pack membership, and retains enabled/disabled state per world. Require an explicit source when none was recorded. Refuse conflicting UUID ownership or ambiguous duplicate pack identities.

## Safety and verification

Validate the server directory and selected world before mutation. Require an existing world for activation; `--no-enable` permits shared installation before a world exists. Document that pack changes require a stopped server and take effect on its next start; process management is outside this version.

Stage changes before replacing installed files. Use a per-server mutation lock, rollback on handled failures, and temporary-file replacement for JSON writes. Never overwrite malformed activation files or conflicting installations implicitly.

Constrain archive extraction and mutation to validated destinations. Reject traversal, absolute archive paths, duplicate normalized entries, and source symlinks. Limit nested archives to four levels and total expanded content to 1 GiB.

Verify with fixture-based tests covering:

- Both executable names, nested help, aliases, invalid arguments, and error exit codes.
- Configuration persistence, platform locations, unset behavior, malformed files, and server-path precedence.
- Folder/archive installation, paired bundles, export/reinstall, and remembered-source updates.
- Shared and world-local discovery, dependency protection, activation idempotency, and cross-world version updates.
- Conflicts, missing worlds, unsafe archives, failed-write rollback, and concurrent mutation rejection.

Run package build, type checking, scoped repository lint, and tests. Inspect package contents with `npm pack --dry-run`, then smoke-test both executable names from an isolated packed installation.

## Delivery defaults

Add `build`, `typecheck`, `test`, and `prepack` scripts, package documentation, installation instructions, and command examples. Publish compiled `Distribution` files and the README; expose no public library API initially.

Before implementation, create and claim a Beads issue using `C:\Users\aethelbald\AppData\Local\Programs\bd\bd.exe`. Preserve existing unrelated changes, including lockfile edits. Do not modify the real server during verification, commit, publish, push, or perform Dolt remote sync.
