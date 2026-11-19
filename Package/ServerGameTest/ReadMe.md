# `@bedform/server-gametest`

Bedform's counterpart to [`@minecraft/server-gametest`](https://www.npmjs.com/package/@minecraft/server-gametest).

It re-exports all of `@minecraft/server-gametest`, which it requires as an exact peer dependency: the game provides the module at runtime, so your add-on's manifest must declare the matching module version.
Bedform adds its extensions here, and where an extension replaces a first-party export, it shadows it.

## Versions

This package's version is the version of `@minecraft/server-gametest` that it tracks, followed by a channel suffix:
`-dev.N` on the `Master` branch and `-beta.N` on the `Beta` branch. For example, this release tracks
`@minecraft/server-gametest@1.0.0-beta.1.26.66-stable`.
