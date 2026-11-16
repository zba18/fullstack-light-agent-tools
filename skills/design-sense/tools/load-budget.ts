#!/usr/bin/env bun
// load-budget: the measured gate for design-sense (cognitive load, plus first-impression contrast and peak-end spikes).
//
//   bun load-budget.ts <url | label=url> [more …] [--out <dir>]
//
// For each URL, at desktop (1440×900) and phone (390×844), it measures the first viewport exactly as it loads,
// before any scrolling: words, interactive elements, filled actions, font families, type sizes, colours, images,
// the contrast of every text block against the real pixels behind it, LCP and layout shift. Then it scrolls the
// page and takes full-page shots. Writes <label>.<viewport>.fold.png / .full.png, report.json and report.md.
// Exit 0 = no FAIL, 2 = at least one FAIL, 1 = tool error.
import { chromium, type Browser, type Page } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// The one place the thresholds live: value ≤ first → PASS, ≤ second → WARN, above → FAIL.
// House numbers built on references/evidence.md, not figures from the papers. Tune here, nowhere else.
export const BUDGETS = {
	desktop: { words: [50, 90], interactive: [8, 12], filledActions: [1, 2], fontFamilies: [2, 3], typeSizes: [4, 6], colours: [6, 9], images: [3, 6], overflowPx: [1, 1] },
	phone: { words: [40, 70], interactive: [6, 10], filledActions: [1, 2], fontFamilies: [2, 3], typeSizes: [4, 6], colours: [6, 9], images: [2, 4], overflowPx: [1, 1] },
	lcpMs: [2500, 4000], // Core Web Vitals "good" / "poor"
	cls: [0.1, 0.25],
	contrast: { normal: 4.5, large: 3 }, // WCAG 2.2 SC 1.4.3; large = ≥ 24px, or ≥ 18.66px bold
} as const;

const VIEWPORTS = {
	desktop: { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
	phone: {
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true,
		userAgent:
			'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
	},
} as const;
type ViewportName = keyof typeof VIEWPORTS;
type Verdict = 'PASS' | 'WARN' | 'FAIL';
type Box = { x: number; y: number; w: number; h: number };
type TextBlock = { text: string; color: string; size: number; weight: number; clip: boolean; box: Box };

const METRICS = ['words', 'interactive', 'filledActions', 'fontFamilies', 'typeSizes', 'colours', 'images', 'overflowPx'] as const;
const LABELS: Record<(typeof METRICS)[number], string> = {
	words: 'Words in view',
	interactive: 'Interactive elements',
	filledActions: 'Filled actions',
	fontFamilies: 'Font families',
	typeSizes: 'Type sizes',
	colours: 'Colours',
	images: 'Images',
	overflowPx: 'Sideways overflow (px)',
};

const verdict = (value: number, [pass, warn]: readonly [number, number]): Verdict =>
	value <= pass ? 'PASS' : value <= warn ? 'WARN' : 'FAIL';

// ---- In-page probes (run in the browser; keep them plain JS) ---------------------------------------

const OBSERVERS = `
window.__ds = { lcp: null, cls: 0 };
try {
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ds.lcp = e.renderTime || e.loadTime || e.startTime; })
    .observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__ds.cls += e.value; })
    .observe({ type: 'layout-shift', buffered: true });
} catch (e) {}
`;

function measureFold(deviceWidth: number) {
	const vw = innerWidth;
	const vh = innerHeight;
	// A page wider than the phone makes mobile Chrome zoom out: layout px then map to fewer screenshot px.
	const scale = Math.min(1, deviceWidth / vw);
	const overflowPx = Math.max(0, document.documentElement.scrollWidth - deviceWidth);
	const inView = (r: DOMRect) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
	const shown = (el: Element) =>
		(el as any).checkVisibility ? (el as any).checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true;
	const parse = (c: string) => {
		const m = c.match(/rgba?\(([^)]+)\)/);
		if (!m) return null;
		const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
		return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
	};
	const lum = (c: { r: number; g: number; b: number }) => {
		const f = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
		return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
	};
	const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
	// Painted at that point: not covered by an overlay and not scrolled out of a clipping box.
	const painted = (el: Element, r: { left: number; top: number; right: number; bottom: number }) => {
		const x = Math.min(vw - 1, Math.max(0, (r.left + r.right) / 2));
		const y = Math.min(vh - 1, Math.max(0, (r.top + r.bottom) / 2));
		const hit = document.elementFromPoint(x, y);
		return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
	};
	const effectiveBg = (el: Element | null) => {
		for (let e = el; e; e = e.parentElement) {
			const c = parse(getComputedStyle(e).backgroundColor);
			if (c && c.a > 0.5) return c;
		}
		return { r: 255, g: 255, b: 255, a: 1 };
	};

	// Text: every visible text node in view, grouped by its element.
	const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
	const blocks = new Map<Element, { text: string; l: number; t: number; r: number; b: number }>();
	let words = 0;
	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		const t = (n.textContent || '').replace(/\s+/g, ' ').trim();
		const el = n.parentElement;
		if (!t || !el || skip.has(el.tagName) || !shown(el)) continue;
		const range = document.createRange();
		range.selectNodeContents(n);
		const rects = [...range.getClientRects()].filter(inView);
		if (!rects.length) continue;
		const u = {
			l: Math.min(...rects.map((r) => r.left)),
			t: Math.min(...rects.map((r) => r.top)),
			r: Math.max(...rects.map((r) => r.right)),
			b: Math.max(...rects.map((r) => r.bottom)),
		};
		if (!painted(el, { left: u.l, top: u.t, right: u.r, bottom: u.b })) continue;
		words += t.split(' ').length;
		const prev = blocks.get(el);
		blocks.set(
			el,
			prev
				? { text: `${prev.text} ${t}`, l: Math.min(prev.l, u.l), t: Math.min(prev.t, u.t), r: Math.max(prev.r, u.r), b: Math.max(prev.b, u.b) }
				: { text: t, ...u },
		);
	}

	const families = new Set<string>();
	const sizes = new Set<number>();
	const colours = new Set<string>();
	const q = (c: { r: number; g: number; b: number }) => [c.r, c.g, c.b].map((v) => Math.round(v / 24)).join(',');
	const textBlocks: any[] = [];
	for (const [el, b] of blocks) {
		const cs = getComputedStyle(el);
		const family = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
		if (family) families.add(family);
		sizes.add(Math.round(parseFloat(cs.fontSize)));
		const fill = parse(cs.webkitTextFillColor || '') ?? parse(cs.color);
		const clip = /text/.test(cs.backgroundClip || (cs as any).webkitBackgroundClip || '') || (fill ? fill.a === 0 : false);
		const color = parse(cs.color);
		if (color && color.a > 0 && !clip) colours.add(q(color));
		const l = Math.max(0, b.l), t = Math.max(0, b.t);
		textBlocks.push({
			text: b.text.slice(0, 80),
			color: cs.color,
			size: parseFloat(cs.fontSize),
			weight: Number(cs.fontWeight) || 400,
			clip,
			box: { x: l, y: t, w: Math.min(vw, b.r) - l, h: Math.min(vh, b.b) - t },
		});
	}

	// Interactive elements, outermost only, and which of them are filled actions.
	const selector =
		'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [tabindex]:not([tabindex="-1"])';
	const all = [...document.querySelectorAll(selector)];
	const set = new Set(all);
	let interactive = 0;
	let filledActions = 0;
	const filled: string[] = [];
	for (const el of all) {
		let nested = false;
		for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) nested = true;
		if (nested || !shown(el)) continue;
		const r = el.getBoundingClientRect();
		if (!inView(r) || !painted(el, r)) continue;
		interactive++;
		const cs = getComputedStyle(el);
		const bg = parse(cs.backgroundColor);
		const gradient = /gradient/.test(cs.backgroundImage);
		const sized = r.width >= 60 && r.height >= 28 && r.height <= 120 && r.width <= vw * 0.6;
		if (sized && (gradient || (bg && bg.a >= 0.5 && ratio(lum(bg), lum(effectiveBg(el.parentElement))) >= 1.3))) {
			filledActions++;
			filled.push((el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40));
		}
	}

	// Colours from painted surfaces and borders; images and media.
	let images = 0;
	for (const el of document.body.querySelectorAll('*')) {
		const r = el.getBoundingClientRect();
		if (!inView(r) || !shown(el)) continue;
		const cs = getComputedStyle(el);
		const bg = parse(cs.backgroundColor);
		const area = r.width * r.height;
		if (bg && bg.a >= 0.5 && (area >= vw * vh * 0.01 || set.has(el))) colours.add(q(bg));
		if (parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== 'none') {
			const bc = parse(cs.borderTopColor);
			if (bc && bc.a >= 0.5) colours.add(q(bc));
		}
		const tag = el.tagName;
		const media = tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS' || (tag === 'svg' && !el.parentElement?.closest('svg'));
		const bgImage = /url\(/.test(cs.backgroundImage);
		if ((media || bgImage) && r.width >= 24 && r.height >= 24) images++;
	}

	return {
		words,
		interactive,
		filledActions,
		filled,
		fontFamilies: families.size,
		families: [...families],
		typeSizes: sizes.size,
		sizes: [...sizes].sort((a, b) => a - b),
		colours: colours.size,
		images,
		overflowPx,
		scale,
		textBlocks,
	};
}

function measurePage() {
	let words = 0;
	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		const el = n.parentElement;
		const t = (n.textContent || '').replace(/\s+/g, ' ').trim();
		if (!t || !el || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)) continue;
		if ((el as any).checkVisibility && !(el as any).checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
		words += t.split(' ').length;
	}
	const height = document.documentElement.scrollHeight;
	return { words, height, screens: Math.round((height / innerHeight) * 10) / 10 };
}

// ---- Contrast against the pixels behind the text ---------------------------------------------------

const HIDE_TEXT = `*, *::before, *::after {
  color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important;
  text-decoration-color: transparent !important; caret-color: transparent !important; transition: none !important;
}`;

async function backgroundStats(decoder: Page, png: Buffer, boxes: Box[]) {
	return decoder.evaluate(
		async ({ b64, boxes }) => {
			const img = new Image();
			img.src = `data:image/png;base64,${b64}`;
			await img.decode();
			const c = document.createElement('canvas');
			c.width = img.width;
			c.height = img.height;
			const g = c.getContext('2d', { willReadFrequently: true })!;
			g.drawImage(img, 0, 0);
			const f = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
			return boxes.map((b) => {
				const x = Math.max(0, Math.floor(b.x));
				const y = Math.max(0, Math.floor(b.y));
				const w = Math.min(c.width - x, Math.ceil(b.w));
				const h = Math.min(c.height - y, Math.ceil(b.h));
				if (w < 1 || h < 1) return null;
				const d = g.getImageData(x, y, w, h).data;
				const step = Math.max(1, Math.floor((w * h) / 4000));
				const L: number[] = [];
				const sum = [0, 0, 0];
				for (let i = 0; i < w * h; i += step) {
					const o = i * 4;
					L.push(0.2126 * f(d[o]) + 0.7152 * f(d[o + 1]) + 0.0722 * f(d[o + 2]));
					sum[0] += d[o];
					sum[1] += d[o + 1];
					sum[2] += d[o + 2];
				}
				L.sort((a, b) => a - b);
				const at = (p: number) => L[Math.min(L.length - 1, Math.floor(p * (L.length - 1)))];
				return { median: at(0.5), p10: at(0.1), p90: at(0.9), mean: sum.map((s) => s / L.length) };
			});
		},
		{ b64: png.toString('base64'), boxes },
	);
}

const rgba = (c: string) => {
	const p = (c.match(/rgba?\(([^)]+)\)/)?.[1] ?? '0,0,0').split(/[\s,/]+/).filter(Boolean).map(Number);
	return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
};
const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

async function measureContrast(page: Page, decoder: Page, blocks: TextBlock[], scale: number) {
	const measurable = blocks.filter((b) => !b.clip && b.box.w >= 2 && b.box.h >= 2);
	const style = await page.addStyleTag({ content: HIDE_TEXT });
	await page.waitForTimeout(150);
	const shot = await page.screenshot();
	await style.evaluate((el) => el.remove());
	const boxes = measurable.map(({ box: b }) => ({ x: b.x * scale, y: b.y * scale, w: b.w * scale, h: b.h * scale }));
	const stats = await backgroundStats(decoder, shot, boxes);
	const results = measurable.map((b, i) => {
		const s = stats[i];
		if (!s) return null;
		const c = rgba(b.color);
		// Blend a translucent text colour over the average background behind it.
		const mix = (v: number, bg: number) => v * c.a + bg * (1 - c.a);
		const text = luminance(mix(c.r, s.mean[0]), mix(c.g, s.mean[1]), mix(c.b, s.mean[2]));
		const large = b.size >= 24 || (b.size >= 18.66 && b.weight >= 700);
		const need = large ? BUDGETS.contrast.large : BUDGETS.contrast.normal;
		const median = contrast(text, s.median);
		const worst = Math.min(contrast(text, s.p10), contrast(text, s.p90));
		const v: Verdict = median < need ? 'FAIL' : worst < need ? 'WARN' : 'PASS';
		return { text: b.text, size: Math.round(b.size), need, median: +median.toFixed(2), worst: +worst.toFixed(2), verdict: v };
	});
	return {
		results: results.filter(Boolean) as NonNullable<(typeof results)[number]>[],
		skipped: blocks.length - measurable.length,
	};
}

// ---- Run --------------------------------------------------------------------------------------------

async function measure(browser: Browser, decoder: Page, url: string, label: string, name: ViewportName, out: string) {
	const ctx = await browser.newContext({ ...VIEWPORTS[name], deviceScaleFactor: 1 });
	await ctx.addInitScript(OBSERVERS);
	const page = await ctx.newPage();
	try {
		const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
		await page.waitForLoadState('load', { timeout: 20_000 }).catch(() => {});
		await page.waitForTimeout(2500);

		const fold = await page.evaluate(measureFold, VIEWPORTS[name].viewport.width);
		const vitals = await page.evaluate(() => (window as any).__ds as { lcp: number | null; cls: number });
		await page.screenshot({ path: join(out, `${label}.${name}.fold.png`) });
		const contrastReport = await measureContrast(page, decoder, fold.textBlocks, fold.scale);

		// Scroll through so lazy content renders, then the whole page.
		await page.evaluate(async () => {
			for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) {
				scrollTo(0, y);
				await new Promise((r) => setTimeout(r, 120));
			}
			scrollTo(0, 0);
		});
		await page.waitForTimeout(800);
		const whole = await page.evaluate(measurePage);
		await page.screenshot({ path: join(out, `${label}.${name}.full.png`), fullPage: true });

		const budget = BUDGETS[name];
		const checks = Object.fromEntries(
			METRICS.map((m) => [m, { value: fold[m] as number, verdict: verdict(fold[m] as number, budget[m]) }]),
		) as Record<(typeof METRICS)[number], { value: number; verdict: Verdict }>;
		const lcp = vitals.lcp == null ? null : Math.round(vitals.lcp);
		const cls = +vitals.cls.toFixed(3);
		const contrastFails = contrastReport.results.filter((r) => r.verdict === 'FAIL').length;
		return {
			status: res?.status() ?? null,
			checks,
			detail: { families: fold.families, sizes: fold.sizes, filled: fold.filled },
			vitals: {
				lcpMs: { value: lcp, verdict: lcp == null ? null : verdict(lcp, BUDGETS.lcpMs) },
				cls: { value: cls, verdict: verdict(cls, BUDGETS.cls) },
			},
			contrast: { ...contrastReport, verdict: (contrastFails ? 'FAIL' : contrastReport.results.some((r) => r.verdict === 'WARN') ? 'WARN' : 'PASS') as Verdict },
			page: whole,
		};
	} finally {
		await ctx.close();
	}
}

type Result = Awaited<ReturnType<typeof measure>>;

const slug = (url: string) => {
	const u = new URL(url);
	const path = u.pathname.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-');
	return [u.host.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-'), path].filter(Boolean).join('-').toLowerCase();
};

function verdicts(r: Result): Verdict[] {
	return [
		...Object.values(r.checks).map((c) => c.verdict),
		r.contrast.verdict,
		r.vitals.cls.verdict,
		...(r.vitals.lcpMs.verdict ? [r.vitals.lcpMs.verdict] : []),
	];
}

function markdown(sites: { label: string; url: string; results: Partial<Record<ViewportName, Result>>; error?: string }[]) {
	const mark = (v: Verdict | null | undefined) => (v === 'FAIL' ? '**FAIL**' : v === 'WARN' ? 'WARN' : v === 'PASS' ? 'pass' : 'n/a');
	const lines: string[] = ['# Load budget', '', `Run ${new Date().toISOString()}. Thresholds: \`BUDGETS\` in load-budget.ts (desktop / phone).`, ''];
	lines.push('| Metric | Desktop budget | Phone budget |', '|---|---|---|');
	for (const m of METRICS) lines.push(`| ${LABELS[m]} | ≤ ${BUDGETS.desktop[m][0]} pass, ≤ ${BUDGETS.desktop[m][1]} warn | ≤ ${BUDGETS.phone[m][0]} pass, ≤ ${BUDGETS.phone[m][1]} warn |`);
	lines.push(
		`| Text contrast | ≥ ${BUDGETS.contrast.normal}:1, large ≥ ${BUDGETS.contrast.large}:1 | same |`,
		`| LCP · layout shift | ≤ ${BUDGETS.lcpMs[0]} ms · ≤ ${BUDGETS.cls[0]} pass | same |`,
		'',
		'## Summary',
		'',
		'| Page | Desktop FAIL · WARN | Phone FAIL · WARN | Words on page | Screens (desktop) |',
		'|---|---|---|---|---|',
	);
	for (const s of sites) {
		const count = (r?: Result) => (r ? `${verdicts(r).filter((v) => v === 'FAIL').length} · ${verdicts(r).filter((v) => v === 'WARN').length}` : 'error');
		lines.push(`| ${s.label} | ${count(s.results.desktop)} | ${count(s.results.phone)} | ${s.results.desktop?.page.words ?? '–'} | ${s.results.desktop?.page.screens ?? '–'} |`);
	}
	for (const s of sites) {
		lines.push('', `## ${s.label}`, '', s.url, '');
		if (s.error) lines.push(`Error: ${s.error}`, '');
		const d = s.results.desktop;
		const p = s.results.phone;
		if (!d && !p) continue;
		lines.push('| First viewport | Desktop | Phone |', '|---|---|---|');
		for (const m of METRICS) lines.push(`| ${LABELS[m]} | ${d?.checks[m].value ?? '–'} ${mark(d?.checks[m].verdict)} | ${p?.checks[m].value ?? '–'} ${mark(p?.checks[m].verdict)} |`);
		const cf = (r?: Result) => (r ? `${r.contrast.results.filter((x) => x.verdict === 'FAIL').length} of ${r.contrast.results.length} blocks fail ${mark(r.contrast.verdict)}` : '–');
		lines.push(
			`| Text contrast | ${cf(d)} | ${cf(p)} |`,
			`| LCP | ${d?.vitals.lcpMs.value ?? 'n/a'} ms ${mark(d?.vitals.lcpMs.verdict)} | ${p?.vitals.lcpMs.value ?? 'n/a'} ms ${mark(p?.vitals.lcpMs.verdict)} |`,
			`| Layout shift | ${d?.vitals.cls.value ?? '–'} ${mark(d?.vitals.cls.verdict)} | ${p?.vitals.cls.value ?? '–'} ${mark(p?.vitals.cls.verdict)} |`,
			'',
		);
		if (d) lines.push(`Desktop fonts: ${d.detail.families.join(', ') || '–'} · sizes ${d.detail.sizes.join(', ')} px · filled actions: ${d.detail.filled.map((t) => `"${t}"`).join(', ') || 'none'}`, '');
		const bad = [...(d?.contrast.results ?? []).map((r) => ({ ...r, vp: 'desktop' })), ...(p?.contrast.results ?? []).map((r) => ({ ...r, vp: 'phone' }))].filter((r) => r.verdict !== 'PASS');
		if (bad.length) {
			lines.push('| Contrast | Viewport | Text | Size | Median | Worst | Needs |', '|---|---|---|---|---|---|---|');
			for (const r of bad) lines.push(`| ${mark(r.verdict)} | ${r.vp} | ${r.text.replace(/\|/g, '/')} | ${r.size}px | ${r.median} | ${r.worst} | ${r.need} |`);
			lines.push('');
		}
		const skipped = (d?.contrast.skipped ?? 0) + (p?.contrast.skipped ?? 0);
		if (skipped) lines.push(`${skipped} text blocks not measured for contrast (gradient or clipped text): check them by eye.`, '');
	}
	return lines.join('\n') + '\n';
}

async function main() {
	const args = process.argv.slice(2);
	const outAt = args.indexOf('--out');
	const out = outAt >= 0 ? args[outAt + 1] : 'load-budget';
	const targets = args
		.filter((a, i) => a !== '--out' && i !== outAt + 1)
		.map((a) => {
			const eq = a.indexOf('=');
			const hasLabel = eq > 0 && !a.slice(0, eq).includes(':');
			const url = hasLabel ? a.slice(eq + 1) : a;
			return { url, label: hasLabel ? a.slice(0, eq) : slug(url) };
		});
	if (!targets.length) {
		console.error('usage: bun load-budget.ts <url | label=url> [more …] [--out <dir>]');
		process.exit(1);
	}
	await mkdir(out, { recursive: true });
	const browser = await chromium.launch();
	const decoder = await browser.newPage();
	const sites: { label: string; url: string; results: Partial<Record<ViewportName, Result>>; error?: string }[] = [];
	for (const t of targets) {
		const site: (typeof sites)[number] = { ...t, results: {} };
		for (const name of Object.keys(VIEWPORTS) as ViewportName[]) {
			try {
				site.results[name] = await measure(browser, decoder, t.url, t.label, name, out);
				console.log(`${t.label} ${name}: ${verdicts(site.results[name]!).filter((v) => v === 'FAIL').length} FAIL`);
			} catch (err) {
				site.error = `${name}: ${(err as Error).message.split('\n')[0]}`;
				console.error(`${t.label} ${name}: ${site.error}`);
			}
		}
		sites.push(site);
	}
	await browser.close();
	await writeFile(join(out, 'report.json'), JSON.stringify({ budgets: BUDGETS, sites }, null, 2));
	await writeFile(join(out, 'report.md'), markdown(sites));
	console.log(`report: ${join(out, 'report.md')}`);
	const failed = sites.some((s) => s.error || Object.values(s.results).some((r) => r && verdicts(r).includes('FAIL')));
	process.exit(failed ? 2 : 0);
}

if (import.meta.main) await main();
