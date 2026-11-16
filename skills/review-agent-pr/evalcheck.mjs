#!/usr/bin/env node
// Is an eval gain real? Compares runs before a change with runs after it.
// No dependencies.
//
//   node evalcheck.mjs before-1.json before-2.json --vs after-1.json after-2.json [--tool <name>]
//
// --tool names the tool the change added, to check that the gain came through it.
//
// Each file is one run:
//   { "scorer": "<hash of the scorer file>", "dataset": "<hash of the eval set>",
//     "cases": [ { "id": "inv-01", "pass": true, "error": null, "tokens": 21000,
//                  "trace": [ { "tool": "search_suppliers" } ] } ] }
//
// Exits 1 when there is at least one flag.
import fs from 'node:fs';

const raw = process.argv.slice(2);
const toolAt = raw.indexOf('--tool');
const tool = toolAt >= 0 ? raw[toolAt + 1] : null;
const argv = toolAt >= 0 ? raw.filter((_, i) => i !== toolAt && i !== toolAt + 1) : raw;
const split = argv.indexOf('--vs');
if (split < 1 || split === argv.length - 1) {
  console.error('usage: evalcheck.mjs <before.json>... --vs <after.json>...');
  process.exit(2);
}
const load = (f) => ({ file: f, ...JSON.parse(fs.readFileSync(f, 'utf8')) });
const before = argv.slice(0, split).map(load);
const after = argv.slice(split + 1).map(load);
const runs = [...before, ...after];

const flags = [];
const row = (name, text, bad = false) => {
  console.log(`${name.padEnd(10)} ${bad ? 'FLAG  ' : ''}${text}`);
  if (bad) flags.push(name);
};

const ids = [...new Set(runs.flatMap((r) => r.cases.map((c) => c.id)))].sort();
console.log(`EVAL CHECK  before ${before.length} run(s) · after ${after.length} run(s) · ${ids.length} cases\n`);

// Same ruler on both sides: the scorer and the eval set must not move between runs.
const distinct = (key) => new Set(runs.map((r) => r[key] ?? 'missing'));
const moved = ['scorer', 'dataset'].filter((k) => distinct(k).size > 1 || distinct(k).has('missing'));
row('ruler', moved.length ? `${moved.join(' and ')} hash differs between runs or is missing. The numbers are not comparable.` : 'same scorer and dataset in every run', moved.length > 0);

// Every run must score every case. A case that errored is a fail, never a skip.
const short = runs.filter((r) => r.cases.length !== ids.length).map((r) => `${r.file} has ${r.cases.length}`);
row('cases', short.length ? `runs with a different case count: ${short.join(', ')}` : `every run scored all ${ids.length}`, short.length > 0);
const wrongErrors = runs.flatMap((r) => r.cases.filter((c) => c.error && c.pass).map((c) => `${r.file}:${c.id}`));
const errored = runs.reduce((n, r) => n + r.cases.filter((c) => c.error).length, 0);
row('errors', wrongErrors.length ? `errored cases marked as pass: ${wrongErrors.join(', ')}` : `${errored} errored case(s), all counted as fails`, wrongErrors.length > 0);

// Scores and the noise floor.
const passed = (r) => r.cases.filter((c) => c.pass && !c.error).length;
const stats = (side) => {
  const scores = side.map(passed);
  return { scores, mean: scores.reduce((a, b) => a + b, 0) / scores.length, spread: Math.max(...scores) - Math.min(...scores) };
};
const b = stats(before);
const a = stats(after);
row('before', `${b.scores.map((s) => `${s}/${ids.length}`).join(', ')}   mean ${b.mean.toFixed(1)}   spread ${b.spread}`);
row('after', `${a.scores.map((s) => `${s}/${ids.length}`).join(', ')}   mean ${a.mean.toFixed(1)}   spread ${a.spread}`);

const delta = a.mean - b.mean;
const sign = delta >= 0 ? '+' : '';
if (before.length < 2) {
  row('delta', `${sign}${delta.toFixed(1)} cases. No noise floor: run the unchanged code at least twice before claiming anything.`, true);
} else {
  const floor = Math.max(b.spread, after.length > 1 ? a.spread : 0);
  const outside = Math.abs(delta) > floor;
  row('delta', `${sign}${delta.toFixed(1)} cases. Noise floor ${floor}. ${outside ? 'Outside noise.' : 'Inside noise: this is not evidence of a change.'}`, !outside);
}

// Which cases moved. A net gain can hide a case that broke.
const verdict = (side, id) => {
  const votes = side.map((r) => r.cases.find((c) => c.id === id)).map((c) => Boolean(c?.pass && !c?.error));
  const yes = votes.filter(Boolean).length;
  return { pass: yes * 2 > votes.length, fail: yes * 2 < votes.length, unstable: yes > 0 && yes < votes.length };
};
const fixed = ids.filter((id) => verdict(before, id).fail && verdict(after, id).pass);
const broke = ids.filter((id) => verdict(before, id).pass && verdict(after, id).fail);
const unstable = ids.filter((id) => verdict(before, id).unstable || verdict(after, id).unstable);
row('fixed', fixed.join(', ') || 'none');
row('broke', broke.length ? `${broke.join(', ')}. Read each trace and give the cause.` : 'none', broke.length > 0);
row('unstable', unstable.length ? `${unstable.join(', ')} (changes between runs of the same code)` : 'none');

// Mechanism: a gain should come through the thing that was built.
if (tool) {
  const called = (c) => (c?.trace ?? []).some((t) => (t?.tool ?? t?.name ?? t) === tool);
  const caseIn = (r, id) => r.cases.find((c) => c.id === id);
  const lastRun = after.at(-1);
  const calls = lastRun.cases.filter(called).length;
  const viaTool = fixed.filter((id) => called(caseIn(lastRun, id))).length;
  const bad = calls === 0 || (fixed.length > 0 && viaTool === 0);
  row('mechanism', `${tool} was called in ${calls}/${lastRun.cases.length} cases and in ${viaTool}/${fixed.length} of the fixed ones${bad ? '. The gain did not come through it.' : ''}`, bad);
}

// Cost next to accuracy, when the runs record tokens.
const meanTokens = (side) => {
  const t = side.flatMap((r) => r.cases.map((c) => c.tokens)).filter((x) => typeof x === 'number');
  return t.length ? t.reduce((x, y) => x + y, 0) / t.length : null;
};
const [tb, ta] = [meanTokens(before), meanTokens(after)];
if (tb && ta) row('cost', `${Math.round(tb)} to ${Math.round(ta)} tokens per case (${ta >= tb ? '+' : ''}${(((ta - tb) / tb) * 100).toFixed(0)}%)`);

// Observability: a failed case needs its tool calls to be explainable.
const total = runs.reduce((m, r) => m + r.cases.length, 0);
const traced = runs.reduce((m, r) => m + r.cases.filter((c) => Array.isArray(c.trace) && c.trace.length).length, 0);
row('traces', `${traced}/${total} cases carry a trace`, traced < total);

// Two cases for a person to check against the source document.
const last = after.at(-1);
const mid = (list) => list[Math.floor(list.length / 2)]?.id;
const picks = [mid(last.cases.filter((c) => c.pass && !c.error)), mid(last.cases.filter((c) => !c.pass || c.error))].filter(Boolean);
console.log(`\nhand-check ${picks.join(' and ')} against the source document (${last.file})`);
console.log(flags.length ? `\n${flags.length} flag(s): ${flags.join(', ')}` : '\nno flags');
process.exit(flags.length ? 1 : 0);
