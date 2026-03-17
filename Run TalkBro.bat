@echo off
TITLE TalkBro Server
echo ===================================================
echo               Starting TalkBro
echo ===================================================
echo.

:: Navigate to the correct folder
cd /d "c:\Users\nevil\OneDrive\Documents\Desktop\talkbro\whisper-server"

:: Check if virtual environment exists and activate it
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo Warning: Virtual environment not found! 
    echo Ensure you have run start.bat at least once to install dependencies.
)

:: Run the server
echo Starting the Python server...
python server.py

:: Keep the window open if it crashes or stops
pause
