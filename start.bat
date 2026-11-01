@echo off
title hikarii - English Corner
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missing_node
if exist node_modules goto run_app
call npm.cmd install
if errorlevel 1 goto install_error
:run_app
echo Open http://localhost:3000 in your browser.
start "" "http://localhost:3000"
node server.js
pause
exit /b
:missing_node
echo Please install Node.js 20 or newer, then try again.
pause
exit /b 1
:install_error
echo Could not install dependencies. Check your connection and try again.
pause
exit /b 1
