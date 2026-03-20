# 🔄 Fallback System Flow Diagram

## Visual Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    /enhance Endpoint                         │
│                  Receives: text + systemPrompt               │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ NVIDIA_API_KEY │
                    │   configured?  │
                    └────────┬───────┘
                             │
                ┌────────────┴────────────┐
                │ YES                     │ NO
                ▼                         ▼
    ┌───────────────────────┐    ┌──────────────────┐
    │  TRY: Nvidia DeepSeek │    │ Skip to Ollama   │
    │  🔵 Primary Service   │    │ (no API key)     │
    └───────────┬───────────┘    └────────┬─────────┘
                │                          │
                ▼                          │
    ┌───────────────────────┐             │
    │  POST to Nvidia API   │             │
    │  Timeout: 30 seconds  │             │
    └───────────┬───────────┘             │
                │                          │
    ┌───────────┴───────────┐             │
    │ SUCCESS?              │             │
    └───────────┬───────────┘             │
                │                          │
    ┌───────────┴───────────┐             │
    │ YES                   │ NO          │
    ▼                       ▼             │
┌─────────────┐    ┌──────────────┐      │
│ ✅ Return   │    │ Log error:   │      │
│ enhanced    │    │ • Timeout    │      │
│ text from   │    │ • 401/403    │      │
│ Nvidia      │    │ • Network    │      │
│             │    │ • Empty resp │      │
│ provider:   │    └──────┬───────┘      │
│ "nvidia"    │           │              │
└─────────────┘           │              │
                          │              │
                          ▼              │
              ┌───────────────────────┐  │
              │  FALLBACK: Try Ollama │◄─┘
              │  🟢 Secondary Service │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  POST to Ollama API   │
              │  Timeout: 60 seconds  │
              │  Model: mistral       │
              └───────────┬───────────┘
                          │
              ┌───────────┴───────────┐
              │ SUCCESS?              │
              └───────────┬───────────┘
                          │
              ┌───────────┴───────────┐
              │ YES                   │ NO
              ▼                       ▼
      ┌─────────────┐        ┌──────────────┐
      │ ✅ Return   │        │ Log error:   │
      │ enhanced    │        │ • Timeout    │
      │ text from   │        │ • Connection │
      │ Ollama      │        │ • Not running│
      │             │        │ • No model   │
      │ provider:   │        └──────┬───────┘
      │ "ollama"    │               │
      │ note: why   │               │
      │ fallback    │               │
      └─────────────┘               │
                                    ▼
                        ┌───────────────────────┐
                        │ ❌ BOTH FAILED        │
                        │ Return HTTP 503       │
                        │ with detailed error:  │
                        │ • Nvidia error        │
                        │ • Ollama error        │
                        │ • Troubleshooting     │
                        └───────────────────────┘
```

## Decision Tree

```
Request arrives
    │
    ├─ Has NVIDIA_API_KEY?
    │   ├─ YES → Try Nvidia (30s timeout)
    │   │   ├─ Success → Return (provider: nvidia)
    │   │   └─ Fail → Continue to Ollama
    │   │
    │   └─ NO → Skip to Ollama
    │
    └─ Try Ollama (60s timeout)
        ├─ Success → Return (provider: ollama)
        └─ Fail → Return 503 error with details
```

## Response Examples

### ✅ Success via Nvidia (Primary)
```json
{
  "success": true,
  "enhanced_text": "I was thinking we should do the thing.",
  "provider": "nvidia"
}
```

### ✅ Success via Ollama (Fallback)
```json
{
  "success": true,
  "enhanced_text": "I was thinking we should do the thing.",
  "provider": "ollama",
  "model": "mistral",
  "note": "Nvidia API failed (HTTP 401: Unauthorized), used Ollama fallback"
}
```

### ❌ Both Failed
```json
{
  "success": false,
  "error": "Text enhancement failed. Both services are unavailable:\n\n• Nvidia API: HTTP 401: Unauthorized\n• Ollama: Connection failed - is Ollama running?\n\nTroubleshooting:\n1. Check your NVIDIA_API_KEY environment variable\n2. Ensure Ollama is running: 'ollama serve'\n3. Verify Ollama has the 'mistral' model: 'ollama pull mistral'\n4. Check your internet connection for Nvidia API",
  "details": {
    "nvidia": "HTTP 401: Unauthorized",
    "ollama": "Connection failed - is Ollama running?"
  }
}
```

## Console Logging Examples

### Scenario 1: Nvidia Success
```
[TalkBro] Enhancing text (Input length: 58 characters)...
[TalkBro] 🔵 Attempting Nvidia DeepSeek API...
[TalkBro] ✅ Enhancement complete via Nvidia DeepSeek API
```

### Scenario 2: Nvidia Fails → Ollama Success
```
[TalkBro] Enhancing text (Input length: 58 characters)...
[TalkBro] 🔵 Attempting Nvidia DeepSeek API...
[TalkBro] ⚠️  Nvidia API error: HTTP 401: Unauthorized
[TalkBro] 🟢 Falling back to Ollama (mistral)...
[TalkBro] ✅ Enhancement complete via Ollama (mistral)
```

### Scenario 3: Both Fail
```
[TalkBro] Enhancing text (Input length: 58 characters)...
[TalkBro] 🔵 Attempting Nvidia DeepSeek API...
[TalkBro] ⚠️  Nvidia API timeout: Request timed out after 30 seconds
[TalkBro] 🟢 Falling back to Ollama (mistral)...
[TalkBro] ⚠️  Ollama connection error: Connection failed - is Ollama running?
[TalkBro] ❌ All enhancement services failed
```

## Error Handling Matrix

| Nvidia Status | Ollama Status | Result | HTTP Code |
|---------------|---------------|--------|-----------|
| ✅ Success | N/A (not tried) | Return Nvidia response | 200 |
| ❌ Timeout | ✅ Success | Return Ollama response | 200 |
| ❌ 401 Auth | ✅ Success | Return Ollama response | 200 |
| ❌ Network | ✅ Success | Return Ollama response | 200 |
| ❌ Empty | ✅ Success | Return Ollama response | 200 |
| Not configured | ✅ Success | Return Ollama response | 200 |
| ❌ Any error | ❌ Timeout | Return error details | 503 |
| ❌ Any error | ❌ Connection | Return error details | 503 |
| Not configured | ❌ Any error | Return error details | 503 |

## Timeout Strategy

| Service | Timeout | Reason |
|---------|---------|--------|
| **Nvidia API** | 30 seconds | Cloud API, should be fast (1-3s typical) |
| **Ollama** | 60 seconds | Local CPU inference can be slow (10-30s) |

## Configuration Priority

1. **Primary**: Nvidia DeepSeek API (if `NVIDIA_API_KEY` is set)
2. **Fallback**: Ollama (always attempted if primary fails)
3. **Error**: Both services unavailable (503 response)

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `NVIDIA_API_KEY` | No* | None | Nvidia API authentication |
| `OLLAMA_URL` | No | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | No | `mistral` | Ollama model to use |

*At least one service (Nvidia or Ollama) must be available for enhancement to work.

## Reliability Features

✅ **Automatic failover** - No manual intervention needed  
✅ **Detailed logging** - Know exactly what's happening  
✅ **Error transparency** - Users see why things failed  
✅ **Graceful degradation** - Works with one or both services  
✅ **Timeout protection** - Won't hang indefinitely  
✅ **Connection retry** - Each service tried independently  
✅ **Offline capability** - Ollama works without internet  

## Production Recommendations

1. **Always configure both services** for maximum reliability
2. **Monitor logs** to detect when fallback is being used frequently
3. **Set up alerts** if both services fail
4. **Keep Ollama running** as a reliable backup
5. **Use GPU for Ollama** if available for faster fallback performance
