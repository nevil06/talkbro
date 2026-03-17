# TalkBro — Voice Companion Chrome Extension

> Speak naturally, get polished text. A floating side-by-side companion powered by **OpenAI Whisper** (local) & **open-source LLMs**.

<img src="assets/icons/icon128.png" width="64" alt="TalkBro Icon">

## ✨ Features

- **🎤 One-tap voice recording** with real-time waveform visualization
- **🤖 OpenAI Whisper** running locally for accurate speech-to-text (no API key needed)
- **🧠 AI-powered text enhancement** via local HuggingFace Safetensors model (DeepSeek/Qwen)
- **📋 Instant copy** — copy raw transcript or enhanced text with one click
- **🎯 Enhancement presets** — Clean Up, Formal, Bullet Points, Email, Code Docs, Summary
- **🌗 Paper & Ink design** — clean, distraction-free aesthetic with smooth animations
- **⌨️ Keyboard shortcuts** — `Alt+T` toggle panel, `Alt+R` start/stop recording
- **🔒 Privacy-first** — everything runs locally by default
- **📜 History** — searchable history of all transcriptions in the side panel

## 🚀 Quick Start

### Step 1: Install Python (if not already installed)
Download from [python.org](https://www.python.org/downloads/) — make sure to check "Add to PATH" during install.

### Step 2: Download the Local LLM Model
You must manually download a HuggingFace model (e.g., DeepSeek 1.5B or Qwen) and place **all** necessary files into `talkbro/whisper-server/model/`:
- `model.safetensors`
- `config.json`
- `tokenizer.json`
- `tokenizer_config.json`

### Step 3: Start the Whisper + LLM Server
Double-click the **`Run TalkBro.bat`** file located in the main `talkbro` folder.
Alternatively, manually:
```bash
cd talkbro/whisper-server
call venv\Scripts\activate.bat
pip install -r requirements.txt
python server.py
```
You should see: `✅ Local LLM loaded successfully and is ready for text enhancement!`

> **⚠️ Performance Note (CPU Limitations):**
> Currently, the local LLM runs entirely on your CPU to ensure maximum offline compatibility and zero configuration. **Enhancement will be slow** (~15-30+ seconds depending on your processor). However, it runs completely offline and privately.
> 
> **💡 Recommended Upgrade:** For significantly faster generation speeds, integrating **Ollama** running the `mistral` model is highly recommended. You can easily switch to an Ollama backend tomorrow by modifying the service worker to point to `localhost:11434`.

### Step 4: Load the Extension in Chrome
1. Open Chrome → `chrome://extensions`
2. Enable **Developer Mode** (top-right)
3. Click **Load unpacked** → select the `talkbro/` folder
4. TalkBro icon appears in your toolbar ✅

### Step 5: Use It!
1. Go to any website
2. Click the **TalkBro pill** (bottom-right) or press `Alt+T`
3. Press the **mic button** or `Alt+R` — speak naturally
4. Wait for Whisper + LLM to process (~3-5 seconds)
5. Click 📋 **Copy** on the enhanced text card

## 🏗️ Architecture

```
User speaks → MediaRecorder captures audio
            → Local Python Server (localhost:5555)
              ├── Whisper transcribes audio
              └── HuggingFace Transformers enhances text
            → Floating panel shows result with copy button
```

### Components

| Component | Path | Purpose |
|---|---|---|
| **Python API Server** | `whisper-server/` | Runs OpenAI Whisper and local HuggingFace LLM |
| Content Script | `content/inject.js` | Injects floating panel and permissions logic |
| Panel UI | `content/panel.*` | Recording, waveform, results, copy, drag |
| Service Worker | `background/` | Message routing to localhost:5555 |
| Options | `options/` | Permissions management and UI presets |
| Recorder | `lib/recorder.js` | MediaRecorder + silence detection |

## ⚙️ Settings

| Setting | Options | Default |
|---|---|---|
| Enhancement Preset | Clean, Formal, Bullets, Email, Code, Summary | Clean |
| Silence Timeout | 1-10 seconds | 2s |
| Disabled Sites | Managed via Context Menu / Options page | None |

### Change Whisper Model Size
```bash
# Set model before starting server (default: base)
set WHISPER_MODEL=small
python server.py

# Available: tiny (fastest), base (default), small, medium, large (best)
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+T` | Toggle panel |
| `Alt+R` | Start/Stop recording |

## 📝 License

MIT
