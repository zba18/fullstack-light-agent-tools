# Blind test brief

The gate for law 1, and the outside check for law 3. Brief a **fresh subagent** that has never seen the page's brief, code, notes or this conversation. It sees screenshots and nothing else.

## Setup (the orchestrator does this)
1. Run `load-budget.ts` on the page(s). It saves `<label>.desktop.fold.png` (the first viewport only), `<label>.desktop.full.png` and `<label>.phone.full.png`.
2. `bun $DS/tools/blind-setup.ts <load-budget out> <run>/blind` copies them to `blind/site-a/{fold,full,phone}.png` in shuffled order, with names that give nothing away, and writes the key to `<run>/blind-key.json`, outside the folder testers see.
3. One agent per site, run in parallel.
4. Paste the prompt below with its paths filled in. Add nothing else. Never paste the arrival brief.
5. If the agent spawner needs one, add the line `Concept check: n/a, blind review of screenshots`.

## Prompt (paste as is)

```
You are a first-time visitor. You don't know whose page this is or why you are seeing it. Answer from the pictures only. Open only the three image files named below: don't list folders, search, open URLs or guess from file names.

PART 1 · THE FIRST GLANCE
Open only <dir>/fold.png. Look at it the way you'd glance at a page that just loaded, then answer without looking again:
1. In one sentence: what is this, and who is it for?
2. Three words for how it makes you feel.
3. Where did your eye land first, second and third?
4. Appeal, 1 to 7 (1 = I'd leave, 7 = I want to see more). One line why.
5. Trust, 1 to 7 (would you hand this organisation something that matters?). One line why.

PART 2 · THE WHOLE PAGE
Now open <dir>/full.png and <dir>/phone.png.
6. The one moment you'd mention to a friend afterwards. "Nothing" is a valid answer.
7. How the page ends: what is the last thing you see, and how does it leave you?
8. Up to three things you'd remove because they add nothing.
9. Anything that looks broken, unfinished or wrong: unreadable text, typos, placeholder or template content, things that don't belong to this organisation, layout faults on the phone. Quote what you see.
10. Is anything hard to read? Say where.

Answer in that numbered format. Be blunt; a polite answer is a useless one.
```

## Scoring (the orchestrator, against the arrival brief)

| Check | Pass |
|---|---|
| Category and visitor (Q1) | Names the brief's category and visitor in substance |
| Feeling (Q2) | At least 2 of the 3 words sit in the brief's target-feeling family, and none in the anti-feeling family |
| Focal point (Q3) | The first landing is the brief's one focal idea |
| Appeal and trust (Q4, Q5) | Both ≥ 5 |
| Peak (Q6) | Names the peak the `peak-end` map designed, or something better that you then make deliberate |
| End (Q7) | Describes the designed last moment, not "a footer" |
| Defects (Q9, Q10) | None, or every one fixed before ship |

Q8's removals go straight into the element ledger as candidates to cut.

A fail on Q1–Q3 sends you back to `first-impression`, Q8 or a busy Q3 to `cognitive-load`, and Q6, Q7 or Q9 to `peak-end`. Re-test with a **new** agent each round, since one that has seen the page is no longer blind.

The tester is a proxy for real visitors, not a replacement. Say so when reporting. If real people are available, the same ten questions work as a 5-second test with them.
