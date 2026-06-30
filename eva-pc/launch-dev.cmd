@echo off
set "NODE_PATH=F:\donnee_app\dev_tool\node"
set "PATH=%NODE_PATH%;%PATH%"
cd /d "%~dp0"
echo [EVA] Lancement en mode developpement...
"%NODE_PATH%\npm.cmd" run electron:dev
