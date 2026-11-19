`player.vanilla.json` is the unmodified Mojang Bedrock Samples player definition from release tag `v1.26.60.5`, commit `15701fa9c13923f12662984c32c124327e40e3d3`:

https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/behavior_pack/entities/player.json

Upstream license: https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/LICENSE.md

`Tool/Build.mts` preserves that definition and adds a component group containing `minecraft:body_rotation_blocked`, plus lock/unlock events. This player override belongs only in the isolated demo; other add-ons that override the player would need a merged definition.

`player.render_controllers.vanilla.json` is the unmodified player render-controller file from the same upstream commit:

https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/render_controllers/player.render_controllers.json

`player.client.vanilla.json` is the unmodified player client entity from that commit:

https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/entity/player.entity.json

Starting in 1.0.7, the builder emits that player client entity with an explicit reference to `controller.render.look_demo.hidden`. While the local demo camera is active, all original render-controller selections are disabled and the custom controller hides every avatar part. Other viewers, OFF state, map previews and inventory previews retain the original controller selection. This replaces the earlier patch to vanilla controller identifiers and does not depend on skin bone names. The camera position remains the 1.0.5 native head anchor plus 0.10 blocks vertically; physical-client visual acceptance is still separate.

The pinned upstream license is included as `License.Mojang.txt` and copied into both generated packs.
