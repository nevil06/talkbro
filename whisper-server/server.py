"""
TalkBro — Local Whisper Server
A lightweight Flask server that runs OpenAI Whisper for local speech-to-text.
The Chrome extension sends audio to this server for transcription.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import tempfile
import os
import sys
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

app = Flask(__name__)
CORS(app)  # Allow requests from Chrome extension

# Load model on startup (cached after first load)
MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")
print(f"[TalkBro] Loading Whisper model: {MODEL_SIZE}...")
model = whisper.load_model(MODEL_SIZE)
print(f"[TalkBro] Whisper model '{MODEL_SIZE}' loaded successfully!")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 1. Look specifically in the 'model' subdirectory
LLM_DIR = os.path.join(BASE_DIR, "model")

print(f"[TalkBro] Checking for local DeepSeek/Qwen model in: {LLM_DIR}")

LLM_AVAILABLE = False
tokenizer = None
llm_model = None

try:
    if not os.path.exists(os.path.join(LLM_DIR, "config.json")):
        raise FileNotFoundError(f"Missing config.json in {LLM_DIR}. You must place all HuggingFace model files (tokenizer.json, config.json, model.safetensors, etc.) into the 'model' subfolder.")
    
    # 2. Setup Device (Forced to CPU and float32 per request)
    print(f"[TalkBro] Loading tokenizer from {LLM_DIR}...")
    tokenizer = AutoTokenizer.from_pretrained(LLM_DIR, local_files_only=True)
    
    print(f"[TalkBro] Loading LLM from {LLM_DIR} to CPU (this may take a moment)...")
    llm_model = AutoModelForCausalLM.from_pretrained(
        LLM_DIR, 
        local_files_only=True,
        torch_dtype=torch.float32, 
        device_map="cpu",
        low_cpu_mem_usage=True
    )
        
    print("[TalkBro] ✅ Local LLM loaded successfully and is ready for text enhancement!")
    LLM_AVAILABLE = True
except Exception as e:
    print("\n[TalkBro] ❌ ERROR: Could not load local LLM. Detailed error below:")
    print("-" * 50)
    import traceback
    traceback.print_exc()
    print("-" * 50)
    print(f"Please ensure you have placed all necessary Hugging Face model files in the '{LLM_DIR}' directory.\n")
    LLM_AVAILABLE = False

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "model": MODEL_SIZE,
        "model_loaded": LLM_AVAILABLE,
        "service": "TalkBro Whisper Server"
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
    """Enhance text using the local LLM."""
    if not LLM_AVAILABLE:
        print("[TalkBro] Request to /enhance denied: Local LLM is not loaded.")
        return jsonify({"error": "Local LLM is not loaded. Please check the server console for startup errors."}), 503

    data = request.json
    if not data or "text" not in data:
        return jsonify({"error": "No text provided"}), 400

    system_prompt = data.get("systemPrompt", "You are a helpful assistant.")
    user_text = data.get("text", "")

    print(f"[TalkBro] Enhancing text using local LLM (Input length: {len(user_text)} characters)...")

    # Format prompt (simple context format, adjust depending on exact model family: Qwen/DeepSeek/Llama)
    prompt = f"<|im_start|>system\n{system_prompt}<|im_end|>\n<|im_start|>user\n{user_text}<|im_end|>\n<|im_start|>assistant\n"
    
    try:
        # Determine device where the model is loaded
        device = next(llm_model.parameters()).device
        inputs = tokenizer(prompt, return_tensors="pt").to(device)
        
        # Generation kwargs
        generate_kwargs = {
            "max_new_tokens": 1024,
            "temperature": 0.3,
            "do_sample": True,
        }
        
        # Gracefully handle EOS/PAD tokens
        if tokenizer.pad_token_id is not None:
            generate_kwargs["pad_token_id"] = tokenizer.pad_token_id
        elif tokenizer.eos_token_id is not None:
            generate_kwargs["pad_token_id"] = tokenizer.eos_token_id

        outputs = llm_model.generate(**inputs, **generate_kwargs)
        
        # Decode only the generated response
        generated_tokens = outputs[0][inputs.input_ids.shape[1]:]
        response_text = tokenizer.decode(generated_tokens, skip_special_tokens=True).strip()

        print("[TalkBro] Enhancement complete!")
        return jsonify({
            "success": True,
            "enhanced_text": response_text
        })
    except Exception as e:
        print(f"[TalkBro] ❌ Inference Error during /enhance: {e}")
        return jsonify({"error": f"LLM Inference failed: {str(e)}"}), 500


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
