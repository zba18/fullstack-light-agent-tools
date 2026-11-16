#!/usr/bin/env python3
"""Humanizer gate. Zayd, 2026-11-10: "I want this applied to everywhere in my setup ... make sure it always runs when I
expect." The skill (~/.claude/skills/humanizer, blader/humanizer) does the rewriting; this script makes sure it runs.

Its machine-checkable tells live in humanizer-tells.json beside this file, the one source every gate reads.

Modes:
    prompt   UserPromptSubmit: a prompt about writing gets a short reminder to run the skill before anything ships.
    pre      PreToolUse: denies an outgoing text that still has AI tells. Covers Artifact publishes, Claude Docs
             writes, Notion page and comment writes, and git commit / gh pr / gh issue / gh release text in Bash.
    check    python3 humanizer-gate.py check FILE|-   prints the tells; exit 1 when the text would be denied.
Library: copy-guard.py imports scan() so page edits get the same tells.

Strong tells deny on one sighting. Weak tells deny only when weakLimit distinct ones pile up. Code, inline code, URLs
and quotations are exempt. A page or doc about AI tells opts out with "humanizer: off" (or
<meta name="humanizer" content="off">).
"""
import json
import os
import re
import sys
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
TELLS = os.path.join(HERE, 'humanizer-tells.json')
SKILL = '~/.agents/skills/humanizer/SKILL.md'
OFF = re.compile(r'humanizer["\']?\s*(?::|content=["\'])\s*off', re.I)
SKIP_TAGS = {'code', 'pre', 'script', 'style', 'svg', 'template', 'noscript', 'textarea', 'kbd', 'samp', 'q', 'blockquote'}
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}


def load():
    try:
        d = json.load(open(TELLS, encoding='utf-8'))
    except (OSError, ValueError):
        return [], 99
    tells = []
    for t in d.get('tells', []):
        rx = []
        for p in t.get('patterns', []):
            try:
                rx.append(re.compile(p, re.I | re.M))
            except re.error:
                pass
        tells.append({**t, 'rx': rx})
    return tells, d.get('weakLimit', 4)


class Visible(HTMLParser):
    """Text a reader sees on an HTML page, minus code and quotations. <title> counts."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.chunks, self.off = [], [], False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'meta' and (a.get('name') or '').lower() == 'humanizer' and (a.get('content') or '').lower() == 'off':
            self.off = True
        if tag in VOID:
            return
        self.stack.append((tag, tag in SKIP_TAGS or (tag == 'head') or 'data-humanizer-ok' in a))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        inside_title = self.stack and self.stack[-1][0] == 'title'
        if (inside_title or not any(x for _, x in self.stack)) and data.strip():
            self.chunks.append(' '.join(data.split()))


def html_text(src):
    p = Visible()
    p.feed(src)
    return None if p.off else '\n'.join(p.chunks)


def prose(text):
    """Strip what the skill leaves alone: code, inline code, URLs, comments, quotations, placeholder dash cells."""
    text = re.sub(r'```.*?```|~~~.*?~~~', ' ', text, flags=re.S)
    text = re.sub(r'<!--.*?-->|<\?claude.*?\?>', ' ', text, flags=re.S)
    text = re.sub(r'`[^`\n]*`', ' ', text)
    text = re.sub(r'\[[^\]\n]{0,200}\](\([^)]*\))?', ' ', text)  # link labels and [source] titles are names, not prose
    text = re.sub(r'(?<![*\w])\*[^*\n]{1,200}\*(?![*\w])', ' ', text)  # *Italic titles*
    text = re.sub(r'https?://\S+|www\.\S+', ' ', text)
    text = re.sub(r'"[^"\n]{1,300}"|“[^”\n]{1,300}”', ' ', text)
    text = re.sub(r'^\s*>.*$', ' ', text, flags=re.M)  # markdown blockquotes are quotations
    text = re.sub(r'(?<=\|)\s*[—–-]+\s*(?=\|)', ' ', text)
    text = re.sub(r'^\s*[—–]+\s*$', ' ', text, flags=re.M)
    return text


def ctx(text, m):
    s, e = max(0, m.start() - 35), min(len(text), m.end() + 35)
    return '…' + ' '.join(text[s:e].split()) + '…'


def scan(text, is_html=False):
    """Returns (strong, weak, trips): lists of 'H8 name: …context…' and whether a gate should stop on it."""
    if not text or OFF.search(text):
        return [], [], False
    if is_html:
        text = html_text(text)
        if text is None:
            return [], [], False
    text = prose(text)
    tells, weak_limit = load()
    strong, weak, weak_words = [], [], set()
    for t in tells:
        for rx in t['rx']:
            for m in rx.finditer(text):
                hit = f"{t['id']} {t['name']} \"{m.group(0).strip()}\": {ctx(text, m)}"
                if t.get('strength') == 'strong':
                    strong.append(hit)
                else:
                    weak.append(hit)
                    weak_words.add(m.group(0).strip().lower())
                break
    strong = list(dict.fromkeys(strong))
    return strong, weak, bool(strong) or len(weak_words) >= weak_limit


def message(strong, weak, what):
    shown = (strong + weak)[:14]
    more = f'\n  … and {len(strong) + len(weak) - 14} more' if len(strong) + len(weak) > 14 else ''
    return (
        f'Humanizer gate: {what} still has AI tells (humanizer skill, {SKILL}):\n  - ' + '\n  - '.join(shown) + more +
        '\nLoad the humanizer skill and run its process on the text (embedded mode: return only the final text). Fix every '
        'hit, then look again for §1 contrasts, §2 closers, §6 triads, §8 dashes and §19 bold labels, and resend. '
        'A quotation, or a passage that discusses a phrase rather than uses it, can stay: put it in quotes or code. A page '
        'or doc that is about AI tells opts out with "humanizer: off".'
    )


# ---- what each outgoing tool sends ----

def strings_in(obj, out):
    if isinstance(obj, str):
        if len(obj.split()) >= 4 and not re.fullmatch(r'[\w./:#?=&%-]+', obj):
            out.append(obj)
    elif isinstance(obj, dict):
        for k, v in obj.items():
            if k not in ('id', 'url', 'parent', 'container', 'ref', 'opId', 'icon', 'cover'):
                strings_in(v, out)
    elif isinstance(obj, list):
        for v in obj:
            strings_in(v, out)
    return out


def from_bash(cmd):
    if not re.search(r'\bgit\s+commit\b|\bgh\s+(pr|issue)\s+(create|edit|comment|review)\b|\bgh\s+release\s+(create|edit)\b', cmd):
        return ''
    if re.search(r'\bgit\s+commit\b', cmd) and re.search(r'--no-edit\b', cmd) and not re.search(r'\s-m\b|--message', cmd):
        return ''
    parts = []
    flag = r'(?:-m|--message|-t|--title|-b|--body|-n|--notes|-F|--file|--body-file|--notes-file)'
    for m in re.finditer(r'<<-?\s*[\'"]?(\w+)[\'"]?\n(.*?)\n\s*\1\b', cmd, re.S):
        # only a heredoc that feeds the message: -m "$(cat <<EOF …)" or -F - <<EOF; a heredoc writing a file is not one
        if re.search(flag + r'[ =]("?\$\(cat\s*|-\s+)$', cmd[max(0, m.start() - 60):m.start()]):
            parts.append(m.group(2))
    for m in re.finditer(r'(?:^|\s)(?:-m|--message|-t|--title|-b|--body|-n|--notes)[ =](?:"((?:[^"\\]|\\.)*)"|\'([^\']*)\')', cmd, re.S):
        v = m.group(1) or m.group(2) or ''
        if '<<' not in v:
            parts.append(v.replace('\\"', '"'))
    for m in re.finditer(r'(?:-F|--file|--body-file|--notes-file)[ =](\S+)', cmd):
        p = os.path.expanduser(m.group(1).strip('\'"'))
        if os.path.isfile(p):
            parts.append(open(p, errors='replace').read())
    text = '\n'.join(parts)
    return '\n'.join(l for l in text.splitlines() if not re.match(r'\s*(Co-Authored-By:|🤖 Generated with)', l))


def outgoing(ev):
    """(text, is_html, label) for a tool call that sends prose somewhere, else None."""
    name = ev.get('tool_name') or ''
    ti = ev.get('tool_input') or {}
    if name == 'Artifact':
        if (ti.get('action') or 'publish') != 'publish' or ti.get('asset'):
            return None
        path = ti.get('file_path') or ''
        text = ti.get('description') or ''
        if path.endswith(('.html', '.htm', '.md')) and os.path.isfile(path):
            body = open(path, errors='replace').read()
            if path.endswith('.md'):
                return (text + '\n' + body, False, f'the artifact {os.path.basename(path)}')
            if OFF.search(body):
                return None
            visible = html_text(body)
            return (None if visible is None else (text + '\n' + visible, False, f'the artifact {os.path.basename(path)}'))
        return (text, False, 'the artifact description') if text else None
    if name == 'Bash':
        cmd = ti.get('command') or ''
        if isinstance(cmd, list):  # Codex can send the command as an argv list
            cmd = ' '.join(str(c) for c in cmd)
        text = from_bash(cmd)
        return (text, False, 'this commit / GitHub text') if text.strip() else None
    if re.search(r'__notion-(create-pages|update-page|create-comment|update-comment|create-suggested-edit)$', name):
        return ('\n\n'.join(strings_in(ti, [])), False, 'this Notion write')
    if re.search(r'^mcp__[0-9a-f-]{36}__(batch|update)$', name) and ('container' in ti or 'payload' in ti):
        return ('\n\n'.join(strings_in(ti.get('batch') or ti.get('payload') or ti.get('container') or {}, [])), False, 'this doc write')
    return None


def pre(ev):
    got = outgoing(ev)
    if not got or not got[0]:
        return
    text, is_html, label = got
    strong, weak, trips = scan(text, is_html)
    if trips:
        print(json.dumps({'hookSpecificOutput': {
            'hookEventName': 'PreToolUse',
            'permissionDecision': 'deny',
            'permissionDecisionReason': message(strong, weak, label),
        }}))


WRITING = re.compile(
    r'\b(write|writing|wrote|draft\w*|rewrite|redraft|copy|copywriting|email|e-mail|letter|post|blog|article|essay|brief|'
    r'memo|readme|bio|cv|cover letter|pitch|announcement|newsletter|linkedin|tweet|caption|headline|tagline|story|stories|'
    r'reply|respond|proposal|report|write-?up|doc|document|notes?|commit message|pr description|outreach|humani[sz]e\w*)\b', re.I)
NUDGE = ('Writing: before any prose reaches Zayd or anyone else (page copy, emails, docs, briefs, posts, Notion, commits, '
         'PR text), load the humanizer skill and run its four steps on it; embedded mode returns only the final text. '
         'Hooks deny publishes, doc and Notion writes, commits and PRs that still carry strong tells (dashes, not-X-but-Y, '
         'staged openers, closers, stock AI words, chatbot residue).')


def prompt(ev):
    if WRITING.search(ev.get('prompt') or ''):
        print(json.dumps({'hookSpecificOutput': {'hookEventName': 'UserPromptSubmit', 'additionalContext': NUDGE}}))


def check(arg):
    src = sys.stdin.read() if arg == '-' else open(arg, errors='replace').read()
    strong, weak, trips = scan(src, arg.endswith(('.html', '.htm')))
    if trips:
        print(message(strong, weak, arg))
        return 1
    print(f'humanizer: ok ({len(strong)} strong, {len(weak)} weak)' + ''.join(f'\n  - {w}' for w in weak))
    return 0


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'pre'
    if mode == 'check':
        return check(sys.argv[2] if len(sys.argv) > 2 else '-')
    try:
        ev = json.load(sys.stdin)
    except Exception:
        return 0
    try:
        (prompt if mode == 'prompt' else pre)(ev)
    except Exception as e:  # a broken gate must never wedge a session
        print(f'humanizer-gate error: {e}', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
