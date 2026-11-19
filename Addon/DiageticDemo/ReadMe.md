# Diagetic demonstration

A small, self-contained BDS world for trying Bedform's Diagetic levers, sliders and
wheels. It runs from its own server directory and uses its own copy of the engine,
so it never touches `C:\MineCraft\Server` or its worlds.

## Start it

From the repository root:

```sh
npm run demo:diagetic --workspace @sorrell/diagetic-demo
```

Or run `Start Demonstration.cmd` in `Addon/DiageticDemo/Demonstration/diagetic/server`.
The console shows the LAN address and port (19132) once the scene is ready. Enter
`stop` or press Ctrl+C to save and shut down. On first use, run
`npm run firewall:configure` from an administrator-approved prompt so Windows
Firewall admits the demonstration's fixed `bedrock_server.exe`.

Connect from Minecraft and accept the resource packs. Players join as operators in
creative mode.

## What to try

Walk south from spawn.

- **First row:** a floating block for each built-in control, with one on each of
  its six faces. Look at a control, press **Use** to grab it, drag with the mouse
  or right stick, then press **Use** again to let go. The action bar shows the
  release prompt while you hold a control. Empty-handed Use releases even when
  your native aim has moved into air.
- **Desk:** free controls that are tilted toward you, rolled and turned. These
  check the free-pose path.
- **Wall:** tuned controls with their own entity types. The heavy lever lags your
  hand and lights the lamp above it. The throttle springs back to zero when you let
  go and fills the gauge. The dial has 45° detents and stops after two turns either
  way. Name tags show each value.

Place more built-in controls with
`/scriptevent bedform:diagetic_place lever` (or `slider` or `wheel`). It binds to
the block face you are looking at; add `free` to float one in front of you.
Breaking the supporting block removes a bound control.

With two players, each can hold one control at a time and both see the motion.

## Rebuild it

```sh
npm run demo:prepare --workspace @sorrell/diagetic-demo
```

Set `BDS_PATH` to an extracted stable BDS installation before preparing the server
when `C:\MineCraft\Server` is unavailable. For example, in PowerShell,
`$env:BDS_PATH = "C:\path\to\bedrock-server"`.

This rebuilds BedformCommon and the demo packs, then recreates the server from the
tracked `TestWorld/level.dat` flat creative world seed. A previous server directory is kept as a timestamped backup. The
server must be stopped first. The scene is built once, on the first start. The
world seed, scene source, server configuration and launcher tooling are tracked in
git. Running server files and player saves live in the ignored `Demonstration/`
directory.

`npm run check --workspace @sorrell/diagetic-demo` runs lint, typechecks and host
tests of the layout and built packs.

Server checks only cover pack loading, scene creation and published pose
properties. How the models look and how dragging feels must be checked in a real
Minecraft client.
