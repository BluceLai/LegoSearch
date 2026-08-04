@echo off
setlocal
cd /d "%~dp0"
node "%~dp0tools\legoctl.mjs" status
pause
