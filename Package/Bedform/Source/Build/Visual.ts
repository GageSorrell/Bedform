/**
 * Common-root visual overlays and tagged per-frame interval decoding.
 *
 * @module bedform/Build/Visual
 *
 * @file      Visual.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Host geometry/packet expressions keep mathematical ordering and contextual types. */
/* eslint-disable sort-imports, sort-keys, @stylistic/max-len */
/* Document exported constants at their declarations; generated expressions retain layout. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

/* Generated JSON and expressions retain contextual inference. */
/* eslint-disable @typescript-eslint/typedef */

import { EntityProperty } from "../keys.js";
import { type JsonObject, object, triple } from "./Geometry.js";

/**
 * Complete host-generated visual overlay and attachment descriptor.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Visual
{
    readonly geometry: JsonObject;
    readonly root: string;
    readonly properties: JsonObject;
    readonly scripts: JsonObject;
    readonly animation: JsonObject;
}

/**
 * Reuses an identity root at the origin; otherwise preserves authored fixed
 * transforms below a new common root. No per-face animated bones are generated.
 *
 * @category Build
 * @since 1.0.0
 */
export const visual = (input: JsonObject, identifier: string): Visual =>
{
    const Geometry = structuredClone(input);
    const Bones = (Geometry.bones as Array<unknown>).map((b) => object(b, "Bone"));
    const Roots = Bones.filter((b) => b.parent === undefined);
    const Suitable = Roots.length === 1 && triple(Roots[0].pivot ?? [ 0, 0, 0 ], "Root pivot").every((n) => n === 0) &&
        triple(Roots[0].rotation ?? [ 0, 0, 0 ], "Root rotation").every((n) => n === 0);
    let root = Suitable ? String(Roots[0].name) : "bedform_physics_root";
    if (!Suitable)
    {
        while (Bones.some((b) => b.name === root))
        {
            root += "_";
        }

        Roots.forEach((b) =>
        {
            b.parent = root;
        });
        Bones.unshift({ name: root,
            pivot: [ 0, 0, 0 ] });
    }

    Geometry.bones = Bones;
    Geometry.description = { ...object(Geometry.description, "Description"),
        identifier: `geometry.${identifier.replace(":", ".")}` };
    const Keys = Object.entries(EntityProperty);
    const Payload = Keys.filter(([ name ]) => name !== "Sequence");
    const Properties = Object.fromEntries(Keys.map(([ name, key ]) => [ key,
        { type: "int",
            range: [ name === "Sequence" ? -1 : 0, 8_388_607 ],
            default: name === "Sequence" ? -1 : 8_388_607,
            client_sync: true } ]));
    const Read = (key: string): string => `query.property('${key}')`;
    const Sequence = Read(EntityProperty.Sequence);
    const Word = (key: string): string => `math.mod(${Read(key)},65536)`;
    const Valid = Payload.map(([ , key ]) => `math.floor(${Read(key)}/65536)==math.mod(${Sequence},128)`).join("&&");
    const Assignments = Payload.map(([ name, key ]) => `variable.bf_${name.toLowerCase()}=${Word(key)};`).join("");
    const Latch = `variable.bf_new=0;(${Sequence}>variable.bf_sequence&&(${Valid}))?{` +
        `variable.bf_skip=(${Sequence}!=variable.bf_sequence+1)||(${Word(EntityProperty.Reset)}!=variable.bf_reset);` +
        Assignments + `variable.bf_sequence=${Sequence};variable.bf_reset=${Word(EntityProperty.Reset)};` +
        "variable.bf_elapsed=0;variable.bf_ready=1;variable.bf_new=1;" +
        [ "x", "y", "z" ].map((a) => `variable.bf_s${a}=variable.bf_skip?variable.bf_e${a}:variable.bf_s${a};`).join("") +
        [ "x", "y", "z", "w" ].map((a) => `variable.bf_sq${a}=variable.bf_skip?variable.bf_eq${a}:variable.bf_sq${a};`).join("") + "};";
    const Clock = "variable.bf_elapsed=variable.bf_new?0:math.min(0.05,variable.bf_elapsed+query.delta_time);" +
        "variable.bf_alpha=math.clamp(variable.bf_elapsed/0.05,0,1);";
    const Blend = [ "x", "y", "z", "w" ].map((a) => `variable.bf_q${a}=math.lerp(variable.bf_sq${a}-32768,variable.bf_eq${a}-32768,variable.bf_alpha);`).join("");
    const Normalize = "variable.bf_length=math.max(0.000001,math.sqrt(variable.bf_qx*variable.bf_qx+variable.bf_qy*variable.bf_qy+variable.bf_qz*variable.bf_qz+variable.bf_qw*variable.bf_qw));" +
        [ "x", "y", "z", "w" ].map((a) => `variable.bf_q${a}=variable.bf_q${a}/variable.bf_length;`).join("");
    // Reflect world Z into model space: q_model=(-qx,-qy,qz,qw).
    const Angles = [
        "math.abs(-2*(variable.bf_qw*variable.bf_qy-variable.bf_qz*variable.bf_qx))>0.999999?0:math.atan2(-2*(variable.bf_qw*variable.bf_qx+variable.bf_qy*variable.bf_qz),1-2*(variable.bf_qx*variable.bf_qx+variable.bf_qy*variable.bf_qy))",
        "math.asin(math.clamp(-2*(variable.bf_qw*variable.bf_qy-variable.bf_qz*variable.bf_qx),-1,1))",
        "math.abs(-2*(variable.bf_qw*variable.bf_qy-variable.bf_qz*variable.bf_qx))>0.999999?2*math.atan2(variable.bf_qz,variable.bf_qw):math.atan2(2*(variable.bf_qw*variable.bf_qz+variable.bf_qx*variable.bf_qy),1-2*(variable.bf_qy*variable.bf_qy+variable.bf_qz*variable.bf_qz))"
    ];
    const Position = [ "x", "y", "z" ].map((a, i) =>
    {
        // Remove the signed-word bias before scaling. Combining the words into
        // a biased 32-bit coordinate first loses ordinary world positions in
        // Molang floats (for example y=101 becomes zero). Subtract the native
        // origin before adding fine words so fractions survive cancellation too.
        const Base = `((variable.bf_b${a}high-32768)*65536-query.position(${i})+variable.bf_b${a}low+variable.bf_b${a}fraction/65535)`;
        return `variable.bf_ready?(${i === 2 ? -16 : 16})*(${Base}+(math.lerp(variable.bf_s${a},variable.bf_e${a},variable.bf_alpha)-32768)/4096):0`;
    });
    return { geometry: Geometry,
        root,
        properties: Properties,
        scripts: { initialize: [ "variable.bf_sequence=-1;variable.bf_reset=-1;variable.bf_ready=0;variable.bf_elapsed=0.05;" +
                Payload.map(([ name ]) => `variable.bf_${name.toLowerCase()}=${[ "Sqw", "Eqw" ].includes(name) ? 65_535 : 32_768};`).join("") ],
        pre_animation: [ Latch, Clock, Blend + Normalize ],
        animate: [ "bedform_pose" ] },
        animation: { format_version: "1.8.0",
            animations: { [`animation.${identifier.replace(":", ".")}.pose`]:
            { loop: true,
                animation_length: 0.05,
                bones: { [root]: { position: Position,
                    rotation: Angles.map((a) => `variable.bf_ready?(${a}):0`) } } } } } };
};
