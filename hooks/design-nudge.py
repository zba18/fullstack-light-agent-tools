#!/usr/bin/env python3
"""Design nudge (UserPromptSubmit). Zayd, 2026-10-27: memories fail as context grows, so his design laws are injected
at the moment a prompt is about a page, not left to recall. It fires only on design words, adds a few lines, and
never blocks."""
import json, re, sys

WORDS = r'\b(hero|landing|lander|homepage|page|section|design|layout|typograph\w*|spacing|copy|headline|concept|mockup|visual|ui)\b'
NUDGE = """Zayd's design laws (design-sense skill), for this request:
1. First impression: the first screen is one feeling, one focal idea, one action.
2. Cognitive load is the enemy: every element earns its place; no narration, no repetition, plain concrete value.
3. Peak-end: design the peak and the ending; every interaction rewards the visitor.
Order: ground in the reader's own job and fears first, then lock type and spacing (8px grid, at most 5 sizes, 3 weights), then pixels and copy. Show him cheap frames early; his eye decides, not scores."""


def main():
    try:
        ev = json.load(sys.stdin)
    except Exception:
        return
    if re.search(WORDS, ev.get('prompt') or '', re.I):
        print(json.dumps({'hookSpecificOutput': {'hookEventName': 'UserPromptSubmit', 'additionalContext': NUDGE}}))


if __name__ == '__main__':
    main()
