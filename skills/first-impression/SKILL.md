---
name: first-impression
description: "Law 1 of design-sense: curate the first viewport around one on-brand experience that evokes one named feeling. Writes the arrival brief (visitor, their 5-second question, target feeling and anti-feeling, the one focal idea, category legibility), composes the first viewport and choreographs the arrival, then gates it with a blind 5-second test by a fresh agent. Use when starting a homepage, hero or landing page, when a redesign needs a direction, or when a page feels generic, off-brand or doesn't land."
compatibility: "Reads design-sense's blind-test brief and load-budget tool (the design-sense skill folder, $DS)."
metadata:
  version: "1.0.0"
  part-of: "design-sense"
---

# First impression

The verdict on a page forms in about 50 ms and rarely changes (`design-sense/references/evidence.md`, law 1). So the first viewport isn't a summary of the site. It's one experience, chosen on purpose, that makes the visitor feel one thing.

## 1. Write the arrival brief (before any pixel)

Write it at the top of `docs/design/<surface>.md`:

```
VISITOR      who arrives, from where, in what state of mind
QUESTION     the one thing they need answered in 5 seconds
FEELING      one word, plus what it looks like on this page
ANTI-FEELING one word: the feeling that would lose them (usually the category's cliché)
CATEGORY     what the page must read as at a glance, and 3 peers checked
FOCAL IDEA   the single element that carries the feeling and answers the question
PROOF        what only this organisation can show (a fact, a person, a result, a place)
ACTION       the one thing the visitor should do next
```

How to fill it:
- **Feeling.** Write three candidates from the brand's position and the visitor's fear, then keep one. "Professional" and "modern" aren't feelings; "quietly certain", "welcomed in", "in safe hands" are.
- **Anti-feeling.** Name the cliché you're refusing. For an investment firm it's usually "slick and generic": the stock skyline, the handshake, the glass tower.
- **Category.** Screenshot 3 peers' first viewports (`load-budget.ts <url>` saves them). List the conventions to keep so the page reads as its category, and the one convention to break, which is where the distinctiveness lives. Pages that look like their category win the first impression (Tuch 2012); break one convention, not all of them.
- **Focal idea.** One. Two strong ideas in a first viewport cancel each other out. If you can't choose, the brief isn't finished.
- **Proof.** Real material beats invented material: the partners' actual track record, a real photograph, a real place. A claim with no proof is decoration.

## 2. Compose the first viewport

- One focal element, dominant by size, contrast or isolation. Everything else is visibly quieter.
- A headline of 8 words or fewer. At most one supporting line. One filled action. The navigation. That's all.
- Scale contrast does the work: a large focal element against generous empty space. Whitespace is part of the composition, not leftover room.
- Imagery is real, or specific to the brand. No category clichés. Text over an image must pass load-budget's contrast check (4.5:1, or 3:1 for large text), measured against the pixels behind it.
- The brand is present without shouting: the logo, the colour, the voice in the headline. A wordmark must be legible against its background; load-budget can't measure it because it's an image.
- A consent banner is part of the first impression. Keep it small, out of the focal area, and off the content.

## 3. Choreograph the arrival

- **First paint shows the focal idea.** No loader screen, no blank hero waiting for JavaScript, no font swap that moves the layout (use a fallback font with matching metrics).
- **At most 3 reveal beats, done within about 1.2 s.** Motion reveals the composition in reading order; it never holds back the text people came for.
- **Correct without motion.** The static layout is the design. Motion is a layer on top. With `prefers-reduced-motion`, the final state shows at once.
- **The phone gets its own composition**, not the desktop shrunk. Check the focal idea is still first and still whole at 390 px.

## 4. Gate

1. Your own look: open the desktop and phone fold screenshots at full size. Where does your eye land? Is it the focal idea?
2. `bun $DS/tools/load-budget.ts <url> --out <dir>`, with `DS=$(find ~/.agents ~/.claude / -path /proc -prune -o -type d -path '*/design-sense/tools' -print -quit 2>/dev/null)/..`. The fold section must have no FAIL, including contrast.
3. The blind test, `design-sense/assets/brief-blind-test.md`. Q1–Q5 must pass against this brief.

On a fail, change the brief or the composition. Never change the test.

## Hand to Impeccable
Build with Impeccable in Persuade (or Experience) mode and pin the arrival brief as the brief. `impeccable bolder` if the focal idea isn't dominant enough, `impeccable typeset` for the headline.
