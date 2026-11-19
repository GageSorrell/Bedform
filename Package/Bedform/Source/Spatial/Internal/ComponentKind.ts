/**
 * Canonical spatial host kinds and private render-failure routing keys.
 *
 * @module bedform/Spatial/Internal/ComponentKind
 *
 * @file      ComponentKind.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * The structural host vocabulary; native content identifiers and saved-world data are unaffected.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Kind = Object.freeze({
    Bar: "bedform:Bar",
    Button: "bedform:Button",
    Callout: "bedform:Callout",
    Column: "bedform:Column",
    Content: "bedform:Content",
    Divider: "bedform:Divider",
    FramedPanel: "bedform:FramedPanel",
    Heading: "bedform:Heading",
    Image: "bedform:Image",
    InputScope: "bedform:InputScope",
    ItemStack: "bedform:ItemStack",
    Mob: "bedform:Mob",
    Panel: "bedform:Panel",
    Row: "bedform:Row",
    ScrollView: "bedform:ScrollView",
    Slider: "bedform:Slider",
    Slot: "bedform:Slot",
    TabButton: "bedform:TabButton",
    Tabs: "bedform:Tabs",
    Text: "bedform:Text",
    Title: "bedform:Title",
    TitledPanel: "bedform:TitledPanel",
    Toggle: "bedform:Toggle",
    View: "bedform:View"
} as const);

/**
 * Internal host props excluded from committed surface descriptors.
 *
 * @category Constant
 * @since 1.0.0
 */
export const InternalProp = Object.freeze({ Failure: "__bedform_failure" } as const);
