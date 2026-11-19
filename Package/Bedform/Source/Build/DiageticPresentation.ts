/**
 * Shared player body-lock, native eye-camera and race-safe first-person presentation generation.
 *
 * @module bedform/Build/DiageticPresentation
 *
 * @file      DiageticPresentation.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Bedrock content keys and expressions preserve authored ordering. */

/**
 * Identifiers supplied by the owning pack without introducing a native runtime dependency.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface PresentationOptions
{
    readonly Preset: string;
    readonly ActiveProperty: string;
    readonly LockEvent: string;
    readonly UnlockEvent: string;
    readonly LockedGroup: string;
}

/**
 * Copies pinned vanilla definitions and adds camera/body presentation without altering the source objects.
 * The local first-person guard is evaluated during selection and pre-animation, retaining other viewers
 * and inventory/map previews and avoiding reliance on property delivery order or a hard-coded FOV.
 *
 * @category Serialization
 * @since 1.0.0
 */
export const Presentation = (behavior: unknown, client: unknown, options: PresentationOptions) =>
{
    const player = JSON.parse(JSON.stringify(behavior));
    const entity = player["minecraft:entity"];
    entity.description.properties ??= {};
    entity.description.properties[options.ActiveProperty] = { client_sync: true,
        default: false,
        type: "bool" };
    entity.component_groups[options.LockedGroup] = { "minecraft:body_rotation_blocked": {} };
    entity.events[options.LockEvent] = { add: { component_groups: [ options.LockedGroup ] },
        set_property: { [options.ActiveProperty]: true } };
    entity.events[options.UnlockEvent] = { remove: { component_groups: [ options.LockedGroup ] },
        set_property: { [options.ActiveProperty]: false } };
    const resource = JSON.parse(JSON.stringify(client));
    const description = resource["minecraft:client_entity"].description;
    const localWorld = "query.is_local_player && !variable.is_paperdoll && !variable.map_face_icon";
    const firstPerson = "(variable.is_first_person || (" + localWorld +
        ` && (query.property('${options.ActiveProperty}') || query.distance_from_camera < 2.0)))`;
    for (const entry of description.render_controllers as Array<Record<string, string>>)
    {
        for (const name of Object.keys(entry))
        {
            entry[name] = entry[name].replaceAll("variable.is_first_person", firstPerson);
        }
    }

    description.scripts.pre_animation.unshift(`variable.is_first_person = ${firstPerson};`);
    return { Behavior: player,
        Client: resource,
        Preset: { format_version: "1.21.0",
            "minecraft:camera_preset": { identifier: options.Preset,
                inherit_from: "minecraft:free",
                listener: "player",
                player_effects: true } } };
};
