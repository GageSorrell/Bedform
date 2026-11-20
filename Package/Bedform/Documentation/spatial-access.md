# Spatial access control

`Spatial.Access` (`Source/Spatial/Access.ts`) limits how many players can use a
widget, a control or an `InputScope` subtree at once, and can lock it to one
player. Importing it starts nothing. Admission runs inside the
[pointer tracker](spatial-pointer.md) on every input update (once per tick).

## Controllers

```tsx
import { Spatial } from "bedform";
import { InputScope, Button, Text } from "bedform/Spatial/Components";

// Create once and keep it, for example in a ref, a module or useMemo.
const seat = Spatial.Access.CreateController({ MaxPlayers: 1 });

<InputScope Access={ seat }>
    <Button OnActivate={ play }><Text>Play</Text></Button>
    <Button OnActivate={ stop }><Text>Stop</Text></Button>
</InputScope>;

seat.SetMaxPlayers(2);    // takes effect on the next input update
seat.LockTo(player);      // a player, or a player id
seat.Unlock();
seat.Admitted;            // ids admitted by the last update, in admission order
```

- **Placement.** Pass a controller as the `Access` prop of any widget, control or
  `InputScope`. A new controller admits every player.
- **Stable identity.** Admission history belongs to the controller object. Create
  it once and reuse it across renders.
- **Staged changes.** `SetMaxPlayers`, `LockTo` and `Unlock` are staged. Every
  admission update applies all staged changes before it admits anyone, even for
  controllers that nobody is aiming at. A change therefore never takes effect
  partway through an update. Until then, `MaxPlayers` and `LockedTo` report the
  settings currently in effect.
- **Validation.** `MaxPlayers` must be a nonnegative safe integer or `undefined`
  (unlimited). `0` admits nobody.

Plain policy objects, such as `Access={ { MaxPlayers: 2, LockedTo: "id",
Allows: id => ... } }`, are also accepted. Their admission history is tied to
that object, so an inline object that a render recreates loses its admitted
players. Use a controller when limits must be stable. Layout validation rejects
a `LockedTo` that is not a nonempty string, a noninteger `MaxPlayers` and a
non-function `Allows`.

## Admission rules

Each update, the tracker asks for admission for every player whose ray hits a
widget surface and who is not already denied as `"disabled"`, `"distance"` or
`"item"`. It then applies these rules:

- **Counting.** A policy counts the distinct players whose hit lies on its
  component or any descendant. This includes noninteractive surfaces inside the
  subtree and pointers whose line is hidden. Players denied for an item or
  distance are not counted.
- **Nesting.** Policies apply ancestors first. A player must be admitted by every
  policy from the widget down to the target. A player denied by an ancestor is
  neither counted nor admitted by its descendants. A controller reused at
  several depths is evaluated once, at its shallowest depth.
- **Predicates.** A policy's `Allows` predicate runs first. Players it rejects,
  or for whom it throws, are denied and not counted. Predicate failures are
  reported through the tracker's `OnError`.
- **Stability.** Admitted players keep their places for as long as they keep
  aiming at the subtree. A smaller id or an earlier arrival never displaces them.
- **Vacancies.** When places are free, they are filled in arrival order. A
  player's arrival is the update on which they started aiming continuously.
  Players who arrive on the same update are ordered by player id. A player who
  stops aiming loses both their place and their arrival position.
- **Limits.** Lowering `MaxPlayers` keeps the earliest-admitted players. Raising
  it fills the new places from waiting players in arrival order.
- **Locks.** A lock admits only the locked player, while they aim at the
  subtree and the limit allows it. Everyone else is denied. Unlocking readmits
  waiting players in arrival order.

A denied player's state has `Denial: "access"` and `Eligible: false`. The
denied surface is still the nearest surface on the ray, so it blocks the
controls behind it: there is no click-through. Gesture cancellation for
players who lose access belongs to activation and gestures (`ty2k.15`), which
reads these denials.

## Lower-level API

`CreateAdmission({ OnError })` returns the engine that the tracker uses. Its
`Admit(requests)` takes `{ ViewerId, Policies }` requests, with policies ordered
ancestors first, and returns the ids denied for that update. `Admitted(policy)`
and `Reset()` expose and clear its history. `IsController` identifies
controllers. The tracker's optional `Admit` hook still runs after built-in
admission, for interactive candidates that remain eligible.
