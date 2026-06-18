@echo off
REM TeachingOS scheduler tick — run by Windows Task Scheduler.
REM Portable: resolves the repo root from this script's location.
pushd "%~dp0.."
".venv\Scripts\python.exe" -m teachingos tick >> "state\tick.log" 2>&1
popd
