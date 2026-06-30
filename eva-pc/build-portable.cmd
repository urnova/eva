@echo off
set "NODE_PATH=F:\donnee_app\dev_tool\node"
set "PATH=%NODE_PATH%;%PATH%"
cd /d "%~dp0"
echo [EVA] Build production .exe portable...
"%NODE_PATH%\npm.cmd" run build:portable
echo [EVA] Build termine ! Voir le dossier release/
pause
