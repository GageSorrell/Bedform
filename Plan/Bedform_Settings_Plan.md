# Bedform Server Settings

## Summary

Create a complete settings system consisting of:

- `Addon/BedformSettings`: the `@bedform/settings` BDS add-on.
- `Application/BedformSettings/CLI`: an Effect-based backend and web host.
- `Application/BedformSettings/Web`: a Next.js frontend.
- `Package/BedformUi`: reusable `@bedform/ui` React components.
- A new `bedform/ServerSettings` API for declaring and consuming per-player settings.

Settings are stored server-wide. The CLI runs independently alongside BDS. Players authenticate with an in-game code or a previously linked Microsoft account.

## Settings API and BDS integration

- Export a pure `ServerSettings` namespace from Bedform's root and subpath. Put Bedrock runtime integration behind `bedform/ServerSettings/Bedrock`, preserving inert, game-independent root imports.
- Provide `define` and typed setting constructors: `boolean`, `number`, `string`, `choice`, `multiChoice`, and `color`. **Exclude key bindings.**
- Definitions contain a stable add-on ID, title, description, schema version, ordered groups, and settings. Setting options provide defaults, labels, descriptions, numeric bounds/steps, text length limits, choice labels/values, and selection limits. Colors use normalized hexadecimal RGB values.
- Infer settings value types from declarations. Reject invalid defaults and contradictory options when defining the schema. Use serializable validation rules; arbitrary validation callbacks cannot participate in browser/backend validation.
- Runtime `register` returns a disposable handle with typed `get(player)`, synchronization status, and change subscriptions. Reads return cached values or declared defaults while synchronization is unavailable. Notify consumers when effective values change, and isolate callback failures.
- Use the settings add-on as the broker between consuming packs and the backend. Consumers communicate through versioned script events; only the broker requires `@minecraft/server-net` and `@minecraft/server-admin`.
- Frame and chunk messages within Bedrock's documented script-event limit. Bound reassembly size and time, correlate responses, reject malformed messages, and make registration/reconnection idempotent.
- Cache accepted values in broker-owned world/player dynamic properties. The backend remains authoritative; reconnecting refreshes caches without uploading stale cache values over newer database values.
- Register `/bedform:settings` for ordinary players with cheats disabled. It requests a code asynchronously and privately displays the code, expiration, and website URL.
- Place shared protocol identifiers in Bedform's public settings contract and broker-owned identifiers in its `keys.ts`. Follow repository TSDoc, namespace, and PascalCase conventions.

## Backend, persistence, and authentication

- Use the workspace's `effect@4.0.5` and matching Node platform package. Separate configuration, database, authentication, synchronization, and HTTP services through Effect layers with scoped startup and shutdown.
- Provide a `bedform-settings` executable with `setup`, `serve`, and `status` commands. Setup targets an explicit BDS directory, backs up changed configuration, preserves unrelated fields, and configures permissions, variables, and a generated bridge secret for this add-on only. BDS installation/configuration changes require a stopped server.
- Store a versioned SQLite database beneath the selected BDS installation's `.bedform/settings` directory. Persist canonical player profiles, world/player identity mappings, Microsoft links, schemas, overrides, revisions, and synchronization acknowledgements. Use transactional migrations and backups.
- Give each world a persistent broker-generated identifier. Scope game identity by world identifier and opaque `Player.id`; never merge profiles by gamertag. Microsoft documents entity IDs as stable across loads of a particular world. [Entity identity reference](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable)
- Bind the bridge listener to `127.0.0.1:19133` by default, with a configurable port. Authenticate every request using the configured secret. The broker exchanges registrations, connected-player snapshots, code requests, and revisioned updates through this listener.
- Poll once per second while connected, batch updates, and back off during outages. A database commit succeeds independently of immediate game delivery; retain pending synchronization across restarts.
- Support reads and atomic per-page saves through authenticated APIs. Validate against the current schema and expected revision; return conflicts instead of overwriting concurrent edits. Reset removes overrides and restores declared defaults.
- Preserve removed or incompatible saved values during schema changes. Expose valid values or defaults with compatibility notices; do not silently delete stored data.

### Authentication behavior

- Generate cryptographically random, eight-character codes in the backend, valid for five minutes and consumable once. Store hashes, invalidate the player's previous code, rate-limit issuance/redemption, and consume transactionally.
- Implement Microsoft personal-account sign-in using MSAL Node, authorization code flow, PKCE, state, and nonce. Identify accounts by validated issuer/subject claims; never by email. Microsoft recommends supported authentication libraries for this flow. [Authentication guidance](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
- A player links Microsoft sign-in by proving access to both the Microsoft account and an in-game code. After linking, either login method opens the same canonical profile.
- In each new world, the player signs into Microsoft and supplies a new in-game code to recover server-wide settings.
- Before combining existing profiles, show conflicting overrides and require explicit choices. Preserve nonconflicting overrides, apply the reviewed merge transactionally, and invalidate sessions attached to superseded profiles.
- Use server-side sessions, HttpOnly cookies, CSRF protection, and logout. Reject access to another player's settings.
- Document operator setup for the Microsoft app registration and callback URL. Missing credentials leave code login functional and explain Microsoft sign-in's configuration requirement.

## Web hosting and Minecraft UI

- Serve the Next.js App Router application through the CLI, sharing an origin with the Effect API. Dispatch API/authentication requests to Effect and page/assets requests to Next's production handler. Package the production web build with the CLI; use a custom-server-compatible build. [Next.js custom server guidance](https://nextjs.org/docs/app/guides/custom-server)
- Default HTTP to port **80**. Support configured TLS certificate/key files; TLS mode defaults to **443**, with port 80 redirecting to the configured HTTPS origin. Certificate provisioning remains operator-managed.
- Require a configured public HTTPS origin for remote authenticated use. Permit plain HTTP authentication for localhost development.
- Provide login, account-linking/conflict-review, add-on index, and individual `/addons/[addonId]` pages. Generate controls from registered schemas without rebuilding the frontend when an add-on registers.
- Use draft editing with **Save**, **Cancel**, and **Reset to defaults** per page. Display field validation, unsaved changes, revision conflicts, backend availability, and game synchronization status.
- Build reusable Bedrock-style buttons, panels, settings rows, switches, sliders, numeric/text inputs, dropdowns, multi-select controls, color controls, dialogs, and feedback states in `@bedform/ui`.
- Reproduce Bedrock settings-screen geometry, borders, colors, spacing, focus, hover, pressed, and disabled states. Include the requested tiled dirt background and self-hosted assets with provenance.
- Support desktop/mobile layouts, keyboard navigation, accessible names, and visible focus. Verify visual fidelity against Bedrock reference captures as well as component screenshots.

## Implementation sequence and acceptance

1. Create a Beads epic and dependent tasks for the contract, broker, backend/authentication, UI/frontend, and integrated validation.
2. Implement the typed contract and protocol, then exercise it with two independent example consuming packs.
3. Implement persistence, code login, Microsoft linking, synchronization, and HTTP/TLS hosting.
4. Implement the component package and generated Next.js pages, then assemble production artifacts.

Add the application directories to npm workspaces and supply build, typecheck, lint, test, and integrated verification commands. New packages start at `1.0.0`; preserve Bedform's existing version.

Acceptance must cover:

- Declaration inference, all setting types/options, invalid schemas, package exports, and absence of Node dependencies in game-safe imports.
- Two players and two consuming packs; cached/default behavior; backend/BDS restart; schema changes; offline web edits; duplicate/out-of-order messages; and concurrent saves.
- Code expiration, replay and simultaneous redemption; Microsoft callback validation; linking conflicts; cross-world relinking; session isolation; and unauthorized requests.
- Production page deep links, generated controls, save/reset behavior, accessibility, visual comparisons, HTTP defaults, HTTPS, and redirects.
- Real BDS tests through the add-on's fixed `dist/bds-runtime/bedrock_server.exe`. Extend explicit firewall setup for this path; ordinary tests must not elevate.
- A real player/browser walkthrough proving both authentication methods access identical settings and saved changes reach consuming add-ons.

Use disposable test worlds. Report automated, live BDS, browser, and real Microsoft-account evidence separately. Do not deploy to the existing server, publish packages, commit, push, or synchronize remote Dolt data as part of implementation.

## Beads implementation tracking

Epic: `MineCraft-ikm`. Beads is the source of truth for task status; all implementation entries start open. The table maps this specification to its implementation entries, not a separate task-status checklist.

| Issue | Implementation area | Prerequisites |
| --- | --- | --- |
| `MineCraft-ikm.1` | Typed ServerSettings API and shared protocol | None |
| `MineCraft-ikm.2` | BDS broker, runtime adapter, cache, and in-game command | `.1` |
| `MineCraft-ikm.3` | Effect sidecar, setup, SQLite, and synchronization APIs | `.1` |
| `MineCraft-ikm.4` | One-time codes, sessions, and player authorization | `.3` |
| `MineCraft-ikm.5` | Microsoft sign-in, linking, and reviewed profile merges | `.4` |
| `MineCraft-ikm.6` | Next.js hosting, HTTP/TLS, workspaces, and production packaging | `.3` |
| `MineCraft-ikm.7` | Reusable Bedrock-style React controls and dirt theme | None |
| `MineCraft-ikm.8` | Generated settings pages, authentication UI, and save workflows | `.1`, `.4`, `.5`, `.6`, `.7` |
| `MineCraft-ikm.9` | Automated integration, examples, packaging, runner, and documentation | `.2`, `.3`, `.4`, `.5`, `.6`, `.7`, `.8` |
| `MineCraft-ikm.10` | Real BDS/player/browser/Microsoft-account acceptance | `.9` |

Dependencies above use the `MineCraft-ikm` prefix. Unmet real-engine, client, visual, or Microsoft-account acceptance keeps its owning entry and the epic open even when automated verification passes.
