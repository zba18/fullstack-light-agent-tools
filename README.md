# Fullstack light agent tools

Coding agents fail in a few predictable ways. These are the pitfalls I see most often and the countermeasure I run against each, in three groups.

## 1. Clear, concise output

Agent output tends to read unnaturally: contrasts that argue with a claim nobody made ("it's not X, it's Y"), one-line closers that repeat the point, inflated stock words like "crucial" and "robust", and so on. I remove these from anything another person will read.

- `humanizer` is the skill that does the rewriting. It is a copy of the public `blader/humanizer` skill.
- `humanizer-gate.py` makes sure it runs. It reminds the agent when a prompt is about writing, and it blocks a commit or PR whose text still has those patterns. It also checks any file on request: `python3 hooks/humanizer-gate.py check docs/pr.md`.

## 2. Prompting blind spots

An agent builds what the prompt says, and a prompt leaves things out. These three checks sit where that goes wrong: before the work starts, when work is handed to a sub-agent, and when the agent says it is done.

- `deepen` runs before a large, open-ended ask. It makes the agent name the source material, the method and an outside check before it starts. `deepen-gate.py` flags the prompts that need it.
- `concept-check.py` blocks a long brief to a sub-agent unless it says what I approved, so a big build never starts from an idea I have not seen.
- `review-agent-pr` reviews a change against what was asked, before it becomes a PR. A fresh agent that did not write the change reads the ask, runs a script that takes readings from the diff (scope, size, whether the tests notice broken code, what else uses the changed code), and judges the change against ten failure modes. It ends in READY, FIX FIRST or SEND BACK.

## 3. Visual checks

Agents are still poor judges of how a page looks, and checking by eye costs me the most time. So I give the agent three rules and two ways to test them.

- `design-sense` holds the rules: the first screen gives one clear impression, every element has a job, and the page has one high point and a deliberate ending.
- `first-impression`, `cognitive-load` and `peak-end` each work through one rule.
- `design-sense/tools/load-budget.ts` measures a page's first screen in a real browser: words, buttons, fonts, colours, text contrast, layout jumps. Each number passes, warns or fails against a budget.
- The blind test shows screenshots to a fresh agent that has never seen the brief and asks what the page is, how it feels and what looks broken.
- `design-nudge.py` puts the three rules into the prompt whenever I ask for page work.

Impeccable does the building and installs from its own source.

## Install

```bash
git clone https://github.com/zba18/fullstack-light-agent-tools.git
```

```bash
./fullstack-light-agent-tools/install.sh
```

The script copies the skills and hooks into place, keeps anything you already have, and prints the few steps left to do by hand. It needs `python3` and `node`.
