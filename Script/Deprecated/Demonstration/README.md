# Demonstration servers

`npm run demo:create -- --name "Example" --description "A small scene" --world <prepared-world> --bds <engine> --addon Addon/Example --behavior-pack <bp> --resource-pack <rp>` prepares an isolated server without launching it. Repeat pack flags for dependencies. Pack versions may be numeric triples or format-3 plain release strings such as `"1.14.1"`; world pack references always receive triples. The prepared world must contain `level.dat`. `BDS_PATH` or `BDS_ROOT` can supply the engine directory.

Use `--instructions` for the visitor's activity and `--ready-marker` whenever scene setup is asynchronous. Explain prerequisites in clear, moderately concise prose. Mention any required primer. Prefer prose for three or fewer steps. Resource packs are supplied by the server; clients should not need a separate installation.

Optional flags include `--descriptor`, `--output`, `--config <JSON-file>`, `--port` and `--portv6`. The default directory is `<addon>/Demonstration/<descriptor>/server`. Recreating a marked, stopped server stages a replacement and preserves its complete predecessor in a timestamped sibling backup. Unmarked directories and running servers are refused.

Start using the generated add-on `demo:<descriptor>` command, `Start Demonstration.cmd`, or `npm run demo:start -- --server <directory>`. Output and console input remain live; enter `stop` or press Ctrl+C for a graceful shutdown. Readiness requires both BDS startup and the optional fixture marker, and follows the telemetry banner. `--address` overrides automatic LAN detection. `--stop-after-ready` saves a seeded world and shuts down for smoke testing.

Creation records stable executable paths in ignored `dist/demonstration-servers.json`. Explicit `npm run firewall:configure` registers those paths. Creation and launch do not elevate. Actual Minecraft client rendering and input acceptance must be reported separately from host and BDS checks.
