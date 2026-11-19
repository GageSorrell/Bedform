# Create quick prototype worlds with `bedform/Prototype`, bundled into a BDS server

Please extend the `bedform` CLI (and possibly `bedform/Prototype`) to make it easy to create and run small BDS servers for testing out "small" things, like to quickly implement something and try it to see if it works.

The world should be a simple flat world, with an empty add-on, made by internally using the official Minecraft CLI to create an add-on with the "TypeScript starter" template ("tsStarter"?).

A directory should be created, whose path should be a required argument.
This directory should contain a directory `Addon`, which contains the add-on, and another directory `Server` which should contain a BDS server.

An optional boolean flag `--preview` (with alias `-p`), `false` by default, should allow for using the current Preview version of BDS.
An optional boolean flag `--beta` (with alias `-b`), `false` by default, should allow for using (all) Beta APIs in the add-on (with any configuration also done to the BDS server if needed to allow for using these Beta APIs).

An optional string flag `--name` (with alias -n) should allow for specifying the name of the BDS server and add-on name.
If not specified, then the `Make` function from `bedform/Utility/Name` should be used to create a name for the add-on and server; the `Config` argument should not be used.

An optional boolean flag `--spawn-item`, `true` by default, should, if `true`, cause the generated add-on to contain a simple item, which is placed in the player's hand when they join the BDS server.
The item's model should be the vanilla compass, and should have no-op functions registered that are called when "use" is pressed while the player is holding the item.
This allows for a quick entrypoint for the developer to try doing something in the add-on, with an easy way to *start* the thing they want to try.

An optional file path flag `--server-properties` (with alias `-s`) should allow for specifying a `server.properties` file to use instead of the default one.
The default `server.properties` should be the one supplied with the BDS server release, with any changes made that are needed to serve its purpose here, and any changes made that improve the developer experience (for example, changing the name of the server is not necessary, but it would be nice).

In addition to the `--server-properties` flag, a `config` setting should be added, named `prototype.server-properties`, which is set by providing a file path to a `server.properties` file, and when the value is retrieved with `get`, the contents of the `server.properties` that the `bedform` CLI stores should be output to the terminal, with the file path stated before the file contents.
This config value should be used if it is set and if `--server-properties` is not used.
