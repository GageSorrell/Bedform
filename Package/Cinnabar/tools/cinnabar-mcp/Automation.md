# Bedform automation host

Build the developer-control renderer and the MCP executable separately on the qualified Windows target. Start the native bridge with its provisioned configuration, then run `cinnabar-mcp --automation-host <host.json>`. The host emits diagnostics on stderr. It creates one renderer per attached native simulated player. Script and MCP clients that use the same discovery file share access to the same sessions.

The host accepts the following JSON configuration. Paths resolve relative to the configuration file.

```json
{
  "compatibility": "compatibility.json",
  "bridgeEndpoint": "private/bridge.json",
  "rendererExecutable": "cinnabar.exe",
  "assets": "assets",
  "runDirectory": "private/runs",
  "scriptEndpoints": ["private/script.json"],
  "provisionerEndpoint": "private/setup.json"
}
```

- Supply a v1 bridge discovery document with role `bridge`, the matching manifest digest and the bridge credential. The host binds to IPv4 loopback and selects a free port by default. Set `port` to request a fixed port.
- Configure private discovery parent directories and a private run directory before startup. On Windows, set inherited ACLs for the account or module that may read each discovery file. The host publishes each file without overwriting an existing file. It removes its publications on orderly shutdown.
- Each `scriptEndpoints` entry gets its own credential and session scope. The optional provisioner credential can only call `Hello` and `Capabilities`. Each renderer has a fresh user root, a private developer-control endpoint, a separate authenticated packet connection, and its own retained session log directory.
- `rendererArguments` optionally supplies trusted local renderer arguments. Attach defaults to `hidden`. Pass `"renderer": "visible"` to open a normal window. Sessions connected to native players use real time.
- Stop the host with a console interrupt. A supervisor can set `shutdownOnStdinClose` to `true` and close the input pipe to request orderly shutdown. Detach and orderly shutdown release the owned renderer and native lease and leave the simulated player in its world.

Scripts use the [v1 control and packet contract](../../Bedform/Contract/README.md). Authenticate with the script token and complete `Hello` before sending requests. Use the full immutable session handle for later operations. State and bounded event history include terminal reasons so callers can inspect the outcome of a detach, player removal, GameTest completion, or renderer loss. If a mutating renderer command times out after dispatch, the host retires the affected session to clear potentially held input. Inspect it with a new request ID.

Configure MCP with the same binary and arguments `--automation-stdio <script discovery file>`. The automation tools report structured errors in their results and accept the optional v1 `timeoutMs` argument. Closing stdio leaves host sessions available to script callers. Running `cinnabar-mcp` without an automation mode serves the upstream tool set, including frame-based input.

The host advertises native sessions, virtual input, visible and hidden renderers, and native observations. The capture, trigger, and retention services are separate components. The process contract can be exercised with the bridge and renderer peers:

```powershell
cargo build --locked -p cinnabar-mcp
node --test tools/cinnabar-mcp/tests/Automation.test.mjs
```

Set `BEDFORM_CINNABAR_MCP_BINARY` when using an isolated Cargo target directory. The peer run exercises the executable and its real loopback/stdio boundaries. Bedform-8ww.6 owns the production bridge and renderer integration run.
