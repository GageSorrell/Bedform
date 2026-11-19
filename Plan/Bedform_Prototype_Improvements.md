# Quick BDS prototype projects

## Summary

Add a Windows-only command:

```text
bedform prototype <directory>
  [--preview|-p[=true|false]]
  [--beta|-b[=true|false]]
  [--name|-n <name>]
  [--spawn-item[=true|false]]
  [--server-properties|-s <file>]
```

Creation produces `Addon/` and `Server/`, installs dependencies, builds the add-on, prepares a fresh flat world, and leaves BDS stopped. Running `npm start` from the generated root rebuilds and installs the add-on before opening an interactive BDS console.

Defaults: Preview off, Beta APIs off, spawn item on.

## Creation and development workflow

- Invoke the official Creator Tools CLI noninteractively with its `tsStarter` template. Remove the starter’s periodic greeting and example behavior. Use a pinned, tested Creator Tools dependency rather than requiring a global installation. [Official CLI reference](https://github.com/Mojang/minecraft-creator-tools/blob/main/plugins/minecraft/skills/creator-tools-cli/references/commands.md)
- Use the supplied name for server and add-on display names. Otherwise call `Make()` from `bedform/Utility/Name` with no argument. Derive valid package identifiers separately from the display name.
- Resolve paths relative to the caller. Require a nonexistent destination; refuse existing files or directories. Validate arguments before downloads or scaffolding.
- Download the current official Windows BDS release for the selected channel. Cache archives by version and channel, validate archive paths, and record the download URL and hash. Preserve the release’s bundled engine files and stock packs.
- Reuse the shared development build pipeline and provision a fresh native flat world with grass at Y=63. Configure flat generation before creating its chunks; never flatten a finite area or copy an existing user world.
- Add a host-only `bedform/Prototype/Server` export with creation/start operations and documented options. Keep host dependencies outside Bedrock runtime exports.
- Generate root build/start scripts using that host API. Include the invoking Bedform package as a local tarball dependency so projects created from an unpublished checkout remain usable independently of that checkout.
- Starting refuses an already-running server, builds before replacing installed packs, and preserves the world and server configuration. Failed builds leave previous installed packs intact. Console input remains interactive; `stop` and Ctrl+C save and shut down gracefully.
- Record relative project paths, engine/API versions, pack identities, and creation options in versioned metadata. Starting does not automatically upgrade the engine or dependencies.

## Spawn item and API selection

- With spawn-item enabled, generate an unstackable custom item using vanilla compass visuals and editable no-op `OnUse` and `OnUseOn` handlers registered through an item custom component.
- On each connection, reuse an existing trigger item or add one, then select its hotbar slot. Preserve displaced items; if inventory is full, drop the displaced stack visibly rather than delete it.
- With spawn-item disabled, omit the item, handlers, and join subscription; retain an empty TypeScript entrypoint.
- Stable mode uses compatible stable scripting APIs without enabling Beta APIs.
- Beta mode includes compatible versions of `server`, `server-ui`, `server-net`, `server-admin`, `server-gametest`, and `debug-utilities`, plus required supporting type packages. Editor-only modules are excluded.
- Resolve exact typings and manifest versions against the selected engine, independently of the Preview flag. Validate them with a native import probe instead of trusting npm’s moving `beta` tag.
- Enable required world experiments and grant permissions specifically to the generated script module UUID. [BDS scripting configuration](https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockserver/scripting?view=minecraft-bedrock-stable)

## Server properties and saved defaults

Add:

```text
bedform config set prototype.server-properties <file>
bedform config get prototype.server-properties
bedform config unset prototype.server-properties
```

- Store a user-wide snapshot under `%LOCALAPPDATA%/bedform/`; subsequent changes to the original file do not affect it. Validate before atomically replacing an existing snapshot.
- `get` prints the absolute stored-file path followed by its contents. An unset value produces a clear diagnostic and nonzero exit status.
- Choose properties in this order: explicit flag, stored snapshot, selected BDS release’s stock file.
- Preserve supplied properties, comments, unknown keys, and formatting. Override only `level-name` to select the generated world and any engine setting necessary for flat generation; report overrides.
- For stock properties, additionally set the chosen server name, Creative mode, Peaceful difficulty, cheats, resource-pack delivery, and content logging. Preserve stock authentication and port settings.
- Creation/start never elevate or silently change firewall rules. Tests retain `Package/Bedform/dist/bds-runtime/bedrock_server.exe`; document Windows firewall setup for generated server paths.

## Validation and boundaries

- Test required paths, aliases, boolean forms, malformed/repeated flags, generated names, existing-destination refusal, and failures during download/scaffolding.
- Test snapshot copying, replacement, retrieval, removal, precedence, and preservation of custom properties.
- Verify generated projects through an independently installed Bedform tarball, including paths containing spaces and operation outside the repository.
- Run native BDS checks for all four Preview/Beta combinations, flat terrain beyond spawn, module loading, item issuance/use, clean shutdown/restart, and preservation after rebuilding.
- Verify compass appearance and physical use input separately in a real client.
- Run Bedform’s full verification gate and follow repository documentation/key conventions.
- Track implementation in Beads, preserving existing edits. This work does not require the larger Prototype editor, demonstration manager, watch mode, Linux support, or automatic engine updates.

## Beads implementation references

Epic **`MineCraft-1gi8`** contains this specification. Beads is authoritative for issue status, acceptance evidence, and dependencies; saving this plan does not complete implementation.

| Issue | Work | Prerequisites |
| --- | --- | --- |
| `MineCraft-1gi8.1` | CLI parsing and host contracts | None |
| `MineCraft-1gi8.2` | User-wide server-properties snapshots and property preservation | None |
| `MineCraft-1gi8.3` | Official Windows stable/Preview BDS provisioning and caching | None |
| `MineCraft-1gi8.4` | Fresh native flat worlds and engine-compatible APIs | `.3` |
| `MineCraft-1gi8.5` | Official TypeScript starter and optional compass trigger | `.1`, `.4` |
| `MineCraft-1gi8.6` | Portable projects, orchestration, and build-on-start launchers | `.1`, `.2`, `.4`, `.5` |
| `MineCraft-1gi8.7` | Host/packed-consumer verification and documentation | `.6` |
| `MineCraft-1gi8.8` | Four engine/API combinations in fixed-path native BDS | `.7` |
| `MineCraft-1gi8.9` | Real-client compass visuals and physical input acceptance | `.8` |

Unqualified `.n` entries refer to children of `MineCraft-1gi8`. Compatible provisioning groundwork may be shared with `MineCraft-s80.9`; the larger demonstration-world epic remains separate.
