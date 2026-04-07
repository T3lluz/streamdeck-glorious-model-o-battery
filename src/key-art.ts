/**
 * Stream Deck key graphics as SVG data URLs (sharp text at any size; Elgato recommends SVG for setImage).
 * Font: Outfit variable (OFL) in `fonts/Outfit-Variable.ttf`.
 * Bolt: Heroicons 24×24 solid "bolt" path (MIT).
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONT_FILE = path.join(PLUGIN_ROOT, "fonts", "Outfit-Variable.ttf");

/** Heroicons 24 solid bolt (trimmed), MIT License — https://github.com/tailwindlabs/heroicons */
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

function layout(level: number): { label: string; fontSize: number; textWidth: number } {
	const label = `${level}%`;
	let fontSize = 72;
	if (level >= 100) fontSize = 52;
	else if (level >= 10) fontSize = 64;
	// Approximate horizontal advance for Outfit bold digits + % (tuned for centering / bolt anchor).
	const textWidth = label.length * fontSize * 0.5;
	return { label, fontSize, textWidth };
}

/**
 * Builds `data:image/svg+xml,...` for use with `action.setImage`.
 */
export function buildBatteryKeyDataUrl(level: number, charging: boolean): string {
	const W = 144;
	const H = 144;
	const cx = W / 2;
	const cy = H * 0.5;
	const { label, fontSize, textWidth } = layout(level);

	const fontCss = fontFaceBlock();
	const styleBlock = fontCss
		? `<style type="text/css"><![CDATA[${fontCss}]]></style>`
		: "";

	// Anchor bolt at the top-right of the estimated percentage bbox (drawn after text = on top).
	const rightEdge = cx + textWidth / 2;
	const boltTx = rightEdge - 2;
	const boltTy = cy - fontSize * 0.52;
	const boltScale = 1.18;

	const boltGroup = charging
		? `<g transform="translate(${boltTx.toFixed(1)},${boltTy.toFixed(1)}) scale(${boltScale}) translate(-14,-8)" filter="url(#boltGlow)">
	<path fill="#2a1f06" fill-opacity="0.45" fill-rule="evenodd" d="${BOLT_PATH_D}" transform="translate(0.5,1)" />
	<path fill="url(#boltGrad)" fill-rule="evenodd" d="${BOLT_PATH_D}" stroke="#fff8dc" stroke-width="0.4" />
</g>`
		: "";

	const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${styleBlock}
<defs>
	<linearGradient id="bgTop" x1="0%" y1="0%" x2="0%" y2="100%">
		<stop offset="0%" style="stop-color:#141822"/>
		<stop offset="100%" style="stop-color:#0a0c10"/>
	</linearGradient>
	<linearGradient id="bgVignette" x1="50%" y1="0%" x2="50%" y2="100%">
		<stop offset="0%" style="stop-color:#00d6aa;stop-opacity:0.07"/>
		<stop offset="45%" style="stop-color:#00d6aa;stop-opacity:0"/>
	</linearGradient>
	<linearGradient id="boltGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
		<stop offset="0%" style="stop-color:#fff9e0"/>
		<stop offset="55%" style="stop-color:#ffd54a"/>
		<stop offset="100%" style="stop-color:#ff9f1a"/>
	</linearGradient>
	<filter id="textShadow" x="-30%" y="-30%" width="160%" height="160%">
		<feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#000" flood-opacity="0.65"/>
	</filter>
	<filter id="boltGlow" x="-80%" y="-80%" width="260%" height="260%">
		<feGaussianBlur stdDeviation="1.4" result="b"/>
		<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
	</filter>
</defs>
<rect width="${W}" height="${H}" rx="14" fill="url(#bgTop)"/>
<rect width="${W}" height="${H * 0.28}" rx="14" fill="url(#bgVignette)"/>
<text
	x="${cx}"
	y="${cy}"
	text-anchor="middle"
	dominant-baseline="middle"
	font-family="OutfitKey, 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
	font-size="${fontSize}"
	font-weight="700"
	style="font-variation-settings:'wght' 700"
	letter-spacing="-0.045em"
	fill="#f2f5fb"
	filter="url(#textShadow)">${escapeXml(label)}</text>
${boltGroup}
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
<rect width="${W}" height="${H}" rx="14" fill="url(#ebg)"/>
<text x="72" y="78" text-anchor="middle" dominant-baseline="middle"
	font-family="Segoe UI,system-ui,sans-serif" font-size="38" font-weight="600" fill="#8a858e">${escapeXml(symbol)}</text>
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
