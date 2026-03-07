@echo off
echo ═══════════════════════════════════════════
echo   TalkBro — Whisper Server Setup
echo ═══════════════════════════════════════════
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found! Install Python 3.8+ from https://www.python.org/downloads/
    pause
    exit /b 1
)

:: Install dependencies
echo 📦 Installing dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ✅ Setup complete!
echo.

:: Start server
echo 🎤 Starting Whisper server...
echo    Model: base (set WHISPER_MODEL=tiny for faster, or medium for better accuracy)
echo    URL:   http://localhost:5555
echo.
echo    Press Ctrl+C to stop the server
echo.
python server.py
