---
name: peak-end
description: "Law 3 of design-sense: people remember a visit by its peak and its end, and a bad moment outweighs a good one. Maps the journey's emotion curve, designs one peak worth retelling and a deliberate last moment, hunts every negative spike first (layout jumps, slow heroes, dead clicks, unreadable text, broken phone layouts), and specs every micro-interaction (trigger, rules, feedback, timing, reduced-motion fallback) so each one feels good. Use when designing scroll journeys, hero moments, animation, hover and focus states, forms, confirmations, page endings and footers, or when a page is correct but forgettable."
compatibility: "Uses design-sense's load-budget tool for layout shift and load timing, and its blind-test brief for the peak and end checks."
metadata:
  version: "1.0.0"
  part-of: "design-sense"
---

# Peak-end

A visit is remembered by its best (or worst) moment and by how it ended, not by its length or its average (Redelmeier & Kahneman 1996; see `design-sense/references/evidence.md`, law 3). So: remove every bad moment, design one peak, design the end, and make each small interaction feel good on the way.

## 1. Draw the emotion curve

List the journey's moments in order and rate the expected feeling from −3 to +3. Write it under the element ledger in `docs/design/<surface>.md`:

```
+3 |                    ★ PEAK
+2 |  ●                 ●              ● END
+1 |     ●     ●                ●
 0 |----------------------------------------
-1 |              ▼ dip: bios wall of text
    arrive  approach  sectors  proof  team  contact
```

- **Fix the dips first.** Anything at −1 or below is a defect. Bad is stronger than good, so a dip can become what people remember.
- **Name the peak:** one moment, the one a visitor would mention to someone else. It usually comes after they've invested a little (scrolled, hovered, opened something), at the point where the page proves its claim.
- **Name the end:** the last thing they experience. On a site that's the closing section and the contact moment. After a form, the confirmation is the end.

## 2. Design the peak

- **Delight is discovery, not decoration.** The visitor does something and gets more than they expected. Undersell on the surface; reward the curious.
- **It grows out of the brand's truth,** the PROOF line in the arrival brief: a real track record revealed, a real place, a real person. A generic flourish (particles, a parallax skyline) is decoration, not a peak.
- **One peak per page.** Several "wow" moments flatten into noise and break law 2.
- **The page works without it.** The peak is a layer on top: it plays itself once on arrival in its section, or rewards an interaction, and degrades to a strong static state.

## 3. Design the end

- The last section is composed, not left over: a closing line in the brand's voice, the one action, and a human touch (a named person, a direct email or phone number).
- It leaves the visitor in the brief's FEELING. The footer is the frame after the end, not the end itself.
- Forms: the confirmation says what happens next, who replies and by when. A blank "Thanks!" wastes the moment that is remembered most.

## 4. Spec every micro-interaction

Every interactive element gets a row (Saffer's trigger, rules, feedback, loops and modes):

| Interaction | Trigger | Rules | Feedback | Timing | Reduced motion |
|---|---|---|---|---|---|
| Primary action | hover · focus · press | — | lift + colour shift; visible focus ring | 120 ms ease-out | colour only |
| Section reveal | enters viewport, once | content readable before it plays | fade + 12 px rise, 3 items max, 60 ms stagger | 400 ms, decelerating | shown at once |
| Contact link | click | opens mail client | — | — | — |

Defaults, unless the brief says otherwise:
- Feedback starts within 100 ms of the trigger (Nielsen's "instant").
- Hover and press: 100–150 ms. Small transitions: 150–250 ms. Entrances: 300–500 ms with a decelerating ease such as `cubic-bezier(0.2, 0, 0, 1)`. Exits run faster than entrances. Nothing in the UI over about 600 ms.
- Animate only `transform` and `opacity`. Never animate layout.
- Every interactive element has a visible keyboard focus state, and everything that looks clickable is.
- No scroll-jacking, no autoplay sound, no motion that can't be paused (WCAG 2.2.2), and `prefers-reduced-motion` honoured everywhere (WCAG 2.3.3).

## 5. Negative-spike hunt (run before ship)

| Spike | Check |
|---|---|
| Layout jump | load-budget's CLS ≤ 0.1 at both widths |
| Slow hero | load-budget's LCP ≤ 2.5 s (local numbers are optimistic; check the deployed URL too) |
| Unreadable text | load-budget contrast: no FAIL |
| Broken phone layout | look at the full phone screenshot at full size |
| Dead clicks, missing states | walk the spec table in the browser: hover, focus with Tab, press |
| Placeholder, filler, typos | blind test Q9 |
| Motion sickness | emulate reduced motion and confirm the page still reads and still ends well |

## 6. Gate

- The spec table has a row for every interactive element, each with feedback and a reduced-motion fallback.
- The negative-spike hunt is clean.
- The blind test (`design-sense/assets/brief-blind-test.md`): Q6 names the peak you designed, Q7 describes the designed end, and Q9 finds nothing.

## Hand to Impeccable
`impeccable delight` for the peak, `impeccable animate` to implement the spec table, `impeccable overdrive` when the peak needs more ambition, and `impeccable harden` for the states (errors, empty, loading).
