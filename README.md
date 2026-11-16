# Codex kit

My skills and hooks from Claude Code, ported to Codex.

## Install

```bash
git clone <this repo> codex-kit
```

```bash
./codex-kit/install.sh
```

Then open Codex, type `/hooks` and approve the five hooks. Codex skips a hook until you approve it, and asks again whenever its command changes.

The script needs `python3` for the hooks and `node` for the `pre-pr` scripts. It keeps any skill or `config.toml` you already have. `--force` replaces the skills.

## What it installs

| What | Where it goes | What it does |
|---|---|---|
| `pre-pr` skill | `~/.agents/skills/pre-pr` | Reviews a change an agent wrote before it becomes a PR. Type `$pre-pr`. |
| `deepen` skill | `~/.agents/skills/deepen` | Makes a complex ask deeper before doing it. |
| `humanizer` skill | `~/.agents/skills/humanizer` | Rewrites text that sounds like AI. A copy of `blader/humanizer` (MIT). |
| `design-sense` skill | `~/.agents/skills/design-sense` | The three design laws and their gates, for pages a visitor judges at a glance. It sends app screens elsewhere. |
| `first-impression`, `cognitive-load`, `peak-end` skills | `~/.agents/skills/<name>` | One skill per design law. `design-sense` routes to them. |
| `deepen-gate.py` | runs on every prompt | Flags a complex ask and points Codex at `deepen`. `deep:` forces it, `quick:` skips it. |
| `design-nudge.py` | runs on every prompt | Adds the three design laws when the prompt is about a page. |
| `humanizer-gate.py prompt` | runs on every prompt | Adds the writing rule when the prompt is about writing. |
| `humanizer-gate.py pre` | runs before shell commands | Blocks a `git commit` or `gh pr` whose text still has AI tells. |
| `concept-check.py` | runs before an agent is spawned | Blocks a long agent brief with no `Concept check:` line. |
| `config.toml` | `~/.codex/config.toml`, only if you have none | Runs Codex on OpenRouter. The key is read from the macOS Keychain item `openrouter-codex`. |

Impeccable is not in this repo. It installs from its own source:

```bash
npx impeccable install --providers=codex --scope=global
```

The measured gate in `design-sense` (`tools/load-budget.ts`) needs bun and Playwright's Chromium. Its packages are not in this repo. Install them once:

```bash
cd ~/.agents/skills/design-sense/tools && bun install
```

## Tested

On Codex 0.169 with DeepSeek flash through OpenRouter, in a throwaway Codex home:

- Codex found all seven skills.
- All three prompt hooks added their context.
- The humanizer gate blocked a commit with a "not just X, but Y" message, and no commit was made.

Not tested:

- `concept-check.py` inside Codex. It passes when fed a sample call by hand. I could not make Codex spawn an agent to trigger it.
- The Codex panel in VS Code. Every test ran through `codex exec` in a terminal.
- Impeccable's installer for Codex.
- The `design-sense` measuring tools under Codex. Only the skill text was checked to load.
