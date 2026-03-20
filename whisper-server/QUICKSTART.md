# 🚀 Quick Start Guide

## Setup in 3 Minutes

### Step 1: Install Dependencies (1 min)
```bash
cd whisper-server
pip install -r requirements.txt
```

### Step 2: Configure API Key (1 min)
```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your Nvidia API key
# Get your key from: https://build.nvidia.com/
nano .env  # or use any text editor
```

Your `.env` file should look like:
```bash
NVIDIA_API_KEY=nvapi-your-actual-key-here
WHISPER_MODEL=base
PORT=5555
```

### Step 3: Start Server (30 seconds)
```bash
python server.py
```

You should see:
```
[TalkBro] Loading Whisper model: base...
[TalkBro] Whisper model 'base' loaded successfully!
[TalkBro] ✅ Using Nvidia DeepSeek API for text enhancement!
[TalkBro] Whisper server running at http://localhost:5555
```

### Step 4: Test It (30 seconds)
Open http://localhost:5555/health in your browser.

Expected response:
```json
{
  "status": "ok",
  "model": "base",
  "llm_provider": "Nvidia DeepSeek API",
  "service": "TalkBro Whisper Server"
}
```

## ✅ You're Ready!

The server is now running and ready to:
- Transcribe audio via `/transcribe` endpoint
- Enhance text via `/enhance` endpoint

## Troubleshooting

**"NVIDIA_API_KEY environment variable not set"**
- Make sure `.env` file exists in `whisper-server/` directory
- Check that the API key is on a line like: `NVIDIA_API_KEY=nvapi-...`
- No spaces around the `=` sign

**"Cannot connect to Nvidia API"**
- Verify your API key is valid at https://build.nvidia.com/
- Check your internet connection
- Make sure you haven't exceeded API rate limits

**Server won't start**
- Make sure port 5555 is not already in use
- Try a different port: `PORT=8080 python server.py`

## Next Steps

1. Start the Chrome extension (see main README.md)
2. Click the TalkBro pill on any webpage
3. Click the mic button and speak
4. Watch your speech get transcribed and enhanced!

For detailed documentation, see [SETUP.md](SETUP.md)
