/**
 * Checks structural native injection, surface contracts, audience policies and async root lifetimes.
 *
 * @module bedform/Test/SpatialRuntime.types
 *
 * @file      SpatialRuntime.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixtures retain lifetime order and infer callbacks from public contracts. */
/* eslint-disable sort-keys */

import * as Renderer from "bedform/Spatial/Renderer";
import { Start } from "bedform/Spatial/Renderer";
import type { Viewer } from "bedform/Spatial/Renderer";

/**
 * Models a consumer backend without requiring ambient Node or DOM declarations.
 *
 * @category Testing
 * @since 1.0.0
 */
export function Check(configuration: Renderer.Configuration, viewer: Viewer): Promise<void>
{
    const factory: Renderer.SurfaceFactory = {
        Create: (context: Renderer.SurfaceContext): Renderer.Surface =>
        {
            const release = context.Own((): void => undefined);
            return { Commit: (frame: Renderer.SurfaceFrame): void =>
            {
                void frame.Nodes;
            },
            Update: (): void => undefined,
            Dispose: release };
        }
    };
    const runtime: Renderer.Runtime = Start({ ...configuration,
        Surface: factory });
    const root: Renderer.Root = Renderer.CreateRoot(runtime, { Player: viewer });
    const shared = Renderer.CreateRoot(runtime, { Shared: true,
        Audience: () => [ viewer ] });
    // @ts-expect-error A private root requires a player.
    Renderer.CreateRoot(runtime, {});
    // @ts-expect-error Shared roots require an explicit audience provider.
    Renderer.CreateRoot(runtime, { Shared: true });
    // @ts-expect-error A private root cannot omit Player by supplying an implicit shared audience.
    Renderer.CreateRoot(runtime, { Audience: () => [ viewer ] });
    // @ts-expect-error Unmount completion is asynchronous.
    const invalid: void = root.Unmount();
    void invalid;
    root.Render(null);
    const release: () => void = root.Own(() => undefined);
    release();
    return Promise.all([ root.Unmount(), shared.Unmount() ]).then(() => runtime.Dispose());
}
