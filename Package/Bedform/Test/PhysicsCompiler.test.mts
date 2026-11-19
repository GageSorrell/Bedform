/**
 * Analytic solid, malformed topology, overlay and packet compiler fixtures.
 *
 * @module bedform/Test/PhysicsCompiler.test
 *
 * @file      PhysicsCompiler.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Independent analytic fixtures keep coordinate and matrix ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import * as O from "@bedform/effect/Option";
import * as R from "@bedform/effect/Result";
import * as H from "bedform/ConvexHull";
import * as T from "bedform/Transform";
import * as Q from "bedform/Quat";
import * as V from "bedform/Vector3";
import * as C from "bedform/CollisionShape";
import * as Renderer from "bedform/PhysicsRenderer";
import { EntityProperty } from "bedform/keys";
import { compile, compileConfig, publish, fingerprint, meshSolid } from "../Source/Build/Physics.js";
import { partition, massProperties, type Surface } from "../Source/Build/Solid.js";
import { cuboids } from "../Source/Build/Geometry.js";
import { visual } from "../Source/Build/Visual.js";
import { runInNewContext } from "node:vm";
import Ts from "typescript";

/**
 * Evaluates generated scalar animation expressions with float32 operands and
 * intermediate arithmetic, matching Molang's float precision rather than JS doubles.
 *
 * @category Tests
 * @since 1.0.0
 */
const floatExpression = (expression: string, context: Record<string, unknown>): number =>
{
    const Source = Ts.createSourceFile("expression.ts", expression, Ts.ScriptTarget.Latest);
    const Result = Ts.transform(Source, [ (transform) =>
    {
        const Visit: Ts.Visitor = (node) =>
        {
            const Value = Ts.visitEachChild(node, Visit, transform);
            if (Ts.isNumericLiteral(Value) || Ts.isPrefixUnaryExpression(Value) ||
                Ts.isCallExpression(Value) || Ts.isBinaryExpression(Value) &&
                [ Ts.SyntaxKind.PlusToken, Ts.SyntaxKind.MinusToken,
                    Ts.SyntaxKind.AsteriskToken, Ts.SyntaxKind.SlashToken ].includes(Value.operatorToken.kind))
            {
                return Ts.factory.createCallExpression(Ts.factory.createPropertyAccessExpression(
                    Ts.factory.createIdentifier("Math"), "fround"), undefined, [ Value as Ts.Expression ]);
            }

            return Value;
        };

        return (node) => Ts.visitNode(node, Visit) as Ts.SourceFile;
    } ]);
    try
    {return runInNewContext(Ts.createPrinter().printFile(Result.transformed[0]), context) as number;}
    finally
    {Result.dispose();}
};

test("generated root offsets preserve gallery coordinates with float32 intermediate arithmetic", () =>
{
    const Asset = visual({ description: { identifier: "geometry.float" },
        bones: [ { name: "root" } ] }, "test:float");
    const Animation = Asset.animation as { animations: Record<string, { bones: Record<string, { position: Array<string> }> }> };
    const Position = Object.values(Animation.animations)[0].bones[Asset.root].position;
    for (const Base of [ V.Vector3Unsafe(0, 101, 0), V.Vector3Unsafe(80, 99.375, 0),
        V.Vector3Unsafe(-100.25, 50.125, -100.5), V.Vector3Unsafe(65535.5, 101, -65536.25) ])
    {
        const Pose = T.TransformUnsafe(Base, Q.Identity);
        const Packet = R.getOrThrow(Renderer.encode({ start: Pose,
            end: Pose,
            renderBase: Base,
            duration: 0.05,
            sequence: 1,
            reset: 0 }));
        const Variable: Record<string, number> = { bf_ready: 1,
            bf_alpha: 0.5 };
        for (const [ Name, Key ] of Object.entries(EntityProperty))
        {Variable[`bf_${Name.toLowerCase()}`] = Packet[Key] % 65536;}

        const Context = { variable: Variable,
            query: { position: (axis: number) => [ Base.x, Base.y, Base.z ][axis] },
            math: { lerp: (a: number, b: number, t: number) => Math.fround(a + Math.fround(Math.fround(b - a) * t)) } };
        for (const Expression of Position)
        {near(floatExpression(Expression, Context), 0, 0.02);}

        const Moving = R.getOrThrow(Renderer.encode({
            start: T.TransformUnsafe(V.add(Base, V.Vector3Unsafe(0.5, 0.25, 0.5)), Q.Identity),
            end: T.TransformUnsafe(V.add(Base, V.Vector3Unsafe(1, 0.75, -0.5)), Q.Identity),
            renderBase: Base,
            duration: 0.05,
            sequence: 2,
            reset: 0
        }));
        for (const [ Name, Key ] of Object.entries(EntityProperty))
        {Variable[`bf_${Name.toLowerCase()}`] = Moving[Key] % 65536;}

        Context.query.position = (axis: number) => [ Base.x + 0.125, Base.y + 0.125, Base.z + 0.125 ][axis];
        Position.forEach((expression, axis) => near(floatExpression(expression, Context), [ 10, 6, 2 ][axis], 0.02));
    }
});

/**
 * Independent outward box triangulation with binary XYZ vertices.
 *
 * @category Fixtures
 * @since 1.0.0
 */
const box = (min = [ 0, 0, 0 ], max = [ 1, 1, 1 ], inward = false): Surface =>
{
    const Vertices = Array.from({ length: 8 }, (_, i) => ({ x: (i & 1) ? max[0] : min[0],
        y: (i & 2) ? max[1] : min[1],
        z: (i & 4) ? max[2] : min[2] }));
    const Faces = [ [ 0, 4, 6, 2 ], [ 1, 3, 7, 5 ], [ 0, 1, 5, 4 ], [ 2, 6, 7, 3 ], [ 0, 2, 3, 1 ], [ 4, 5, 7, 6 ] ];
    return { vertices: Vertices,
        triangles: Faces.flatMap((f, face) => [ [ f[0], f[1], f[2] ], [ f[0], f[2], f[3] ] ].map((indices) =>
            ({ indices: (inward ? [ ...indices ].reverse() : indices) as [number, number, number],
                source: { object: `box${min.join("_")}`,
                    face } }))) };
};

/**
 * Merges independent indexed shells without merging physical volume.
 *
 * @category Fixtures
 * @since 1.0.0
 */
const combine = (...surfaces: Array<Surface>): Surface =>
{
    let offset = 0;
    return { vertices: surfaces.flatMap((s) => [ ...s.vertices ]),
        triangles: surfaces.flatMap((s) =>
        {
            const Triangles = s.triangles.map((t) => ({ ...t,
                indices: t.indices.map((i) => i + offset) as [number, number, number] }));
            offset += s.vertices.length;
            return Triangles;
        }) };
};

/**
 * Compares independently known physical values within integration tolerance.
 *
 * @category Tests
 * @since 1.0.0
 */
const near = (actual: number, expected: number, tolerance = 1e-8): void =>
{
    Assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

/**
 * Welded boundary of a concave voxel ring with a through opening.
 *
 * @category Fixtures
 * @since 1.0.0
 */
const ringMesh = (): Surface =>
{
    const Vertices: Array<V.Coordinates> = [];
    const Triangles: Array<Surface["triangles"][number]> = [];
    const Indices = new Map<string, number>();
    const Occupied = (x: number, y: number, z: number): boolean =>
        x >= 0 && x < 3 && y >= 0 && y < 3 && z === 0 && !(x === 1 && y === 1);
    for (let x = 0; x < 3; x++)
    {
        for (let y = 0; y < 3; y++)
        {
            if (!Occupied(x, y, 0))
            {
                continue;
            }

            const Cube = box([ x, y, 0 ], [ x + 1, y + 1, 1 ]);
            const Neighbors = [ [ x - 1, y, 0 ], [ x + 1, y, 0 ], [ x, y - 1, 0 ], [ x, y + 1, 0 ], [ x, y, -1 ], [ x, y, 1 ] ];
            for (const Triangle of Cube.triangles)
            {
                const Neighbor = Neighbors[Triangle.source.face];
                if (Occupied(Neighbor[0], Neighbor[1], Neighbor[2]))
                {
                    continue;
                }

                const Mapped = Triangle.indices.map((i) =>
                {
                    const P = Cube.vertices[i];
                    const Key = `${P.x},${P.y},${P.z}`;
                    if (!Indices.has(Key))
                    {
                        Indices.set(Key, Vertices.length);
                        Vertices.push(P);
                    }

                    return Indices.get(Key)!;
                }) as [number, number, number];
                Triangles.push({ indices: Mapped,
                    source: Triangle.source });
            }
        }
    }

    return { vertices: Vertices,
        triangles: Triangles };
};

test("analytic cuboid inertia, COM overrides, overlap union and disconnected solids", () =>
{
    const Cells = partition([ box([ 0, 0, 0 ], [ 2, 3, 4 ]) ], true).cells;
    const P = massProperties(Cells, 12);
    near(P.volume, 24);
    near(P.centroid.x, 1);
    near(P.centroid.y, 1.5);
    near(P.centroid.z, 2);
    near(P.inertia[0], 25);
    near(P.inertia[4], 20);
    near(P.inertia[8], 13);
    near(P.inertia[1], 0);
    const Shifted = massProperties(Cells, 12, { x: 0,
        y: 0,
        z: 0 });
    near(Shifted.inertia[0], 100);
    near(Shifted.inertia[1], -18);
    const Union = partition([ box(), box([ 0.5, 0, 0 ], [ 1.5, 1, 1 ]) ], false);
    near(massProperties(Union.cells, 1).volume, 1.5);
    Assert.ok(Union.cells.some((c) => c.internalFaces.some(Boolean)));
    near(massProperties(partition([ combine(box(), box([ 3, 0, 0 ], [ 4, 1, 1 ])) ], true).cells, 1).volume, 2);
});

test("mesh cavity subtracts mass and remains empty rather than becoming a hull", () =>
{
    const Source = combine(box([ 0, 0, 0 ], [ 3, 3, 3 ]), box([ 1, 1, 1 ], [ 2, 2, 2 ], true));
    const Result = partition([ Source ], true);
    const P = massProperties(Result.cells, 26);
    near(P.volume, 26);
    near(P.centroid.x, 1.5);
    near(P.inertia[0], 40 + 1 / 3);
    for (const Cell of Result.cells)
    {
        Assert.equal(O.getOrThrow(H.containsPoint(Cell.hull, { x: 1.5,
            y: 1.5,
            z: 1.5 })), false);
    }
});

test("concave L union and narrow opening preserve the exact occupied region", () =>
{
    const Surfaces = [ box([ 0, 0, 0 ], [ 3, 1, 1 ]), box([ 0, 1, 0 ], [ 1, 3, 1 ]) ];
    const Result = partition(Surfaces, false);
    near(massProperties(Result.cells, 1).volume, 5);
    Assert.ok(Result.cells.every((c) => !O.getOrThrow(H.containsPoint(c.hull, { x: 2,
        y: 2,
        z: 0.5 }))));
    const Ring = partition([ box([ 0, 0, 0 ], [ 1, 3, 1 ]), box([ 2, 0, 0 ], [ 3, 3, 1 ]),
        box([ 1, 0, 0 ], [ 2, 1, 1 ]), box([ 1, 2, 0 ], [ 2, 3, 1 ]) ], false);
    near(massProperties(Ring.cells, 1).volume, 8);
    Assert.ok(Ring.cells.every((c) => !O.getOrThrow(H.containsPoint(c.hull, { x: 1.5,
        y: 1.5,
        z: 0.5 }))));
});

test("concave manifold mesh opening, oblique tetrahedra and corrected mirrored solids", () =>
{
    const Ring = partition([ ringMesh() ], true);
    near(massProperties(Ring.cells, 1).volume, 8);
    Assert.ok(Ring.cells.every((c) => !O.getOrThrow(H.containsPoint(c.hull, { x: 1.5,
        y: 1.5,
        z: 0.5 }))));
    const Tetra: Surface = { vertices: [ V.Zero, V.UnitX, V.UnitY, V.UnitZ ],
        triangles: [ [ 0, 2, 1 ], [ 0, 1, 3 ], [ 0, 3, 2 ], [ 1, 2, 3 ] ].map((indices, face) =>
            ({ indices: indices as [number, number, number],
                source: { object: "tetra",
                    face } })) };
    const Physical = massProperties(partition([ Tetra ], true).cells, 1);
    near(Physical.volume, 1 / 6);
    near(Physical.centroid.x, 0.25);
    near(Physical.inertia[0], 3 / 40);
    near(Physical.inertia[1], 1 / 80);
    const Mirrored: Surface = { vertices: Tetra.vertices.map((v) => ({ x: -v.x,
        y: v.y,
        z: v.z })),
    triangles: Tetra.triangles.map((t) => ({ ...t,
        indices: [ t.indices[0], t.indices[2], t.indices[1] ] })) };
    const Reflected = massProperties(partition([ Mirrored ], true).cells, 1);
    near(Reflected.volume, Physical.volume);
    near(Reflected.centroid.x, -0.25);
    near(Reflected.inertia[1], -1 / 80);
});

test("open, nonmanifold, degenerate, overlapping shells and reversed cavities fail with provenance", () =>
{
    const Good = box();
    Assert.throws(() => partition([ { ...Good,
        triangles: Good.triangles.slice(1) } ], true), /Open.*face/u);
    Assert.throws(() => partition([ { ...Good,
        triangles: [ ...Good.triangles, Good.triangles[0] ] } ], true), /nonmanifold/u);
    Assert.throws(() => partition([ { ...Good,
        triangles: [ { ...Good.triangles[0],
            indices: [ 0, 0, 1 ] }, ...Good.triangles.slice(1) ] } ], true), /indices/u);
    Assert.throws(() => partition([ combine(Good, box([ 0.5, 0.5, 0.5 ], [ 1.5, 1.5, 1.5 ])) ], true), /intersection/u);
    Assert.throws(() => partition([ combine(box([ 0, 0, 0 ], [ 3, 3, 3 ]), box([ 1, 1, 1 ], [ 2, 2, 2 ])) ], true), /winding/u);
    Assert.throws(() => partition([ box([ 0, 0, 0 ], [ 1, 1, 1 ], true) ], true), /winding/u);
    Assert.throws(() => partition([ box([ 0, 0, 0 ], [ 2_000, 1, 1 ]) ], true), /budget/u);
    Assert.throws(() => partition([ { ...Good,
        triangles: Array.from({ length: 1_025 }, () => Good.triangles[0]) } ], true), /budget/u);
});

test("versioned interchange applies Blender units/axes once and rejects tampering", () =>
{
    const S = box([ 1, 2, 3 ], [ 2, 4, 6 ]);
    const Data = { schemaVersion: 1,
        coordinates: "blender",
        metresPerUnit: 2,
        ...S };
    const Mesh = meshSolid({ ...Data,
        fingerprint: fingerprint(Data) });
    const P = massProperties(partition([ Mesh ], true).cells, 1);
    near(P.volume, 48);
    near(P.centroid.x, 3);
    near(P.centroid.y, 9);
    near(P.centroid.z, -6);
    Assert.throws(() => meshSolid({ ...Data,
        fingerprint: "bad" }), /fingerprint/u);
});

test("topology tolerances scale for small and large finite solids", () =>
{
    for (const Size of [ 1e-6, 1e-3, 128 ])
    {
        const Physical = massProperties(partition([ box([ 0, 0, 0 ], [ Size, Size, Size ]) ], true).cells, 1);
        near(Physical.volume / Size ** 3, 1);
        near(Physical.inertia[0] / Size ** 2, 1 / 6);
    }
});

test("cube inflation, cube and ancestor rotations preserve asymmetric volume and source immutability", () =>
{
    const Document = { "minecraft:geometry": [ { description: { identifier: "geometry.test" },
        bones: [
            { name: "parent",
                pivot: [ 0, 0, 0 ],
                rotation: [ 0, 90, 0 ] },
            { name: "child",
                parent: "parent",
                pivot: [ 0, 0, 0 ],
                rotation: [ 0, 0, 90 ],
                cubes:
            [ { origin: [ 0, 0, 0 ],
                size: [ 16, 32, 48 ],
                inflate: 1,
                pivot: [ 0, 0, 0 ],
                rotation: [ 90, 0, 0 ] } ] } ] } ] };
    const Original = structuredClone(Document);
    const Baked = cuboids(Document, "geometry.test");
    const P = massProperties(partition(Baked.surfaces, false).cells, 1);
    near(P.volume, 18 * 34 * 50 / 16 ** 3);
    near(P.centroid.x, 1);
    near(P.centroid.y, 0.5);
    near(P.centroid.z, 1.5);
    Assert.deepEqual(Document, Original);
    const Unsupported = structuredClone(Document);
    Object.assign(Unsupported["minecraft:geometry"][0].bones[1], { poly_mesh: {} });
    Assert.throws(() => cuboids(Unsupported, "geometry.test"), /poly_mesh/u);
});

test("common root reuse, fixed-transform preservation, multiple roots and bone-less anchors", () =>
{
    const Description = { identifier: "geometry.original" };
    Assert.equal(visual({ description: Description,
        bones: [ { name: "authored" } ] }, "test:box").root, "authored");
    const Fixed = { name: "authored",
        pivot: [ 1, 2, 3 ],
        rotation: [ 1, 2, 3 ] };
    const Result = visual({ description: Description,
        bones: [ Fixed, { name: "other" } ] }, "test:box");
    Assert.equal((Result.geometry.bones as Array<unknown>).length, 3);
    Assert.deepEqual((Result.geometry.bones as Array<Record<string, unknown>>)[1], { ...Fixed,
        parent: Result.root });
    Assert.equal((visual({ description: Description,
        bones: [] }, "test:particle").geometry.bones as Array<unknown>).length, 1);
    Assert.equal(Object.keys(Result.properties).length, 25);
    const Scripts = JSON.stringify(Result.scripts);
    Assert.match(Scripts, /query.delta_time/u);
    Assert.match(Scripts, /math.floor/u);
    Assert.match(Scripts, /bf_skip/u);
    Assert.match(JSON.stringify(Result.animation), /query.position/u);
});

test("tagged interval packet quantization, quaternion sign alignment and range rejection", () =>
{
    const Interval: Renderer.Interval = { start: T.Identity,
        end: T.TransformUnsafe({ x: 1,
            y: 2,
            z: 3 }, Q.QuatUnsafe(0, 0, 0, -1)),
        renderBase: V.Zero,
        duration: 0.05,
        sequence: 7,
        reset: 2 };
    const Packet = R.getOrThrow(Renderer.encode(Interval));
    Assert.equal(Object.keys(Packet).length, 25);
    for (const [ Key, Value ] of Object.entries(Packet))
    {
        if (Key !== EntityProperty.Sequence)
        {
            Assert.equal(Math.floor(Value / 65_536), 7);
        }
    }

    Assert.equal(Packet[EntityProperty.Sqw], Packet[EntityProperty.Eqw]);
    Assert.ok(R.isFailure(Renderer.encode({ ...Interval,
        end: T.TransformUnsafe({ x: 9,
            y: 0,
            z: 0 }, Q.Identity) })));
    Assert.ok(R.isFailure(C.primitive("sphere", { x: 1,
        y: 2,
        z: 1 })));
    Assert.ok(Object.isFrozen(R.getOrThrow(C.primitive("box", V.One)).halfExtents));
    const Huge = Renderer.encode({ ...Interval,
        end: T.TransformUnsafe(V.One, Q.QuatUnsafe(1e308, 1e308, 1e308, 1e308)) });
    Assert.ok(R.isSuccess(Huge));
    const Half = { ...Interval,
        end: T.TransformUnsafe(V.One, Q.QuatUnsafe(1, 0, 0, 0)) };
    const HalfNegated = { ...Half,
        start: T.TransformUnsafe(V.Zero, Q.negate(Q.Identity)),
        end: T.TransformUnsafe(V.One, Q.QuatUnsafe(-1, 0, 0, 0)) };
    Assert.deepEqual(R.getOrThrow(Renderer.encode(Half)), R.getOrThrow(Renderer.encode(HalfNegated)));
});

test("generated per-frame expressions hold coherent intervals, nlerp full rotation and compensate render-base movement", () =>
{
    const Asset = visual({ description: { identifier: "geometry.test" },
        bones: [ { name: "root" } ] }, "test:pose");
    const Properties: Record<string, number> = Object.fromEntries(Object.entries(Asset.properties).map(([ key, definition ]) =>
        [ key, (definition as { default: number }).default ]));
    const Variable: Record<string, number> = new Proxy({}, { get: (target: Record<string, number>, key: string) => target[key] ?? 0 });
    const Native = [ 100, 50, -100 ];
    const Query = { property: (key: string) => Properties[key],
        position: (axis: number) => Native[axis],
        delta_time: 0.0125 };
    const MathFunctions = { abs: Math.abs,
        floor: Math.floor,
        mod: (a: number, b: number) => a % b,
        min: Math.min,
        max: Math.max,
        sqrt: Math.sqrt,
        lerp: (a: number, b: number, t: number) => a + (b - a) * t,
        clamp: (x: number, min: number, max: number) => Math.max(min, Math.min(max, x)),
        atan2: (y: number, x: number) => Math.atan2(y, x) * 180 / Math.PI,
        asin: (x: number) => Math.asin(x) * 180 / Math.PI };
    const Scripts = Asset.scripts as { initialize: Array<string>;
        pre_animation: Array<string> };
    const Context = { variable: Variable,
        query: Query,
        math: MathFunctions };
    const Run = (script: string): number => runInNewContext(script.replace(/\((.*?)\)\?\{/gu, "if($1){"), Context) as number;
    Scripts.initialize.forEach(Run);
    const Frame = (): void =>
    {
        Scripts.pre_animation.forEach(Run);
    };

    const Pose = (x: number, rotation = Q.Identity): T.Transform => T.TransformUnsafe({ x,
        y: 50,
        z: -100 }, rotation);
    const Base = V.Vector3Unsafe(100, 50, -100);
    const Initial: Renderer.Interval = { start: Pose(100),
        end: Pose(100),
        renderBase: Base,
        duration: 0.05,
        sequence: 0,
        reset: 0 };
    Object.assign(Properties, R.getOrThrow(Renderer.encode(Initial)));
    Frame();
    const Rotation = O.getOrThrow(Q.normalize(Q.QuatUnsafe(0.2, 0.3, 0.4, 0.5)));
    const Next: Renderer.Interval = { ...Initial,
        start: Pose(100),
        end: Pose(102, Rotation),
        sequence: 1 };
    const Packet = R.getOrThrow(Renderer.encode(Next));
    // A new commit marker arriving ahead of one payload channel cannot latch a torn interval.
    const Missing = Packet[EntityProperty.Eqx];
    Object.assign(Properties, Packet, { [EntityProperty.Eqx]: Properties[EntityProperty.Eqx] });
    Frame();
    Assert.equal(Variable.bf_sequence, 0);
    Properties[EntityProperty.Eqx] = Missing;
    const Animation = Asset.animation as { animations: Record<string, { bones: Record<string, { position: Array<string>;
        rotation: Array<string> }> }> };
    const Root = Object.values(Animation.animations)[0].bones[Asset.root];
    for (let index = 0; index <= 4; index++)
    {
        Native[0] = 100 + index / 10;
        Frame();
        near(Variable.bf_alpha, index / 4);
        const Position = Root.position.map(Run);
        near(Native[0] + Position[0] / 16, 100 + index / 2, 1e-4);
        const Angles = Root.rotation.map(Run).map((a) => a * Math.PI / 180);
        let [ x, y, z ] = [ 0.3, 0.7, -0.9 ];
        // Independent XYZ model-space Euler transform, reflected back to world coordinates.
        [ y, z ] = [ Math.cos(Angles[0]) * y - Math.sin(Angles[0]) * z, Math.sin(Angles[0]) * y + Math.cos(Angles[0]) * z ];
        [ x, z ] = [ Math.cos(Angles[1]) * x + Math.sin(Angles[1]) * z, -Math.sin(Angles[1]) * x + Math.cos(Angles[1]) * z ];
        [ x, y ] = [ Math.cos(Angles[2]) * x - Math.sin(Angles[2]) * y, Math.sin(Angles[2]) * x + Math.cos(Angles[2]) * y ];
        const ExpectedQ = O.getOrThrow(Q.Quat(Rotation.x * index / 4, Rotation.y * index / 4,
            Rotation.z * index / 4, 1 + (Rotation.w - 1) * index / 4));
        const Expected = O.getOrThrow(Q.rotateVector(ExpectedQ, { x: 0.3,
            y: 0.7,
            z: 0.9 }));
        near(x, Expected.x, 1e-4);
        near(y, Expected.y, 1e-4);
        near(-z, Expected.z, 1e-4);
    }

    Query.delta_time = 0.1;
    Frame();
    near(Variable.bf_alpha, 1);
    // Duplicate and stale sequences do not restart the clock. Skipped intervals snap.
    Frame();
    near(Variable.bf_alpha, 1);
    Object.assign(Properties, R.getOrThrow(Renderer.encode(Initial)));
    Frame();
    Assert.equal(Variable.bf_sequence, 1);
    Object.assign(Properties, R.getOrThrow(Renderer.encode({ ...Next,
        sequence: 4 })));
    Frame();
    Assert.equal(Variable.bf_skip, true);
    Assert.equal(Variable.bf_sx, Variable.bf_ex);
    const SingularQ = O.getOrThrow(Q.normalize(Q.QuatUnsafe(-0.3, -0.7, -0.3, 0.7)));
    Object.assign(Properties, R.getOrThrow(Renderer.encode({ ...Next,
        end: Pose(102, SingularQ),
        sequence: 5,
        reset: 1 })));
    Frame();
    const Angles = Root.rotation.map(Run).map((a) => a * Math.PI / 180);
    let [ x, y, z ] = [ 1, 0, 0 ];
    [ y, z ] = [ Math.cos(Angles[0]) * y - Math.sin(Angles[0]) * z, Math.sin(Angles[0]) * y + Math.cos(Angles[0]) * z ];
    [ x, z ] = [ Math.cos(Angles[1]) * x + Math.sin(Angles[1]) * z, -Math.sin(Angles[1]) * x + Math.cos(Angles[1]) * z ];
    [ x, y ] = [ Math.cos(Angles[2]) * x - Math.sin(Angles[2]) * y, Math.sin(Angles[2]) * x + Math.cos(Angles[2]) * y ];
    const Expected = O.getOrThrow(Q.rotateVector(SingularQ, V.UnitX));
    near(x, Expected.x, 1e-4);
    near(y, Expected.y, 1e-4);
    near(-z, Expected.z, 1e-4);

});

test("deterministic compiler, both owner representations, typed catalog and owned-only stale cleanup", async () =>
{
    const Root = await Fs.mkdtemp(Path.join(tmpdir(), "bedform-physics-"));
    try
    {
        await Fs.mkdir(Path.join(Root, "bp"));
        await Fs.mkdir(Path.join(Root, "rp"));
        await Fs.writeFile(Path.join(Root, "rp", "test.png"), "fixture texture bytes");
        await Fs.writeFile(Path.join(Root, "rp", "cube.json"), JSON.stringify({ "minecraft:geometry": [ {
            description: { identifier: "geometry.box" },
            bones: [ { name: "box",
                cubes: [ { origin: [ 0, 0, 0 ],
                    size: [ 16, 16, 16 ] } ] } ] } ] }));
        const Solid = { schemaVersion: 1,
            coordinates: "minecraft",
            metresPerUnit: 1,
            ...box() };
        await Fs.writeFile(Path.join(Root, "solid.json"), JSON.stringify({ ...Solid,
            fingerprint: fingerprint(Solid) }));
        await Fs.writeFile(Path.join(Root, "anchor.json"), JSON.stringify({ "minecraft:geometry": [ { description: { identifier: "geometry.anchor" },
            bones: [] } ] }));
        await Fs.writeFile(Path.join(Root, "renderer.json"), JSON.stringify({ schemaVersion: 1,
            identifier: "test:renderer",
            geometry: "anchor.json",
            geometryIdentifier: "geometry.anchor",
            assets: [] }));
        const Config = { schemaVersion: 1,
            namespace: "test",
            behaviorPack: "bp",
            resourcePack: "rp",
            models: [
                { name: "box",
                    representation: "cuboid",
                    geometry: "cube.json",
                    geometryIdentifier: "geometry.box",
                    textures: { default: "test" },
                    materials: { default: "entity_alphatest" },
                    density: 3,
                    collision: { kind: "sphere",
                        fit: true } },
                { name: "mesh",
                    representation: "particle",
                    meshSolid: "solid.json",
                    rendererDescriptor: "renderer.json",
                    collision: { kind: "complex" } } ] };
        const ConfigFile = Path.join(Root, "bedform.config.json");
        await Fs.writeFile(ConfigFile, JSON.stringify(Config));
        const Result = await compile(ConfigFile);
        Assert.deepEqual(Result.files, (await compile(ConfigFile)).files);
        Assert.deepEqual(Result.files, (await compileConfig(Config, Root)).files);
        near(Result.models[0].physical.mass, 3);
        near(Result.models[0].physical.volume, 1);
        Assert.equal(Result.models[1].representation, "particle");
        Assert.ok(Result.files["catalog/models.ts"].includes("H.ConvexHullUnsafe"));
        const Out = Path.join(Root, "out");
        await publish(Result, Out);
        await Fs.writeFile(Path.join(Out, "authored.txt"), "preserve");
        const ReducedFiles = { ...Result.files };
        delete ReducedFiles["resource_pack/entity/box.entity.json"];
        await publish({ ...Result,
            files: ReducedFiles }, Out);
        await Assert.rejects(Fs.stat(Path.join(Out, "resource_pack/entity/box.entity.json")), /ENOENT/u);
        Assert.equal(await Fs.readFile(Path.join(Out, "authored.txt"), "utf8"), "preserve");
        await Fs.writeFile(Path.join(Out, "catalog/models.ts"), "edited");
        await Assert.rejects(publish(Result, Out), /unowned or edited/u);
        // Run the actual command entrypoint against space-containing paths.
        const CliOut = Path.join(Root, "command output");
        execFileSync(process.execPath, [ new URL("../Distribution/Bin.js", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/u, "$1"), "build", "--config", ConfigFile, "--out", CliOut ]);
        Assert.ok((await Fs.stat(Path.join(CliOut, "catalog/models.ts"))).isFile());
        Object.assign(Config.models[0], { mass: 2 });
        await Fs.writeFile(ConfigFile, JSON.stringify(Config));
        await Assert.rejects(compile(ConfigFile), /mutually exclusive/u);
    }
    finally
    {
        await Fs.rm(Root, { recursive: true,
            force: true });
    }
});
