@echo off
setlocal
echo ═══════════════════════════════════════════
echo   TalkBro — Local Server Setup
echo ═══════════════════════════════════════════
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found! Install Python 3.8+ from https://www.python.org/downloads/
    pause
    exit /b 1
)

:: Create and activate virtual environment
if not exist venv (
    echo 📦 Creating Python virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo ❌ Failed to create virtual environment!
        pause
        exit /b 1
    )
)

echo 🔄 Activating virtual environment...
call venv\Scripts\activate.bat

:: Install dependencies
echo 📦 Installing dependencies (this may take a while)...
pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ Failed to install dependencies!
    pause
    exit /b 1
)

echo.
echo ✅ Setup complete!
echo.
echo 🎤 Starting Local Server (Whisper + DeepSeek)...
echo    URL:   http://localhost:5555
echo.
echo    Press Ctrl+C to stop the server
echo.
python server.py
pause
