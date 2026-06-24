#!/usr/bin/env bash
# AEGIS — secret-leak scan (Phase 30.8)
# Blocks the commit if staged files contain a real API key / service_role JWT.
# Setup:  git config core.hooksPath scripts/githooks
# (or invoke as a pre-commit hook)

set -e

# Get staged content (excluding deletions)
staged=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$staged" ] && exit 0

found=0
while IFS= read -r file; do
    # skip binary / example files
    case "$file" in
        *.env.example|*.md|*.png|*.jpg|*.ico) continue ;;
    esac
    content=$(git show ":$file" 2>/dev/null || true)

    # Real Groq key: gsk_ + 30+ alphanumeric
    if echo "$content" | grep -qE 'gsk_[A-Za-z0-9]{30}'; then
        echo "❌ $file: possible Groq API key (gsk_...)"; found=1
    fi
    # OpenAI key: sk- / sk-proj- + long
    if echo "$content" | grep -qE 'sk-(proj-)?[A-Za-z0-9_-]{30}'; then
        echo "❌ $file: possible OpenAI API key (sk-...)"; found=1
    fi
    # service_role JWT as an .env-style assignment (long JWT starting with eyJ assigned to a SERVICE var)
    if echo "$content" | grep -qE 'SERVICE_(ROLE_)?KEY\s*[:=]\s*["'"'"']?eyJ'; then
        echo "❌ $file: possible Supabase service_role key"; found=1
    fi
done <<< "$staged"

# The .env file itself must never be added
if echo "$staged" | grep -qE '(^|/)\.env$'; then
    echo "❌ .env file is being committed — secrets may leak!"; found=1
fi

if [ "$found" -ne 0 ]; then
    echo ""
    echo "🚫 Commit blocked: a real secret was detected. Keep secrets in the Edge Function secret store, don't hardcode them."
    echo "   If this is a false positive:  git commit --no-verify"
    exit 1
fi
exit 0
