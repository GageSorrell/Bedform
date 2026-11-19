# Pinned vanilla player definitions

`player.vanilla.json` and `player.client.vanilla.json` are unchanged copies of
LookInputDemo's pinned Mojang Bedrock Samples inputs at release `v1.26.60.5`,
commit `15701fa9c13923f12662984c32c124327e40e3d3`.

Source behavior: https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/behavior_pack/entities/player.json

Source client: https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/entity/player.entity.json

Upstream attribution: Mojang AB / Microsoft. Upstream license:
https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/LICENSE.md

The shared `bedform/Build/DiageticPresentation` source generator (used by both
builders) adds only the body-rotation group, synchronized camera property,
lock/unlock events and local first-person selection guard. It retains remote,
inventory and map presentation. `Tool/Build.mts` regenerates the pack JSON before
archiving it. Player overrides from another pack must merge these additions;
Bedrock's player definitions do not automatically merge across packs.

The pinned upstream license is included as `License.Mojang.txt` and copied into both generated packs.
