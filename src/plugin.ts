import streamDeck from "@elgato/streamdeck";

import { GloriousBatteryAction } from "./actions/glorious-battery.js";

streamDeck.logger.setLevel("info");

streamDeck.actions.registerAction(new GloriousBatteryAction());

streamDeck.connect();
