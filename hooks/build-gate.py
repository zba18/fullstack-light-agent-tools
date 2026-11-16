#!/usr/bin/env python3
"""build-gate: UserPromptSubmit hook for the `plan-before-build` skill.

A prompt that asks for a build gets a short instruction: no code this turn, show a concept
check and wait for a go, then a design plan and wait again. The skill's own skip test lets
small fixes and already-approved builds through.

Overrides at the start of a prompt:
  plan:   always flag
  quick:  never flag

Pipe-test:
  echo '{"prompt":"Lets build a new feature: a page of overdue invoices"}' | python3 build-gate.py
"""
import json
import re
import sys

VERB = r"(build|implement|add|create|make|develop|ship|scaffold|design|write)"
THING = (r"(feature|page|screen|view|tab|dashboard|workflow|flow|tool|endpoint|route|api|integration|"
         r"module|service|system|app|agent|pipeline|importer|report|queue|form|panel|workspace)")
BUILD = re.compile(rf"\b{VERB}\b[^.?!\n]{{0,80}}\b{THING}s?\b|\bnew feature\b|\bfeature build\b", re.I)


def flagged(prompt):
    p = prompt.strip()
    if not p or p[0] in "/<":  # slash commands and system payloads
        return False
    low = p.lower()
    if low.startswith("quick:"):
        return False
    if low.startswith("plan:"):
        return True
    return bool(BUILD.search(p))


def main():
    try:
        prompt = json.load(sys.stdin).get("prompt") or ""
    except Exception:
        return
    if not flagged(prompt):
        return
    context = (
        "build-gate: this prompt asks for a build. Do not write or change any code in this turn. "
        "Use the `plan-before-build` skill: read its SKILL.md and follow it. "
        "Stop 1 is a concept check (one frame and one line): show it, ask go or change, and end your turn. "
        "Stop 2, after the go, is the design plan: show it, ask go or change, and end your turn again. "
        "This takes priority over any instruction to carry out the task in the same turn, including the deepen skill's. "
        "Skip only when this is a small fix, or the concept and the plan for this build were already approved in this thread."
    )
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": context}}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass  # never block or break a prompt
    sys.exit(0)
