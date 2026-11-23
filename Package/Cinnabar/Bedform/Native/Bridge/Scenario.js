// Script side of the disposable native bridge fixture.
import { GameMode, system, world } from "@minecraft/server";
import { register, spawnSimulatedPlayer } from "@minecraft/server-gametest";

let standalone;
let gameTest;
let testContext;

function report(stage) {
    const players = world.getAllPlayers().map(player => ({ id: player.id, name: player.name, yaw: player.getRotation().y }));
    console.warn(`BEDFORM_BRIDGE_FIXTURE ${JSON.stringify({ stage, players })}`);
}

function spawnStandalone(stage) {
    standalone = spawnSimulatedPlayer({ dimension: world.getDimension("overworld"), x: 2.5, y: -59, z: 2.5 },
        "BridgeStandalone", GameMode.survival);
    report(stage);
}

system.runTimeout(() => spawnStandalone("standalone"), 30);

register("BedformBridge", "Native", test => {
    testContext = test;
    gameTest = test.spawnSimulatedPlayer({ x: 0, y: 1, z: 0 }, "BridgeGameTest", GameMode.creative);
    report("gameTest");
}).structureName("proof:bridge").maxTicks(1400);

system.afterEvents.scriptEventReceive.subscribe(event => {
    if (event.id !== "bedform_bridge:test") return;
    switch (event.message) {
    case "beforeTitle": standalone.onScreenDisplay.setTitle("ExistingPrivateTitle", {
        fadeInDuration: 0, stayDuration: 300, fadeOutDuration: 0
    }); report("beforeTitle"); break;
    case "title": {
        const options = { fadeInDuration: 0, stayDuration: 200, fadeOutDuration: 0 };
        standalone.onScreenDisplay.setTitle("StandalonePrivateTitle", options);
        gameTest.onScreenDisplay.setTitle("GameTestPrivateTitle", options);
        break;
    }
    case "nativeMove": standalone.move(0, 1, 1); system.runTimeout(() => report("nativeMove"), 5); break;
    case "report": report("report"); break;
    case "death": standalone.kill(); break;
    case "respawn": standalone.respawn(); break;
    case "nether": standalone.teleport({ x: 0.5, y: 64, z: 0.5 }, { dimension: world.getDimension("nether") }); break;
    case "endTest": testContext.succeed(); break;
    case "remove": standalone.disconnect(); break;
    case "replace": spawnStandalone("replacement"); break;
    }
});
