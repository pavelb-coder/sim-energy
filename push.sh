#!/usr/bin/env bash
# Отправка готового репозитория на GitHub.
# Использование:  GH_TOKEN=ghp_xxxxxxxx ./push.sh
# Токен не сохраняется на диск: он передаётся только в этой команде.
set -euo pipefail
if [ -z "${GH_TOKEN:-}" ]; then
  echo "Нужен токен: GH_TOKEN=... ./push.sh" >&2
  echo "Создать: https://github.com/settings/tokens (fine-grained, доступ к репозиторию sim-energy, разрешение Contents: Read and write)" >&2
  exit 1
fi
cd "$(dirname "$0")"
git remote set-url origin "https://github.com/pavelb-coder/sim-energy.git"
git -c credential.helper= \
    -c http.extraheader="Authorization: Basic $(printf 'x-access-token:%s' "$GH_TOKEN" | base64 -w0)" \
    push -u origin main
echo "Готово: https://github.com/pavelb-coder/sim-energy"
