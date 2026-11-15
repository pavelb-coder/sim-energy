#!/usr/bin/env bash
# Синхронизация рабочей папки с GitHub-репозиторием pavelb-coder/sim-energy.
#
#   ./sync.sh                 собрать, прогнать тесты, закоммитить изменения и отправить
#   ./sync.sh -m "сообщение"  то же, но со своим текстом коммита
#   ./sync.sh --pull          только забрать изменения из репозитория (rebase)
#   ./sync.sh --status        показать, что расходится с репозиторием
#   ./sync.sh --no-moodle     не обновлять ветку moodle-plugin
#
# После каждого обновления main ветка moodle-plugin приводится к его состоянию:
# свежая сборка стенда внутри плагина, архив mod_energy.zip и проверки PHP.
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


sync_moodle() {
  local base_branch
  base_branch="$(git rev-parse --abbrev-ref HEAD)"
  [ "$base_branch" = "HEAD" ] && return 0

  echo "== обновляю ветку moodle-plugin под main"
  git fetch origin moodle-plugin >/dev/null 2>&1 || true
  # запоминаем состояние удалённой ветки: rebase переписывает коммиты,
  # поэтому пуш идёт с force-with-lease именно на это состояние
  local remote_sha=""
  if git show-ref --verify --quiet refs/remotes/origin/moodle-plugin; then
    remote_sha="$(git rev-parse origin/moodle-plugin)"
  fi

  # незакоммиченные правки в рабочей папке прячем, чтобы не мешали переключению ветки
  local stashed=0
  if [ -n "$(git status --porcelain)" ]; then
    git stash push -q -u -m "sync-moodle: временные правки" && stashed=1
  fi

  if git show-ref --verify --quiet refs/remotes/origin/moodle-plugin; then
    git checkout -q -B moodle-plugin origin/moodle-plugin
    # плагин целиком живёт в moodle/ и не меняется в main: переносим ветку на новый main
    # с нашими файлами как единственной разницей (CI делает так же через rebase)
    git reset -q --soft origin/main
    git checkout origin/main -- .
    # правки самого плагина (lib.php, языки, проверки) живут только в ветке moodle-plugin:
    # возвращаем moodle/ из удалённой ветки, а встроенную сборку всё равно пересоберём ниже
    git checkout origin/moodle-plugin -- moodle 2>/dev/null || true
    git add -A moodle
    if [ -n "$(git status --porcelain)" ]; then
      git commit -q -m "Moodle: ветка плагина на базе main $(git rev-parse --short origin/main)"
    fi
  else
    git checkout -q -B moodle-plugin origin/main
  fi

  # пересобираем стенд внутри плагина и архив для установки
  if command -v node >/dev/null 2>&1; then
    node tools/build.mjs >/dev/null
  fi
  if command -v zip >/dev/null 2>&1; then
    (cd moodle && zip -qr mod_energy.zip mod/energy -x "*/.*")
  fi

  # проверки плагина
  if command -v php >/dev/null 2>&1 && [ -f moodle/mod/energy/tools_check.php ]; then
    (cd moodle/mod/energy && php tools_check.php >/dev/null) && echo "  проверки плагина: ок"
  fi

  if [ -n "$(git status --porcelain)" ]; then
    git add -A moodle
    git commit -q -m "Moodle: сборка плагина под main $(git rev-parse --short origin/main)"
    echo "  коммит: сборка плагина под main"
  fi

  local ahead
  if git show-ref --verify --quiet refs/remotes/origin/moodle-plugin; then
    ahead="$(git rev-list --count origin/moodle-plugin..HEAD)"
  else
    ahead=1
  fi
  if [ "$ahead" != "0" ]; then
    if [ -n "$remote_sha" ]; then
      git -c credential.helper= -c "http.extraheader=$(remote_auth)" \
        push --force-with-lease=refs/heads/moodle-plugin:"$remote_sha" origin HEAD:moodle-plugin >/dev/null
    else
      git -c credential.helper= -c "http.extraheader=$(remote_auth)" push origin HEAD:moodle-plugin >/dev/null
    fi
    echo "  ветка moodle-plugin обновлена"
  else
    echo "  ветка moodle-plugin уже актуальна"
  fi

  git checkout -q "$base_branch"
  # возвращаем отложенные правки рабочей папки
  if [ "$stashed" = "1" ]; then
    git stash pop -q || echo "  ! отложенные правки вернулись с конфликтом — проверьте git status" >&2
  fi
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
  --moodle)
    # только привести ветку moodle-plugin к текущему main (без коммита в main)
    git -c credential.helper= -c "http.extraheader=$(remote_auth)" fetch origin main >/dev/null 2>&1 || true
    sync_moodle
    exit $?
    ;;
esac

MSG=""
SYNC_MOODLE=1
if [ "${1:-}" = "-m" ] && [ -n "${2:-}" ]; then MSG="$2"; shift 2; fi
for arg in "$@"; do
  [ "$arg" = "--no-moodle" ] && SYNC_MOODLE=0
done

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

# 5. ветка moodle-plugin всегда соответствует main

if [ "$SYNC_MOODLE" = "1" ]; then
  sync_moodle || echo "  (ветку moodle-plugin обновлю через CI после пуша)" >&2
fi
