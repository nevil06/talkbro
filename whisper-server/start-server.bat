@echo off
echo ========================================
echo TalkBro Whisper Server Startup
echo ========================================
echo.

REM Set the API key from .env file or set it here temporarily
REM set NVIDIA_API_KEY=your-api-key-here

REM Load from .env file (recommended)
if exist .env (
    for /f "tokens=1,2 delims==" %%a in (.env) do (
        if "%%a"=="NVIDIA_API_KEY" set NVIDIA_API_KEY=%%b
    )
)

REM Optional: Set custom Whisper model size
REM set WHISPER_MODEL=tiny

REM Optional: Set custom port
REM set PORT=5555

echo Starting TalkBro server...
echo API Key: %NVIDIA_API_KEY:~0,15%... (hidden)
echo.

python server.py

pause
