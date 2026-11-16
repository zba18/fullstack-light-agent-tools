---
name: design-sense
description: "House taste for anything a visitor judges at a glance: landing pages, corporate and brand sites, portfolios, campaign pages, a product's marketing front door. Three laws, each with a gate that can fail: the first impression is everything (one curated, on-brand feeling), cognitive load is the enemy (every element pays rent or goes), and peak-end (design the peak, the end, and every micro-interaction). Use before and during any redesign, revamp, hero, homepage or page-level visual work, and whenever a page feels busy, generic, flat or forgettable. Sits on top of Impeccable, which does the building. Product UI (apps, dashboards, flows) goes to design-studio instead."
compatibility: "The load-budget gate needs bun and Playwright's Chromium (tools/package.json pins playwright-core 1.63.0). The blind test needs a subagent that can read images."
metadata:
  version: "1.0.0"
  related: "first-impression, cognitive-load, peak-end, impeccable"
---

# Design sense

A visitor decides how they feel about a page before they read it, judges it by how little it asks of them, and remembers it by its best moment and its last one. Design for those three facts, in that order, and prove each with a gate that someone other than the designer runs.

## The three laws

| Law | What it means | Skill | Gate |
|---|---|---|---|
| **1. First impression is everything** | The first viewport is judged in about 50 ms, and the verdict sticks. Curate it around one experience that is on brand and evokes one named feeling. | `first-impression` | The blind test: a fresh agent, shown only the screenshot, names the category, the visitor and a feeling from the brief. |
| **2. Cognitive load is the enemy** | Working memory holds about four things. Every element on screen spends some of it. Sparse, curated, architected: cut anything that doesn't earn its place. | `cognitive-load` | `tools/load-budget.ts`: no FAIL, and every element left has a job in the ledger. |
| **3. Peak-end** | People remember the peak and the end, not the average or the length. Design one peak, design the end, allow no bad spike, and make every micro-interaction feel good. | `peak-end` | Every interaction is in the spec table with its feedback and reduced-motion fallback, and the blind test names the peak you designed. |

Why these hold, with the numbers: `references/evidence.md`.

## Run order

```
ARRIVAL BRIEF ──► CUT ──► PEAK & END ──► BUILD ──► MEASURE ──► BLIND TEST ──► SHIP
first-impression  cognitive-load  peak-end  impeccable  load-budget  fresh agent
      ▲                                                                   │
      └───────────── a fail sends you back to the law it broke ───────────┘
```

1. **Arrival brief** (`first-impression`): the feeling, the anti-feeling, the visitor and their 5-second question, the one focal idea. No pixels before this exists.
2. **Cut** (`cognitive-load`): list every element the page would have, give each a job, and delete the ones with no job. Do it on the list before you draw anything.
3. **Peak and end** (`peak-end`): draw the emotion curve, name the peak and the end, and spec every interaction.
4. **Build** with Impeccable in Persuade or Experience mode, pinning the arrival brief as the brief. Its persuade rules are in `reference/mode-persuade.md` inside the Impeccable skill.
5. **Measure**: `bun $DS/tools/load-budget.ts <url> --out <dir>` measures desktop and phone widths. `$DS` is this skill's folder (`~/.agents/skills/design-sense` after the kit install): `DS=$(find ~/.agents ~/.claude / -path /proc -prune -o -type d -path '*/design-sense/tools' -print -quit 2>/dev/null)/..`. If `playwright-core` isn't found, run `npm install` in `$DS/tools` once. A cloud environment's setup script installs it ahead of time.
6. **Blind test**: `tools/blind-setup.ts` hides the names, then brief a fresh subagent from `assets/brief-blind-test.md`. It never sees the brief, the code or your notes.
7. **Ship** only when all three gates pass. Report each gate's result, not your opinion of the page.

All three skills write into one file per surface, `docs/design/<surface>.md`: the arrival brief, the element ledger and the peak-end map, in that order. Nothing is restated anywhere else.

## The maker never judges

The agent that designed or built the page doesn't run the blind test, and nobody shows the tester the brief. Your own look is still required (open the full-size screenshots and ask "where does my eye land?"), but it's a floor, not the gate.

## Where the work goes

| Symptom | Do |
|---|---|
| New page or full redesign | The run order above, building with Impeccable's new-work flow |
| Busy, cluttered, too much to read | `cognitive-load`, then `impeccable distill` |
| Safe, generic, forgettable | `first-impression` (is the feeling named?), then `impeccable bolder` or `overdrive` |
| Flat, no moment anyone would mention | `peak-end`, then `impeccable delight` |
| Motion needed or motion feels cheap | `peak-end`'s spec table, then `impeccable animate` |
| Loud, overstimulating | `impeccable quieter`, then re-run load-budget |
| Before shipping | `impeccable polish` and `impeccable audit` (contrast, accessibility, performance), then the gates |
| App screens, dashboards, flows | Not this skill: `design-studio` |

## Bans (each one breaks a law)
- Two ideas competing in the first viewport (law 1).
- Text that explains the interface ("scroll to explore", "click below to…"), captions that repeat what an image shows, and eyebrows above headlines that add nothing (law 2).
- More than one filled, high-contrast action in a viewport (law 2).
- A page that ends on a generic footer with no designed last moment (law 3).
- Motion with no job: it plays for its own sake, delays the content, or can't be turned off (law 3).
- Text over imagery without a measured contrast check (laws 1 and 3: an unreadable headline is the worst possible first impression).

## Pitfalls (add what breaks, dated)
- 2026-10-25: written. 2026-10-26: calibrated on five live pages (`references/evidence.md` § Calibration). Neither gate is enough alone: the script missed typos, template filler and an image wordmark, and the blind test needs the script's numbers to rank close pages.
- 2026-10-26: on a phone the page can be wider than the screen, so Chrome zooms out and screenshot pixels stop matching layout coordinates. load-budget scales for that, and fails any sideways overflow.
