#!/usr/bin/env bash
# Запуск виртуальной лаборатории «Энерджиквантум» на Ubuntu / Linux / macOS.
#
#   ./start.sh              открыть на порту 8082
#   PORT=9000 ./start.sh    другой порт
#   ./start.sh --python     без Node.js (простой статический сервер Python)
#
# Ctrl+C — остановить.

set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8082}"
MODE="node"
[ "${1:-}" = "--python" ] && MODE="python"

echo "Виртуальная лаборатория «Энерджиквантум»"
echo "папка: $(pwd)"
echo

# index.html — это опубликованная сборка; если её нет, соберём
if [ ! -f index.html ]; then
  if command -v node >/dev/null 2>&1 && [ -f tools/build.mjs ]; then
    echo "index.html нет — собираю из src/..."
    node tools/build.mjs
  else
    echo "ОШИБКА: нет index.html и нет Node.js для сборки."
    exit 1
  fi
fi

if [ "$MODE" = "node" ] && command -v node >/dev/null 2>&1; then
  echo "Node.js: $(node -v)"
  echo "Откройте в браузере: http://localhost:${PORT}"
  echo "В локальной сети:   http://$(hostname -I 2>/dev/null | awk '{print $1}'):${PORT}"
  echo
  exec node server.js
fi

if [ "$MODE" = "node" ]; then
  echo "Node.js не найден — переключаюсь на сервер Python."
fi

if command -v python3 >/dev/null 2>&1; then
  echo "Python: $(python3 -V 2>&1)"
  echo "Откройте в браузере: http://localhost:${PORT}"
  echo
  exec python3 -m http.server "${PORT}" --bind 0.0.0.0
fi

echo "ОШИБКА: не установлен ни Node.js, ни Python 3."
echo "Ubuntu:  sudo apt update && sudo apt install -y nodejs"
exit 1
