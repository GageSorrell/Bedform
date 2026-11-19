# DDUI navigation flows, Link and Back

## Summary

Extend `bedform/DDUI/CustomForm` with image-button components and typed navigation flows. Preserve the existing builder API and expose the additions through `bedform/DDUI` and a new `bedform/DDUI/CustomForm` package export.

Each flow owns its context, forms, observables and cleanup callbacks. Values survive every navigation operation, including reopening a popped form, until the flow ends.

## Public API

- `FormFlow<Context>(player, createContext)` creates a single-use flow with fresh, player-specific context.
- `flow.form(title, build)` returns a typed form definition. The builder receives a Bedform `CustomForm` and a scope exposing `context`, `player`, navigation methods and cleanup registration.
- `definition.subform(title, build, options?)` creates an owned form. It automatically appends a Back button after the builder finishes; `{ back: false }` disables it.
- `flow.show(root)` starts navigation and returns a promise that settles after cleanup.
- `push(target)`, `pop()`, `replace(target)` and `close()` are available through the flow and builder scope.
- `form.link(label, target, options?)` appends an external-link-arrow image button that calls `push(target)`.
- `form.back(options?)` appends a left-arrow image button that calls `pop()`. Its default label is localized "Back".
- Link and Back accept native disabled, visibility and tooltip options while retaining their prescribed images. Both return `this`.
- `scope.onDispose(cleanup)` and `scope.subscribe(observable, listener)` register flow-owned resources. Add idempotent `CustomForm.dispose()` for component cleanup and standalone use.

Existing standalone `CustomForm` construction remains supported. Navigation components require association with a flow and report a clear error otherwise.

## Implementation and behavior

- Implement the public components and flow API in `CustomForm.ts`; keep internal lifecycle and transition helpers private to the package.
- Build each visited form once and retain its native instance and observables until flow disposal. Builders run lazily on first entry, allowing definitions to reference one another.
- `push()` adds a destination, `pop()` returns to the previous entry, and `replace()` changes the current entry without adding history. Popping the root ends the flow.
- Ownership records the parent relationship and supplies the default Back button. Back follows navigation history; ownership does not silently redirect navigation.
- Reject cross-flow targets and duplicate active stack entries before closing the current form.
- Permit one transition at a time. Navigation returns `Promise<boolean>`: accepted transitions resolve `true`; additional requests during a transition resolve `false`.
- Mark intentional closes, await the outgoing native `show()` result, then show the destination. Fence stale callbacks and close results so they cannot navigate or terminate a later screen.
- Native dismissal ends the whole flow. Busy responses terminate without automatic retries. Construction, presentation and transition errors trigger cleanup before rejection.
- Maintain one active managed flow per player. Starting another closes and disposes the previous flow before presenting the replacement.
- Disconnect, explicit close, native dismissal, supersession and errors dispose the flow exactly once. Release all retained forms, context references and subscriptions; run remaining cleanup callbacks even if one fails.
- Integrate Direction subscriptions, transactional history and input-registry observers with form disposal. Preserve their state while navigating.
- Generate both icons using the existing Mojangles-style pixel scale, white foreground and offset shadow. Package them and Back localization in Bedform Common; increment its patch version and regenerate outputs.
- Follow repository headers, TSDoc, nested-type and identifier conventions. Preserve existing working-tree changes.

## Validation and defaults

- Test navigation order, root pop, replacement, owned Back placement, disabled automatic Back, rapid clicks and stale callback handling.
- Verify native input values, direction values and transactional history survive navigation and revisiting popped forms.
- Test two-player isolation, same-player supersession, disconnects, busy responses, presentation failures and idempotent cleanup, including throwing cleanup callbacks.
- Add consumer type checks for context inference and the new package export.
- Verify deterministic icon pixels, localization and packaged texture paths.
- Run Bedform verification and Bedform Common checks. Use an isolated fixed-path BDS fixture to confirm close/reopen sequencing; verify icon appearance and navigation on a physical client.
- Persistence is in memory for one flow only. JSX rendering, saved-world persistence, production deployment, commits and pushes are outside this change.

## Beads tracking

The implementation epic is `MineCraft-fwox`. Implementation status and dependencies are tracked in Beads, not in this document.

| Issue | Deliverable |
| --- | --- |
| `MineCraft-fwox.1` | Disposable form resources and existing component cleanup |
| `MineCraft-fwox.2` | Typed flow definitions, context and persistent form state |
| `MineCraft-fwox.3` | Navigation, player isolation, supersession and termination |
| `MineCraft-fwox.4` | Generated navigation icons and localized Back text |
| `MineCraft-fwox.5` | Link, Back and owned sub-form builders |
| `MineCraft-fwox.6` | Package exports, documentation and consumer verification |
| `MineCraft-fwox.7` | Isolated native and physical-client validation |
