#!/usr/bin/env python3
"""PreToolUse hook for Agent and SendMessage: Zayd's working meta (memory: concept-check-small-first).

A big build brief (a long Agent prompt or SendMessage message) must say how it was cleared with him:
a line starting "Concept check:", naming what he approved, or "Concept check: n/a, <why>" for work
that isn't a build (research, review, fact-check, coordination). Short briefs pass untouched.
"""
import json
import re
import sys

LIMIT = 1800

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

inp = data.get("tool_input") or {}
text = inp.get("prompt") or inp.get("message") or ""
if not isinstance(text, str) or len(text) <= LIMIT:
    sys.exit(0)
if re.search(r"^\s*concept check:", text, re.I | re.M):
    sys.exit(0)

reason = (
    "Big brief without a concept check. Zayd's meta: ship small fixes first, separately and fast, as their "
    "own publish; before a big build (3D or render work, a new visual system, a redesign), show him a concept "
    "check (one frame and one line) and get his go. If he approved the concept, add a line "
    "'Concept check: <what he approved>'. If this is not a build (research, review, fact-check, coordination), "
    "add 'Concept check: n/a, <why>'. Then resend."
)
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": reason,
    }
}))
