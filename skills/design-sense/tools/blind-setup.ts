#!/usr/bin/env bun
// blind-setup: copy a load-budget run's screenshots into neutral folders for the blind test.
//
//   bun blind-setup.ts <load-budget out dir> <blind dir>
//
// Each label gets a shuffled letter: <blind dir>/site-a/{fold,full,phone}.png. The key (letter → label)
// goes to <blind dir>/../blind-key.json, outside the folder the testers are pointed at.
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
	console.error('usage: bun blind-setup.ts <load-budget out dir> <blind dir>');
	process.exit(1);
}
const files = await readdir(src);
const labels = [...new Set(files.filter((f) => f.endsWith('.desktop.fold.png')).map((f) => f.replace('.desktop.fold.png', '')))];
const shuffled = labels.map((l) => ({ l, k: Math.random() })).sort((a, b) => a.k - b.k).map((x) => x.l);
const key: Record<string, string> = {};
for (const [i, label] of shuffled.entries()) {
	const dir = join(dest, `site-${String.fromCharCode(97 + i)}`);
	await mkdir(dir, { recursive: true });
	await copyFile(join(src, `${label}.desktop.fold.png`), join(dir, 'fold.png'));
	await copyFile(join(src, `${label}.desktop.full.png`), join(dir, 'full.png'));
	await copyFile(join(src, `${label}.phone.full.png`), join(dir, 'phone.png'));
	key[`site-${String.fromCharCode(97 + i)}`] = label;
}
const keyPath = join(dirname(dest), 'blind-key.json');
await writeFile(keyPath, JSON.stringify(key, null, 2));
console.log(`${shuffled.length} sites → ${dest}; key at ${keyPath}`);
