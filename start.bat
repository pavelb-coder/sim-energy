@echo off
chcp 65001 >nul
rem Запуск виртуальной лаборатории «Энерджиквантум» на Windows.
rem   start.bat              открыть на порту 8082
rem   set PORT=9000 ^&^& start.bat   другой порт
rem Двойной клик по файлу тоже работает.

setlocal
cd /d "%~dp0"

if "%PORT%"=="" set PORT=8082

echo Виртуальная лаборатория «Энерджиквантум»
echo папка: %CD%
echo.

where node >nul 2>nul
if errorlevel 1 goto nopython

if not exist index.html (
  echo index.html нет - собираю из src\...
  node tools\build.mjs
)

echo Node.js найден:
node -v
echo.
echo Откройте в браузере: http://localhost:%PORT%
echo Остановить: Ctrl+C
echo.
node server.js
goto end

:nopython
where python >nul 2>nul
if errorlevel 1 goto noall

if not exist index.html (
  echo index.html нет, а Node.js не установлен - запускаю готовую сборку dist\lab.html
  if exist dist\lab.html (
    start "" "dist\lab.html"
    goto end
  )
)

echo Node.js не найден - использую Python.
echo Откройте в браузере: http://localhost:%PORT%
echo.
python -m http.server %PORT% --bind 0.0.0.0
goto end

:noall
if exist dist\lab.html (
  echo Node.js и Python не найдены - открываю готовую сборку в браузере.
  start "" "dist\lab.html"
) else (
  echo ОШИБКА: не установлен ни Node.js, ни Python.
  echo Скачайте Node.js с https://nodejs.org и запустите файл снова.
  pause
)

:end
endlocal
