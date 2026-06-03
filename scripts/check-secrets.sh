#!/usr/bin/env bash
# AEGIS — sır sızıntısı taraması (Faz 30.8)
# Staged dosyalarda gerçek API anahtarı / service_role JWT varsa commit'i engeller.
# Kurulum:  git config core.hooksPath scripts/githooks
# (veya pre-commit olarak çağır)

set -e

# Staged içeriği al (silinenler hariç)
staged=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$staged" ] && exit 0

found=0
while IFS= read -r file; do
    # binary / örnek dosyaları atla
    case "$file" in
        *.env.example|*.md|*.png|*.jpg|*.ico) continue ;;
    esac
    content=$(git show ":$file" 2>/dev/null || true)

    # Gerçek Groq key: gsk_ + 30+ alfasayısal
    if echo "$content" | grep -qE 'gsk_[A-Za-z0-9]{30}'; then
        echo "❌ $file: olası Groq API anahtarı (gsk_...)"; found=1
    fi
    # OpenAI key: sk- / sk-proj- + uzun
    if echo "$content" | grep -qE 'sk-(proj-)?[A-Za-z0-9_-]{30}'; then
        echo "❌ $file: olası OpenAI API anahtarı (sk-...)"; found=1
    fi
    # service_role JWT'si .env tarzı atama (eyJ ile başlayan uzun JWT bir SERVICE değişkenine)
    if echo "$content" | grep -qE 'SERVICE_(ROLE_)?KEY\s*[:=]\s*["'"'"']?eyJ'; then
        echo "❌ $file: olası Supabase service_role anahtarı"; found=1
    fi
done <<< "$staged"

# .env dosyasının kendisi hiç eklenmemeli
if echo "$staged" | grep -qE '(^|/)\.env$'; then
    echo "❌ .env dosyası commit ediliyor — sırlar sızabilir!"; found=1
fi

if [ "$found" -ne 0 ]; then
    echo ""
    echo "🚫 Commit engellendi: gerçek sır tespit edildi. Sırları Edge Function secret'ında tut, koda gömme."
    echo "   Yanlış pozitifse:  git commit --no-verify"
    exit 1
fi
exit 0
