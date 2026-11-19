# Flat spatial UI button demonstration

## Goal and visual reference

Create a self-contained, isolated Bedrock Dedicated Server (BDS) and add-on to determine whether flat world-space assemblies of cuboids and particles can reproduce the vanilla buttons in the user's supplied **Multiplayer Connection Failed** screenshot.

The screenshot is the visual authority. Its buttons are vanilla and differ from the main-menu and pause-screen buttons. Do not substitute those screens' assets, the installed client's legacy `button_borderless_light` textures, or Trailers Vision textures. Reproduce the screenshot's gray and green fills, dark outer frame, light inner highlights, and lower shadow in a bundled atlas. Record the reference and the pixel template used to generate it.

Show four unlabeled buttons: cuboid gray, cuboid green, particle gray, particle green. This is a visual feasibility prototype; labels, the external-link icon, clicking, hover responses, sounds, and animations are outside this iteration.

Both implementations are flat and fixed in world space. In particular, **every cuboid has exactly one opaque front face and five transparent faces**. The cuboid assembly must not show solid sides, a solid back, or physical bevel depth. The apparent bevel comes from the screenshot's texture pixels.

## Add-on and shared assets

- Create `Addon/WorldButtonDemo` as private package `@sorrell/world-button-demo`, initially version `1.0.0`, with independent behavior and resource packs, build tools, tests, and a `.mcaddon` artifact.
- Use stable Script APIs supported by the selected release engine. This prototype requires no Bedform runtime dependency, BedformCommon pack, experimental feature, or beta API.
- Generate the bundled atlas reproducibly from a documented pixel template matching the screenshot. Include fully transparent atlas space and padding that prevents opaque texels from leaking onto transparent faces. Use crisp pixels without smoothing. Ordinary builds must not require an installed Minecraft client or another resource pack to supply textures.
- Define one shared nine-slice layout: four corners, four edges, and a center. Preserve border proportions while stretching the intended interior regions. Both renderers consume the same dimensions, rectangle positions, and UV regions.
- Generate a flat PNG reference from that same layout for visual comparison. Keep atlas generation, reference generation, and generated pack assets reproducible.
- Follow repository module-header, symbol TSDoc, nested-type, PascalCase constant, and centralized frozen identifier-record conventions. Generated TypeScript modules must receive the required headers from their generators.

## Renderers

### Cuboids

Use one stationary custom entity per button, containing nine cuboids. Each cuboid has positive thickness and its opaque front lies on the shared display plane. Its other five faces map exclusively to fully transparent texels. Use an alpha-tested material and normal world depth testing.

Disable movement, gravity, pushing, and damage. Set explicit visible bounds covering the complete button. Keep the geometry and texture mapping independent of the player's current view; walking around the assembly must not rotate it toward the camera.

### Particles

Use nine stationary textured particle panels per button, matching the cuboid fronts' rectangles and UVs. Fix their orientation to the world XY plane rather than following the camera. Bedrock documents fixed emitter-plane orientation and explicit texture UV regions in its [particle billboard component](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/particlesreference/particlecomponents/minecraftparticle_appearance_billboard?view=minecraft-bedrock-stable).

Emit one particle per slice every 10 ticks, with a 0.6-second particle lifetime and opaque cutout rendering. Retain normal world depth testing so terrain can occlude the panels. Refresh while at least one player is in the overworld within 32 blocks of the exhibit center; otherwise stop refreshing and let previous particles expire. On returning, refresh within the next 10 ticks. Keep work bounded by the two particle buttons, rather than multiplying the exhibit for each player.

Particle rear-face behavior is part of the observed result; the user's explicit five-transparent-faces requirement applies to cuboids. Record any particle-material limitation separately from front-view fidelity.

## Server and exhibit

- Prepare the self-contained runtime at the fixed executable path `Addon/WorldButtonDemo/dist/bds-runtime/bedrock_server.exe`. Read the engine from `BDS_PATH`, defaulting to `C:/MineCraft/Server`; copy required engine files and stock content, without copying unrelated custom packs, worlds, credentials, or manager state.
- Reuse the repository's demonstration lifecycle tooling where compatible, supplying the explicit runtime output path. Extend only what is needed to preserve that fixed path and the lifecycle guarantees below.
- Create a fresh Creative, Peaceful grass-flat world: one bedrock layer, two dirt layers, and one grass-block layer, using post-1.18 flat-world metadata. Set clear weather and fixed daytime.
- Establish a fixed viewing point near the origin and a fixed exhibit plane 10 blocks ahead along +Z. On join and respawn, verify loaded grass support and clear standing space, place the player directly on the grass surface, and face the exhibit. Retry unavailable chunk reads before teleporting; do not use an unverified high-altitude fallback.
- Arrange all four buttons in one horizontal, coplanar row. Each measures 3.25 by 0.75 blocks, with 0.5 blocks between adjacent edges. Center the complete row on the viewing point's X coordinate, with button centers approximately at standing eye height.
- The left-to-right order from spawn is **cuboid gray, cuboid green, particle gray, particle green**. Explain the order in a join message. Do not add button labels or experimental text primitives.
- Reconcile the two cuboid entities on startup without accumulating duplicates. Additional joins and respawns must not move or duplicate the shared exhibit. Restarting must restore the same scene and resume particle refresh for nearby players.
- Provide prepare, start, stop, and native-check commands. Preparation and ordinary rebuilds preserve an existing world; replacing it requires an explicit reset and a backup. Refuse unsafe replacement while the runtime is running.
- Use ports **19140/19141**. Report a conflict rather than stopping another server. Register the fixed executable with the repository's explicit firewall setup before launching; preparation, launch, and ordinary tests never elevate or silently change firewall rules.
- Supply all required packs through the server, including correct manifest dependencies and world references. The prepared server must run without reading its original engine source directory or fetching textures from elsewhere.
- After validation, restore the playable configuration and leave this server stopped. Provide the exact launch command and connection address at handoff.

## Verification and acceptance

### Host and packaging checks

Run scoped lint and TypeScript checks. Validate atlas colors against the documented reference template, fully transparent texels, UV bounds, nine-slice coverage and alignment, and identical front dimensions between renderers. Check that each cuboid has exactly one opaque face and five transparent faces, positive thickness, and complete visible bounds. Check particle orientation, timing, size conventions, and nearby-player refresh behavior.

Build reproducible archives and compare repeated outputs. Inspect the packs inside the artifact, verify that every referenced texture is bundled, and verify that installed scripts and assets match the final build. No broad unrelated refactor or repository-wide cleanup is part of this prototype.

### Native BDS checks

Use the add-on runner and the same fixed executable path with a disposable native test world. Exercise fresh startup and a second-process restart, actual grass support, player spawn and facing, entity counts, duplicate prevention, particle emission, and refresh start/stop behavior. Native player probes must not add experiments or GameTest code to the playable artifact.

Capture engine version, pack versions, logs, and machine-readable results. Require clean shutdown and no unexpected content or script errors. Restore the playable world/configuration after the probes.

### Real-client checks

Join the prepared server and compare all four buttons against the supplied screenshot and generated PNG reference. Inspect correct gray/green colors, dark frames, highlights, lower shadows, crisp corners, continuous borders, seams, missing-texture patterns, and front-view equivalence between the two renderers.

Walk to oblique angles and behind the cuboid buttons to verify that the other five faces are transparent. Confirm that both exhibits stay fixed in world space and respect world occlusion. Observe particles over sustained viewing, leaving and returning to the refresh range, and restarting the server; record visible flicker or material limitations rather than assuming success from emission calls.

Record client, engine, and pack versions with visual evidence. Host and BDS checks do not prove client rendering. If no real-client observation is available, report visual acceptance as pending and keep its Beads issue open.

## Beads work breakdown

Beads is the authoritative source for task status and dependencies. This document is the implementation specification, not a separate task tracker. All issues below are initially open; creating this plan does not implement the prototype.

Epic: **`MineCraft-4yx3` — Prototype flat spatial UI buttons with cuboids and particles**.

| Issue | Deliverable | Depends on |
| --- | --- | --- |
| `MineCraft-4yx3.1` | Demo package, screenshot-matching atlas, shared layout, and reference PNG | — |
| `MineCraft-4yx3.2` | Flat single-face cuboid renderer | `.1` |
| `MineCraft-4yx3.3` | Matching fixed particle-panel renderer | `.1` |
| `MineCraft-4yx3.4` | Self-contained grass-flat BDS server, scene, and lifecycle commands | `.2`, `.3` |
| `MineCraft-4yx3.5` | Packaging, quality checks, and native startup/restart evidence | `.4` |
| `MineCraft-4yx3.6` | Real-client screenshot fidelity and renderer acceptance | `.5` |

Preserve existing servers, worlds, and unrelated working-tree changes. No git commit, git push, or remote Dolt synchronization is authorized by this plan. Close the epic only when its implementation and acceptance children are complete.
