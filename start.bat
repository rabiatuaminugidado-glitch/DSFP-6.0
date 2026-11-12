@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   Starting Hikma JobTrack Application...
echo   Primary Theme: Light Blue (#0284c7)
echo ===================================================

REM Check if node exists in PATH
where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
  set "NODE_CMD=node"
) else (
  REM Fallback to detected OpenAI Codex node runtime
  if exist "%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node\bbc9141fe9f920ac\bin\node.exe" (
    set "NODE_CMD=%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node\bbc9141fe9f920ac\bin\node.exe"
  ) else (
    echo [ERROR] Node.js executable was not found. Please install Node.js.
    pause
    exit /b 1
  )
)

echo Using Node: %NODE_CMD%
start "" http://localhost:3000
"%NODE_CMD%" server.js
pause

