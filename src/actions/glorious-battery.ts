import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import streamDeck, { action, type KeyAction, SingletonAction } from "@elgato/streamdeck";
import type {
	DidReceiveSettingsEvent,
	KeyDownEvent,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";

/** Bundled plugin.js lives in `<sdPlugin>/bin/plugin.js`; script is sibling `scripts/`. */
const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SCRIPT = path.join(PLUGIN_ROOT, "scripts", "glorious_battery.py");

export type BatterySettings = {
	/** Python launcher (Windows: `python` or `py`). */
	pythonPath?: string;
	/** Override path to glorious_battery.py (leave empty for bundled script). */
	scriptPath?: string;
	/** Seconds between polls (minimum 5). */
	pollSeconds?: number;
};

type BatteryJson =
	| {
			ok: true;
			level: number;
			charging: boolean;
			status: string;
			proto: string;
			mv: number;
			product: string;
			pid: string;
	  }
	| {
			ok: false;
			error: string;
			error_code?: string;
	  };

@action({ UUID: "com.t3lluz.modelobattery.battery" })
export class GloriousBatteryAction extends SingletonAction<BatterySettings> {
	private readonly timers = new Map<string, ReturnType<typeof setInterval>>();

	override async onWillAppear(ev: WillAppearEvent<BatterySettings>): Promise<void> {
		this.startPolling(ev.action, ev.payload.settings);
	}

	override async onWillDisappear(ev: WillDisappearEvent<BatterySettings>): Promise<void> {
		this.stopPolling(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<BatterySettings>): Promise<void> {
		this.startPolling(ev.action, ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<BatterySettings>): Promise<void> {
		await this.refresh(ev.action, await ev.action.getSettings());
	}

	private stopPolling(actionId: string): void {
		const t = this.timers.get(actionId);
		if (t) {
			clearInterval(t);
			this.timers.delete(actionId);
		}
	}

	private startPolling(action: KeyAction<BatterySettings>, settings: BatterySettings): void {
		this.stopPolling(action.id);
		const sec = Math.max(5, settings.pollSeconds ?? 30);
		void this.refresh(action, settings);
		const id = setInterval(() => {
			void action.getSettings().then((s) => this.refresh(action, s));
		}, sec * 1000);
		this.timers.set(action.id, id);
	}

	private async refresh(action: KeyAction<BatterySettings>, settings: BatterySettings): Promise<void> {
		const python =
			settings.pythonPath?.trim() ||
			(process.platform === "win32" ? "python" : "python3");
		const script = settings.scriptPath?.trim() || DEFAULT_SCRIPT;

		const result = spawnSync(python, [script, "--json"], {
			encoding: "utf-8",
			timeout: 20_000,
			windowsHide: true,
		});

		if (result.error) {
			streamDeck.logger.warn(`spawn failed: ${result.error.message}`);
			await action.setTitle("—");
			await action.setState(0);
			return;
		}

		let data: BatteryJson;
		try {
			const line = (result.stdout ?? "").trim();
			data = JSON.parse(line) as BatteryJson;
		} catch (e) {
			streamDeck.logger.warn(`bad JSON: ${(e as Error).message} stdout=${result.stdout?.slice(0, 200)}`);
			await action.setTitle("—");
			await action.setState(0);
			return;
		}

		if (!data.ok) {
			streamDeck.logger.info(`battery read failed: ${data.error}`);
			await action.setTitle("HID");
			await action.setState(0);
			return;
		}

		await action.setTitle(`${data.level}%\n${data.charging ? "⚡" : " "}`);
		await action.setState(data.charging ? 1 : 0);
	}
}
