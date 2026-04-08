import { spawnSync, type SpawnSyncReturns } from "node:child_process";
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

const SPAWN_OPTS = {
	encoding: "utf-8" as const,
	timeout: 20_000,
	windowsHide: true,
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

export type BatterySettings = {
	/** Python launcher (Windows: `python` or `py`). */
	pythonPath?: string;
	/** Override path to glorious_battery.py (leave empty for bundled script). */
	scriptPath?: string;
	/** Seconds between polls (minimum 5). */
	pollSeconds?: number;
};

function parseBatteryJsonFromStdout(stdout: string | undefined): BatteryJson | null {
	if (stdout === undefined || stdout === "") {
		return null;
	}
	const text = stdout.replace(/^\uFEFF/, "");
	const lines = text
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	const jsonLines = lines.filter((l) => l.startsWith("{"));
	const candidates =
		jsonLines.length > 0 ? [...jsonLines].reverse() : lines.length > 0 ? [lines[lines.length - 1]!] : [];

	for (const line of candidates) {
		if (!line.startsWith("{")) {
			continue;
		}
		try {
			const o = JSON.parse(line) as unknown;
			if (
				o !== null &&
				typeof o === "object" &&
				"ok" in o &&
				typeof (o as { ok: unknown }).ok === "boolean"
			) {
				return o as BatteryJson;
			}
		} catch {
			/* try next line */
		}
	}
	return null;
}

/**
 * Stream Deck often inherits a minimal PATH; on Windows `python` may be missing while `py` works.
 * Tries launchers in order until one produces parseable battery JSON (so a broken `py -3` without
 * hidapi does not block a working `python`). Honors explicit `pythonPath` as exe or `exe` + args.
 */
function spawnPythonJson(
	script: string,
	configuredPath: string | undefined,
): SpawnSyncReturns<string> {
	const scriptArgs = [script, "--json"];
	const configured = configuredPath?.trim();

	const attempts: Array<{ exe: string; prefix: string[] }> = [];

	if (configured) {
		const parts = configured.match(/(?:[^\s"]+|"[^"]*")+/g);
		if (parts?.length) {
			const argv = parts.map((p) => p.replace(/^"|"$/g, ""));
			attempts.push({ exe: argv[0]!, prefix: argv.slice(1) });
		}
	} else if (process.platform === "win32") {
		attempts.push({ exe: "py", prefix: ["-3"] });
		attempts.push({ exe: "python", prefix: [] });
		attempts.push({ exe: "python3", prefix: [] });
	} else {
		attempts.push({ exe: "python3", prefix: [] });
		attempts.push({ exe: "python", prefix: [] });
	}

	let last: SpawnSyncReturns<string> | undefined;
	for (const a of attempts) {
		const r = spawnSync(a.exe, [...a.prefix, ...scriptArgs], SPAWN_OPTS);
		last = r;
		const err = r.error as NodeJS.ErrnoException | undefined;
		if (err?.code === "ENOENT") {
			continue;
		}
		if (parseBatteryJsonFromStdout(r.stdout) !== null) {
			return r;
		}
	}
	return last ?? spawnSync("python", scriptArgs, SPAWN_OPTS);
}

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
			const script = settings.scriptPath?.trim() || DEFAULT_SCRIPT;

			const result = spawnPythonJson(script, settings.pythonPath);

			const imgOpts = { target: Target.HardwareAndSoftware as const, state: 0 };

			if (result.error) {
				streamDeck.logger.warn(`spawn failed: ${result.error.message}`);
				await action.setTitle("");
				await action.setImage(buildErrorKeyDataUrl("—"), imgOpts);
				return;
			}

			const data = parseBatteryJsonFromStdout(result.stdout);
			if (!data) {
				streamDeck.logger.warn(
					`no battery JSON after trying Python launchers. stderr=${(result.stderr ?? "").slice(0, 400)} stdout=${(result.stdout ?? "").slice(0, 300)}`,
				);
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

			const level = Math.round(Number(data.level));
			if (!Number.isFinite(level)) {
				streamDeck.logger.warn(`invalid battery level in JSON: ${JSON.stringify(data.level)}`);
				await action.setTitle("");
				await action.setImage(buildErrorKeyDataUrl("—"), imgOpts);
				return;
			}
			const clamped = Math.min(100, Math.max(0, level));

			// Match glorious_battery.py read_battery(): bool charging OR status label.
			const charging =
				Boolean(data.charging) || data.status === "Charging";
			await action.setTitle("");
			await action.setImage(buildBatteryKeyDataUrl(clamped, charging), imgOpts);
		} finally {
			this.busy.delete(action.id);
		}
	}
}
