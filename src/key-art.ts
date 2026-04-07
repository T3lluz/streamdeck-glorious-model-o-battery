/**
 * Stream Deck key graphics as SVG data URLs (Elgato recommends SVG for setImage).
 * Font: Outfit variable (OFL) in `fonts/Outfit-Variable.ttf`.
 * Bolt: Heroicons 24×24 solid (MIT).
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONT_FILE = path.join(PLUGIN_ROOT, "fonts", "Outfit-Variable.ttf");

/** Heroicons 24 solid bolt, MIT — https://github.com/tailwindlabs/heroicons */
const BOLT_PATH_D =
	"M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z";

let cachedFontB64: string | null | undefined;

function fontFaceBlock(): string {
	if (cachedFontB64 === undefined) {
		if (!existsSync(FONT_FILE)) {
			cachedFontB64 = null;
		} else {
			cachedFontB64 = readFileSync(FONT_FILE).toString("base64");
		}
	}
	if (!cachedFontB64) {
		return "";
	}
	return `@font-face{font-family:OutfitKey;src:url(data:font/ttf;base64,${cachedFontB64})format('truetype');font-weight:100 900;font-stretch:100%;}`;
}

/** Font size only — text is always visually centered on the key. */
function fontSizeForLevel(level: number): number {
	if (level >= 100) return 46;
	if (level >= 10) return 58;
	return 64;
}

/**
 * Builds `data:image/svg+xml,...` for use with `action.setImage`.
 * Layout: centered “NN%”, charging bolt badge in top-right with safe margins (no clipping).
 */
export function buildBatteryKeyDataUrl(level: number, charging: boolean): string {
	const W = 144;
	const H = 144;
	const cx = W / 2;
	// Slightly below geometric center — Stream Deck / rim reads visually high otherwise.
	const cy = H / 2 + 14;
	const labelNumber = String(level);
	const digitFontSize = fontSizeForLevel(level);
	// Use explicit px (user units); some hosts ignore `em` on nested tspans → tiny "%".
	const percentFontSize = digitFontSize * 0.5;
	const percentDy = Math.round(digitFontSize * 0.14);

	const fontCss = fontFaceBlock();
	const styleBlock = fontCss
		? `<style type="text/css"><![CDATA[${fontCss}]]></style>`
		: "";

	// Top-right badge: inset so nothing clips on hardware / rounded corners.
	const badge = charging
		? `<g filter="url(#boltGlow)">
	<circle cx="122" cy="22" r="17" fill="#1c1610" fill-opacity="0.55"/>
	<circle cx="122" cy="22" r="16" fill="none" stroke="#3d3428" stroke-width="0.75"/>
	<g transform="translate(122,22) scale(1.12) translate(-12,-11.5)">
		<path fill="url(#boltGrad)" fill-rule="evenodd" d="${BOLT_PATH_D}" stroke="#fff4cc" stroke-width="0.35"/>
	</g>
</g>`
		: "";

	const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" overflow="visible">
${styleBlock}
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
	<filter id="textShadow" x="-35%" y="-35%" width="170%" height="170%">
		<feDropShadow dx="0" dy="1.5" stdDeviation="1.8" flood-color="#000" flood-opacity="0.55"/>
	</filter>
	<filter id="boltGlow" x="-120%" y="-120%" width="340%" height="340%">
		<feGaussianBlur stdDeviation="1.2" result="b"/>
		<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
	</filter>
</defs>
<rect width="${W}" height="${H}" rx="16" ry="16" fill="url(#bgTop)" stroke="#252a36" stroke-width="1"/>
<rect width="${W}" height="38" rx="16" ry="16" fill="url(#rim)"/>
<text
	x="${cx}"
	y="${cy}"
	text-anchor="middle"
	dominant-baseline="middle"
	font-family="OutfitKey, 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
	font-size="${digitFontSize}"
	font-weight="700"
	style="font-variation-settings:'wght' 700"
	letter-spacing="-0.04em"
	fill="#e8ecf4"
	filter="url(#textShadow)"><tspan>${escapeXml(labelNumber)}</tspan><tspan font-size="${percentFontSize}" dy="${percentDy}">%</tspan></text>
${badge}
</svg>`;

	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
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
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
