# 🧪 Testing the Fallback System

This guide shows you how to test the Nvidia → Ollama fallback logic.

## Prerequisites

1. **Install Ollama** (for fallback testing):
   ```bash
   # Download from: https://ollama.ai/
   # Or on Windows with winget:
   winget install Ollama.Ollama
   ```

2. **Pull the Mistral model**:
   ```bash
   ollama pull mistral
   ```

3. **Start Ollama**:
   ```bash
   ollama serve
   ```

## Test Scenarios

### ✅ Scenario 1: Nvidia API Works (Primary)

**Setup:**
```bash
# Set valid Nvidia API key
set NVIDIA_API_KEY=nvapi-your-valid-key-here
python server.py
```

**Expected Output:**
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
```

**Test Request:**
```powershell
$body = @{
    text = "um so like I was thinking we should maybe uh do the thing"
    systemPrompt = "Clean up this text and fix grammar."
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5555/enhance" -Method Post -Body $body -ContentType "application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "enhanced_text": "I was thinking we should do the thing.",
  "provider": "nvidia"
}
```

**Console Output:**
```
[TalkBro] Enhancing text (Input length: 58 characters)...
[TalkBro] 🔵 Attempting Nvidia DeepSeek API...
[TalkBro] ✅ Enhancement complete via Nvidia DeepSeek API
```

---

### 🔄 Scenario 2: Nvidia Fails → Ollama Fallback

**Setup:**
```bash
# Set invalid or no API key
set NVIDIA_API_KEY=invalid-key
# OR don't set it at all
python server.py
```

**Expected Output:**
```
============================================================
TEXT ENHANCEMENT CONFIGURATION
============================================================
✅ Nvidia DeepSeek API: Configured (Primary)
   API Key: invalid-key...

🔄 Ollama Fallback: http://localhost:11434
   Model: mistral
   Status: Will be used if Nvidia API fails
============================================================
```

**Test Request:** (same as above)

**Expected Response:**
```json
{
  "success": true,
  "enhanced_text": "I was thinking we should do the thing.",
  "provider": "ollama",
  "model": "mistral",
  "note": "Nvidia API failed (HTTP 401: Unauthorized), used Ollama fallback"
}
```

**Console Output:**
```
[TalkBro] Enhancing text (Input length: 58 characters)...
[TalkBro] 🔵 Attempting Nvidia DeepSeek API...
[TalkBro] ⚠️  Nvidia API error: HTTP 401: Unauthorized
[TalkBro] 🟢 Falling back to Ollama (mistral)...
[TalkBro] ✅ Enhancement complete via Ollama (mistral)
```

---

### ❌ Scenario 3: Both Services Fail

**Setup:**
```bash
# No API key + Ollama not running
# Don't set NVIDIA_API_KEY
# Stop Ollama if running
python server.py
```

**Expected Output:**
```
============================================================
TEXT ENHANCEMENT CONFIGURATION
============================================================
⚠️  Nvidia DeepSeek API: Not configured
   Set NVIDIA_API_KEY environment variable to enable

🔄 Ollama Fallback: http://localhost:11434
   Model: mistral
   Status: Will be used if Nvidia API fails

⚠️  WARNING: No primary LLM configured!
   Text enhancement will only work if Ollama is running.
   Start Ollama: 'ollama serve'
   Pull model: 'ollama pull mistral'
============================================================
```

**Test Request:** (same as above)

**Expected Response:**
```json
{
  "success": false,
  "error": "Text enhancement failed. Both services are unavailable:\n\n• Nvidia API: NVIDIA_API_KEY not configured\n• Ollama: Connection failed - is Ollama running?\n\nTroubleshooting:\n1. Check your NVIDIA_API_KEY environment variable\n2. Ensure Ollama is running: 'ollama serve'\n3. Verify Ollama has the 'mistral' model: 'ollama pull mistral'\n4. Check your internet connection for Nvidia API",
  "details": {
    "nvidia": "NVIDIA_API_KEY not configured",
    "ollama": "Connection failed - is Ollama running?"
  }
}
```

**Console Output:**
```
[TalkBro] Enhancing text (Input length: 58 characters)...
[TalkBro] ⚠️  Nvidia API key not set, skipping...
[TalkBro] 🟢 Falling back to Ollama (mistral)...
[TalkBro] ⚠️  Ollama connection error: Connection failed - is Ollama running?
[TalkBro] ❌ All enhancement services failed
```

---

### 🌐 Scenario 4: Nvidia Timeout → Ollama Fallback

**Setup:**
```bash
# Valid API key but simulate network issues
# You can test this by disconnecting internet temporarily
set NVIDIA_API_KEY=nvapi-your-valid-key-here
python server.py
```

**Expected Console Output:**
```
[TalkBro] Enhancing text (Input length: 58 characters)...
[TalkBro] 🔵 Attempting Nvidia DeepSeek API...
[TalkBro] ⚠️  Nvidia API timeout: Request timed out after 30 seconds
[TalkBro] 🟢 Falling back to Ollama (mistral)...
[TalkBro] ✅ Enhancement complete via Ollama (mistral)
```

---

## Health Check Testing

**Check service status:**
```powershell
Invoke-RestMethod -Uri "http://localhost:5555/health"
```

**Expected Response (all services available):**
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

**Expected Response (only Ollama available):**
```json
{
  "status": "ok",
  "whisper_model": "base",
  "service": "TalkBro Whisper Server",
  "enhancement": {
    "nvidia": {
      "configured": false,
      "status": "not_configured"
    },
    "ollama": {
      "url": "http://localhost:11434",
      "model": "mistral",
      "available": true,
      "status": "primary"
    }
  }
}
```

---

## Performance Comparison

| Service | Speed | Quality | Cost | Offline |
|---------|-------|---------|------|---------|
| **Nvidia DeepSeek** | ⚡⚡⚡ Fast (1-3s) | ⭐⭐⭐⭐⭐ Excellent | 💰 API costs | ❌ No |
| **Ollama Mistral** | 🐌 Slow (10-30s CPU) | ⭐⭐⭐⭐ Very Good | 💰 Free | ✅ Yes |

---

## Troubleshooting

### "Nvidia API error: HTTP 401"
- Your API key is invalid or expired
- Generate a new key at https://build.nvidia.com/
- Update your `.env` file or environment variable

### "Ollama connection error"
- Ollama is not running
- Start it: `ollama serve`
- Check it's running: `curl http://localhost:11434/api/tags`

### "Ollama error: model 'mistral' not found"
- Pull the model: `ollama pull mistral`
- Or use a different model: `set OLLAMA_MODEL=llama2`

### Both services work but responses are slow
- Nvidia should respond in 1-3 seconds
- Ollama on CPU can take 10-30 seconds (this is normal)
- Consider using GPU for Ollama for faster inference

---

## Custom Ollama Models

You can use different Ollama models:

```bash
# Use a smaller, faster model
set OLLAMA_MODEL=phi
ollama pull phi

# Use a larger, more capable model
set OLLAMA_MODEL=llama2:13b
ollama pull llama2:13b

# Use a code-focused model
set OLLAMA_MODEL=codellama
ollama pull codellama
```

Then restart the server.

---

## Production Recommendations

1. **Always configure Nvidia API** for best performance
2. **Keep Ollama running** as a reliable fallback
3. **Monitor logs** to see which service is being used
4. **Set up alerts** if both services fail frequently
5. **Use GPU** for Ollama if available for faster fallback

---

## Summary

The fallback system ensures your TalkBro extension keeps working even if:
- ❌ Nvidia API is down
- ❌ API key expires
- ❌ Network connection fails
- ❌ Rate limits are hit

Ollama provides a reliable local fallback that works offline! 🎉
