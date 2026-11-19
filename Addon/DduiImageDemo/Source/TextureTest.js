/**
 * A test of user interface textures on the faces of world cuboids: four
 * custom blocks and, above them, four custom cube entities, each faced with
 * one vanilla texture by path: the main menu button
 * (textures/ui/button_borderless_light), a play screen button
 * (textures/gui/newgui/play_screen/NormalButtonThinNewBevel), the server list
 * icon (textures/ui/servers), and stone as a control. Blocks take their
 * textures through the terrain atlas (the resource pack's
 * textures/terrain_texture.json), entities directly by path. A texture the
 * client cannot load shows its missing-texture pattern instead.
 *
 * @module @sorrell/ddui-image-demo/Source/TextureTest
 *
 * @file      TextureTest.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { BlockTypes, TextPrimitive, world } from "@minecraft/server";

/**
 * The tested textures' short names, left to right as seen from the browser.
 *
 * @category Constant
 * @since 1.1.59
 */
export const TextureTests = Object.freeze([ "menu_button", "play_button", "servers_icon", "stone" ]);

const CubeEntity = "ddui_demo:ui_texture_cube";
let Label;

/**
 * Places the test 6 blocks behind the browser page's viewing spot, toward the
 * pixel offset row: the blocks on the ground in a row across the aisle, 2
 * blocks apart, an entity cube 1 block above each, and a label above,
 * replacing any earlier test. `Page` is the browser page's location, viewed
 * from smaller x; `GroundTop` is the ground's top.
 *
 * @category Running
 * @since 1.1.59
 */
export function PlaceTextureTest(Dimension, Page, GroundTop)
{
    for (const Entity of Dimension.getEntities({ type: CubeEntity })) Entity.remove();
    Label?.remove();
    const X = Math.floor(Page.x) - 6;
    const Z = Math.floor(Page.z);
    TextureTests.forEach((Name, Index) =>
    {
        // Seen from the browser's viewing spot, looking toward smaller x, left is larger z.
        const BlockZ = Z + 3 - 2 * Index;
        const Type = `ddui_demo:ui_texture_${Name}`;
        if (!BlockTypes.get(Type)) console.error(`UI_TEXTURE_TEST block type ${Type} is not registered`);
        try { Dimension.getBlock({ x: X, y: GroundTop, z: BlockZ })?.setType(Type); }
        catch (Error) { console.error(`UI_TEXTURE_TEST block ${Type}: ${Error?.name} ${Error?.message} ${String(Error)}`); }
        try
        {
            Dimension.spawnEntity(CubeEntity, { x: X + 0.5, y: GroundTop + 2, z: BlockZ + 0.5 },
                { spawnEvent: `ddui_demo:variant_${Index}` });
        }
        catch (Error) { console.error(`UI_TEXTURE_TEST entity ${Index}: ${Error?.name} ${Error?.message} ${String(Error)}`); }
    });
    // Without a dimension, a shape is drawn in every dimension.
    Label = new TextPrimitive({ dimension: Dimension, x: X + 0.5, y: GroundTop + 4.4, z: Z + 0.5 },
        "UI textures on cuboids: entities above, blocks below\nmenu button | play button | servers icon | stone");
    Label.useRotation = true;
    // Facing smaller x, toward a viewer at the browser's viewing spot; a TextPrimitive's yaw is opposite an entity's.
    Label.rotation = { x: 0, y: -90, z: 0 };
    Label.scale = 0.7875;
    Label.depthTest = false;
    Label.textBackfaceVisible = false;
    Label.backfaceVisible = false;
    Label.backgroundColorOverride = { red: 0, green: 0, blue: 0, alpha: 1 };
    world.primitiveShapesManager.addText(Label, Dimension);
    console.warn(`UI_TEXTURE_TEST placed at x ${X}, z ${Z - 3}..${Z + 3}, y ${GroundTop}`);
}
