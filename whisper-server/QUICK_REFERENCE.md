# 📋 Quick Reference Card

## 🚀 Start Server

```bash
cd whisper-server
python server.py
```

## 🔑 Set API Key (Windows)

**Command Prompt:**
```cmd
set NVIDIA_API_KEY=nvapi-your-key-here
```

**PowerShell:**
```powershell
$env:NVIDIA_API_KEY="nvapi-your-key-here"
```

**.env file (Best):**
```bash
NVIDIA_API_KEY=nvapi-your-key-here
```

## 🧪 Test Endpoints

**Health Check:**
```bash
curl http://localhost:5555/health
```

**Enhance Text:**
```bash
curl -X POST http://localhost:5555/enhance \
  -H "Content-Type: application/json" \
  -d '{"text":"um so like test","systemPrompt":"Clean this up"}'
```

## 🔧 Setup Ollama (Fallback)

```bash
# 1. Install from https://ollama.ai/
# 2. Pull model
ollama pull mistral

# 3. Start server
ollama serve

# 4. Verify
curl http://localhost:11434/api/tags
```

## 📊 Service Status

| Indicator | Meaning |
|-----------|---------|
| 🔵 | Trying Nvidia API |
| 🟢 | Trying Ollama fallback |
| ✅ | Success |
| ⚠️ | Warning/Error |
| ❌ | Complete failure |

## 🔍 Common Issues

**"NVIDIA_API_KEY not set"**
→ Create `.env` file with your API key

**"Ollama connection error"**
→ Run `ollama serve` in another terminal

**"Both services failed"**
→ Check API key AND start Ollama

## 📁 Important Files

```
whisper-server/
├── server.py          # Main server
├── .env               # Your config (create this!)
├── .env.example       # Template
├── start-server.bat   # Quick start
├── README.md          # Full docs
└── QUICKSTART.md      # 3-min setup
```

## 🌐 Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Status check |
| `/transcribe` | POST | Audio → text |
| `/enhance` | POST | Text enhancement |
| `/models` | GET | List Whisper models |

## ⚙️ Environment Variables

```bash
NVIDIA_API_KEY=nvapi-...        # Required for Nvidia
OLLAMA_URL=http://localhost:11434  # Optional
OLLAMA_MODEL=mistral            # Optional
WHISPER_MODEL=base              # Optional
PORT=5555                       # Optional
```

## 🎯 Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success (Nvidia or Ollama) |
| 400 | Bad request (missing text) |
| 503 | Both services failed |

## 💡 Pro Tips

✅ Use `.env` file for persistent config  
✅ Keep Ollama running for reliable fallback  
✅ Monitor console logs for service usage  
✅ Test both services independently  
✅ Use `base` Whisper model for best balance  

## 🆘 Get Help

- Full docs: `README.md`
- Setup guide: `SETUP.md`
- Test guide: `TEST_FALLBACK.md`
- Flow diagrams: `FALLBACK_FLOW.md`
