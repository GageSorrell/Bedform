/**
 * Candidate JSON UI mechanisms; native behavior remains subject to client acceptance.
 *
 * @module @sorrell/documentation-probe/Tool/Controls
 *
 * @file      Controls.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Shared namespace for the experimental registry and shell.
 *
 * @category Constant
 * @since 1.0.12
 */
export const Namespace = "bedform_docs_probe";

/**
 * Prefix marker excluded from the probe query alphabet.
 *
 * @category Constant
 * @since 1.0.12
 */
export const Sentinel = "\uE100";

/**
 * Marks an unevaluated state; printable-ASCII indexes cannot consume this character.
 *
 * @category Constant
 * @since 1.0.12
 */
export const PendingQuery = "\uE101";

/**
 * Stable resource and module identities for the experimental shared pack.
 *
 * @category Constant
 * @since 1.0.12
 */
export const CommonIdentity = Object.freeze({
    moduleUuid: "32b81773-74fa-4ccf-a611-c45b232dc830",
    uuid: "17a576bd-8702-4781-86b6-a008ad771faf"
});

/**
 * Reads a sibling/descendant control's property using the client's view binding mechanism.
 *
 * @category Factory
 * @since 1.0.12
 */
export function View(control, expression, target = "#visible")
{
    return {
        binding_type: "view",
        source_control_name: control,
        source_property_name: expression,
        target_property_name: target
    };
}

/**
 * Creates a native label with an explicit measured probe height.
 *
 * @category Factory
 * @since 1.0.12
 */
export function Label(text, height = 20)
{
    return {
        color: [ 1, 1, 1 ],
        localize: false,
        shadow: true,
        size: [ "100%", height ],
        text,
        text_alignment: "left",
        type: "label"
    };
}

/**
 * Displays one direct native expression independently of the generated search chain.
 *
 * @category Testing
 * @since 1.0.12
 */
export function Probe(name, expression, siblingScope = false)
{
    return {
        ...Label("#probe_display", 28),
        bindings: [ {
            ...View("docs_query_text", `('${name}=[' + ${expression} + ']')`, "#probe_display"),
            ...(siblingScope ? { resolve_sibling_scope: true } : {})
        } ],
        property_bag: { "#probe_display": `${name}=[not evaluated]` }
    };
}

/**
 * Creates a vertical stack for measured probe controls.
 *
 * @category Factory
 * @since 1.0.12
 */
export function Stack(controls, size = [ "100%", "100%c" ])
{
    return {
        controls,
        orientation: "vertical",
        size,
        type: "stack_panel"
    };
}

/**
 * Uses only native toggle state; radio groups are deliberately shared across contributions.
 *
 * @category Factory
 * @since 1.0.12
 */
export function Toggle(text, group, index, selected = false)
{
    return {
        bindings: [ {
            binding_condition: "always",
            binding_name: "#toggle_state"
        } ],
        button_mappings: [ {
            from_button_id: "button.menu_select",
            mapping_type: "pressed",
            to_button_id: "button.menu_select"
        }, {
            from_button_id: "button.menu_ok",
            mapping_type: "focused",
            to_button_id: "button.menu_ok"
        } ],
        checked_control: "on",
        checked_hover_control: "hover",
        controls: [ {
            on: Label(`§a${text}`)
        }, {
            off: Label(`§7${text}`)
        },
        {
            hover: Label(`§e> ${text}`)
        } ],
        focus_enabled: true,
        focus_identifier: `${group}_${index ?? text}`,
        radio_toggle_group: index !== undefined,
        size: [ "100%", 22 ],
        toggle_default_state: selected,
        toggle_group_default_selected: 0,
        toggle_group_forced_index: index ?? -1,
        toggle_name: group,
        type: "toggle",
        unchecked_control: "off",
        unchecked_hover_control: "hover"
    };
}

/**
 * A native edit box with local text state, avoiding screen-controller-owned form bindings.
 *
 * @category Factory
 * @since 1.0.12
 */
export function Edit(name, initial = "")
{
    return {
        button_mappings: [
            {
                from_button_id: "button.menu_select",
                handle_select: true,
                mapping_type: "pressed",
                to_button_id: "button.text_edit_box_selected"
            },
            {
                from_button_id: "button.menu_ok",
                handle_select: true,
                mapping_type: "focused",
                to_button_id: "button.text_edit_box_selected"
            },
            {
                consume_event: false,
                from_button_id: "button.menu_cancel",
                handle_deselect: true,
                mapping_type: "global",
                to_button_id: "button.text_edit_box_deselected"
            }
        ],
        controls: [ {
            background: {
                alpha: 0.8,
                texture: "textures/ui/Black",
                type: "image"
            }
        }, {
            [`${name}_text`]: {
                ...Label("#text"),
                property_bag: {
                    "#property_field": "#text",
                    "#text": initial
                }
            }
        } ],
        default_control: "background",
        enabled: true,
        focus_enabled: true,
        hover_control: "background",
        max_length: 256,
        pressed_control: "background",
        property_bag: {
            "#property_field": "#text",
            "#text": initial
        },
        size: [ "100%", 22 ],
        text_box_name: name,
        text_control: `${name}_text`,
        text_type: "ExtendedASCII",
        type: "edit_box"
    };
}

/**
 * Emits a greedy subsequence automaton, one binding per indexed character. A sentinel makes
 * subtraction remove a character only at the beginning of the remaining query. ASCII case
 * pairs are emitted together. This depends on UNVERIFIED client string-subtraction semantics.
 *
 * @throws { Error } If the index is outside the supported probe alphabet.
 *
 * @category Encoding
 * @since 1.0.12
 */
export function Search(index, prefix)
{
    if (!/^[\x20-\x7E]*$/.test(index) || index.includes("'"))
    {
        throw new Error("The feasibility index supports printable ASCII without apostrophes only.");
    }

    const controls = [];
    let previous = "docs_query_text";
    let property = "#text";
    for (const [ position, character ] of [ ...index.toLowerCase() ].entries())
    {
        const name = `${prefix}_step_${position}`;
        let expression = `('${Sentinel}' + ${property})`;
        for (const variant of new Set([ character, character.toUpperCase() ]))
        {
            expression = `(${expression} - '${Sentinel}${variant}')`;
        }

        expression = `(${expression} - '${Sentinel}')`;
        controls.push({
            [name]: {
                alpha: 0,
                bindings: [ { ...View(previous, expression, "#text"),
                    binding_condition: "always" } ],
                property_bag: {
                    "#text": PendingQuery
                },
                size: [ 1, 1 ],
                text: "#text",
                type: "label"
            }
        });
        previous = name;
        property = "#text";
    }

    return {
        controls,
        last: previous
    };
}

/**
 * Candidate shared controls. Contributions modify only the empty registration panel.
 *
 * @category Factory
 * @since 1.0.12
 */
export function Common()
{
    const directory = Toggle("Home / directory", "docs_route", 0);
    const open = Toggle("Documentation", "docs_visibility", 1);
    open.size = [ 114, 22 ];
    open.anchor_from = "top_right";
    open.anchor_to = "top_right";
    open.offset = [ -10, 4 ];
    open.layer = 110;
    open.bindings.push({
        binding_type: "view",
        source_property_name: "(not #toggle_state)",
        target_property_name: "#visible"
    });
    const close = Toggle("Documentation / X", "docs_visibility", 0);
    close.anchor_from = open.anchor_from;
    close.anchor_to = open.anchor_to;
    close.bindings.push(View("docs_open", "#toggle_state"));
    close.layer = open.layer;
    close.offset = open.offset;
    close.size = open.size;
    const closeInside = Toggle("X", "docs_visibility", 0);
    closeInside.anchor_from = "top_right";
    closeInside.anchor_to = "top_right";
    closeInside.focus_identifier = "docs_close_inside";
    closeInside.layer = 200;
    closeInside.offset = [ -2, 2 ];
    closeInside.size = [ 22, 22 ];
    close.focus_identifier = "docs_close_launcher";
    const sidebar = Stack([
        {
            docs_directory: directory
        },
        {
            instructions: Label("Full index probe: fOp / FOP / ppwf / zz", 36)
        },
        {
            docs_query: Edit("docs_query")
        },
        {
            query_echo: {
                ...Label("#query_display", 20),
                bindings: [ View("docs_query_text", "('Query=[' + #text + ']')", "#query_display") ],
                property_bag: { "#query_display": "Query=[not bound]" }
            }
        },
        {
            minus_probe: Probe("minus", "('aaa' - 'a')")
        },
        {
            ascii_probe: Probe("ascii", "(('~zz' - '~a') - '~')")
        },
        {
            marker_probe: Probe("marker", `(('${Sentinel}zz' - '${Sentinel}a') - '${Sentinel}')`)
        }
    ], [ 150, "100%c" ]);
    sidebar.anchor_from = "top_left";
    sidebar.anchor_to = "top_left";
    sidebar.offset = [ 0, 24 ];
    const content = {
        controls: [ {
            title: {
                ...Label("Documentation feasibility probe — 9a8v.1", 20),
                anchor_from: "top_left",
                anchor_to: "top_left"
            }
        }, { sidebar }, {
            [`registry@${Namespace}.registry`]: {
                anchor_from: "bottom_right",
                anchor_to: "bottom_right",
                offset: [ 0, -100 ],
                size: [ "100% - 160px", "100% - 124px" ]
            }
        }, {
            [`diagnostics@${Namespace}.diagnostics`]: {
                anchor_from: "bottom_left",
                anchor_to: "bottom_left",
                layer: 300,
                size: [ "100%", "100%c" ]
            }
        } ],
        size: [ "100% - 20px", "100% - 8px" ],
        type: "panel"
    };
    return {
        content,
        diagnostics: Stack([ { heading: Label("Binding diagnostics (always visible)", 18) } ]),
        namespace: Namespace,
        registry: {
            controls: [ { recovery_status: {
                ...Label(
                    "Full fixture indexes and text results only. Page rendering remains disabled.", 72),
                anchor_from: "top_left",
                anchor_to: "top_left"
            } }, {
                input_probes: {
                    ...Stack([
                        { direct: Probe("direct", "#text") },
                        { sibling: Probe("sibling", "#text", true) }
                    ]),
                    anchor_from: "top_left",
                    anchor_to: "top_left",
                    offset: [ 0, 80 ]
                }
            } ],
            type: "panel"
        },
        root: {
            controls: [
                {
                    docs_open: open
                },
                {
                    docs_close: close
                },
                {
                    overlay: {
                        bindings: [ View("docs_open", "#toggle_state") ],
                        controls: [
                            {
                                background: {
                                    alpha: 0.96,
                                    texture: "textures/ui/Black",
                                    type: "image"
                                }
                            },
                            {
                                [`content@${Namespace}.content`]: {

                                }
                            },
                            {
                                docs_close_inside: closeInside
                            }
                        ],
                        layer: 100,
                        offset: [ 0, 15 ],
                        size: [ "100%", "100% - 30px" ],
                        type: "panel"
                    }
                }
            ],
            layer: 100,
            type: "panel"
        }
    };
}

/**
 * Preserves the experimental renderer for offline investigation; normal builds never emit it.
 *
 * @category Factory
 * @since 1.0.12
 */
export function ExperimentalContribution(fixture)
{
    const { id, name, page, route, target, targetRoute } = fixture;
    const ns = `docs_probe_${id}`;
    const index = `${page.title} ${page.heading} ${page.body}`;
    const search = Search(index, id);
    const infobox = Stack([
        {
            band: {
                ...Label(page.title, 28),
                font_type: "MinecraftTen"
            }
        },
        {
            type: Label(`Type: ${page.type}`)
        }, {
            identifier: Label(page.identifier, 30)
        },
        {
            fact: Label("Fixture fact: conditional / authored", 30)
        }
    ]);
    const intro = Label(`${page.body}\nWrap test: a longer introduction beside the infobox.`, 64);
    const layouts = {

    };
    for (const compact of [ false, true ])
    {
        const box = structuredClone(infobox);
        const introduction = structuredClone(intro);
        box.size = [ compact ? "100%" : "45%", "100%c" ];
        introduction.size = [ compact ? "100%" : "55%", compact ? 64 : "100%" ];
        layouts[compact ? "compact" : "wide"] = {
            bindings: [ View("docs_compact", compact ? "#toggle_state" : "(not #toggle_state)") ],
            controls: compact ? [ {
                box
            }, {
                introduction
            } ] : [ {
                introduction
            }, {
                box
            } ],
            orientation: compact ? "vertical" : "horizontal",
            size: [ "100%", "100%c" ],
            type: "stack_panel"
        };
    }

    const link = Toggle(`Open ${target} (bedform://docs/${target}/@readme)`, "docs_route", targetRoute);
    link.property_bag = {
        "#available": false
    };
    link.bindings.push(View(`${target}_available`, "#available", "#available"),
        {
            binding_type: "view",
            source_property_name: "#available",
            target_property_name: "#enabled"
        });
    const url = "https://example.com/bedform?source=docs#copy-me";
    const section = Toggle(`Jump to #${page.heading.toLowerCase().replaceAll(" ", "-")}`, `${id}_heading`);
    const body = Stack([
        {
            title: {
                ...Label(`${name} / ${page.title}`, 28),
                font_type: "MinecraftTen"
            }
        },
        {
            cross_link: link
        },
        {
            availability: {
                ...Label(`Target ${target}: green link = active contribution; grey = absent.`, 28)
            }
        },
        {
            [`${id}_heading`]: section
        },
        ...Object.entries(layouts).map(([ key, value ]) => ({
            [key]: value
        })),
        {
            introduction_tail: Label("Following body starts below the taller introduction/infobox.", 26)
        },
        {
            heading: {
                ...Label(page.heading, 28),
                font_type: "MinecraftTen"
            }
        },
        ...Array.from({
            length: 14
        }, (_, line) => ({
            [`line_${line}`]: Label(`Scroll evidence ${line + 1}: ${page.body}`, 26)
        })),
        {
            url_toggle: Toggle("External Link / Show URL", `${id}_url`)
        },
        {
            url_panel: {
                bindings: [ View("url_toggle", "#toggle_state") ],
                controls: [
                    {
                        text: {
                            ...Label("Select all and copy; edits must survive typing.", 24),
                            anchor_from: "top_left",
                            anchor_to: "top_left"
                        }
                    },
                    {
                        url: {
                            ...Edit(`${id}_url_text`, url),
                            offset: [ 0, 16 ]
                        }
                    }
                ],
                size: [ "100%", 84 ],
                type: "panel"
            }
        }
    ]);
    // Alternate anchored content is a focus/position experiment, not a claimed scroll-to API.
    const headingBody = Stack([
        {
            heading: {
                ...Label(`${page.heading} (heading target)`, 28),
                font_type: "MinecraftTen"
            }
        },
        {
            warning: Label(
                "Candidate swaps to an anchored view; original scroll restoration is unproven.", 40)
        },
        {
            back: Toggle("Return to introduction", `${id}_heading`)
        },
        ...Array.from({
            length: 10
        }, (_, line) => ({
            [`section_${line}`]: Label(`${line + 1}. ${page.body}`, 26)
        }))
    ]);
    const routeControl = Toggle(`${name}: ${page.title}`, "docs_route", route);
    routeControl.bindings.push(View("docs_directory", "#toggle_state", "#directory"),
        View(`docs_filter_${page.type}`, "#toggle_state", "#included"),
        {
            binding_type: "view",
            source_property_name: "(#directory and #included)",
            target_property_name: "#visible"
        });
    const result = Toggle(`Search: ${page.title} / ${page.type} / @readme`, "docs_route", route);
    result.tooltip_text = page.description;
    result.bindings.push(View(search.last, "(#text = '')", "#match"),
        View("docs_query_text", "(not (#text = ''))", "#query"),
        View(`docs_filter_${page.type}`, "#toggle_state", "#included"),
        View("docs_directory", "#toggle_state", "#directory"),
        {
            binding_type: "view",
            source_property_name: "(#match and #query and #included and #directory)",
            target_property_name: "#visible"
        });
    const card = {
        bindings: [ View(`${id}_route`, "#toggle_state") ],
        controls: [
            {
                intro_scroll: {
                    bindings: [ View(`${id}_heading`, "(not #toggle_state)") ],
                    controls: [ {
                        ["scroll@common.scrolling_panel"]: {
                            $scrolling_content: `${ns}.body`,
                            size: [ "100%", "100%" ]
                        }
                    } ],
                    type: "panel"
                }
            },
            {
                anchor_scroll: {
                    bindings: [ View(`${id}_heading`, "#toggle_state") ],
                    controls: [ {
                        ["scroll@common.scrolling_panel"]: {
                            $scrolling_content: `${ns}.heading_body`,
                            size: [ "100%", "100%" ]
                        }
                    } ],
                    type: "panel"
                }
            }
        ],
        size: [ "100%", "100%" ],
        type: "panel"
    };
    return {
        definitions: {
            body,
            diagnostic: {
                controls: [ {
                    caption: {
                        ...Label(`${id} tail =`, 18),
                        size: [ 90, 18 ]
                    }
                }, {
                    value: {
                        ...Label("#tail_display", 18),
                        bindings: [ View(search.last, "('[' + #text + ']')", "#tail_display") ],
                        property_bag: { "#tail_display": "[not bound]" },
                        size: [ "fill", 18 ]
                    }
                } ],
                orientation: "horizontal",
                size: [ "100%", 18 ],
                type: "stack_panel"
            },
            entry: {
                controls: [
                    {
                        [`${id}_available`]: {
                            property_bag: {
                                "#available": true
                            },
                            size: [ 0, 0 ],
                            type: "panel"
                        }
                    },
                    ...search.controls,
                    {
                        [`${id}_route`]: {
                            ...routeControl,
                            anchor_from: "top_left",
                            anchor_to: "top_left",
                            offset: [ 0, route * 25 ]
                        }
                    },
                    {
                        [`${id}_result`]: {
                            ...result,
                            anchor_from: "top_left",
                            anchor_to: "top_left",
                            offset: [ 0, 70 + route * 25 ]
                        }
                    },
                    {
                        card
                    }
                ],
                size: [ "100%", "100%" ],
                type: "panel"
            },
            heading_body: headingBody,
            namespace: ns
        },
        index,
        sharedRegistration: {
            diagnostics: {
                modifications: [ {
                    array_name: "controls",
                    operation: "insert_back",
                    value: [ { [`${id}_diagnostic@${ns}.diagnostic`]: {} } ]
                } ]
            },
            namespace: Namespace,
            registry: {
                modifications: [
                    {
                        array_name: "controls",
                        operation: "insert_back",
                        value: [ {
                            [`${id}@${ns}.entry`]: {

                            }
                        } ]
                    }
                ]
            }
        }
    };
}

/**
 * Creates a full-index binding probe within the proven footer, with plain text results. Page,
 * scrolling and navigation controls from the experimental registry are never emitted.
 *
 * @category Factory
 * @since 1.0.12
 */
export function Contribution(fixture)
{
    const { id, page } = fixture;
    const ns = `docs_probe_${id}`;
    const probeIndex = `${page.title} ${page.heading} ${page.body}`;
    const search = Search(probeIndex, id);
    const result = Label(`Search: ${page.title} | ${page.type} | @readme`, 18);
    result.bindings = [
        View(search.last, "(#text = '')", "#matched"),
        View("docs_query_text", "(not (#text = ''))", "#has_query"),
        { binding_type: "view",
            source_property_name: "(#matched and #has_query)",
            target_property_name: "#visible" }
    ];
    result.property_bag = { "#has_query": false,
        "#matched": false };
    result.tooltip_text = page.description;
    return {
        definitions: {
            diagnostic: {
                controls: [ ...search.controls, {
                    caption: {
                        ...Label(`${id} tail =`, 18),
                        size: [ 90, 18 ]
                    }
                }, {
                    value: {
                        ...Label("#tail_display", 18),
                        bindings: [ View(search.last, "('[' + #text + ']')", "#tail_display"),
                            View(search.last, `(not (#text = '${PendingQuery}'))`) ],
                        property_bag: { "#tail_display": "[not bound]" },
                        size: [ "fill", 18 ]
                    }
                }, {
                    pending: {
                        ...Label("[pending]", 18),
                        bindings: [ View(search.last, `(#text = '${PendingQuery}')`) ],
                        size: [ "fill", 18 ]
                    }
                } ],
                orientation: "horizontal",
                size: [ "100%", 18 ],
                type: "stack_panel"
            },
            namespace: ns,
            result
        },
        index: `${page.title} ${page.heading} ${page.body}`,
        probeIndex,
        searchSteps: search.controls.length,
        sharedRegistration: {
            diagnostics: {
                modifications: [ {
                    array_name: "controls",
                    operation: "insert_back",
                    value: [ { [`${id}_diagnostic@${ns}.diagnostic`]: {} },
                        { [`${id}_result@${ns}.result`]: {} } ]
                } ]
            },
            namespace: Namespace
        }
    };
}
