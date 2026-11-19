# `@bedform/server-ui`

Bedform's counterpart to [`@minecraft/server-ui`](https://www.npmjs.com/package/@minecraft/server-ui).

It re-exports all of `@minecraft/server-ui`, which it requires as an exact peer dependency: the game provides the module at runtime, so your add-on's manifest must declare the matching module version.
Bedform adds its extensions here, and where an extension replaces a first-party export, it shadows it.

## Versions

This package's version is the version of `@minecraft/server-ui` that it tracks, followed by a channel suffix:
`-dev.N` on the `Master` branch and `-beta.N` on the `Beta` branch. For example, this release tracks
`@minecraft/server-ui@2.3.0`.
