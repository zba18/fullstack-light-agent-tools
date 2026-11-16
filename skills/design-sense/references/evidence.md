# Why the three laws hold

Primary sources only. Each entry gives the finding, then what it means for a page. Budgets in the skills are house numbers built on these findings, not figures from the papers.

## Law 1 · First impression is everything

- **Lindgaard, Fernandes, Dudek & Brown (2006).** "Attention web designers: You have 50 milliseconds to make a good first impression!" *Behaviour & Information Technology* 25(2), 115–126. People rated a page's visual appeal after a 50 ms exposure, and those ratings closely matched their ratings after longer viewing.
  → The feeling is set before a word is read. The first viewport's composition, colour and image carry it; copy only confirms it.
- **Tuch, Presslaber, Stöcklin, Opwis & Bargas-Avila (2012).** "The role of visual complexity and prototypicality regarding first impression of websites." *International Journal of Human-Computer Studies* 70(11), 794–811. At exposures of 17, 50 and 500 ms, pages with low visual complexity and high prototypicality (they look like their category) were judged most appealing. Complexity registered even at 17 ms.
  → Be distinctive in execution but legible as the category. An investment firm's page must read as an investment firm in the first glance. Novelty that hides the category costs more than it earns.
- **Tractinsky, Katz & Ikar (2000).** "What is beautiful is usable." *Interacting with Computers* 13(2), 127–145. Aesthetics judged before use predicted how usable people found a system after using it.
  → The first impression colours every later judgment, including trust in the content.
- **Norman (2004).** *Emotional Design.* Three levels of response: visceral (instant, sensory), behavioural (use), reflective (meaning, self-image).
  → The arrival brief targets the visceral level. The peak and the end target the reflective level: what the visitor tells someone afterwards.

## Law 2 · Cognitive load is the enemy

- **Sweller (1988).** "Cognitive load during problem solving: Effects on learning." *Cognitive Science* 12(2), 257–285. Later work splits load into intrinsic (the subject itself), extraneous (how it is presented) and germane (building understanding).
  → Design can't change the intrinsic load of "what this firm does". It can remove almost all extraneous load: decoration, repetition, competing emphasis, words that explain the layout.
- **Cowan (2001).** "The magical number 4 in short-term memory." *Behavioral and Brain Sciences* 24(1), 87–114. Working memory holds about four chunks, not Miller's seven.
  → About four groups per viewport. Chunk related items so they count as one.
- **Hick (1952), Hyman (1953).** Decision time grows with the logarithm of the number of equally likely choices.
  → Every extra link or button at a decision point slows the decision. One primary action per viewport; secondary actions visibly quieter.
- **Reinecke et al. (2013).** "Predicting users' first impressions of website aesthetics with a quantification of perceived visual complexity and colorfulness." *CHI 2013.* Computed visual complexity and colourfulness explained about half of the variation in appeal ratings after a 500 ms view. Appeal fell as complexity rose, and preferred colourfulness varied by audience.
  → Complexity is measurable, so load-budget measures its proxies: words, elements, type sizes, colours. Colour is a tuning knob for the audience; complexity is a cost for everyone.

## Law 3 · Peak-end

- **Redelmeier & Kahneman (1996).** "Patients' memories of painful medical treatments." *Pain* 66(1), 3–8. Patients' later ratings of a colonoscopy tracked the worst moment and the final moments. The procedure's length barely mattered (duration neglect).
- **Kahneman, Fredrickson, Schreiber & Redelmeier (1993).** "When more pain is preferred to less: Adding a better end." *Psychological Science* 4(6), 401–405. Most people chose to repeat a longer cold-water trial whose last 30 seconds were slightly less cold, over the shorter one.
- **Fredrickson & Kahneman (1993).** "Duration neglect in retrospective evaluations of affective episodes." *Journal of Personality and Social Psychology* 65(1), 45–55.
  → Memory keeps the peak and the end. Design one peak worth retelling and a deliberate last moment. A longer page with a better end beats a shorter page that just stops.
- **Baumeister, Bratslavsky, Finkenauer & Vohs (2001).** "Bad is stronger than good." *Review of General Psychology* 5(4), 323–370.
  → A bad moment outweighs a good one of the same size, and the worst moment can become the peak. Hunt negative spikes first: a layout jump, a slow hero, a dead click, unreadable text, a broken state on phone.
- **Saffer (2013).** *Microinteractions: Designing with Details.* O'Reilly. Every micro-interaction is a trigger, rules, feedback, and loops and modes.
  → The spec table in `peak-end` uses those four parts, so no interaction ships without designed feedback.

## Thresholds the gates use

| Check | Threshold | Source |
|---|---|---|
| Text contrast | 4.5:1, or 3:1 for large text (≥ 24 px, or ≥ 18.66 px bold) | WCAG 2.2 SC 1.4.3 |
| Response feels instant / keeps flow | ≤ 100 ms / ≤ 1 s | Nielsen (1993), *Usability Engineering*, ch. 5 |
| Largest content paint · layout shift · interaction delay | ≤ 2.5 s · ≤ 0.1 · ≤ 200 ms ("good") | Google Core Web Vitals (web.dev) |
| Auto-playing motion over 5 s | Must be pausable | WCAG 2.2 SC 2.2.2 |
| Motion triggered by interaction | Can be turned off (`prefers-reduced-motion`) | WCAG 2.2 SC 2.3.3 |

## Calibration · 2026-10-26

Both gates were run on five live pages. The blind testers were fresh agents with neutral folder names and the order shuffled. They are a proxy for visitors, not real people.

| Page | load-budget FAIL, desktop / phone | Blind appeal · trust (1–7) | What the blind test caught |
|---|---|---|---|
| Sequoia home | 0 / 0 (3 WARN each) | 5 · 6 | Cookie banner covering content; the phone loses the circled "daring"; a card cut off mid-word on the phone |
| Benchmark home | 1 / 1: grey small print 3.6:1 | 3 · 4 | Wordmark near-black on navy; "can't tell what Benchmark does" |
| Mekar baseline (Astro port) | 1 / 0: 13 interactive, because the footer sits in the fold | 4 · 3 | Footer in the fold with the nav repeated; unstyled phone nav; no peak; weak end |
| Mekar live portfolio (WordPress) | 0 / 0 | 3 · 2 | "We're eclipse" template headline; under-construction image; "Copyrigt" |
| Mekar live home (WordPress) | 3 / 1: "lasting relationship" 1.04:1, 4 font families, LCP 6.3 s | 2 · 2 | Invisible second headline line; "significants"; "Copyrigt © 2024"; hero straight into footer |

Result: pass. Every known defect on the live site was caught. Both instruments failed the unreadable headline. Only the blind test caught the typos and template filler, and the script passed the portfolio page clean. The rankings agree: Sequoia is best, the live Mekar home is worst.

What the run taught (now in the skills):
- **The script can't see images of text.** Benchmark's wordmark, near-black on navy, passed the script; the blind test caught it. Logos and text baked into images get checked by eye.
- **The script can't see meaning.** Typos, template leftovers and the wrong company name pass the script. That's why the blind test is a required gate, not an optional one.
- **Cutting has a floor.** Benchmark is nearly perfect on load (23 words, 3 links, 1 font, 2 colours) and still fails the first question: a cold visitor can't tell what it is. The arrival brief's QUESTION is the floor that cutting can't go through.
- **The consent banner is part of the first impression.** On Sequoia it was the third thing the eye landed on, and it covered content.
