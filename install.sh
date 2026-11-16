#!/usr/bin/env bash
# Installs the kit for Codex: skills into ~/.agents/skills, hooks into ~/.codex.
#
#   ./install.sh            install; skills and config that already exist are kept
#   ./install.sh --force    replace skills that already exist
#
# CODEX_HOME and SKILLS_DIR override the two target folders (used for testing).
set -euo pipefail

KIT="$(cd "$(dirname "$0")" && pwd)"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
SKILLS_DIR="${SKILLS_DIR:-$HOME/.agents/skills}"
FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

command -v python3 >/dev/null || { echo "python3 is missing and the hooks need it"; exit 1; }
command -v node >/dev/null || echo "note    node is missing; the pre-pr scripts need it"

mkdir -p "$SKILLS_DIR" "$CODEX_HOME/hooks"

for dir in "$KIT"/skills/*/; do
  name="$(basename "$dir")"
  if [ -e "$SKILLS_DIR/$name" ] && [ "$FORCE" -eq 0 ]; then
    echo "skill   $name: already there, kept (--force replaces it)"
    continue
  fi
  rm -rf "${SKILLS_DIR:?}/$name"
  cp -R "$dir" "$SKILLS_DIR/$name"
  echo "skill   $name: installed"
done

cp "$KIT"/hooks/*.py "$KIT"/hooks/*.json "$CODEX_HOME/hooks/"
echo "hooks   scripts copied to $CODEX_HOME/hooks"

if [ -f "$CODEX_HOME/hooks.json" ]; then
  cp "$CODEX_HOME/hooks.json" "$CODEX_HOME/hooks.json.bak"
  echo "hooks   old hooks.json saved as hooks.json.bak"
fi
HOOKS_DIR="$CODEX_HOME/hooks" python3 - > "$CODEX_HOME/hooks.json" <<'PY'
import json, os
d = os.environ['HOOKS_DIR']
run = lambda script, arg='', status='': {
    'type': 'command',
    'command': f'python3 "{d}/{script}"' + (f' {arg}' if arg else ''),
    'timeout': 10,
    **({'statusMessage': status} if status else {}),
}
print(json.dumps({'hooks': {
    'UserPromptSubmit': [{'hooks': [
        run('deepen-gate.py'),
        run('design-nudge.py'),
        run('humanizer-gate.py', 'prompt'),
    ]}],
    'PreToolUse': [
        {'matcher': 'Bash', 'hooks': [run('humanizer-gate.py', 'pre', 'Checking commit and PR text')]},
        {'matcher': 'Agent', 'hooks': [run('concept-check.py', status='Checking the agent brief')]},
    ],
}}, indent=2))
PY
echo "hooks   $CODEX_HOME/hooks.json written (3 on each prompt, 2 before tool calls)"

if [ -f "$CODEX_HOME/config.toml" ]; then
  echo "config  $CODEX_HOME/config.toml already there, kept"
else
  cp "$KIT/config.toml" "$CODEX_HOME/config.toml"
  echo "config  OpenRouter config installed"
fi

cat <<'NEXT'

Left to do by hand:
  1. In Codex, type /hooks and approve the five hooks. They do not run until you do.
  2. If you use the OpenRouter config on a new Mac, store the key once:
       security add-generic-password -a "$USER" -s openrouter-codex -w
  3. Impeccable installs from its own source:
       npx impeccable install --providers=codex --scope=global
NEXT
