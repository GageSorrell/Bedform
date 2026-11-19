# Offline console command hints

`Source/command-catalog.ts` is a static advisory catalog, checked on October 26,
2026. It never queries players, scans item registries, validates commands, or
limits what can be sent to BDS. Command availability depends on the server
version, enabled features and permissions. Usage hints abbreviate complex
overloads with `arguments…`; use `help <command>` on the selected server for its
complete syntax. Editor-only commands in Microsoft's list remain advisory.

Sources:

- [Microsoft command index](https://learn.microsoft.com/en-us/minecraft/creator/commands/commands?view=minecraft-bedrock-stable)
  for command names and brief functional descriptions. Each catalog entry links
  to its command page; aliases also come from those pages and the `help` enum.
- Command-specific pages for
  [allowlist](https://learn.microsoft.com/en-us/minecraft/creator/commands/commands/allowlist?view=minecraft-bedrock-stable),
  [permission](https://learn.microsoft.com/en-us/minecraft/creator/commands/commands/permission?view=minecraft-bedrock-stable),
  [difficulty](https://learn.microsoft.com/en-us/minecraft/creator/commands/commands/difficulty?view=minecraft-bedrock-stable),
  [gamemode](https://learn.microsoft.com/en-us/minecraft/creator/commands/commands/gamemode?view=minecraft-bedrock-stable),
  [time](https://learn.microsoft.com/en-us/minecraft/creator/commands/commands/time?view=minecraft-bedrock-stable),
  [weather](https://learn.microsoft.com/en-us/minecraft/creator/commands/commands/weather?view=minecraft-bedrock-stable),
  [gamerule](https://learn.microsoft.com/en-us/minecraft/creator/commands/commands/gamerule?view=minecraft-bedrock-stable),
  and [target selectors](https://learn.microsoft.com/en-us/minecraft/creator/documents/targetselectors?view=minecraft-bedrock-stable)
  for the bounded argument hints. Selectors can require an entity, position or NPC
  execution context; offering one does not assert it can resolve from the server
  console. Numeric gamerule values and arbitrary remaining arguments stay free text.
- The local `C:/MineCraft/Server/bedrock_server_how_to.html`, accompanying BDS
  **1.26.52.3**, supplies server administration syntax, including `serveridentity`.
  SHA-256: `a3559a8ce6ebe10089a3b6715c9537b00d327d083770f45a306eab52e248dac6`.
  The document was read without launching the server; original files were preserved.

To refresh hints, compare these sources with the target BDS release, update the
catalog/provenance, and run the completion tests and package `verify` command.
Do not infer Java-only commands or gamerules, dynamic player names, or a full
argument grammar from these hints.

The controller calls `dispatchCompletion` before editor and Enter handling.
Only a result with `handled: false` can reach ordinary editing/submission.
Pastes and external editor changes should clear completion state. Menu rows are
bounded and shrink to the supplied terminal budget. Inline suggestions are
suppressed during selection and away from the input end; accepting one appends
the entire suffix even if only its first columns fit in the viewport.
