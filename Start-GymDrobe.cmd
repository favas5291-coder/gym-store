@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer, then open this file again.
  pause
  exit /b 1
)
if not exist "node_modules\vite\package.json" (
  call npm ci
  if errorlevel 1 (
    echo Installation failed. Close any terminal running this project and try again.
    echo If Windows reports EPERM, restart Windows or extract to a new folder.
    echo Keep package-lock.json. See START-HERE.md for instructions.
    pause
    exit /b 1
  )
)
call npm run doctor
if errorlevel 1 (
  pause
  exit /b 1
)
call npm run dev:tryon -- --open
pause