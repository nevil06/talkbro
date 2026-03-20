# TalkBro Server Setup Guide

## Prerequisites
- Python 3.8 or higher
- pip (Python package manager)

## Installation Steps

### 1. Install Dependencies
```bash
cd whisper-server
pip install -r requirements.txt
```

### 2. Configure API Key

**IMPORTANT:** Never commit your API key to version control!

Create a `.env` file in the `whisper-server/` directory:
```bash
cp .env.example .env
```

Edit `.env` and add your Nvidia API key:
```bash
NVIDIA_API_KEY=nvapi-your-actual-key-here
```

**Get your Nvidia API key:**
1. Visit https://build.nvidia.com/
2. Sign in or create an account
3. Navigate to the API Keys section
4. Generate a new API key for DeepSeek

### Optional: Configure Ollama Fallback

For a reliable local fallback (works offline):

1. **Install Ollama**: https://ollama.ai/
2. **Pull the model**:
   ```bash
   ollama pull mistral
   ```
3. **Start Ollama**:
   ```bash
   ollama serve
   ```

The server will automatically use Ollama if Nvidia API fails!

### 3. Set Environment Variables (Alternative Methods)

**Option A: Using .env file (Recommended)**
```bash
# Already done in step 2
```

**Option B: Export in terminal (temporary)**
```bash
export NVIDIA_API_KEY="nvapi-your-actual-key-here"
export WHISPER_MODEL="base"  # optional
export PORT="5555"            # optional
```

**Option C: Windows Command Prompt**
```cmd
set NVIDIA_API_KEY=nvapi-your-actual-key-here
set WHISPER_MODEL=base
set PORT=5555
```

**Option D: Windows PowerShell**
```powershell
$env:NVIDIA_API_KEY="nvapi-your-actual-key-here"
$env:WHISPER_MODEL="base"
$env:PORT="5555"
```

### 4. Start the Server

**Basic start:**
```bash
python server.py
```

**With custom model:**
```bash
WHISPER_MODEL=small python server.py
```

**With custom port:**
```bash
PORT=8080 python server.py
```

### 5. Verify Server is Running

Open your browser and visit:
```
http://localhost:5555/health
```

You should see:
```json
{
  "status": "ok",
  "model": "base",
  "llm_provider": "Nvidia DeepSeek API",
  "service": "TalkBro Whisper Server"
}
```

## Troubleshooting

### "NVIDIA_API_KEY environment variable not set"
- Make sure you created the `.env` file
- Verify the API key is correctly set in `.env`
- If using export/set, make sure you're in the same terminal session

### "Cannot connect to Nvidia API"
- Check your internet connection
- Verify your API key is valid
- Check if you've exceeded API rate limits

### "Whisper model download is slow"
- First run downloads the model (~74MB for base)
- Subsequent runs use cached model
- Use `WHISPER_MODEL=tiny` for faster initial download

## Security Best Practices

✅ **DO:**
- Keep `.env` file in `.gitignore`
- Use environment variables for API keys
- Rotate API keys periodically
- Limit API key permissions if possible

❌ **DON'T:**
- Commit API keys to Git
- Share API keys in chat/email
- Hardcode credentials in source code
- Push `.env` file to GitHub

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/transcribe` | POST | Audio → text (Whisper) |
| `/enhance` | POST | Text enhancement (DeepSeek) |
| `/models` | GET | List available Whisper models |

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NVIDIA_API_KEY` | **Yes** | None | Nvidia API key for DeepSeek |
| `WHISPER_MODEL` | No | `base` | Whisper model size |
| `PORT` | No | `5555` | Server port |

## Model Sizes

| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| tiny | ~39 MB | Fastest | Lowest |
| base | ~74 MB | Fast | Good |
| small | ~244 MB | Medium | Better |
| medium | ~769 MB | Slow | High |
| large | ~1550 MB | Slowest | Best |
