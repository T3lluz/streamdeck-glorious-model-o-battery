/**
 * Stream Deck key graphics as SVG data URLs (Elgato recommends SVG for setImage).
 * Bolt: Heroicons 24×24 solid (MIT).
 *
 * We intentionally do **not** embed Outfit (or any TTF) inside the SVG passed to `setImage`.
 * A 100KB+ `data:image/svg+xml,...` string is often truncated or mangled by the host, which
 * still draws early elements (gradients) but leaves `<text>` as a broken sliver/line.
 * Outfit remains in `fonts/` for licensing/optional use; labels use Segoe UI (always on Windows).
 */

/** Heroicons 24 solid bolt, MIT — https://github.com/tailwindlabs/heroicons */
const BOLT_PATH_D =
	"M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z";

/** Main digit font size; `%` is drawn smaller in a separate `<text>` (tspans mis-render on some hosts). */
function fontSizeForLevel(level: number): number {
	if (level >= 100) return 44;
	if (level >= 10) return 54;
	return 58;
}

/** Heuristic advance so digit block + gap + `%` stay centered as a unit. */
function labelLayout(level: number, digitFontSize: number, pctFontSize: number): {
	numberX: number;
	pctX: number;
} {
	const numStr = String(level);
	const gap = Math.max(2, Math.round(digitFontSize * 0.07));
	const digitAdvance = digitFontSize * 0.56;
	const numAdvance = numStr.length * digitAdvance;
	const pctAdvance = pctFontSize * 0.52;
	const total = numAdvance + gap + pctAdvance;
	const cx = 144 / 2;
	const left = cx - total / 2;
	return {
		numberX: left + numAdvance,
		pctX: left + numAdvance + gap,
	};
}

function svgToDataUrl(svg: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(svg, "utf-8").toString("base64")}`;
}

/**
 * Builds `data:image/svg+xml,...` for use with `action.setImage`.
 * Layout: centered “NN” + smaller “%”, charging bolt badge in top-right with safe margins (no clipping).
 */
export function buildBatteryKeyDataUrl(level: number, charging: boolean): string {
	const W = 144;
	const H = 144;
	// Slightly below geometric center — Stream Deck / rim reads visually high otherwise.
	const cy = H / 2 + 14;
	const fontSize = fontSizeForLevel(level);
	const pctFontSize = Math.round(fontSize * 0.5);
	const { numberX, pctX } = labelLayout(level, fontSize, pctFontSize);

	const badge = charging
		? `<g>
	<circle cx="122" cy="22" r="17" fill="#1c1610" fill-opacity="0.55"/>
	<circle cx="122" cy="22" r="16" fill="none" stroke="#3d3428" stroke-width="0.75"/>
	<g transform="translate(122,22) scale(1.12) translate(-12,-11.5)">
		<path fill="url(#boltGrad)" fill-rule="evenodd" d="${BOLT_PATH_D}" stroke="#fff4cc" stroke-width="0.35"/>
	</g>
</g>`
		: "";

	const labelFill = "#e8ecf4";
	const numberText = `<text x="${numberX}" y="${cy}" text-anchor="end" dominant-baseline="middle"
	font-family="Segoe UI,Segoe UI Variable,system-ui,sans-serif"
	font-size="${fontSize}" font-weight="700" letter-spacing="-0.03em" fill="${labelFill}">${escapeXml(
		String(level),
	)}</text>`;
	const pctText = `<text x="${pctX}" y="${cy}" text-anchor="start" dominant-baseline="middle"
	font-family="Segoe UI,Segoe UI Variable,system-ui,sans-serif"
	font-size="${pctFontSize}" font-weight="700" letter-spacing="-0.04em" fill="${labelFill}">%</text>`;

	const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
	<linearGradient id="bgTop" x1="0%" y1="0%" x2="0%" y2="100%">
		<stop offset="0%" style="stop-color:#161922"/>
		<stop offset="100%" style="stop-color:#0b0d12"/>
	</linearGradient>
	<linearGradient id="rim" x1="0%" y1="0%" x2="0%" y2="100%">
		<stop offset="0%" style="stop-color:#00d6aa;stop-opacity:0.09"/>
		<stop offset="100%" style="stop-color:#00d6aa;stop-opacity:0"/>
	</linearGradient>
	<linearGradient id="boltGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
		<stop offset="0%" style="stop-color:#fffce8"/>
		<stop offset="50%" style="stop-color:#ffd54a"/>
		<stop offset="100%" style="stop-color:#ff9f1a"/>
	</linearGradient>
</defs>
<rect width="${W}" height="${H}" rx="16" ry="16" fill="url(#bgTop)" stroke="#252a36" stroke-width="1"/>
<rect width="${W}" height="38" rx="16" ry="16" fill="url(#rim)"/>
${numberText}
${pctText}
${badge}
</svg>`;

	return svgToDataUrl(svg);
}

/** Minimal tile when HID / script fails. */
export function buildErrorKeyDataUrl(symbol: string): string {
	const W = 144;
	const H = 144;
	const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
	<linearGradient id="ebg" x1="0%" y1="0%" x2="0%" y2="100%">
		<stop offset="0%" style="stop-color:#1a1518"/>
		<stop offset="100%" style="stop-color:#0d0b0c"/>
	</linearGradient>
</defs>
<rect width="${W}" height="${H}" rx="16" ry="16" fill="url(#ebg)" stroke="#2a2428" stroke-width="1"/>
<text x="72" y="76" text-anchor="middle" dominant-baseline="middle"
	font-family="Segoe UI,system-ui,sans-serif" font-size="34" font-weight="600" fill="#8a858e">${escapeXml(symbol)}</text>
</svg>`;
	return svgToDataUrl(svg);
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
