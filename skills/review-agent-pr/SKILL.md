---
name: review-agent-pr
description: Reviews a change that an AI agent wrote against what was asked, before it becomes a PR. A script takes readings from the diff (scope, size, mutation score, outside callers, the ask's done-when checks, the agent's claims), then the reviewer judges the change against ten failure modes, each with evidence, and ends in READY, FIX FIRST or SEND BACK. Use when an agent says a change is done, before opening a PR, or when the user asks to review an agent's PR.
argument-hint: "[spec path] [agent summary path] [base branch]"
---

# Review an agent's PR

## Goal

Show that a person is steering the agent. That takes three things: an ask clear enough to check, output checked against it with evidence that could have come out the other way, and the remaining unknowns said out loud.

## Run

A fresh agent or session runs this, never the one that wrote the change.

1. Take the readings:

```bash
node <this skill's folder>/preflight.mjs --spec <the ask> --summary <the agent's done message>
```

2. Judge the change against each failure mode below. Use the readings as leads and confirm by reading or running the code. Give every mode one line: `pass`, `FAIL` or `n/a`, with the evidence.
3. Print the verdict.

## Failure modes

| # | Failure mode | The judge's question | Reading to start from |
|---|---|---|---|
| 1 | No ask | Is there a goal, done-when checks that can fail, a file list and an out-of-scope line? | `ask:` line |
| 2 | Wrong thing built | Does each done-when check hold when you exercise it yourself? Does the change serve the goal, beyond the letter of the checks? | `DONE-WHEN` list |
| 3 | Claims beyond the change | Is each sentence of the agent's done message true of the diff? | `CLAIMS` list |
| 4 | Faked or unfinished work | Any stub, hardcoded answer, code that behaves differently under test, loosened or skipped test? | flags under `did it` |
| 5 | Tests that cannot fail | Would the tests notice if the new logic were wrong? Do they reach the behaviour through the path a user or caller takes? | `MUTATION` score and survivors |
| 6 | Overreach | Does every changed file serve the ask? | change map, flags under `only it` |
| 7 | Overproduction | Who uses each new function, option, file and branch today? | size, unused exports, comment share |
| 8 | Collateral damage | Does existing behaviour still hold for the callers of everything this change touched, with the data that already exists? | `REACH` list |
| 9 | Poor fit | Are the repo's rules followed, do dependencies point one way, was an existing helper reused, do errors surface, is outside text treated as data on its way to SQL, HTML or a model prompt? | flags under `fits` |
| 10 | Proof by the same hand | Is the evidence stronger than the author's own tests? For agent behaviour: is the scorer right on known answers, does the gain exceed the gap between two runs of unchanged code, did it come through the thing that was built, and at what cost (`evalcheck.mjs`)? For UI: was it used for real? | `PROOF` line |

For modes 2, 5 and 8, run something. Call the new route or function in-process, call it twice, call it with data that existed before the change. Reading alone misses these.

## What blocks

A finding blocks only when a done-when check fails in substance or the change defeats the goal, a rule in the repo's rules file is broken, or you reproduced a defect in behaviour the ask covers. A done-when check fails in substance when the behaviour it protects is missing or wrong. A mismatch in wording or count that leaves the behaviour intact is a note. Hardening ideas, inputs the ask never mentioned, style, and things you could not run here are notes. Notes never change the verdict. Blocking a correct change costs as much trust as passing a broken one.

## Verdict

```
PR REVIEW: READY | FIX FIRST | SEND BACK
modes     1 pass · 2 FAIL · 3 pass · ...
readings  <the script's READINGS line>
fix       <numbered, file:line, with the command and output that shows it>
cut       <numbered, file:line>
unproven  <done-when checks or claims with no evidence>
notes     <non-blocking, three at most>
you       <what the person checks personally, including what this review could not run>
```

READY means `fix` and `cut` are empty and no done-when check is unproven. SEND BACK means mode 1 or 2 failed. When sending work back, hand the agent the failing command and its output. After two failed attempts at the same fix, rewrite the ask.
