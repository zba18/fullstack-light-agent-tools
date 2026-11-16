---
name: deepen
description: Make a complex ask deeper, not bigger, before doing it. Answer four questions about the ask (what a top professional in the field would do that the ask leaves out; the rawest source material they would start from; the specific methods and tools they would use; what outside evidence, from neither Claude nor the user, would show the result is right), rewrite the ask to demand exactly that, then do the rewritten ask. Use when the deepen-gate hook flags a prompt, when the user types /deepen, or when a substantial open-ended ask (build, design, research, plan, strategy, write-up) as stated would produce a generic result.
argument-hint: "[ask to deepen; defaults to the latest message] [rewrite-only]"
---

# Deepen

The principle: "a deeper version of this task, not a bigger one." The deliverable
stays the same. What changes is the rigour behind it: better inputs, named methods,
and a check that does not depend on the agent's or the user's opinion.

## 1. Skip test (run it first, silently)

Skip the skill and just do the task when any of these hold:
- The ask already names its inputs, its method and how it will be checked.
- It continues work that was already deepened in this session (a refinement, "go", "next").
- It is a pinpoint fix, a lookup, or a question with one right answer.
- The user wrote `quick:`.

If you skip, say nothing about the skill.

## 2. Ground before answering

Spend a few tool calls looking at what exists so the answers are specific: the repo,
its spec and AGENTS.md, the user's artifacts and docs. A generic answer
("write tests", "do research", "ask an expert") fails this skill.

## 3. The four questions

Answer each in one to three lines, for this ask only.

| # | Question | A good answer names |
|---|---|---|
| 1 | What would a top professional in this field do here that the ask leaves out? | The role (e.g. "a staff backend engineer", "an M&A due-diligence analyst") and the hard part they would not skip. Depth only: if it makes the deliverable bigger, it goes to out of scope. |
| 2 | What is the rawest material they would start from, instead of what is already digested? | The primary source and where it is: the schema and real rows, not the README; the statute, not a blog summary; user transcripts, not personas; the competitor's product, not reviews. A path, URL, table or person. |
| 3 | Which specific methods and tools would they use? | Named techniques (a failure-mode table, property-based tests, a DCF with a sensitivity table, a contrast audit) and the tools available in this session or repo. |
| 4 | What, other than Claude or the user, would show the result is right? | Something that can be run or consulted: a test suite against a real DB, a live URL serving a round-trip write, a type-checker, a benchmark number, a reference implementation, a clause in a standard, a reconciliation against source totals. If none exists, say so and name the closest proxy. |

## 4. Rewrite the ask

One block, in the user's voice:

```
<the same deliverable>
Start from: <raw material, with locations>
Use: <methods and tools>
Done when: <the outside check passes>
Out of scope: <anything bigger the professional would also do>
```

## 5. Show it, then do it

- Show the four answers and the rewritten ask in about 15 lines. No preamble.
- Then carry out the rewritten ask in the same turn.
- Stop and ask once (one question, recommended option first) only when the
  deepening surfaced a call that belongs to the user: money, scope, access you lack,
  or an action that is hard to undo.
- With `rewrite-only`, or when the user asked only for the prompt, stop after step 4.
- When reporting, state whether the outside check ran and what it returned. Without
  it, the work is not done.

## Worked example

Ask: "Add CSV export to the deals list."

1. **Professional:** a senior web engineer guards against CSV formula injection
   (cells starting with `=`, `+`, `-`, `@`), streams large exports instead of
   building them in memory, and writes a UTF-8 BOM so Excel shows Malay and Chinese
   names correctly.
2. **Raw material:** the `deals` table in `src/db/schema.ts` and the real row count
   in the dev DB, not the column list in the UI.
3. **Methods and tools:** OWASP CSV-injection escaping; a streamed `Response` from
   the API route; a `bun:test` round-trip that re-parses the file.
4. **Outside check:** the test exports 10,000 seeded rows, re-parses them, and they
   match the DB; a cell holding `=1+1` comes back as text; the file opens in Numbers
   with names intact.

Rewritten: "Add CSV export to the deals list. Start from the `deals` schema and a
seeded 10k-row dev DB. Use OWASP formula escaping, a streamed response and a UTF-8
BOM. Done when the round-trip test passes against the real DB and `=1+1` stays
text. Out of scope: XLSX, scheduled exports, column pickers."

## Hook

`deepen-gate.py` is a UserPromptSubmit hook, registered in
`~/.codex/hooks.json` by the kit's install script. It flags prompts with 50+ words of the user's own text,
15+ words with an open-ended verb (build, design, plan, research, turn this into…),
or 3+ separate asks. Pasted blocks, code fences and URLs don't count toward length.
Prefix a prompt with `deep:` to force the skill, or `quick:` to skip it. Tune the
word list and thresholds at the top of `deepen-gate.py`.
