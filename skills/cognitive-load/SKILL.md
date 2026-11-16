---
name: cognitive-load
description: "Law 2 of design-sense: cognitive load is the enemy, and every element on screen spends the visitor's attention. Runs a cut-throat element ledger (each element's job, and what breaks if it goes), chunks what's left into about four groups per viewport, keeps one loud thing per viewport, and gates the page with a measured load budget (words, interactive elements, filled actions, fonts, type sizes, colours, images and text contrast per viewport). Use when a page or section feels busy, wordy, cluttered or hard to scan, before building any page, and before shipping."
compatibility: "The gate runs design-sense's tools/load-budget.ts (bun + Playwright Chromium)."
metadata:
  version: "1.0.0"
  part-of: "design-sense"
---

# Cognitive load

Working memory holds about four things (Cowan 2001), and appeal drops as visual complexity rises (Reinecke 2013; see `design-sense/references/evidence.md`, law 2). Design can't make the subject simpler, but it can remove almost everything that makes it harder. Every element pays rent or goes.

## 1. The element ledger (before you draw, and again before you ship)

List every element the page has or would have, viewport by viewport, in `docs/design/<surface>.md` under the arrival brief:

| Element | Its job (which visitor need or brief line it serves) | If removed, what breaks? | Verdict |
|---|---|---|---|
| Hero headline | Answers QUESTION | The visitor doesn't know what this is | keep |
| "Welcome to our website" eyebrow | — | Nothing | **cut** |
| Three stat counters | PROOF | Weak: one strong fact proves more | **merge** into one |

Rules:
- **No job, or nothing breaks → cut.** "It looks nice", "it fills the space" and "the old site had it" aren't jobs.
- **Two elements doing one job → merge.** Keep the stronger, or combine them into one.
- **Has a job but not here → move it.** Depth lives one click away: full bios, details, history. The surface carries the decision, not the archive.
- **Has a job but competes → quieten it.** Smaller, lighter, lower contrast, further down.
- Cut first, then merge, then move, then quieten. Never decorate to fill the space a cut leaves. That space is the design.
- **Cut to the floor, not through it.** The first viewport must still answer the arrival brief's QUESTION. Calibration: a page with 23 words and 3 links passed every load budget, and a cold visitor still couldn't say what the firm does.

## 2. Architecture

- **About four groups per viewport.** Group by proximity and alignment so related things read as one chunk. A section carries one message.
- **One loud thing per viewport.** One filled, high-contrast action, or one dominant image. Everything else is visibly secondary.
- **Navigation of five items or fewer**, labelled in the visitor's words, not the org chart's (Hick–Hyman: each extra choice slows the decision).
- **Two type families at most, about four sizes per viewport**, and one accent colour on neutrals. Each extra size or colour is something the eye has to sort.
- **Order is meaning.** The page reads top to bottom as an argument: what this is → why believe it → what to do. If a section can move without anything changing, it probably isn't needed.

## 3. Words

- Headline 8 words or fewer. One supporting line of 25 words or fewer. Paragraphs of 3 sentences or fewer.
- Say each fact once. No captions that repeat the image, no eyebrows that repeat the headline, no closing lines that repeat the page.
- No narration: nothing that explains the interface ("scroll to discover", "click to learn more"). Labels name the thing; they don't describe the action.
- Concrete beats abstract. A number, a name or a place lowers load; "synergies", "solutions" and "excellence" raise it.

## 4. Gate

```bash
DS=$(find ~/.agents ~/.claude / -path /proc -prune -o -type d -path '*/design-sense/tools' -print -quit 2>/dev/null)/..
bun $DS/tools/load-budget.ts <url> [<url> …] --out <dir>
```

It renders each URL at 1440×900 and 390×844 and measures the first viewport (and the whole page for context). It reports words, interactive elements, filled actions, font families, type sizes, colours, images, and the contrast of every text block against the actual pixels behind it, with PASS, WARN or FAIL for each. The thresholds live in one place, `BUDGETS` at the top of the script, and the report prints them.

Pass means: no FAIL at either width, every WARN either fixed or justified in one line in the ledger, and the blind test's Q8 removals each answered (cut, or kept with the reason).

A pass means the page isn't overloaded. It doesn't mean the page is good: that's the other two laws. The script also can't read text baked into images (logos, wordmarks, text in photos) or judge meaning (typos, template leftovers). Check those by eye and with the blind test.

## Hand to Impeccable
`impeccable distill` executes the cut, `impeccable layout` the grouping and rhythm, `impeccable clarify` the words, and `impeccable quieter` when everything is shouting.
