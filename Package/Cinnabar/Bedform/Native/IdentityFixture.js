// Script half of the disposable Cinnabar native identity probe.
import { GameMode, system, world } from "@minecraft/server";
import { register, spawnSimulatedPlayer } from "@minecraft/server-gametest";

function report(stage, player)
{
    console.warn("BEDFORM_CINNABAR_SCRIPT_IDENTITY " + JSON.stringify({
        stage,
        id: player?.id,
        name: player?.name,
        players: world.getAllPlayers().map(({ id, name }) => ({ id, name }))
    }));
}

system.runTimeout(() =>
{
    report("before");
    const player = spawnSimulatedPlayer({
        dimension: world.getDimension("overworld"),
        x: 0,
        y: -59,
        z: 0
    }, "BedformStandalone", GameMode.creative);
    report("standalone", player);
    system.runTimeout(() =>
    {
        player.disconnect();
        report("standaloneDisconnected");
    }, 80);
}, 30);

register("CinnabarProof", "Identity", test =>
{
    const player = test.spawnSimulatedPlayer({ x: 0, y: 1, z: 0 }, "BedformGameTest", GameMode.creative);
    report("gameTest", player);
    test.runAfterDelay(60, () =>
    {
        report("gameTestSuccess", player);
        test.succeed();
    });
    system.runTimeout(() => report("gameTestEnded"), 90);
}).structureName("proof:identity").maxTicks(160);
