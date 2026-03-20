@echo off
echo ========================================
echo TalkBro Server Status Check
echo ========================================
echo.

echo Checking if server is running on port 5555...
echo.

curl -s http://localhost:5555/health > nul 2>&1

if %errorlevel% equ 0 (
    echo ✅ Server is RUNNING
    echo.
    echo Server details:
    curl -s http://localhost:5555/health
    echo.
    echo.
    echo Server is ready to use!
) else (
    echo ❌ Server is NOT running
    echo.
    echo To start the server:
    echo 1. Open a terminal in the whisper-server folder
    echo 2. Run: python server.py
    echo.
    echo Or double-click: start-server.bat
)

echo.
echo ========================================
pause
