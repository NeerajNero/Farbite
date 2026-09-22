#!/bin/bash
# PreToolUse hook (Edit|Write): ask before editing vendored/generated code —
# shadcn ui primitives and the generated SDK must not be hand-edited
# (apps/web conventions).
set -u

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -z "$file" ] && exit 0

case "$file" in
  */apps/web/src/components/ui/* | */libs/sdk/src/generated/*)
    jq -n --arg f "$file" \
      '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: ("Vendored/generated file: " + $f + ". shadcn ui primitives and the generated @food/sdk should not be hand-edited (wrap in a composite / regenerate instead). Approve only if intentional.")}}'
    ;;
esac

exit 0
