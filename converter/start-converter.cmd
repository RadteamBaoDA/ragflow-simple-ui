@echo off
REM ============================================================================
REM Converter Worker — Windows launcher (runs via WSL)
REM
REM This script launches the converter worker inside WSL.
REM Make sure WSL is installed and has the required packages.
REM
REM Usage: start-converter.cmd
REM ============================================================================

echo Starting Converter Worker via WSL...

cd /d "%~dp0"
wsl bash ./start.sh
