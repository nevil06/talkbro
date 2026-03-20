"""
TalkBro — Local Whisper Server
A lightweight Flask server that runs OpenAI Whisper for local speech-to-text
and uses Nvidia's DeepSeek API for text enhancement.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import tempfile
import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # Allow requests from Chrome extension

# Load Whisper model on startup (cached after first load)
MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")
print(f"[TalkBro] Loading Whisper model: {MODEL_SIZE}...")
model = whisper.load_model(MODEL_SIZE)
print(f"[TalkBro] Whisper model '{MODEL_SIZE}' loaded successfully!")

# Nvidia API configuration
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY")
NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

# Ollama configuration (fallback)
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "mistral")

# Print configuration status
print("\n" + "="*60)
print("TEXT ENHANCEMENT CONFIGURATION")
print("="*60)

if NVIDIA_API_KEY:
    print("✅ Nvidia DeepSeek API: Configured (Primary)")
    print(f"   API Key: {NVIDIA_API_KEY[:15]}...{NVIDIA_API_KEY[-4:]}")
else:
    print("⚠️  Nvidia DeepSeek API: Not configured")
    print("   Set NVIDIA_API_KEY environment variable to enable")

print(f"\n🔄 Ollama Fallback: {OLLAMA_URL}")
print(f"   Model: {OLLAMA_MODEL}")
print(f"   Status: Will be used if Nvidia API fails")

if not NVIDIA_API_KEY:
    print("\n⚠️  WARNING: No primary LLM configured!")
    print("   Text enhancement will only work if Ollama is running.")
    print("   Start Ollama: 'ollama serve'")
    print(f"   Pull model: 'ollama pull {OLLAMA_MODEL}'")

print("="*60 + "\n")

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint with service status."""
    # Check Ollama availability
    ollama_available = False
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=2)
        ollama_available = response.ok
    except:
        pass
    
    return jsonify({
        "status": "ok",
        "whisper_model": MODEL_SIZE,
        "service": "TalkBro Whisper Server",
        "enhancement": {
            "nvidia": {
                "configured": bool(NVIDIA_API_KEY),
                "status": "primary" if NVIDIA_API_KEY else "not_configured"
            },
            "ollama": {
                "url": OLLAMA_URL,
                "model": OLLAMA_MODEL,
                "available": ollama_available,
                "status": "fallback" if NVIDIA_API_KEY else "primary"
            }
        }
    })


@app.route("/transcribe", methods=["POST"])
def transcribe():
    """
    Transcribe audio to text.
    Accepts audio file via multipart form data.
    """
    if "file" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["file"]

    # Save to temp file (Whisper needs a file path)
    suffix = ".webm"
    if audio_file.filename:
        _, ext = os.path.splitext(audio_file.filename)
        if ext:
            suffix = ext

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        # Transcribe with Whisper
        result = model.transcribe(
            tmp_path,
            language="en",      # Force English for speed; remove for auto-detect
            fp16=False          # Use fp32 for CPU compatibility
        )

        text = result.get("text", "").strip()
        language = result.get("language", "en")
        segments = result.get("segments", [])

        return jsonify({
            "success": True,
            "text": text,
            "language": language,
            "segments": [
                {
                    "start": s["start"],
                    "end": s["end"],
                    "text": s["text"].strip()
                }
                for s in segments
            ]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.route("/models", methods=["GET"])
def list_models():
    """List available Whisper model sizes."""
    return jsonify({
        "current": MODEL_SIZE,
        "available": ["tiny", "base", "small", "medium", "large"],
        "descriptions": {
            "tiny": "~39 MB - Fastest, lowest accuracy",
            "base": "~74 MB - Good balance (default)",
            "small": "~244 MB - Better accuracy",
            "medium": "~769 MB - High accuracy",
            "large": "~1550 MB - Best accuracy, slow"
        }
    })


@app.route("/enhance", methods=["POST"])
def enhance():
    """
    Enhance text using Nvidia's DeepSeek API with Ollama fallback.
    Tries Nvidia first, falls back to local Ollama if it fails.
    """
    data = request.json
    if not data or "text" not in data:
        return jsonify({"error": "No text provided"}), 400

    system_prompt = data.get("systemPrompt", "You are a helpful assistant.")
    user_text = data.get("text", "")

    print(f"[TalkBro] Enhancing text (Input length: {len(user_text)} characters)...")

    # Track which services we've tried
    nvidia_error = None
    ollama_error = None

    # ═══════════════════════════════════════════════════
    # TRY 1: Nvidia DeepSeek API (Primary)
    # ═══════════════════════════════════════════════════
    if NVIDIA_API_KEY:
        print("[TalkBro] 🔵 Attempting Nvidia DeepSeek API...")
        try:
            headers = {
                "Authorization": f"Bearer {NVIDIA_API_KEY}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "deepseek/deepseek-r1",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_text}
                ],
                "temperature": 0.3,
                "max_tokens": 1024,
                "stream": False
            }
            
            response = requests.post(NVIDIA_API_URL, headers=headers, json=payload, timeout=30)
            
            if response.ok:
                result = response.json()
                enhanced_text = result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                
                if enhanced_text:
                    print("[TalkBro] ✅ Enhancement complete via Nvidia DeepSeek API")
                    return jsonify({
                        "success": True,
                        "enhanced_text": enhanced_text,
                        "provider": "nvidia"
                    })
                else:
                    nvidia_error = "Empty response from Nvidia API"
                    print(f"[TalkBro] ⚠️  Nvidia API returned empty response")
            else:
                # Extract error message
                try:
                    error_data = response.json()
                    nvidia_error = error_data.get("error", {}).get("message", f"HTTP {response.status_code}")
                except:
                    nvidia_error = f"HTTP {response.status_code}: {response.text[:100]}"
                
                print(f"[TalkBro] ⚠️  Nvidia API error: {nvidia_error}")
        
        except requests.exceptions.Timeout:
            nvidia_error = "Request timed out after 30 seconds"
            print(f"[TalkBro] ⚠️  Nvidia API timeout: {nvidia_error}")
        
        except requests.exceptions.ConnectionError as e:
            nvidia_error = f"Connection failed: {str(e)[:100]}"
            print(f"[TalkBro] ⚠️  Nvidia API connection error: {nvidia_error}")
        
        except Exception as e:
            nvidia_error = f"Unexpected error: {str(e)[:100]}"
            print(f"[TalkBro] ⚠️  Nvidia API unexpected error: {nvidia_error}")
    else:
        nvidia_error = "NVIDIA_API_KEY not configured"
        print("[TalkBro] ⚠️  Nvidia API key not set, skipping...")

    # ═══════════════════════════════════════════════════
    # TRY 2: Ollama Fallback (Secondary)
    # ═══════════════════════════════════════════════════
    print("[TalkBro] 🟢 Falling back to Ollama (mistral)...")
    
    ollama_url = os.environ.get("OLLAMA_URL", "http://localhost:11434")
    ollama_model = os.environ.get("OLLAMA_MODEL", "mistral")
    
    try:
        # Combine system prompt and user text for Ollama's generate endpoint
        combined_prompt = f"{system_prompt}\n\nText to enhance:\n{user_text}\n\nEnhanced text:"
        
        payload = {
            "model": ollama_model,
            "prompt": combined_prompt,
            "stream": False,
            "options": {
                "temperature": 0.3,
                "num_predict": 1024
            }
        }
        
        response = requests.post(
            f"{ollama_url}/api/generate",
            json=payload,
            timeout=60  # Ollama can be slower on CPU
        )
        
        if response.ok:
            result = response.json()
            enhanced_text = result.get("response", "").strip()
            
            if enhanced_text:
                print(f"[TalkBro] ✅ Enhancement complete via Ollama ({ollama_model})")
                return jsonify({
                    "success": True,
                    "enhanced_text": enhanced_text,
                    "provider": "ollama",
                    "model": ollama_model,
                    "note": f"Nvidia API failed ({nvidia_error}), used Ollama fallback"
                })
            else:
                ollama_error = "Empty response from Ollama"
                print(f"[TalkBro] ⚠️  Ollama returned empty response")
        else:
            try:
                error_data = response.json()
                ollama_error = error_data.get("error", f"HTTP {response.status_code}")
            except:
                ollama_error = f"HTTP {response.status_code}: {response.text[:100]}"
            
            print(f"[TalkBro] ⚠️  Ollama error: {ollama_error}")
    
    except requests.exceptions.Timeout:
        ollama_error = "Request timed out after 60 seconds"
        print(f"[TalkBro] ⚠️  Ollama timeout: {ollama_error}")
    
    except requests.exceptions.ConnectionError as e:
        ollama_error = f"Connection failed - is Ollama running? ({str(e)[:100]})"
        print(f"[TalkBro] ⚠️  Ollama connection error: {ollama_error}")
    
    except Exception as e:
        ollama_error = f"Unexpected error: {str(e)[:100]}"
        print(f"[TalkBro] ⚠️  Ollama unexpected error: {ollama_error}")

    # ═══════════════════════════════════════════════════
    # BOTH FAILED - Return Detailed Error
    # ═══════════════════════════════════════════════════
    print("[TalkBro] ❌ All enhancement services failed")
    
    error_details = {
        "nvidia": nvidia_error,
        "ollama": ollama_error
    }
    
    # Build helpful error message
    error_message = "Text enhancement failed. Both services are unavailable:\n\n"
    
    if nvidia_error:
        error_message += f"• Nvidia API: {nvidia_error}\n"
    
    if ollama_error:
        error_message += f"• Ollama: {ollama_error}\n"
    
    error_message += "\nTroubleshooting:\n"
    error_message += "1. Check your NVIDIA_API_KEY environment variable\n"
    error_message += "2. Ensure Ollama is running: 'ollama serve'\n"
    error_message += f"3. Verify Ollama has the '{ollama_model}' model: 'ollama pull {ollama_model}'\n"
    error_message += "4. Check your internet connection for Nvidia API"
    
    return jsonify({
        "success": False,
        "error": error_message,
        "details": error_details
    }), 503


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5555))
    print(f"[TalkBro] Whisper server running at http://localhost:{port}")
    print(f"[TalkBro] Model: {MODEL_SIZE}")
    print(f"[TalkBro] Endpoints:")
    print(f"           POST /transcribe  - Send audio for transcription")
    print(f"           POST /enhance     - Enhance text using local LLM")
    print(f"           GET  /health      - Health check")
    print(f"           GET  /models      - List available models")
    app.run(host="0.0.0.0", port=port, debug=False)
