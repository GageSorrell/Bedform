# `bedform/Diagetic`

Please create a new module `bedform/Diagetic`, which allows add-ons to create controls that are represented as three-dimensional in-world objects, and respond to player input.

## `bedform/World`

Please add a new module `bedform/World` to `bedform`.
This should export an object `world` that is identical to the `world` export of `@minecraft/server`, but with `afterEvents.playerButtonInput` patched with an alternative.
This alternative should forward all of the same information, *and* movement buttons.
This module should detect movement controls by reading the raw input vector reported by `@minecraft/server`.
It should be possible to detect two perpendicular direction controls being pressed at the same time.
This detection of pressing movement controls should be done by comparing the current/previous movement vectors every tick.
Add-ons should be able to subscribe to any of the eight directions.

Additionally, `bedform/Gesture` should be removed, and its functionality should be put into these patched event emitters.
Add-ons should be able to subscribe to the following input events, for jump, sneak, and the eight directions:

- Down (the input is pressed down)
- Up (the input was pressed down, and is now released)
- Press (the input is pressed down and released in a normal, short duration)
- Hold (the input is pressed down, and a sufficient amount of time has passed to determine that it was not just a "press")
- N-tap (the input was pressed down and released multiple times, such that the durations between each release and following press-down are less than the threshold to rule out a normal press)
- Press and hold
- N-tap and hold

A `DiageticControl` should work by freezing player movement and the player's camera when the player looks at the control and holds "use".
While "use" is held down, using the controls to move the player should be applied as force on the diagetic control, with the 2D movement vector being interpreted in the player's screen space.
For example, a wall-mounted lever might allow for up and down movement; if a player looks at the lever in front of them and holds "use", then starts holding the button to move backward, then the lever should be pulled down.
Amnesia-style drag/damping should be used to give things a weighted feel; this should be customizable.
The movement should be listened to, to also detect a movement button being pressed like a normal button press: the API does not provide start/end events for the movement input buttons, so to detect this.
