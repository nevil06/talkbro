# 🎙️ TalkBro Whisper Server

A production-ready Flask server that provides:
- 🎤 **Speech-to-Text** via OpenAI Whisper (local)
- ✨ **Text Enhancement** via Nvidia DeepSeek API + Ollama fallback
- 🔄 **Automatic Failover** for maximum reliability

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd whisper-server
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
# Copy example configuration
cp .env.example .env

# Edit .env and add your Nvidia API key
notepad .env
```

### 3. Start Server
```bash
python server.py
```

Or use the convenient batch file:
```bash
start-server.bat
```

### 4. Verify
Open http://localhost:5555/health

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [QUICKSTART.md](QUICKSTART.md) | Get running in 3 minutes |
| [SETUP.md](SETUP.md) | Detailed setup instructions |
| [TEST_FALLBACK.md](TEST_FALLBACK.md) | Test the fallback system |
| [FALLBACK_FLOW.md](FALLBACK_FLOW.md) | Visual flow diagrams |

## 🔄 Fallback System

The server uses a **two-tier enhancement system**:

```
1️⃣ PRIMARY: Nvidia DeepSeek API
   ├─ Fast (1-3 seconds)
   ├─ High quality
   └─ Requires API key + internet

2️⃣ FALLBACK: Ollama (mistral)
   ├─ Slower (10-30 seconds on CPU)
   ├─ Very good quality
   ├─ Works offline
   └─ Free
```

**Automatic failover** happens when:
- ❌ Nvidia API key is invalid/expired
- ❌ Network connection fails
- ❌ API timeout occurs
- ❌ Rate limits are hit
- ❌ Service is down

## 🎯 API Endpoints

### POST /transcribe
Transcribe audio to text using Whisper.

**Request:**
```bash
curl -X POST http://localhost:5555/transcribe \
  -F "file=@recording.webm"
```

**Response:**
```json
{
  "success": true,
  "text": "Hello, this is a test.",
  "language": "en",
  "segments": [...]
}
```

### POST /enhance
Enhance text using Nvidia API with Ollama fallback.

**Request:**
```bash
curl -X POST http://localhost:5555/enhance \
  -H "Content-Type: application/json" \
  -d '{
    "text": "um so like I was thinking",
    "systemPrompt": "Clean up this text."
  }'
```

**Response (Nvidia success):**
```json
{
  "success": true,
  "enhanced_text": "I was thinking",
  "provider": "nvidia"
}
```

**Response (Ollama fallback):**
```json
{
  "success": true,
  "enhanced_text": "I was thinking",
  "provider": "ollama",
  "model": "mistral",
  "note": "Nvidia API failed (timeout), used Ollama fallback"
}
```

### GET /health
Check server and service status.

**Response:**
```json
{
  "status": "ok",
  "whisper_model": "base",
  "service": "TalkBro Whisper Server",
  "enhancement": {
    "nvidia": {
      "configured": true,
      "status": "primary"
    },
    "ollama": {
      "url": "http://localhost:11434",
      "model": "mistral",
      "available": true,
      "status": "fallback"
    }
  }
}
```

### GET /models
List available Whisper models.

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NVIDIA_API_KEY` | No* | None | Nvidia API key from https://build.nvidia.com/ |
| `OLLAMA_URL` | No | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | No | `mistral` | Ollama model name |
| `WHISPER_MODEL` | No | `base` | Whisper model size (tiny/base/small/medium/large) |
| `PORT` | No | `5555` | Server port |

*At least one enhancement service (Nvidia or Ollama) should be configured.

### Whisper Models

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| tiny | ~39 MB | ⚡⚡⚡ | ⭐⭐ | Quick testing |
| base | ~74 MB | ⚡⚡ | ⭐⭐⭐ | **Recommended** |
| small | ~244 MB | ⚡ | ⭐⭐⭐⭐ | Better accuracy |
| medium | ~769 MB | 🐌 | ⭐⭐⭐⭐⭐ | High accuracy |
| large | ~1550 MB | 🐌🐌 | ⭐⭐⭐⭐⭐ | Best accuracy |

## 🔧 Troubleshooting

### "NVIDIA_API_KEY environment variable not set"
```bash
# Windows Command Prompt
set NVIDIA_API_KEY=nvapi-your-key-here

# Windows PowerShell
$env:NVIDIA_API_KEY="nvapi-your-key-here"

# Or use .env file (recommended)
echo NVIDIA_API_KEY=nvapi-your-key-here > .env
```

### "Cannot connect to Nvidia API"
- Check your internet connection
- Verify API key at https://build.nvidia.com/
- Check if you've exceeded rate limits
- Server will automatically fall back to Ollama

### "Ollama connection error"
```bash
# Install Ollama
# Download from: https://ollama.ai/

# Start Ollama
ollama serve

# Pull the model
ollama pull mistral

# Verify it's running
curl http://localhost:11434/api/tags
```

### "Both services failed"
- Check console logs for specific errors
- Verify at least one service is configured
- Test each service independently
- See [TEST_FALLBACK.md](TEST_FALLBACK.md) for detailed testing

## 📊 Performance

| Service | Typical Response Time | Quality | Cost |
|---------|----------------------|---------|------|
| **Nvidia DeepSeek** | 1-3 seconds | Excellent | API costs |
| **Ollama (CPU)** | 10-30 seconds | Very Good | Free |
| **Ollama (GPU)** | 2-5 seconds | Very Good | Free |

## 🔒 Security

- ✅ API keys loaded from environment variables
- ✅ `.env` file excluded from Git
- ✅ CORS enabled for Chrome extension
- ✅ No credentials in source code
- ✅ Secure token handling

**Never commit your `.env` file or API keys to version control!**

## 🐛 Debugging

Enable detailed logging:
```bash
# The server already logs all operations
# Watch the console for:
# 🔵 Nvidia API attempts
# 🟢 Ollama fallback attempts
# ✅ Successful enhancements
# ⚠️  Warnings and errors
# ❌ Complete failures
```

## 📦 Dependencies

- `openai-whisper` - Speech recognition
- `flask` - Web server
- `flask-cors` - CORS support
- `requests` - HTTP client
- `python-dotenv` - Environment variables

## 🚀 Production Deployment

1. **Use a production WSGI server** (not Flask's built-in):
   ```bash
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:5555 server:app
   ```

2. **Set up monitoring** for both services

3. **Configure alerts** when fallback is used frequently

4. **Use GPU** for Ollama for faster fallback

5. **Set up log rotation** for production logs

6. **Use environment-specific API keys**

## 📝 License

See main project LICENSE file.

## 🤝 Contributing

This is part of the TalkBro project. See main README for contribution guidelines.

## 🔗 Links

- [Nvidia API](https://build.nvidia.com/)
- [Ollama](https://ollama.ai/)
- [OpenAI Whisper](https://github.com/openai/whisper)
- [TalkBro Main Project](../README.md)
