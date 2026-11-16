#!/usr/bin/env node
// Pre-PR preflight: the mechanical half of the review. It reads everything
// this branch changed and files what it finds under the review's questions.
// No dependencies. Run from anywhere inside the repo.
//
//   node preflight.mjs [--base main] [--spec docs/spec.md] [--protect dir/]...
//                      [--summary agent-done-message.md] [--answers data/expected.json]...
//                      [--budget 300] [--mutants 10] [--no-run] [--no-mutate]
//
// Exits 1 when there is at least one flag.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// ---------- options ----------
const argv = process.argv.slice(2);
const one = (name, def) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : def);
const many = (name) => argv.flatMap((a, i) => (a === `--${name}` ? [argv[i + 1]] : []));
const BUDGET = Number(one('budget', 300)); // added source lines that still count as one slice
const MUTANTS = Number(one('mutants', 10)); // how many one-line mutants to try against the tests

const git = (...a) => execFileSync('git', ['-c', 'core.quotepath=off', ...a], { encoding: 'utf8', maxBuffer: 256e6 }).replace(/\n$/, '');
const gitOr = (fallback, ...a) => {
  try {
    return git(...a);
  } catch {
    return fallback; // the ref or file does not exist, which callers treat as "nothing there"
  }
};

const specArg = one('spec') && path.resolve(one('spec'));
const answerFiles = many('answers').map((f) => path.resolve(f));
const summaryArg = one('summary') && path.resolve(one('summary'));
process.chdir(git('rev-parse', '--show-toplevel'));
const rel = (abs) => path.relative(process.cwd(), abs);

const base = [one('base'), 'main', 'origin/main', 'master', 'origin/master'].find((b) => b && gitOr('', 'rev-parse', '--verify', '--quiet', b));
if (!base) {
  console.error('preflight: no base branch found. Pass --base <ref>.');
  process.exit(2);
}
const mergeBase = git('merge-base', base, 'HEAD');

// ---------- what kind of file is this ----------
const isTest = (f) => /[./](test|spec)\.[cm]?[jt]sx?$/.test(f) || /(^|\/)(__tests__|tests?)\//.test(f) || /_test\.(py|go)$/.test(f);
const isEval = (f) => /(^|\/)evals?\//.test(f);
const isDoc = (f) => /\.(md|mdx|txt)$/i.test(f);
const isLock = (f) => /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/.test(f);
const isConfig = (f) => /(^|\/)(package\.json|tsconfig[^/]*\.json|[^/]*\.config\.[cm]?[jt]s|[^/]*\.ya?ml|[^/]*\.toml)$/.test(f);
const isCode = (f) => /\.([cm]?[jt]sx?|py|go|rs|rb|java|kt|swift)$/.test(f);
const isUi = (f) => /\.(tsx|jsx|css|scss|astro|vue|svelte|html)$/.test(f) && !isTest(f);
const isAgent = (f) => !isTest(f) && isCode(f) && (/(^|\/)agents?\//.test(f) || /(prompt|tools?)[^/]*$/.test(f));
const isRoute = (f) => !isTest(f) && /(^|\/)(routes?|api)\/|(^|\/)(app|server|router)\.[cm]?[jt]s$/.test(f);
const kindOf = (f) => (isLock(f) ? 'lock' : isTest(f) ? 'test' : isEval(f) ? 'eval' : isDoc(f) ? 'doc' : isConfig(f) ? 'config' : isCode(f) ? 'source' : isUi(f) ? 'style' : 'other');

// ---------- collect the change ----------
const files = new Map(); // path -> { path, status, add, del, kind }
for (const row of git('diff', '--name-status', '--no-renames', mergeBase).split('\n').filter(Boolean)) {
  const [status, p] = row.split('\t');
  files.set(p, { path: p, status, add: 0, del: 0, kind: kindOf(p) });
}
for (const row of git('diff', '--numstat', '--no-renames', mergeBase).split('\n').filter(Boolean)) {
  const [a, d, p] = row.split('\t');
  const f = files.get(p);
  if (f) Object.assign(f, { add: Number(a) || 0, del: Number(d) || 0 });
}

const added = new Map(); // path -> [{ n, text }]
const removed = new Map(); // path -> [text]
const push = (map, key, value) => map.set(key, [...(map.get(key) ?? []), value]);
{
  let cur = null;
  let inHeader = true;
  let n = 0;
  for (const line of git('diff', '-U0', '--no-renames', mergeBase).split('\n')) {
    if (line.startsWith('diff --git ')) {
      cur = line.match(/^diff --git a\/.* b\/(.*)$/)?.[1] ?? null;
      inHeader = true;
    } else if (line.startsWith('@@')) {
      n = Number(line.match(/\+(\d+)/)?.[1] ?? 0);
      inHeader = false;
    } else if (!inHeader && cur && line.startsWith('+')) {
      push(added, cur, { n: n++, text: line.slice(1) });
    } else if (!inHeader && cur && line.startsWith('-')) {
      push(removed, cur, line.slice(1));
    }
  }
}
for (const p of git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean)) {
  const stat = fs.lstatSync(p);
  if (!stat.isFile()) continue; // a symlink or a nested repo is not part of the change
  const text = stat.size < 1e6 ? fs.readFileSync(p, 'utf8') : '';
  const lines = text.includes('\0') ? [] : text.replace(/\n$/, '').split('\n');
  files.set(p, { path: p, status: 'A', add: lines.length, del: 0, kind: kindOf(p) });
  added.set(p, lines.map((t, i) => ({ n: i + 1, text: t })));
}

const changed = [...files.values()].filter((f) => f.kind !== 'lock').sort((a, b) => a.path.localeCompare(b.path));

// Flags are filed under the review question they belong to.
const QUESTIONS = { 1: 'ask', 2: 'did it', 3: 'only it', 4: 'fits', 5: 'proof' };
const flags = [];
const clean = [];
const flag = (q, tag, msg) => flags.push({ q, tag, msg });
const where = (hits, max = 4) => hits.slice(0, max).join(', ') + (hits.length > max ? ` and ${hits.length - max} more` : '');
const check = (q, name, tag, hits, describe) => (hits.length ? flag(q, tag, describe(hits)) : clean.push(name));
const linesOf = (keep) => changed.filter((f) => isCode(f.path) && keep(f)).flatMap((f) => (added.get(f.path) ?? []).map((l) => ({ ...l, file: f.path })));
const at = (l) => `${l.file}:${l.n}`;
const isSource = (f) => f.kind === 'source';
const isComment = (text) => /^\s*(\/\/|\/\*|\*|#)/.test(text);

// ---------- 1. is there an ask to check against ----------
const specPath = specArg ? rel(specArg) : changed.find((f) => f.kind === 'doc' && /spec/i.test(f.path) && f.status !== 'D')?.path;
const specPaths = specPath && fs.existsSync(specPath)
  ? new Set([...fs.readFileSync(specPath, 'utf8').matchAll(/`([^`\s]+)`/g)].map((m) => m[1].replace(/^\.\//, '')).filter((t) => t.includes('/') || /\.[a-z]{1,5}$/i.test(t)))
  : null;
if (!changed.length) clean.push('nothing changed');
else if (!specPaths) flag(1, 'no ask', 'no spec found. Write the ask (goal, done when, files, out of scope) before reviewing, or pass --spec.');
else if (specPaths.size === 0) flag(1, 'no files', `${specPath} names no files, so scope cannot be checked`);

// ---------- 2. did it do what was asked: signs of faked or unfinished work ----------
check(2, 'unfinished work', 'unfinished',
  linesOf(isSource).filter((l) => (isComment(l.text) || /\bthrow new Error\(/.test(l.text)) && /not (yet )?implemented|\bplaceholder\b|\bstub(bed)?\b|\bfor now\b|\bsimplified\b|in a real (app|implementation|system|world)|\btemporar(y|ily)\b|\bdummy\b|hard-?coded|\bTODO\b|\bFIXME\b/i.test(l.text)).map(at),
  (h) => `code that says it is unfinished: ${where(h)}`);
check(2, 'test-aware code', 'test-aware',
  linesOf(isSource).filter((l) => /NODE_ENV\s*[!=]==?\s*['"]test['"]|process\.env\.(VITEST|JEST_WORKER_ID)|import\.meta\.vitest/.test(l.text)).map(at),
  (h) => `source behaves differently under test: ${where(h)}`);

const sourceTouched = changed.some(isSource);
const testFiles = changed.filter((f) => f.kind === 'test');
if (sourceTouched && testFiles.length === 0) flag(2, 'tests', 'source changed and no test file changed');
check(2, 'deleted tests', 'tests', testFiles.filter((f) => f.status === 'D').map((f) => f.path), (h) => `test file deleted: ${where(h)}`);
check(2, 'weakened tests', 'tests',
  testFiles.filter((f) => f.status === 'M').map((f) => [f.path, (removed.get(f.path) ?? []).filter((t) => /\b(expect|assert)\w*\(/.test(t)).length]).filter(([, n]) => n > 0).map(([p, n]) => `${p} (${n})`),
  (h) => `assertions removed or rewritten in existing tests: ${where(h)}`);
check(2, 'disabled checks', 'disabled',
  linesOf(() => true).filter((l) => /eslint-disable|\b(it|test|describe)\.(skip|only|todo)\(|\bx(it|describe)\(/.test(l.text)).map(at),
  (h) => `checks switched off: ${where(h)}`);

// ---------- 3. did it do only that ----------
const rulesText = ['AGENTS.md', 'CLAUDE.md', 'CONTRIBUTING.md'].map((f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '')).join('\n');
const protectedPaths = [...many('protect'), ...[...rulesText.matchAll(/do not (?:change|edit|touch|modify)\s+`([^`]+)`/gi)].map((m) => m[1])];
const isProtected = (f) => protectedPaths.some((p) => f === p || f.startsWith(p.endsWith('/') ? p : `${p}/`));
const inSpec = (f) => {
  if (!specPaths?.size) return null;
  const asSource = f.replace(/[._](test|spec)(\.[a-z]+)$/, '$2');
  return f === specPath || [...specPaths].some((s) => s === f || s === asSource || (s.endsWith('/') && f.startsWith(s)));
};
for (const f of changed) f.note = isProtected(f.path) ? 'PROTECTED' : inSpec(f.path) === false ? 'not in spec' : inSpec(f.path) ? 'in spec' : '';
check(3, 'protected paths', 'overreach', changed.filter((f) => f.note === 'PROTECTED').map((f) => f.path), (h) => `changes under a protected path: ${where(h)}`);
if (specPaths?.size) check(3, 'spec scope', 'overreach', changed.filter((f) => f.note === 'not in spec').map((f) => f.path), (h) => `not named in ${specPath}: ${where(h, 8)}`);

const sum = (kind) => changed.filter((f) => f.kind === kind).reduce((n, f) => n + f.add, 0);
const sourceAdded = sum('source');
if (sourceAdded > BUDGET) flag(3, 'size', `${sourceAdded} source lines added, budget is ${BUDGET}. Split it or cut.`);
else clean.push('size');

if (files.has('package.json') && fs.existsSync('package.json')) {
  const deps = (text) => {
    const j = text ? JSON.parse(text) : {};
    return new Set([...Object.keys(j.dependencies ?? {}), ...Object.keys(j.devDependencies ?? {})]);
  };
  const before = deps(gitOr('', 'show', `${mergeBase}:package.json`));
  check(3, 'dependencies', 'dependency', [...deps(fs.readFileSync('package.json', 'utf8'))].filter((d) => !before.has(d)), (h) => `new dependency: ${where(h)}`);
} else clean.push('dependencies');

const EXPORT = /^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|class|type|interface)\s+([A-Za-z_$][\w$]*)/;
const usersOf = (name, self) => new Set(gitOr('', 'grep', '-l', '-w', '-F', '--untracked', '-e', name, '--', '.', ':!*.md').split('\n').filter((f) => f && f !== self));
const unused = [];
for (const l of linesOf(isSource)) {
  const name = l.text.match(EXPORT)?.[1];
  if (!name) continue;
  const users = usersOf(name, l.file);
  const usedAtHome = Number(gitOr('0', 'grep', '-c', '-w', '-F', '--untracked', '-e', name, '--', l.file).split(':').pop()) > 1;
  if (usedAtHome) continue; // its own file uses it, so the export is at worst a visibility nit
  if (users.size === 0) unused.push(`${name} (${at(l)}) is used nowhere`);
  else if ([...users].every(isTest)) unused.push(`${name} (${at(l)}) is used only by tests`);
}
check(3, 'unused exports', 'unused', unused, (h) => where(h, 6));

// Something other code relied on went away.
const gone = [];
for (const f of changed.filter((x) => isSource(x) && x.status !== 'A')) {
  const still = new Set((added.get(f.path) ?? []).map((l) => l.text.match(EXPORT)?.[1]).filter(Boolean));
  for (const name of new Set((removed.get(f.path) ?? []).map((t) => t.match(EXPORT)?.[1]).filter(Boolean))) {
    const users = usersOf(name, f.path);
    if (!still.has(name) && users.size) gone.push(`${name} removed from ${f.path}, still used in ${users.size} file(s)`);
  }
}
check(3, 'removed exports', 'removed', gone, (h) => where(h, 6));

const comments = linesOf(isSource).filter((l) => isComment(l.text)).length;
if (comments >= 10 && comments / Math.max(1, sourceAdded) > 0.25) flag(3, 'comments', `${comments} of ${sourceAdded} added source lines are comments`);
else clean.push('comment density');

// ---------- 4. does it fit the system ----------
const top = (p) => p.split('/')[0];
const crossings = [];
for (const l of linesOf(isSource)) {
  const spec = l.text.match(/(?:from|import|require)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/)?.[1];
  if (!spec) continue;
  const target = path.normalize(path.join(path.dirname(l.file), spec));
  if (!target.startsWith('..') && top(target) !== top(l.file)) crossings.push(`${at(l)} imports ${target}`);
}
check(4, 'folder boundaries', 'boundary', crossings, (h) => `new import across top-level folders: ${where(h)}`);

const FIT_RULES = [
  ['swallowed errors', 'swallow', /catch\s*(\([^)]*\))?\s*\{\s*\}|\.catch\(\s*(\(\s*\w*\s*\)|\w+)\s*=>\s*(\{\s*\}|null|undefined|\[\]|''|""|false)\s*\)/, () => true],
  ['silent fallbacks', 'fallback', /(\?\?|\|\|)\s*(\[\]|\{\}|''|"")\s*([;,)\]}]|$)/, isSource],
  ['type escapes', 'type-escape', /\bas any\b|:\s*any\b|@ts-ignore|@ts-expect-error|\bas unknown as\b|#\s*type:\s*ignore/, () => true],
  ['debug leftovers', 'leftover', /\bconsole\.(log|debug)\(|\bdebugger\b/, isSource],
  ['unsafe input handling', 'unsafe', /\b(SELECT|INSERT INTO|UPDATE|DELETE FROM|WHERE|ORDER BY)\b[^'"]*\$\{|\.innerHTML\s*=|dangerouslySetInnerHTML|\beval\(|\bnew Function\(/, isSource],
  ['secrets', 'secret', /\bsk-[A-Za-z0-9_-]{16,}|\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*['"][A-Za-z0-9_\-]{12,}['"]/i, () => true],
];
for (const [name, tag, re, keep] of FIT_RULES) check(4, name, tag, linesOf(keep).filter((l) => re.test(l.text)).map(at), (h) => `${name}: ${where(h)}`);

// A catch that hands back a harmless value a line or two later.
const softCatch = [];
for (const f of changed.filter(isSource)) {
  const lines = added.get(f.path) ?? [];
  lines.forEach((l, i) => {
    if (!/\bcatch\b/.test(l.text) || /catch\s*(\([^)]*\))?\s*\{\s*\}/.test(l.text)) return;
    const body = lines.slice(i + 1, i + 4).filter((x) => x.n - l.n <= 3).map((x) => x.text).join('\n');
    if (/return\s*(\[\]|\{\}|null|undefined|''|""|false|0)?\s*;?\s*$/m.test(body) && !/\bthrow\b/.test(body)) softCatch.push(`${f.path}:${l.n}`);
  });
}
check(4, 'catch returns a default', 'swallow', softCatch, (h) => `catch returns a default value: ${where(h)}`);

// ---------- 5. is the proof real ----------
if (answerFiles.length) {
  const literals = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    else if (typeof v === 'string' && ((v.length >= 4 && /\d/.test(v)) || v.length >= 16)) literals.add(v);
    else if (typeof v === 'number' && Math.abs(v) >= 100 && !Number.isInteger(v)) literals.add(v.toFixed(2));
  };
  for (const f of answerFiles) walk(JSON.parse(fs.readFileSync(f, 'utf8')));
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const leaks = [];
  const product = changed.filter((f) => ['source', 'config', 'other'].includes(f.kind) && !answerFiles.includes(path.resolve(f.path)));
  for (const l of product.flatMap((f) => (added.get(f.path) ?? []).map((x) => ({ ...x, file: f.path })))) {
    const hit = [...literals].find((s) => new RegExp(`(^|[^A-Za-z0-9])${escape(s)}($|[^A-Za-z0-9])`).test(l.text));
    if (hit) leaks.push(`${at(l)} contains "${hit.length > 40 ? `${hit.slice(0, 40)}…` : hit}"`);
  }
  check(5, 'answer key leak', 'leak', leaks, (h) => `value from the answer key in product code: ${where(h, 6)}`);
}

const runs = [];
if (!argv.includes('--no-run') && fs.existsSync('package.json')) {
  const scripts = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts ?? {};
  for (const name of ['typecheck', 'lint', 'test'].filter((s) => scripts[s])) {
    const t0 = Date.now();
    const r = spawnSync('npm', ['run', '-s', name], { encoding: 'utf8', timeout: 600_000, env: { ...process.env, CI: '1', FORCE_COLOR: '0' } });
    const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '').split('\n').map((s) => s.trim()).filter(Boolean);
    const summary = out.findLast((s) => /^Tests?\s+\d|\d+ (passed|failed|errors?)/.test(s)) ?? out.at(-1) ?? '';
    const ok = r.status === 0;
    runs.push(`npm run ${name}: ${ok ? 'ok' : 'FAILED'} in ${((Date.now() - t0) / 1000).toFixed(1)}s${summary ? ` · ${summary}` : ''}`);
    if (!ok) flag(5, 'run', `npm run ${name} failed: ${summary}`);
  }
}

// ---------- readings: mutation score ----------
// Break one added line at a time and rerun the tests. A mutant the tests do not
// notice is a line the tests do not really check.
const OPS = [
  [/!==/, '==='], [/===/, '!=='], [/<=/, '<'], [/>=/, '>'], [/ < /, ' <= '], [/ > /, ' >= '],
  [/&&/, '||'], [/\|\|/, '&&'], [/\+= /, '-= '], [/ \+ /, ' - '], [/ - /, ' + '],
  [/\btrue\b/, 'false'], [/\bfalse\b/, 'true'],
];
const mutantOf = (t) => {
  if (isComment(t) || t.trim().length < 4 || /^\s*(import |export type |type |interface |[{}<)\]]|\/)/.test(t)) return null;
  if (/\.\s*$/.test(t) || /^\s*\d+\.\s/.test(t)) return null; // prose inside a string, such as a prompt
  for (const [re, to] of OPS) if (re.test(t)) return [t.replace(re, to), `${t.match(re)[0].trim()} to ${to.trim()}`];
  if (!/['"`]/.test(t) && /\b\d+\b/.test(t)) return [t.replace(/\b(\d+)\b/, (m) => String(Number(m) + 1)), 'number plus one'];
  const ret = t.match(/^(\s*)return\s+[^;]+;\s*$/);
  if (ret) return [`${ret[1]}return undefined;`, 'return value dropped'];
  const count = (ch) => t.split(ch).length - 1;
  const wholeStatement = /;\s*$/.test(t) && count('(') === count(')') && count('{') === count('}') && !/^\s*(const|let|var|export|throw|break|continue)\b/.test(t);
  return wholeStatement ? ['', 'statement removed'] : null;
};
const mutation = { total: 0, killed: 0, survivors: [], skipped: '' };
const testsPassed = runs.some((r) => r.startsWith('npm run test: ok'));
if (argv.includes('--no-run') || argv.includes('--no-mutate')) mutation.skipped = 'not run';
else if (!testsPassed) mutation.skipped = 'tests are not green, so mutants cannot be judged';
else {
  const candidates = linesOf(isSource).map((l) => ({ ...l, m: mutantOf(l.text) })).filter((l) => l.m && fs.existsSync(l.file));
  const step = Math.max(1, Math.ceil(candidates.length / MUTANTS));
  for (const c of candidates.filter((_, i) => i % step === 0).slice(0, MUTANTS)) {
    const original = fs.readFileSync(c.file, 'utf8');
    const lines = original.split('\n');
    if (lines[c.n - 1] !== c.text) continue;
    lines[c.n - 1] = c.m[0];
    try {
      fs.writeFileSync(c.file, lines.join('\n'));
      const r = spawnSync('npm', ['run', '-s', 'test'], { encoding: 'utf8', timeout: 300_000, env: { ...process.env, CI: '1', FORCE_COLOR: '0' } });
      mutation.total++;
      if (r.status !== 0) mutation.killed++;
      else mutation.survivors.push(`${at(c)}  ${c.m[1]}  |  ${c.text.trim().slice(0, 70)}`);
    } finally {
      fs.writeFileSync(c.file, original);
    }
  }
  if (!mutation.total) mutation.skipped = 'no mutable source lines in the change';
  else if (mutation.total >= 3 && mutation.killed / mutation.total < 0.5) flag(5, 'mutation', `tests noticed ${mutation.killed} of ${mutation.total} one-line breaks in the new code`);
}

// ---------- readings: who else uses what this change touched ----------
const touched = new Map(); // symbol -> file it lives in
{
  let cur = null;
  for (const line of git('diff', '-U0', '--no-renames', mergeBase).split('\n')) {
    if (line.startsWith('diff --git ')) cur = line.match(/ b\/(.*)$/)?.[1] ?? null;
    const f = cur && files.get(cur);
    if (!f || f.status !== 'M' || f.kind !== 'source') continue;
    const name = line.startsWith('@@')
      ? line.replace(/^@@[^@]*@@/, '').match(/(?:function\*?|class|const|let)\s+([A-Za-z_$][\w$]*)/)?.[1]
      : /^[-+]/.test(line) ? line.slice(1).match(EXPORT)?.[1] : null;
    if (name) touched.set(name, cur);
  }
}
const reach = [...touched].map(([name, file]) => [name, file, [...usersOf(name, file)].filter((u) => !files.has(u))]).filter(([, , users]) => users.length);

// ---------- readings: the ask's checks and the agent's claims, numbered ----------
const bullets = (text, start) => {
  const lines = text.split('\n');
  const from = lines.findIndex((l) => start.test(l));
  const out = [];
  for (const l of from < 0 ? [] : lines.slice(from + 1)) {
    const item = l.match(/^\s*(?:[-*]|\d+[.)])\s+(.*)$/)?.[1];
    if (item) out.push(item.trim());
    else if (l.trim() && out.length) break;
  }
  return out;
};
const doneWhen = specPath && fs.existsSync(specPath) ? bullets(fs.readFileSync(specPath, 'utf8'), /done[- ]when/i) : [];
const claims = summaryArg && fs.existsSync(summaryArg)
  ? fs.readFileSync(summaryArg, 'utf8').split('\n').map((l) => l.replace(/^\s*(?:[-*#]+|\d+[.)])\s*/, '').trim()).filter(Boolean).flatMap((l) => l.split(/(?<=[.!?])\s+(?=[A-Z`])/)).slice(0, 14)
  : [];

// ---------- report ----------
const newFiles = changed.filter((f) => f.status === 'A');
console.log(`PRE-PR PREFLIGHT  base ${base}@${git('rev-parse', '--short', mergeBase)}  ${changed.length} files (${newFiles.length} new)  +${changed.reduce((n, f) => n + f.add, 0)} −${changed.reduce((n, f) => n + f.del, 0)}`);
console.log(`added lines: source ${sourceAdded} · tests ${sum('test')} · evals ${sum('eval')} · docs ${sum('doc')} · config ${sum('config')}`);
console.log(`ask: ${specPath ?? 'none'}${protectedPaths.length ? `   protected: ${protectedPaths.join(', ')}` : ''}`);

console.log('\nCHANGE MAP');
const width = Math.max(...changed.map((f) => f.path.length), 10);
for (const f of changed) {
  const status = { A: 'new ', M: 'edit', D: 'del ' }[f.status] ?? f.status;
  console.log(`  ${f.path.padEnd(width)}  ${status}  ${`+${f.add} −${f.del}`.padEnd(10)}  ${f.kind.padEnd(6)}  ${f.note}`);
}

console.log(`\nFLAGS (${flags.length})`);
flags.sort((a, b) => a.q - b.q).forEach((f, i) => {
  // Long lists go one item per line so each can be ticked off.
  const [head, ...rest] = f.msg.length > 110 ? f.msg.split(', ') : [f.msg];
  console.log(`  ${String(i + 1).padStart(2)}  ${`${f.q} ${QUESTIONS[f.q]}`.padEnd(9)}  ${f.tag.padEnd(11)}  ${head}`);
  rest.forEach((r) => console.log(`${' '.repeat(30)}${r}`));
});
if (!flags.length) console.log('  none');
console.log(`\nCLEAN  ${clean.join(', ')}`);
console.log(runs.length ? `RUN    ${runs.join('\n       ')}` : 'RUN    not run');
if (!answerFiles.length) console.log('LEAK   not scanned. Pass --answers <file> when the repo has an eval answer key.');

if (doneWhen.length) {
  console.log(`\nDONE-WHEN (${doneWhen.length})  each needs evidence or it is unproven`);
  doneWhen.forEach((d, i) => console.log(`  D${i + 1}  ${d}`));
}
if (claims.length) {
  console.log(`\nCLAIMS (${claims.length})  from the agent's done message: mark each true, false or unproven`);
  claims.forEach((c, i) => console.log(`  C${i + 1}  ${c}`));
}
if (reach.length) {
  console.log(`\nREACH  code outside this change that uses what it touched`);
  reach.slice(0, 8).forEach(([name, file, users]) => console.log(`  ${name} (${file}) is used by ${users.length}: ${where(users, 5)}`));
}
console.log(`\nMUTATION  ${mutation.skipped || `tests noticed ${mutation.killed} of ${mutation.total} one-line breaks in the new code`}`);
mutation.survivors.forEach((x) => console.log(`  survived  ${x}`));

const inAsk = changed.filter((f) => f.note === 'in spec').length;
console.log(`\nREADINGS  scope ${specPaths?.size ? `${inAsk}/${changed.length} files in the ask` : 'no ask'} · source +${sourceAdded}, tests +${sum('test')} · mutants ${mutation.total ? `${mutation.killed}/${mutation.total}` : 'n/a'} · outside users ${reach.reduce((n, r) => n + r[2].length, 0)} · done-when ${doneWhen.length} · claims ${claims.length} · flags ${flags.length}`);

const proof = [];
if (sourceTouched) proof.push('5a tests can fail (source changed)');
if (changed.some((f) => f.kind === 'eval' || isAgent(f.path))) proof.push('5b eval evidence (agent behaviour or evals changed)');
if (changed.some((f) => isUi(f.path) || isRoute(f.path))) proof.push('5c real app (UI or routes changed)');
console.log(`\nPROOF  ${proof.join(' · ') || 'no proof branch applies'}`);
process.exit(flags.length ? 1 : 0);
