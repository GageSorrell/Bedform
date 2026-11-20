/**
 * World placement of the widget demonstration: one row of north-facing panels south of spawn.
 *
 * @module @sorrell/widget-demo/Script/Scene
 *
 * @file      Scene.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { Pose } from "../../../Package/Bedform/Source/Spatial/ComponentTypes.js";

/**
 * Air level of the flat world: the first block above the ground.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Floor = -60 as const;

/**
 * World Z of the panel row; panels face north (−Z), toward spawn.
 *
 * @category Constant
 * @since 1.0.0
 */
export const RowZ = 8 as const;

/**
 * Layout pixels per block for every demonstration View.
 *
 * @category Constant
 * @since 1.0.0
 */
export const PixelsPerBlock = 20 as const;

/**
 * Half a turn about +Y: a View's +Z front then faces north and its local +X runs west, which is the
 * right-hand side for a reader standing north of it and looking south.
 *
 * @category Constant
 * @since 1.0.0
 */
const FacingNorth = Object.freeze({
    w: 0,
    x: 0,
    y: 1,
    z: 0
});

/**
 * World Y of the panels' top edges; panels size to their content and hang down from it.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Top = Floor + 8;

/**
 * The pose of a north-facing View of the given pixel width, centered at an X with its top edge at a
 * world Y.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Panel(centerX: number, width: number, top: number = Top): Pose
{
    return Object.freeze({
        position: Object.freeze({
            x: centerX + width / PixelsPerBlock / 2,
            y: top,
            z: RowZ
        }),
        rotation: FacingNorth
    });
}

/**
 * Panel centers from west to east, as seen facing south from spawn (east is on the left).
 *
 * @category Constant
 * @since 1.0.0
 */
export const Center = Object.freeze({
    Access: 0,
    Controls: 9.5,
    Gallery: 19,
    Scroll: -9.5,
    Status: -19
} as const);

/**
 * A two-block stone pillar in front of the Scroll panel, for trying world occlusion.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Pillar = Object.freeze({
    From: Object.freeze({
        x: -12,
        y: Floor,
        z: RowZ - 3
    }),
    To: Object.freeze({
        x: -12,
        y: Floor + 2,
        z: RowZ - 3
    })
});

/**
 * Ground strip under the panels, marking where to stand.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Strip = Object.freeze({
    From: Object.freeze({
        x: -24,
        y: Floor - 1,
        z: RowZ - 5
    }),
    To: Object.freeze({
        x: 24,
        y: Floor - 1,
        z: RowZ - 1
    })
});
