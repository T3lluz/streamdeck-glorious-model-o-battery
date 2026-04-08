# Glorious Model O — Stream Deck battery

Stream Deck plugin plus a small Python HID reader for **Glorious Model O / O-** (wired, PID `0x0036`) and **Model O Wireless** (dongle `0x2022`, USB cable `0x2011`). The key image is a **144×144 SVG** drawn each refresh: large **Outfit** percentage (OFL font, embedded), dark mint-accent background, and a **Heroicons** lightning bolt (MIT) overlaid on the **top-right** of the number when `charging` is true in `--json`. Charging is reliable on **sinowealth** and on **USB cable (0x2011)** while active and below 100%; the **dongle** path often cannot see charging in HID.

## Repository layout

| Path | Purpose |
|------|--------|
| `glorious_battery.py` | CLI + `--json` for the plugin |
| `com.t3lluz.modelobattery.sdPlugin/` | Stream Deck plugin bundle (copy this folder into Stream Deck’s plugins directory after `npm run build`) |
| `com.t3lluz.modelobattery.sdPlugin/fonts/` | **Outfit** variable font + `OFL-Outfit.txt` (attribution / optional; the key SVG uses **Segoe UI** so images stay small and render reliably) |
| `src/` | TypeScript plugin source (`key-art.ts` builds compact SVG data URLs) |

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
npm run fetch-assets
npm run icons
npm run build
```

- `npm run fetch-assets` downloads **Outfit** from Google Fonts (OFL) into `com.t3lluz.modelobattery.sdPlugin/fonts/`. Skip if those files are already present from the repo.
- `npm run icons` generates marketplace / placeholder PNGs under `com.t3lluz.modelobattery.sdPlugin/imgs/`.

Attribution: see `com.t3lluz.modelobattery.sdPlugin/NOTICES.txt`.

## Install in Stream Deck

1. Quit Stream Deck (recommended).
2. Ensure `npm run build` has produced `com.t3lluz.modelobattery.sdPlugin\bin\plugin.js`.
3. Copy the entire folder:

   `com.t3lluz.modelobattery.sdPlugin`

   into:

   `%APPDATA%\Elgato\StreamDeck\Plugins\`

3. Start Stream Deck. Under **Model O Battery**, add **Mouse battery** to a key.

## Key settings

- **Python** — optional. Leave empty on Windows to try **`py -3`**, then **`python`**, then **`python3`**. The plugin keeps trying until one run prints valid battery JSON, so a `py -3` install **without** `hidapi` will not block a working `python` where you ran `pip install hidapi`. You can also set a full path or `py -3` explicitly.
- **Script path** — leave empty to use the bundled `scripts/glorious_battery.py` inside the `.sdPlugin` folder. Override if you keep a copy elsewhere.
- **Poll (sec)** — how often to refresh (minimum 5).

Press the key to force an immediate refresh.

## Troubleshooting (key works but no battery digits)

1. **Custom key icon** — If you assigned a custom image to this key in Stream Deck, the app **will not show** images from the plugin until that custom icon is removed. This is [documented precedence](https://docs.elgato.com/streamdeck/sdk/guides/keys/#display-precedence): user-defined artwork overrides `setImage`. Clear the custom icon for this action.
2. **Python / HID** — If you see **“—”** on the key, the script did not run or did not print JSON. If you see **“HID”**, Python ran but the mouse/dongle was not read (close Glorious CORE, check USB).
3. **Re-copy the plugin** after `npm run build` so `bin/plugin.js` and `fonts/` inside `com.t3lluz.modelobattery.sdPlugin` stay in sync.

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
