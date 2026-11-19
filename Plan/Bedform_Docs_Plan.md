# Bedform in-game documentation with frontmatter

## Summary and player experience

Build a Classic-profile JSON UI documentation browser in BedformCommon, with build-time Markdown compilation and metadata extraction in bedform. Every rebuilt bedform add-on contributes an entry, even without authored documentation.

- Prepend a documentation icon button to the upper-right tabs on inventory and crafting-table screens.
- Open a "Documentation" window with sidebar/main-panel layout and a typical upper-right close button. Closing restores the underlying screen.
- Initially select a distinguished bedform sidebar entry explaining bedform and how compatible add-ons supply documentation.
- Selecting an add-on displays its supplied or generated ReadMe. Prepend the add-on's name as an H1, with a "Documentation" button flush right on that row.
- That button opens the add-on's documentation browser. A top-left back arrow returns to the directory; X closes documentation entirely.
- Its sidebar contains distinguished Home, an expandable folder/document tree, and a separated ReadMe entry at the bottom. Use the Mojangles house glyph for Home and changing open/closed folder icons.
- Use native text, images, and controls. Headings use `MinecraftTen` with the client's fallback behavior, following [Mojang's heading control](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/ui/ui_common.json).
- Keep sidebar and document scrolling independent. Navigation and filter state last only until documentation closes.

## Authoring contract

Add optional `Documentation` configuration with `Id`, `Root`, `ReadMe`, `Home`, `Navigation`, `AllowRemoteImages`, and `Types`.

- Default identity to the package name, otherwise the primary manifest UUID. Default `Root` to `Documentation` when present.
- Resolve configured paths relative to the configuration file. Recursively discover Markdown; navigation overrides control hierarchy and ordering, without overriding document titles.
- Default tree order is folders first, then documents alphabetically by resolved title.
- Generate missing ReadMe/Home content from available add-on metadata. Reserve Home and ReadMe routes and exclude their source files from ordinary discovery.
- `Types` declares add-on-local custom page types with a display name, optional icon, and optional infobox field schema. Built-in names are reserved; internally qualify custom types by add-on identity.

Parse YAML frontmatter before Markdown:

```yaml
---
title: Stirling Engine
description: Produces power by burning solid fuel.
type: block
identifier: buildcraft:engine_stirling
related:
  - ../power/overview.md
  - bedform://docs/another-addon/pipes.md
references:
  - https://example.com/reference
infobox:
  image: ./images/stirling-engine.png
  caption: A Stirling engine
  tool: Pickaxe
---

Introductory text appears here, before any heading.

## Operation
...
```

| Field | Contract |
| --- | --- |
| `title` | Optional when an associated subject has a resolvable in-game name; otherwise required. |
| `description` | Optional plain-text tooltip for sidebar and search-result entries. |
| `type` | `block`, `item`, `entity`, `biome`, `structure`, `dimension`, or a declared custom type. Omission means a general page. |
| `identifier` | Required for built-in subject types; optional for custom types. |
| `related` | Optional ordered list of at most three documentation-page addresses, including cross-add-on addresses. |
| `references` | Optional ordered HTTP(S) URL list, with no documentation-specific count limit. |
| `infobox` | Optional record overriding/extending inferred data; `false` disables the infobox. |

Additional rules:

- Resolve titles from frontmatter first, then the associated subject's in-game display name. Never derive titles from headings, filenames, identifiers, or humanized paths. Fail with an actionable diagnostic if neither source supplies a name.
- Resolve localized display names from staged pack definitions and translations. Preserve available translations and use en_US as the build-time search fallback. Subjects without a discoverable display name require `title`.
- General pages require a frontmatter title. Generated Home/ReadMe pages receive system-provided titles.
- Reject malformed metadata, undeclared custom types, incompatible infobox values, and more than three related pages, reporting source locations.
- Render "Related pages" followed by "References" after the document body. Omit empty sections. Reference labels display their URLs; related-page labels use resolved target titles when available.

## Infobox compilation and document rendering

Compile GFM into native JSON UI labels, panels, images, and interactive links. Support headings, paragraphs, emphasis, strikethrough, lists, task lists, quotations, code, tables, images, and links. Task checkboxes are display-only; raw HTML is displayed as text.

### Infobox behavior

- Associated built-in and custom-type pages receive infoboxes automatically unless `infobox: false`.
- General pages receive an infobox only when an infobox record is supplied.
- Merge available extracted facts with frontmatter overrides. Required identity fields come from the resolved title, type, and identifier; do not require unavailable gameplay facts.
- Use distinct built-in templates and meaningful row groups:

| Type | Supported inferred information |
| --- | --- |
| Block | Display name, identifier, states, mining/explosion properties, light, and loot reference where explicitly defined. |
| Item | Display name, identifier, icon, stack size, durability, and food properties where defined. |
| Entity | Display name, identifier, health, movement, collision size, and summon/spawn flags where defined. |
| Biome | Identifier, climate, precipitation, and tags where defined. |
| Structure | Identifier and dimensions from its packaged `.mcstructure` data. |
| Dimension | Identifier and facts available in packaged declarations; remaining information is authored explicitly. |

- Extract from final staged content, including generated assets. Read only supported, verified schemas. Do not execute scripts, inspect a running world, or invent missing defaults.
- Preserve conditional distinctions: values differing across permutations or component groups must be labeled conditional rather than presented as universal facts.
- Give each template a title band, optional image/caption area, and type-specific grouped rows. Omit absent rows and empty groups.
- Custom field schemas define labels, order, scalar/list value types, and required fields. Without a schema, render authored fields as ordered key/value rows. General pages use this same generic layout.
- Infobox images follow the documentation image policy. Do not automatically generate 3D subject previews.

### Introduction and placement

- Determine the introduction from the authored Markdown body before its first heading, after removing frontmatter. Generated page-title controls do not count as headings.
- On wide layouts, place the introduction left and infobox right. Begin subsequent sections below the taller column, using the full document width.
- With no introduction, place the infobox first, followed by the body. With no headings, the entire body is the introduction.
- Compact layouts stack the infobox above the introduction.
- Use measured layout for wrapping, clickable spans, tables, and code without overflowing the document viewport.

Local images are bundled. Remote images fail builds by default with instructions for enabling `Documentation.AllowRemoteImages`; opted-in downloads happen during builds, and download failures fail the build.

## Search, filtering, and navigation

- Give built-in subject types distinct icons in both sidebar and search results. Custom types use their optional declared icon, otherwise the general-document icon.
- Place a settings icon flush right across from Home's label. It opens a checkbox dropdown for all six built-in types, General, and declared custom types.
- Select every type initially. Filters affect sidebar documents and search results; hide folders with no visible descendants. Keep Home and ReadMe accessible.
- Direct links and related-page links can open filtered pages. Keep the selected document visible without changing filter selections.
- Home contains basic add-on information and live search. Match case-insensitive subsequences across titles, headings, and full document text; prefer contiguous/title matches over loose body matches.
- Nonempty queries show document title, type icon, path, excerpt, and the optional description tooltip. Empty queries hide results; unmatched queries show a no-results state.
- Use the same description tooltip on sidebar entries, accessible through hover and controller focus.

Support relative page links, GitHub-style heading fragments, and:

```text
bedform://docs/<encoded-addon-id>/<page-path>#<heading>
```

Reserve `@home` and `@readme` destinations. Determine cross-add-on availability from active documentation contributions.

- Disabled links retain hover/focus explanations containing their address and the specific failure: missing add-on, page, heading, or malformed destination.
- When the target add-on is available, expose a hover/focus action opening its ReadMe.
- External HTTP(S) links have distinct styling and open a modal containing a generated QR code, "External Link" caption, help toggle, and "Show URL" button.
- Help expands downward to explain that Minecraft cannot open external links. "Show URL" reveals an editable prefilled field for copying; edits do not alter the QR destination.
- Modal dismissal restores document position and focus. Block input to controls underneath it.

## Build architecture and acceptance

- Add a host-only `bedform/Build/Documentation` compiler and update generated configuration types/schema, path resolution, CLI configuration recognition, and author guides.
- Package each add-on's documentation in its own resource pack with stable identities derived from its documentation identity. Add staged dependencies, including for behavior-only projects.
- BedformCommon owns shared controls and contribution points. Consumer builds contribute uniquely named definitions/assets without customizing the common archive.
- Preserve authored files, common-pack deduplication, failure workspaces, and atomic output publication. Bump common package/manifest versions together while retaining UUIDs.

Validate in this order:

1. **Client feasibility:** prove independent contribution merging in both pack orders, cross-add-on routing, heading navigation, live fuzzy search, type filtering, infobox layout, and URL copying before broad renderer implementation. These remain required gates; do not substitute weaker search behavior silently.
2. **Metadata/compiler tests:** cover title precedence and failures, all built-in/custom types, optional descriptions, related/reference validation, extraction and overrides, conditional facts, custom schemas, missing fields, and infobox suppression.
3. **Rendering/link tests:** cover GFM, Unicode, introduction boundaries, compact/wide layouts, long infoboxes, duplicate heading slugs, broken targets, QR decoding, and remote-image policy.
4. **Packaging tests:** use independently installed npm consumers, including behavior-only and multiple add-on fixtures; verify one unchanged shared common pack and preservation of previous output after failed builds.
5. **Real-client acceptance:** check both Classic screens, Survival/Creative, mouse/keyboard/controller, scrolling, tooltips, filters, search, modal focus, and back/close behavior. Run bedform verification and BedformCommon checks afterward.

Follow repository TSDoc/generator conventions and create Beads implementation issues before editing code. Preserve unrelated workspace changes. Pocket UI, runtime-authored documents, persistent history, typo-correcting search, deployment, and publishing remain outside this version.

## Beads implementation entries

Epic: `MineCraft-9a8v` - Bedform in-game documentation browser with frontmatter and infoboxes.

Each child includes its deliverable, acceptance criteria, and a link to this specification. Beads is the source of truth for task status; this document is the implementation specification. The graph below records implementation dependencies, not completion status.

| Entry | Deliverable | Depends on |
| --- | --- | --- |
| `MineCraft-9a8v.1` | Prove client composition, routing, search and input feasibility | - |
| `MineCraft-9a8v.2` | Configuration, frontmatter and custom page types | `MineCraft-9a8v.1` |
| `MineCraft-9a8v.3` | Subject names and extracted infobox facts | `MineCraft-9a8v.2` |
| `MineCraft-9a8v.4` | Native GFM layout compiler and image assets | `MineCraft-9a8v.2` |
| `MineCraft-9a8v.5` | Shared Classic windows, launchers and contribution routing | `MineCraft-9a8v.1`, `MineCraft-9a8v.2` |
| `MineCraft-9a8v.6` | Built-in/custom infobox rendering and introduction placement | `MineCraft-9a8v.3`, `MineCraft-9a8v.4`, `MineCraft-9a8v.5` |
| `MineCraft-9a8v.7` | Live fuzzy search, descriptions, type icons and filters | `MineCraft-9a8v.3`, `MineCraft-9a8v.4`, `MineCraft-9a8v.5` |
| `MineCraft-9a8v.8` | Related pages, references, cross-add-on links and QR modal | `MineCraft-9a8v.2`, `MineCraft-9a8v.4`, `MineCraft-9a8v.5` |
| `MineCraft-9a8v.9` | Add-on build integration and independent documentation packs | `MineCraft-9a8v.2` through `MineCraft-9a8v.8` |
| `MineCraft-9a8v.10` | Automated regressions and offline npm-consumer verification | `MineCraft-9a8v.9` |
| `MineCraft-9a8v.11` | Authoring guides, examples and release maintenance | `MineCraft-9a8v.9` |
| `MineCraft-9a8v.12` | Physical Classic UI acceptance and final quality gates | `MineCraft-9a8v.10`, `MineCraft-9a8v.11` |

Implementation issues remain open until their acceptance criteria are actually met. Saving this plan and creating the issue graph do not implement the feature or establish client feasibility. Any BDS acceptance fixture must use its add-on runner and fixed `dist/bds-runtime/bedrock_server.exe` path without ordinary-test elevation. No deployment, publication, git commit/push, or remote Dolt sync is part of this planning handoff.
