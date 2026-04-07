# Glorious Model O — Stream Deck battery

Stream Deck plugin plus a small Python HID reader for **Glorious Model O / O-** (wired, PID `0x0036`) and **Model O Wireless** (2.4 GHz dongle, PID `0x2022`). The key shows **battery %**, a **mint / charcoal** tile, and switches to a **charging** state (second key image + ⚡ under the percentage) when the JSON field `charging` is true. That flag comes straight from the mouse on the **wired sinowealth** protocol; on the **wireless dongle** path it is usually false unless the firmware exposes a charging status the script recognizes.

## Repository layout

| Path | Purpose |
|------|--------|
| `glorious_battery.py` | CLI + `--json` for the plugin |
| `com.t3lluz.modelobattery.sdPlugin/` | Stream Deck plugin bundle (copy this folder into Stream Deck’s plugins directory after `npm run build`) |
| `src/` | TypeScript plugin source |

## Prerequisites

- **Stream Deck** 6.9+ with **Node.js 20** (bundled with recent Stream Deck releases).
- **Python 3** on `PATH` (`python` on Windows).
- **hidapi**: `pip install -r requirements.txt`
- Close **Glorious CORE** while testing if HID access fails.

## Build the plugin

After cloning the repo you **must** compile the Node plugin (the `.gitignore` excludes `bin/plugin.js`).

```powershell
cd $env:USERPROFILE\Documents\ModelOBattery
npm install
npm run icons
npm run build
```

`npm run icons` generates PNG artwork under `com.t3lluz.modelobattery.sdPlugin/imgs/`. Re-run it if you delete those files.

## Install in Stream Deck

1. Quit Stream Deck (recommended).
2. Ensure `npm run build` has produced `com.t3lluz.modelobattery.sdPlugin\bin\plugin.js`.
3. Copy the entire folder:

   `com.t3lluz.modelobattery.sdPlugin`

   into:

   `%APPDATA%\Elgato\StreamDeck\Plugins\`

3. Start Stream Deck. Under **Model O Battery**, add **Mouse battery** to a key.

## Key settings

- **Python** — launcher command (default `python`).
- **Script path** — leave empty to use the bundled `scripts/glorious_battery.py` inside the `.sdPlugin` folder. Override if you keep a copy elsewhere.
- **Poll (sec)** — how often to refresh (minimum 5).

Press the key to force an immediate refresh.

## CLI usage

```powershell
python glorious_battery.py
python glorious_battery.py --json
python glorious_battery.py --list
python glorious_battery.py --pid 2022
```

`--json` prints one line of JSON for automation (used by the plugin).

## Publish to GitHub

```powershell
cd $env:USERPROFILE\Documents\ModelOBattery
git init
git add .
git commit -m "Initial commit: Glorious Model O battery Stream Deck plugin"
```

Create a new empty repository on GitHub, then:

```powershell
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```

Replace the `Author` field in `com.t3lluz.modelobattery.sdPlugin/manifest.json` and the plugin **UUID** if you plan to ship on the Elgato Marketplace (UUIDs must be unique).

## Credits

- HID protocol for wired mice aligns with [gloriousctl](https://github.com/enkore/gloriousctl).
- Model O Wireless dongle path is based on [korkje/mow](https://github.com/korkje/mow).

## License

MIT — use at your own risk. This project is not affiliated with Glorious PC Gaming Race.
