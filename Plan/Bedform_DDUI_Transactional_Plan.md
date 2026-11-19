# Plan: `bedform/DDUI/Transactional`, an undo/redo/reset component for CustomForm

## Context

Bedform's `CustomForm` subclass ([CustomForm.ts](Package/Bedform/Source/DDUI/CustomForm.ts)) has one component so far, `direction`. You want a second one: a row of **Undo** and **Redo** buttons, plus an optional **Reset** button with an inline "Are you sure?" confirmation. It should record changes to the form's inputs in chunks, so one Undo reverses a meaningful edit rather than a single keystroke.

What I found:
- The native `multiButtonRow(buttons, { visible })` takes up to 3 `ButtonData`. Each button's `options` has `imageDetails { imagePackId, imageSrc }` and an observable `disabled`/`visible`. `spacer`, `label` and `divider` all accept `visible: ObservableBoolean`, so the confirmation area can show and hide while the form is open.
- Vanilla textures don't resolve in DDUI by pack UUID (MineCraft-6jv.1). Icons that live in a pack we ship, referenced as `<pack uuid>` + `textures/...png`, do work (that's how IC2's icons worked). So every icon, including the trash can, will be generated into the **Bedform Common** resource pack (UUID `c15f802e-…`), the same way [DirectionPreview.mts](Addon/BedformCommon/Tool/DirectionPreview.mts) generates its art.

Your decisions:
- Trash can: a generated Bedform pixel trash can, not the vanilla one.
- Reset is undoable as one history step.
- After a confirmed reset, "Are you sure?" and the confirm row hide and the yellow "Reset complete!" stays. The whole area collapses on the next action.
- Checkmark: green.

## Component behaviour

`form.transactional(options?)`. The options are `reset?: boolean` (default false), `chunkWindow?: number` (ms of inactivity that ends a chunk, default 1000) and `historyLimit?: number` (default 100). It returns the form. Adding the component twice to one form throws `{ Error }`.

Layout, in order:
1. `multiButtonRow`: Undo ↩, Redo ↪, and Reset 🗑 if `reset` is set. Undo is disabled when there is nothing to undo, Redo when there is nothing to redo, and Reset when every input already holds its initial value.
2. Added only when `reset` is set, all hidden at first:
   - `spacer` (the empty line)
   - `label` "Are you sure?"
   - `multiButtonRow`: Cancel ✕ (white), Reset ✓ (green)
   - `label` "Reset complete!" in yellow (a `§e` rawtext prefix)
   - `divider`

The confirmation area uses three ObservableBooleans: `Open` (spacer and divider), `Asking` (question and confirm row) and `Done` (yellow text).
- **Reset** sets Open and Asking on, and Done off.
- **Cancel** turns all three off.
- **Confirm** calls `history.reset()` first, then sets Asking off and Done on.
- A recorded input edit, Undo or Redo turns all three off.

Labels use translation keys (`bedform.transactional.*`) with en_US text added to the Common pack's `en_US.lang`, the same pattern as the direction names.

## Change recording and chunking

**Input registry:** new [Internal/FormInputs.ts](Package/Bedform/Source/Internal/FormInputs.ts). A `WeakMap` maps each form to its tracked inputs.
- `TrackedInput` is `{ read(), write(v), subscribe(listener) → unsubscribe }`, where a snapshot is `string | number | boolean | undefined`.
- Functions:
  - `RegisterInput(form, input)` adds an input to the form's registry.
  - `ObserveInputs(form, cb)` reports the existing inputs and then any added later, so inputs added after the component are also tracked.
  - `Untracked(form, body)` runs `body` without registering anything.
  - `ObservableInput(o)` adapts a native observable.
- `CustomForm` overrides `textField`, `toggle`, `slider` and `dropdown`. Each calls `super`, registers the bound observable and returns `this`.
- `Direction.ts` wraps its internal `this.dropdown(...)` in `Untracked`. It registers an adapter around the user-facing `ObservableDirection` (`read` uses `Option.getOrUndefined` and `write` uses `setData`/`clear`), so undoing back to an empty direction works. That is not possible through the internal index observable, which bounces `-1` back.

**History:** new [Internal/TransactionHistory.ts](Package/Bedform/Source/Internal/TransactionHistory.ts). It is pure: no native imports, and the clock can be injected for tests.
- An entry is a chunk: an insertion-ordered map of `input → { before, after }`. A cursor separates undo entries from redo entries. `Known` caches each input's last value, and `Initial` holds each input's value when it was registered.
- When an input changes:
  - Ignore it if the value equals `Known`. This also absorbs echoes and late notifications from our own writes.
  - Drop all redo entries.
  - Merge into the open chunk if the change happened in the same synchronous turn (so cascades a consumer triggers become one step), or if the chunk already contains this input and the last change was within `chunkWindow`. Otherwise start a new chunk.
  - A chunk whose changes all end at `before` is removed (for example, typing and then deleting the same text).
  - The turn marker is cleared through `Promise.resolve().then`.
- A chunk is sealed by idle time, by a change to a different input, or by pressing Undo, Redo or Reset.
- Undo and Redo set `Known` before calling `write`, then set an `Applying` flag so cascades are not recorded. Undo applies `before` values in reverse order; Redo applies `after` values in order.
- `reset()` builds one entry from every input that differs from `Initial`, then applies it. It is undoable.
- The oldest entries are dropped once there are more than `historyLimit`. A `subscribe` callback updates the buttons' disabled observables and collapses the confirmation area.

## Icon art (generated into Bedform Common)

Each icon is a 7×7 Mojangles-scale glyph with a 1 px drop shadow at (+1,+1) in the glyph colour ÷ 4 (white gives `#3F3F3F`, green `#55FF55` gives `#153F15`). That makes an 8×8 cell, upscaled ×8 with nearest-neighbour to a 64×64 RGBA PNG, with alpha only 0 or 255.

```
undo ↩    redo ↪    cancel ✕  confirm ✓  trash
.......   .......   .......   .......    ..###..
..####.   .####..   .#...#.   ......#    #######
......#   #......   ..#.#..   .....#.    .#...#.
.#....#   #....#.   ...#...   #...#..    .#.#.#.
######.   .######   ..#.#..   .#.#...    .#.#.#.
.#.....   .....#.   .#...#.   ..#....    .#...#.
.......   .......   .......   .......    .#####.
```

Paths are `textures/bedform/transactional/{undo,redo,cancel,confirm,reset}.png`. The pixels may be adjusted slightly during implementation.

## Files

**Package/Bedform**
- New `Source/DDUI/Transactional.ts`: the `transactional` function, `TransactionalOptions` and the UI wiring.
- New `Source/Internal/TransactionHistory.ts` and `Source/Internal/FormInputs.ts`.
- New `Source/Internal/TransactionalAssets.ts`: frozen records `TransactionalIcon` (paths) and `TransactionalText` (keys → en_US). These are the single source for both the runtime and the build tool.
- New `Source/Internal/CommonResourcePack.ts`: `CommonResourcePack` UUID. [DirectionPreview.ts](Package/Bedform/Source/Internal/DirectionPreview.ts) defines `DirectionResourcePack` from it.
- Edit `Source/DDUI/CustomForm.ts`: add `public transactional = Transactional.transactional` and the four input overrides.
- Edit `Source/DDUI/Direction.ts`: the `Untracked` dropdown and the direction adapter registration.
- Edit `Source/DDUI/index.ts`: `export * as Transactional`. Edit `package.json`: add the `./DDUI/Transactional` export.
- New `Test/Transactional.test.mts`, using the esbuild + `vm` harness from [Direction.test.mts](Package/Bedform/Test/Direction.test.mts) with a recording fake native `CustomForm`.

**Addon/BedformCommon**
- New `Tool/Png.mts`: extract `Chunk` and the PNG encoding from `DirectionPreview.mts` into a reusable `EncodePng(width, height, rgba)`. `DirectionPreview.mts` will use it.
- New `Tool/TransactionalIcons.mts`: the bitmaps and `GenerateTransactionalIcons(root)`.
- Edit `Tool/Build.mts`: call the generator and append `TransactionalText` lines to `en_US.lang`.
- Edit `.gitignore`: add the generated `textures/bedform/transactional/` directory.
- Bump the version to **1.1.3** (package.json, both manifests, the `Build.test.mts` expectations and ReadMe), because clients cache packs by version. Generalise the `Build.test.mts` texture filter to `textures/bedform/`. Add a ReadMe paragraph about the icons.

Conventions: every new module gets the required TSDoc header. Symbols get `@category`, plus `@since 1.0.0` (Bedform) or `@since 1.1.3` (Common tools). Nested option types go in namespaces and constants use PascalCase.

## Verification

1. `Test/Transactional.test.mts` covers:
   - **History:** idle-window merge and split, splitting on an input switch, grouping within one turn (via `await Promise.resolve()`), dropping no-op chunks, discarding redo entries after a new edit, the entry limit, undo and redo of a reset, and late or duplicate notifications not being recorded.
   - **Component:** the row's buttons, icon paths and pack ID; the disabled states; the Reset → Cancel / Confirm visibility sequence and the next-action collapse; tracking of inputs added after the component; Direction undo back to empty; and the error on adding the component twice.
   - **Art:** all five PNGs are in `Asset/bedform-common.mcaddon`; each is 64×64 with alpha only 0 or 255; the glyph and shadow colours are as specified.
2. `npm run verify --workspace bedform` (typecheck, build, all tests, tools typecheck, lint) and `npm test --workspace bedform-common`.
3. In-client acceptance is the user's: icon look next to Mojangles, live visibility switching, and the text-field write cadence. I'll file a bead for it.

Tracking: create and claim a bead for this work, close it when done, and file the client-check bead. No commits or pushes unless you ask.
