# Add an interactive `bds start` console

## Summary

Add `bds start [-s|--server <directory>]` to `Package/BedrockServerManager`, using the existing explicit-server-before-saved-configuration resolution. Launch the selected BDS instance in the foreground with an Ink console containing scrollable output, a persistent command prompt, completion assistance, and a mode/keybinding footer.

Require interactive stdin/stdout. `stop` and `/stop` are the only interactive ways to shut down the server and exit; Ctrl+C is blocked.

## Process lifecycle and CLI

- Resolve and validate the server directory without requiring an existing world. Run its native `bedrock_server.exe` on Windows or `bedrock_server` on Linux, with that directory as cwd, piped stdio, and no shell. Preserve the environment and prepend the server directory to Linux’s `LD_LIBRARY_PATH`. Reject unsupported platforms and missing/non-executable binaries before launch.
- Prevent duplicate starts using an exclusive per-instance runtime lock and native process inspection: executable paths through Windows CIM or Linux `/proc`. Match canonical paths, case-insensitively on Windows. Refuse launch when a matching process exists or its identity cannot safely be determined.
- Serialize startup against addon transactions and hold the existing mutation lock during the server session, preventing cooperating CLI processes from changing packs while BDS runs.
- Record CLI/server PIDs in runtime metadata. Release owned locks after the child closes or spawning fails; retain uncertain crash leftovers with actionable recovery instructions.
- Decode stdout/stderr incrementally, including split UTF-8 characters and unfinished lines. Send submitted commands directly to stdin with backpressure handling; trim outer whitespace, remove one initial `/`, ignore empty commands, and preserve argument contents.
- After submitting `stop`, continue displaying output until the child closes. Restore terminal state, release resources, print a final exit summary, and propagate failure status. Do not implement automatic restart, detach, or an interactive force-kill shortcut.
- Ensure raw-mode Ctrl+C and SIGINT cannot trigger Ink or Effect’s default exit behavior during the console session. Handle external termination or terminal loss through graceful child cleanup; these are abnormal lifecycle events, not interactive exit commands.

## Console and editing

- Use pinned, compatible dependencies: Ink 7.1.1, React 19.2.9, and `ink-scroll-view` 0.4.0, plus `@byteland/ink-scroll-bar`. The scroll-view release explicitly supports Ink 7. ([Compatibility](https://github.com/ByteLandTechnology/ink-scroll-view#-compatibility))
- Render in Ink’s alternate screen, sized to the terminal: output viewport and scrollbar above a horizontal border, then completion assistance, command input, and persistent footer.
- Keep a PowerLine-inspired segmented prefix beside the input cursor, showing `BDS` and the instance name. Use standard Unicode chevrons without requiring a patched font.
- Implement a custom input editor with cursor movement, Home/End, deletion, word movement, selection replacement, and session history. Shift+Left/Right extends selection by grapheme; Shift+Up/Home and Shift+Down/End extend to the respective input boundary. Highlight selection and keep long input horizontally scrolled around the cursor.
- Treat pasted text as editable input; pasted line breaks become spaces and never execute commands automatically.
- Use named colors for prompt segments, focus, command descriptions, and notices. Detect color capability, including truecolor, respect `NO_COLOR`/`FORCE_COLOR`, and retain readable monochrome styling.
- Bound scrollback to 10,000 lines or 4 MiB, whichever is reached first, and batch output updates. Preserve the viewed position when scrolled upward; resume following when navigation reaches the bottom. Show a new-output count while paused.
- Adapt to resizing and small terminals by shrinking completion assistance and compacting footer hints while preserving the prompt and mode indicator.

| Context | Keys | Behavior |
|---|---|---|
| Either pane | `^W k` / `^W j` | Focus output / input |
| Output | `j`, `k`, arrows | Scroll one row |
| Output | `gg`, `G` | Oldest output / bottom and follow |
| Output | `^U`, `^D` | Half-page scrolling |
| Output | `^B`, `^F`, PageUp/PageDown | Full-page scrolling |
| Output | Escape or `i` | Return to input |
| Input | Up/Down | Browse session history |
| Either pane | `^C` | Block interruption and display guidance |

The footer always identifies `INPUT` or `OUTPUT` and displays context-sensitive bindings using caret notation. Every Ctrl+C adds an explanatory scrollback entry and shows `^C ignored. Use stop instead.` for four seconds. Style `^C` as a keybinding and `stop` as a command; repeated presses refresh the notice without clearing input or selection.

## Completion behavior

- Maintain an offline catalog of Bedrock command names, aliases, descriptions, and usage, sourced from Microsoft’s command reference and shipped BDS documentation. Permit unknown commands and arguments unchanged. ([Command reference](https://learn.microsoft.com/en-us/minecraft/creator/commands/commands?view=minecraft-bedrock-stable))
- Complete common arguments: documented subcommands and enums for server administration, difficulty, gamemode, time, weather, and gamerules; offer selectors in recognized target positions.
- Make matching case-insensitive and aware of quoting, cursor position, and an optional initial slash.
- Tab/Shift+Tab cycles matching replacements for the token under the cursor without submitting.
- Ctrl+Space opens a bounded selectable list with descriptions and usage. Arrows navigate, Enter accepts without executing, and Escape dismisses it.
- Show dim inline suggestions at the end of input when there is no selection. Prefer matching session history, then catalog completions. Right Arrow accepts the entire suggestion only at the input’s end; elsewhere it moves the cursor.
- Keep history in memory for the current session. Full argument grammars and dynamic player/item discovery are outside this version.

## Integration and validation

- Before implementation, create and claim a Beads issue. Preserve existing unrelated changes, including edits already present in the root lockfile.
- Separate process supervision, editor/completion state, and Ink components into testable modules. Enable TSX compilation and update packed-file checks to include compiled TSX modules. Keep the package CLI-only with no new public library exports.
- Update help and README with startup examples, platforms, terminal requirements, lock recovery, completions, keybindings, and shutdown behavior.
- Test server selection, executable validation, duplicate processes, concurrent starts, lock cleanup, spawn failures, stdin backpressure, split output, child failure, and `/stop` normalization using controlled process fixtures.
- Test editing and selection with Unicode, history restoration, completion replacement ranges, menus, ghost acceptance, and paste handling.
- Use Ink tests with controllable terminal streams to verify focus routing, cursor placement, persistent layout, resizing, scrolling/follow behavior, bounded output, colors, and Ctrl+C notices. Exercise actual Ctrl+C bytes and SIGINT to catch runtime-handler interference.
- Run the package’s full `verify` command and extend packed-installation checks for both executable aliases.
- Manually verify Windows Terminal/PowerShell and a modern Linux terminal. Any real BDS test must use the repository’s addon runners and fixed executable paths without elevation.

Assumptions: foreground operation only; session-only history; no macOS BDS execution; no commits, pushes, or remote Dolt sync.
