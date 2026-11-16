#!/usr/bin/env python3
"""deepen-gate: UserPromptSubmit hook for the `deepen` skill.

A cheap prefilter. It flags prompts that look like complex asks and tells
Claude to run the `deepen` skill; the skill's own skip test makes the final call.

Overrides at the start of a prompt:
  deep:   always flag
  quick:  never flag

Pipe-test:
  echo '{"prompt":"deep: tidy the README"}' | /usr/bin/python3 ~/.claude/skills/deepen/gate.py
"""
import json
import re
import sys

# Verbs and nouns that mark open-ended work rather than a pinpoint edit.
SUBSTANTIVE = re.compile(
    r"\b(build|design|redesign|architect\w*|plan|research|strategy|spec|"
    r"implement|migrat\w+|analy[sz]\w*|audit|launch|scaffold|overhaul|rethink|"
    r"roadmap|proposal|pitch|business plan|pipeline|from scratch|"
    r"turn (this|it|these) into|figure out|come up with|end to end)\b",
    re.I,
)

LONG_ASK = 50      # own words; long asks are complex on their own
SUBSTANTIVE_ASK = 15  # own words, when a substantive verb is present


def own_text(prompt):
    """The user's own words: drop pasted blocks, code fences and URLs."""
    t = re.sub(r"<pasted_content[^>]*>.*?</pasted_content[^>]*>", " ", prompt, flags=re.S)
    t = re.sub(r"```.*?```", " ", t, flags=re.S)
    t = re.sub(r"https?://\S+", " ", t)
    return t


def signals(prompt):
    p = prompt.strip()
    if not p or p[0] in "/<":  # slash commands, system/loop/notification payloads
        return None
    low = p.lower()
    if low.startswith("quick:"):
        return None
    if low.startswith("deep:"):
        return ["forced with deep:"]

    text = own_text(p)
    n = len(text.split())
    hits = sorted({m.group(0).lower() for m in SUBSTANTIVE.finditer(text)})
    asks = text.count("?") + len(re.findall(r"^\s*(?:\d+[.)]|[-*])\s+", text, flags=re.M))

    found = []
    if n >= LONG_ASK:
        found.append(f"{n} words")
    if hits and n >= SUBSTANTIVE_ASK:
        found.append("open-ended: " + ", ".join(hits[:4]))
    if asks >= 3 and n >= 25:
        found.append(f"{asks} separate asks")
    return found or None


def main():
    try:
        prompt = json.load(sys.stdin).get("prompt") or ""
    except Exception:
        return
    found = signals(prompt)
    if not found:
        return
    context = (
        "deepen-gate flagged this prompt as a complex ask (" + "; ".join(found) + "). "
        "Before acting, use the `deepen` skill: read its SKILL.md and follow it. "
        "Its skip test decides: if the ask is already precise, continues work already "
        "deepened in this session, or is a quick fix, skip it silently and just do the task."
    )
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": context,
        }
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass  # never block or break a prompt
    sys.exit(0)
