#!/usr/bin/env bash
# 오늘 이 레포에서 돌린 Codex 세션을 마크다운으로 뽑는다.
#
#   ./scripts/codex-log.sh            # 오늘, 이 레포
#   ./scripts/codex-log.sh 2026-08-16 # 날짜 지정
#
# 결과: docs/build-log/codex-<이름>-<날짜>.md
set -euo pipefail

DATE="${1:-$(date +%Y-%m-%d)}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WHO="$(git -C "$REPO" config user.name | tr ' ' '-' | tr '[:upper:]' '[:lower:]')"
DAY_DIR="$HOME/.codex/sessions/${DATE//-//}"
OUT="$REPO/docs/build-log/codex-${WHO}-${DATE}.md"

command -v jq >/dev/null || { echo "jq가 필요하다: brew install jq" >&2; exit 1; }
[ -d "$DAY_DIR" ] || { echo "$DAY_DIR 없음 — 그날 Codex를 안 썼거나 날짜가 틀렸다" >&2; exit 1; }

mkdir -p "$(dirname "$OUT")"
{
  echo "# Codex 세션 — $WHO — $DATE"
  echo
  echo "레포: \`$REPO\`"
} > "$OUT"

found=0
for f in "$DAY_DIR"/rollout-*.jsonl; do
  [ -e "$f" ] || continue
  # 이 레포에서 돈 세션만
  cwd=$(head -1 "$f" | jq -r '.payload.cwd // ""')
  [ "$cwd" = "$REPO" ] || continue
  found=$((found + 1))

  {
    echo
    echo "---"
    echo
    echo "## 세션 $(head -1 "$f" | jq -r '.payload.session_id[0:8]') — $(head -1 "$f" | jq -r '.payload.timestamp')"
    echo
    # 사람이 Codex에게 시킨 것 = 위임 기록 (PLAN의 증거).
    # role=user 에는 <environment_context> 같은 시스템 주입 블록도 섞이므로
    # "<"로 시작하는 것과 하네스가 넣는 표식은 버린다.
    jq -r 'select(.type=="response_item" and .payload.role=="user")
           | (.payload.content[0].text // "") as $t
           | select(($t | length) > 0)
           | select($t | startswith("<") | not)
           | select($t | startswith("[Request interrupted") | not)
           | select($t | startswith("# AGENTS.md instructions") | not)
           | select($t | contains("<INSTRUCTIONS>") | not)
           | "**[" + (.timestamp[11:16]) + "]** " + ($t | .[0:600])' "$f" || true
  } >> "$OUT"
done

if [ "$found" -eq 0 ]; then
  echo "$DATE 에 이 레포($REPO)에서 돌린 Codex 세션이 없다" >&2
  echo "  (다른 폴더에서 돌렸다면 그 폴더에서 실행하거나 REPO 필터를 지워라)" >&2
  rm -f "$OUT"
  exit 1
fi

echo "세션 ${found}개 → $OUT"
