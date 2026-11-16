# Codex kit

These are the checks I run on work a coding agent does for me. Each one comes from a mistake I kept catching by hand, so I wrote it down once and let the agent run it every time. They fall into three groups.

## 1. Writing that sounds like a person

Agents write in a recognisable voice: staged contrasts, one-line closers, dashes everywhere, inflated words. I remove it from anything another person will read.

- `humanizer` is the skill that does the rewriting. It is a copy of the public `blader/humanizer` skill.
- `humanizer-gate.py` makes sure it runs. It reminds the agent when a prompt is about writing, and it blocks a commit or PR whose text still has those patterns. It also checks any file on request: `python3 ~/.codex/hooks/humanizer-gate.py check docs/pr.md`.

## 2. Visual checks

Agents are still poor judges of how a page looks, and checking by eye costs me the most time. So I give the agent three rules and two ways to test them.

- `design-sense` holds the rules: the first screen gives one clear impression, every element has a job, and the page has one high point and a deliberate ending.
- `first-impression`, `cognitive-load` and `peak-end` each work through one rule.
- `design-sense/tools/load-budget.ts` measures a page's first screen in a real browser: words, buttons, fonts, colours, text contrast, layout jumps. Each number passes, warns or fails against a budget.
- The blind test shows screenshots to a fresh agent that has never seen the brief and asks what the page is, how it feels and what looks broken.
- `design-nudge.py` puts the three rules into the prompt whenever I ask for page work.

Impeccable does the building and installs from its own source.

## 3. Engineering blind spots

An agent will say a change is done when it is not, build more than was asked, and write tests that cannot fail. These checks are reminders to look in the places where that happens.

- `check-agent-change` checks a change against what was asked, before it becomes a PR. A fresh agent that did not write the change reads the ask, runs a script that takes readings from the diff (scope, size, whether the tests notice broken code, what else uses the changed code), and judges the change against ten failure modes. It ends in READY, FIX FIRST or SEND BACK.
- `deepen` runs before a large, open-ended ask. It makes the agent name the source material, the method and an outside check before it starts. `deepen-gate.py` flags the prompts that need it.
- `concept-check.py` blocks a long brief to a sub-agent unless it says what I approved, so a big build never starts from an idea I have not seen.

## Install

```bash
git clone <this repo> codex-kit
```

```bash
./codex-kit/install.sh
```

Then open Codex, type `/hooks` and approve the five hooks. Codex skips a hook until you approve it.

The script copies the skills to `~/.agents/skills` and the hooks to `~/.codex`. It needs `python3` for the hooks and `node` for the `check-agent-change` scripts, and it keeps any skill or `config.toml` you already have. `--force` replaces the skills.

Two extras install separately:

```bash
npx impeccable install --providers=codex --scope=global
```

```bash
cd ~/.agents/skills/design-sense/tools && bun install
```

`config.toml` runs Codex on OpenRouter and is installed only when you have no config. It reads the key from the macOS Keychain item `openrouter-codex`.

## Tested

On Codex 0.169 with DeepSeek flash through OpenRouter:

- Codex found all seven skills.
- The three prompt hooks added their context.
- The humanizer gate blocked a commit with a "not just X, but Y" message.

Not tested: `concept-check.py` inside Codex, the Codex panel in VS Code, Impeccable's Codex installer, and the `design-sense` measuring tools under Codex.
