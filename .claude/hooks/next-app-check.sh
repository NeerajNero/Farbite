#!/bin/bash
# PostToolUse hook (Edit|Write): lint + type-check the Next.js app that owns
# the edited file (apps/web) and surface errors back to Claude.
set -u

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -z "$file" ] && exit 0

# Only TS/TSX source files
case "$file" in
  *.ts | *.tsx) ;;
  *) exit 0 ;;
esac

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
case "$file" in
  "$root"/apps/web/*) app_dir="$root/apps/web" ;;
  *) exit 0 ;;
esac

# Skip vendored/generated code the repo never hand-fixes
case "$file" in
  */src/components/ui/* | *generated*) exit 0 ;;
esac

cd "$app_dir" || exit 0

errors=""

lint_out=$(pnpm exec eslint "$file" 2>&1)
lint_code=$?
if [ $lint_code -ne 0 ]; then
  errors="── eslint ($file) ──
$lint_out
"
fi

tsc_out=$(pnpm exec tsc --noEmit 2>&1)
tsc_code=$?
if [ $tsc_code -ne 0 ]; then
  errors="${errors}── tsc --noEmit ($(basename "$app_dir")) ──
$tsc_out
"
fi

if [ -n "$errors" ]; then
  jq -n --arg ctx "$errors" \
    '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: ("Lint/type-check failures after this edit — fix before proceeding:\n" + $ctx)}}'
fi

exit 0
