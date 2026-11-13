#!/usr/bin/env bash
# Синхронизация рабочей папки с GitHub-репозиторием pavelb-coder/sim-energy.
#
#   ./sync.sh                 собрать, прогнать тесты, закоммитить изменения и отправить
#   ./sync.sh -m "сообщение"  то же, но со своим текстом коммита
#   ./sync.sh --pull          только забрать изменения из репозитория (rebase)
#   ./sync.sh --status        показать, что расходится с репозиторием
#
# Токен берётся из ~/.gh_token (права 600) и на диск в репозиторий не попадает.
set -euo pipefail
cd "$(dirname "$0")"
REPO="pavelb-coder/sim-energy"
TOKEN_FILE="${HOME}/.gh_token"

# самовосстановление remote (на случай чистого клона окружения)
if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "https://github.com/pavelb-coder/sim-energy.git"
fi

token() {
  if [ -n "${GH_TOKEN:-}" ]; then printf '%s' "$GH_TOKEN"; return; fi
  if [ -f "$TOKEN_FILE" ]; then tr -d '\r\n' < "$TOKEN_FILE"; return; fi
  echo "Нет токена: положите его в ~/.gh_token или задайте GH_TOKEN" >&2; exit 1
}

remote_auth() {
  # заголовок авторизации передаётся только этой команде git, в .git/config не пишется
  printf 'Authorization: Basic %s' "$(printf 'x-access-token:%s' "$(token)" | base64 -w0)"
}


case "${1:-}" in
  --status)
    git fetch origin main >/dev/null 2>&1 || true
    echo "== локально не закоммичено:"; git status --short || true
    echo "== расхождение с origin/main:"; git log --oneline origin/main..HEAD 2>/dev/null | sed 's/^/  впереди: /' || true
    git log --oneline HEAD..origin/main 2>/dev/null | sed 's/^/  позади:  /' || true
    exit 0
    ;;
  --pull)
    git -c credential.helper= -c "http.extraheader=$(remote_auth)" pull --rebase origin main
    exit $?
    ;;
esac

MSG=""
if [ "${1:-}" = "-m" ] && [ -n "${2:-}" ]; then MSG="$2"; shift 2; fi

# 1. синхронизируемся с удалённым репозиторием (на случай правок через веб-интерфейс)
git -c credential.helper= -c "http.extraheader=$(remote_auth)" pull --rebase --autostash origin main || true

# 2. сборка + тесты
if command -v node >/dev/null 2>&1; then
  node tools/build.mjs
  node src/test_engine.js >/dev/null && echo "тесты физики: ок"
  git add -A dist
fi

# 3. коммит, если есть что коммитить
if [ -n "$(git status --porcelain)" ]; then
  if [ -z "$MSG" ]; then
    MSG="Синхронизация: $(date '+%d.%m.%Y %H:%M')"
  fi
  git add -A
  git commit -q -m "$MSG"
  echo "коммит: $MSG"
else
  echo "изменений нет — отправляю то, что уже закоммичено"
fi

# 4. пуш
git -c credential.helper= -c "http.extraheader=$(remote_auth)" push origin main
echo "готово: https://github.com/$REPO"
