@echo off
echo ========================================
echo TalkBro Whisper Server Startup
echo ========================================
echo.

REM Set the API key (replace with your actual key)
set NVIDIA_API_KEY=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

REM Optional: Set custom Whisper model size
REM set WHISPER_MODEL=tiny

REM Optional: Set custom port
REM set PORT=5555

echo Starting TalkBro server...
echo API Key: %NVIDIA_API_KEY:~0,15%... (hidden)
echo.

python server.py

pause
