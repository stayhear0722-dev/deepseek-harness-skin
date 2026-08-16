@echo off
setlocal

cd /d "%~dp0"

if not exist "%CD%\data" mkdir "%CD%\data"
if not exist "%CD%\workspace" mkdir "%CD%\workspace"

set "DSH_HOME=%CD%\data"
set "DSH_WORKSPACE=%CD%\workspace"

call corepack pnpm dsh web

pause
