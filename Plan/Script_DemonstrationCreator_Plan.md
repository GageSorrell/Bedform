# Shared demonstration server creator

## Summary

Add a TypeScript tool under `Script/Demonstration` that creates a complete BDS directory containing a demonstration world and its packs. Creation never launches the server. A generated launch command starts it later and prints clear readiness, connection, and optional usage instructions.

Recreate the rubber sapling demonstration as the first integration. Leave the WorldRealism preview workflow unchanged.

## Creator interface and behavior

- Expose a reusable `createDemonstration(options)` API and a root `demo:create` command sharing the same implementation.
- Require nonblank `--name`, `--description`, and `--world` values. The world input is a prepared directory containing `level.dat`.
- Accept repeatable `--behavior-pack` and `--resource-pack` directory arguments, optional `--config` for demo-specific server configuration, and optional `--instructions` and `--ready-marker` strings.
- Resolve the engine from `--bds`, then `BDS_PATH`, then `BDS_ROOT`. Copy engine files and bundled vanilla content without copying unrelated worlds, custom packs, credentials, or server-manager state.
- Accept `--addon` to identify an add-on explicitly; otherwise infer it from the destination or current working directory. Default output to `<addon>/Demonstration/<descriptor>/server`; require `--output` when no add-on can be resolved.
- Support `--descriptor`. Automatically derive it from the name by lowercasing, replacing spaces and unsupported characters with hyphens, collapsing repeated hyphens, truncating to 40 characters, and trimming boundary hyphens. Reject an empty result.
- Configure the supplied world as the selected world, install and activate its supplied packs, and verify that referenced pack dependencies are present. Enable human connections, Creative mode, cheats, LAN visibility, and automatic server resource-pack delivery. Default IPv4/IPv6 ports to `19132`/`19133`, with explicit port flags available.
- Write versioned demonstration metadata containing the name, description, instructions, readiness marker, and launcher information.
- Automatically replace an existing tool-generated demonstration after backing up its complete server directory beside it. Refuse replacement of an unmarked directory or a running server. Validate resolved paths and source/output separation before copying or replacement.
- Stage creation before replacing the destination. Leave the previous server usable if preparation fails.

## Commands, ignore files, and firewall

- When the resulting server lies inside an add-on, add or update its `package.json` command as `demo:<descriptor>`. Limit the descriptor portion to 16 characters and trim a trailing hyphen, making the full command at most 21 characters. Add no further suffix.
- The command launches the generated server through the shared launcher using safely quoted, add-on-relative paths. Report explicitly whether the script was **added** or **modified**. Name collisions update the existing script without prompting.
- Also provide a root `demo:start -- --server <directory>` command and a generated Windows launcher for direct use.
- For output within `<addon>/Demonstration`, create the directory as needed and ignore it using this exact priority:
  1. Use the add-on root’s existing `.gitignore`.
  2. Otherwise, if the add-on is below the Git repository root, use that root’s existing `.gitignore`.
  3. Otherwise create `.gitignore` in the add-on root.
- Write a correctly anchored, relative ignore rule without duplicates. Apply this behavior only when the add-on belongs to a Git repository. Custom output outside `<addon>/Demonstration` leaves ignore files untouched.
- Register generated executable paths in ignored repository metadata and extend `firewall:configure` to cover those paths. Keep each demonstration’s executable path stable across recreation. Creation and launch never elevate; report the explicit firewall setup command when its rule is missing.

## Launch and readiness

- Keep BDS output visible, forward console input, support graceful shutdown, prevent concurrent launches of the same server, and propagate failures.
- Require BDS’s `Server started.` message. If `--ready-marker` was supplied, also require that literal marker from the demonstration’s setup code.
- Track the telemetry banner through its closing separator and print the ready messages afterward. When no telemetry banner appears, use a short 500 ms startup-output settling window. Decode partial lines correctly and announce readiness once.
- Use a 120-second startup deadline. An early exit or missing required marker fails without announcing readiness and shuts down the child cleanly.
- Emit these consecutive messages:
  - `DEMONSTRATION READY — <name>: <description>. The demonstration is ready for you to connect.`
  - Concise Minecraft Bedrock connection instructions containing the detected address and actual configured IPv4 port, including accepting the supplied resource packs.
  - Only when provided: `Instructions: <instructions>`.
- Detect the address at launch. Use active adapter addresses and Windows adapter/gateway metadata to exclude VPN and tunnel candidates; prefer LAN addresses beginning with `192.168`, then other private ranges, favoring adapters with a gateway. Do not hardcode the example address.
- Support an optional `--address` override. If no suitable LAN address exists, clearly label loopback connection instructions as usable only on the server machine.

## Rubber demonstration, guidance, and validation

- Add a repeatable rubber-demo preparation command that builds the current IndustrialCraft: Rewired packs, supplies a fresh world, and calls the shared creator.
- Use a separate demo fixture pack to prepare a small grass platform with spaced rubber saplings, set the arrival point, and give joining players bone meal and spare saplings. Emit the readiness marker after scene setup succeeds. Keep fixture code out of production packs.
- Supply prose instructions explaining how to grow the saplings and inspect the three-block leaf spire. State that no primer or separately installed client resource pack is required.
- Update both `AGENTS.md` and `CLAUDE.md` to require this tool for human verification and “check out” demonstrations. Encourage `--instructions` when the intended activity is unclear and require readiness markers for asynchronous setup.
- Document instruction style: clear, moderately concise prose; lists only for particularly broad or complex demonstrations or activities exceeding three steps. State prerequisites, including required primer documentation. Demonstrations must supply their resource packs through the server.
- Add focused tests for argument validation, descriptor truncation and collisions, script add/update reporting, ignore-file priority, backups and failed replacement, world/pack activation, network selection, and startup-message ordering—including split output, absent telemetry, delayed markers, and early exits.
- Run focused lint, tooling typechecks, and host tests. Smoke-test creation and the generated rubber-demo launcher with compatible BDS when available, confirming the readiness messages and graceful shutdown. Report client visual verification separately.
- Create and claim a Beads issue before implementation; preserve unrelated Bedform changes. Do not commit, push, or sync remote Beads data.
