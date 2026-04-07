import streamDeck from "@elgato/streamdeck";

import { GloriousBatteryAction } from "./actions/glorious-battery.js";

streamDeck.logger.setLevel("info");

const batteryAction = new GloriousBatteryAction();
streamDeck.actions.registerAction(batteryAction);
streamDeck.system.onSystemDidWakeUp(() => {
	batteryAction.wakeRefreshAll();
});

streamDeck.connect();
