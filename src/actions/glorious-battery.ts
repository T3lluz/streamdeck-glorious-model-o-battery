import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import streamDeck, { action, type KeyAction, SingletonAction, Target } from "@elgato/streamdeck";
import type {
	DidReceiveSettingsEvent,
	KeyDownEvent,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";

import { buildBatteryKeyDataUrl, buildErrorKeyDataUrl } from "../key-art.js";

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
			/** From HID; for USB cable (PID 0x2011) the script sets true while active and level under 100%. */
			charging?: boolean;
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
	/** One timeout per key; chained so the next poll never overlaps HID read. */
	private readonly pollHandles = new Map<string, ReturnType<typeof setTimeout>>();
	/** Avoid concurrent Python spawns for the same key (dongle can only handle one open). */
	private readonly busy = new Set<string>();
	/** Active keys for system wake refresh. */
	private readonly liveActions = new Map<string, KeyAction<BatterySettings>>();

	/** Called from plugin.ts on system wake. */
	wakeRefreshAll(): void {
		for (const action of this.liveActions.values()) {
			void action.getSettings().then((s) => this.refresh(action, s));
		}
	}

	override async onWillAppear(ev: WillAppearEvent<BatterySettings>): Promise<void> {
		this.liveActions.set(ev.action.id, ev.action);
		this.startPolling(ev.action, ev.payload.settings);
	}

	override async onWillDisappear(ev: WillDisappearEvent<BatterySettings>): Promise<void> {
		this.liveActions.delete(ev.action.id);
		this.stopPolling(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<BatterySettings>): Promise<void> {
		this.startPolling(ev.action, ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<BatterySettings>): Promise<void> {
		await this.refresh(ev.action, await ev.action.getSettings());
	}

	private stopPolling(actionId: string): void {
		const h = this.pollHandles.get(actionId);
		if (h !== undefined) {
			clearTimeout(h);
			this.pollHandles.delete(actionId);
		}
	}

	private startPolling(action: KeyAction<BatterySettings>, initial: BatterySettings): void {
		this.stopPolling(action.id);

		const armNext = (): void => {
			void (async () => {
				const s = await action.getSettings();
				const sec = Math.max(5, s.pollSeconds ?? 10);
				const h = setTimeout(() => {
					void (async () => {
						const s2 = await action.getSettings();
						await this.refresh(action, s2);
						armNext();
					})();
				}, sec * 1000);
				this.pollHandles.set(action.id, h);
			})();
		};

		void (async () => {
			await this.refresh(action, initial);
			armNext();
		})();
	}

	private async refresh(action: KeyAction<BatterySettings>, settings: BatterySettings): Promise<void> {
		if (this.busy.has(action.id)) {
			return;
		}
		this.busy.add(action.id);

		try {
			const python =
				settings.pythonPath?.trim() ||
				(process.platform === "win32" ? "python" : "python3");
			const script = settings.scriptPath?.trim() || DEFAULT_SCRIPT;

			const result = spawnSync(python, [script, "--json"], {
				encoding: "utf-8",
				timeout: 20_000,
				windowsHide: true,
			});

			const imgOpts = { target: Target.HardwareAndSoftware as const };

			if (result.error) {
				streamDeck.logger.warn(`spawn failed: ${result.error.message}`);
				await action.setTitle("");
				await action.setImage(buildErrorKeyDataUrl("—"), imgOpts);
				return;
			}

			let data: BatteryJson;
			try {
				const line = (result.stdout ?? "").trim();
				data = JSON.parse(line) as BatteryJson;
			} catch (e) {
				streamDeck.logger.warn(`bad JSON: ${(e as Error).message} stdout=${result.stdout?.slice(0, 200)}`);
				await action.setTitle("");
				await action.setImage(buildErrorKeyDataUrl("—"), imgOpts);
				return;
			}

			if (!data.ok) {
				streamDeck.logger.info(`battery read failed: ${data.error}`);
				await action.setTitle("");
				await action.setImage(buildErrorKeyDataUrl("HID"), imgOpts);
				return;
			}

			// Match glorious_battery.py read_battery(): bool charging OR status label.
			const charging =
				Boolean(data.charging) || data.status === "Charging";
			await action.setTitle("");
			await action.setImage(buildBatteryKeyDataUrl(data.level, charging), imgOpts);
		} finally {
			this.busy.delete(action.id);
		}
	}
}
