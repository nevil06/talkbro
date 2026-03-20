# 🔧 Troubleshooting Guide

## ❌ "Cannot find LLM" or "Cannot connect to server"

This error means the TalkBro Python server is not running.

### ✅ Solution

**Step 1: Open a terminal in the whisper-server folder**
```bash
cd whisper-server
```

**Step 2: Set your API key (Windows)**

**Option A: Command Prompt**
```cmd
set NVIDIA_API_KEY=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
```

**Option B: PowerShell**
```powershell
$env:NVIDIA_API_KEY="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"
```

**Option C: Use .env file (Best)**
```cmd
copy .env.example .env
notepad .env
REM Add: NVIDIA_API_KEY=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
```

**Step 3: Start the server**
```bash
python server.py
```

**Step 4: Verify it's running**

You should see:
```
============================================================
TEXT ENHANCEMENT CONFIGURATION
============================================================
✅ Nvidia DeepSeek API: Configured (Primary)
   API Key: nvapi-aFm7c5YL...Dw6F

🔄 Ollama Fallback: http://localhost:11434
   Model: mistral
   Status: Will be used if Nvidia API fails
============================================================

[TalkBro] Whisper server running at http://localhost:5555
```

**Step 5: Test it**

Open http://localhost:5555/health in your browser.

You should see:
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
      "available": false,
      "status": "fallback"
    }
  }
}
```

---

## ❌ "Text enhancement failed. Both services are unavailable"

This means both Nvidia API and Ollama failed.

### ✅ Solution

**Check 1: Nvidia API Key**
```bash
# Make sure your API key is set
echo %NVIDIA_API_KEY%  # Command Prompt
echo $env:NVIDIA_API_KEY  # PowerShell
```

If empty, set it:
```bash
set NVIDIA_API_KEY=nvapi-your-key-here
```

**Check 2: Internet Connection**
- Nvidia API requires internet
- Try opening https://build.nvidia.com/ in your browser
- Check if you're behind a firewall/proxy

**Check 3: Install Ollama (Fallback)**
```bash
# 1. Download from https://ollama.ai/
# 2. Install it
# 3. Pull the model
ollama pull mistral

# 4. Start Ollama
ollama serve

# 5. Verify
curl http://localhost:11434/api/tags
```

**Check 4: Restart the server**
```bash
# Stop the server (Ctrl+C)
# Start it again
python server.py
```

---

## ❌ "Nvidia API error: HTTP 401: Unauthorized"

Your API key is invalid or expired.

### ✅ Solution

1. Go to https://build.nvidia.com/
2. Sign in
3. Navigate to API Keys
4. Check if your key is still valid
5. If expired, generate a new one
6. Update your `.env` file or environment variable
7. Restart the server

---

## ❌ "Ollama connection error"

Ollama is not running.

### ✅ Solution

**Step 1: Install Ollama**
- Download from https://ollama.ai/
- Install it

**Step 2: Pull the model**
```bash
ollama pull mistral
```

**Step 3: Start Ollama**
```bash
ollama serve
```

**Step 4: Verify**
```bash
curl http://localhost:11434/api/tags
```

You should see a list of installed models including `mistral`.

**Step 5: Restart TalkBro server**
```bash
python server.py
```

---

## ❌ "Port 5555 is already in use"

Another process is using port 5555.

### ✅ Solution

**Option A: Use a different port**
```bash
set PORT=8080
python server.py
```

Then update the Chrome extension to use port 8080 (edit `background/service-worker.js`).

**Option B: Kill the process using port 5555**

**Windows Command Prompt:**
```cmd
netstat -ano | findstr :5555
taskkill /PID <PID> /F
```

**Windows PowerShell:**
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 5555).OwningProcess | Stop-Process -Force
```

---

## ❌ "ModuleNotFoundError: No module named 'whisper'"

Dependencies not installed.

### ✅ Solution

```bash
cd whisper-server
pip install -r requirements.txt
```

If that fails:
```bash
pip install openai-whisper flask flask-cors requests python-dotenv
```

---

## ❌ Server starts but enhancement is very slow (30+ seconds)

You're using Ollama on CPU without Nvidia API.

### ✅ Solution

**Option A: Configure Nvidia API (Fast)**
```bash
# Set your API key
set NVIDIA_API_KEY=nvapi-your-key-here
# Restart server
python server.py
```

**Option B: Use GPU for Ollama**
- Install CUDA toolkit
- Ollama will automatically use GPU
- Much faster (2-5 seconds instead of 30)

**Option C: Use a smaller Ollama model**
```bash
set OLLAMA_MODEL=phi
ollama pull phi
python server.py
```

---

## ❌ Chrome extension shows "Cannot connect to TalkBro server"

### ✅ Solution

**Check 1: Is the server running?**
```bash
curl http://localhost:5555/health
```

If this fails, start the server:
```bash
cd whisper-server
python server.py
```

**Check 2: Check the port**
- Server default: `http://localhost:5555`
- Extension expects: `http://localhost:5555`
- Make sure they match

**Check 3: Check CORS**
- The server has CORS enabled by default
- If you modified `server.py`, make sure `CORS(app)` is present

**Check 4: Reload the extension**
1. Go to `chrome://extensions`
2. Find TalkBro
3. Click the reload icon
4. Try again

---

## ❌ "Whisper model download is stuck"

### ✅ Solution

**Option 1: Use a smaller model**
```bash
set WHISPER_MODEL=tiny
python server.py
```

**Option 2: Download manually**
```bash
# In Python
import whisper
whisper.load_model("base")
```

**Option 3: Check internet connection**
- Whisper downloads from OpenAI servers
- Check if you can access https://openaipublic.azureedge.net/

---

## 🆘 Still Having Issues?

### Check the logs

The server prints detailed logs. Look for:
- 🔵 Nvidia API attempts
- 🟢 Ollama fallback attempts
- ⚠️ Warnings
- ❌ Errors

### Test each component separately

**Test Nvidia API:**
```bash
curl -X POST http://localhost:5555/enhance \
  -H "Content-Type: application/json" \
  -d '{"text":"test","systemPrompt":"Clean this up"}'
```

**Test Ollama:**
```bash
curl -X POST http://localhost:11434/api/generate \
  -d '{"model":"mistral","prompt":"Say hello"}'
```

**Test Whisper:**
```bash
# Record a short audio file, then:
curl -X POST http://localhost:5555/transcribe \
  -F "file=@test.webm"
```

### Common Issues Checklist

- [ ] Python server is running
- [ ] Port 5555 is accessible
- [ ] NVIDIA_API_KEY is set (or Ollama is running)
- [ ] Internet connection works
- [ ] Dependencies are installed
- [ ] Chrome extension is loaded
- [ ] No firewall blocking localhost:5555

### Get More Help

- Read: `whisper-server/README.md`
- Quick start: `whisper-server/QUICKSTART.md`
- Test guide: `whisper-server/TEST_FALLBACK.md`
- Flow diagrams: `whisper-server/FALLBACK_FLOW.md`

---

## 📝 Quick Commands Reference

**Start server:**
```bash
cd whisper-server
python server.py
```

**Set API key (Windows):**
```cmd
set NVIDIA_API_KEY=nvapi-your-key-here
```

**Test server:**
```bash
curl http://localhost:5555/health
```

**Start Ollama:**
```bash
ollama serve
```

**Check what's using port 5555:**
```cmd
netstat -ano | findstr :5555
```
