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

app = Flask(__name__)
CORS(app)  # Allow requests from Chrome extension

# Load model on startup (cached after first load)
MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")
print(f"[TalkBro] Loading Whisper model: {MODEL_SIZE}...")
model = whisper.load_model(MODEL_SIZE)
print(f"[TalkBro] Whisper model '{MODEL_SIZE}' loaded successfully!")


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "model": MODEL_SIZE,
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


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5555))
    print(f"[TalkBro] Whisper server running at http://localhost:{port}")
    print(f"[TalkBro] Model: {MODEL_SIZE}")
    print(f"[TalkBro] Endpoints:")
    print(f"           POST /transcribe  - Send audio for transcription")
    print(f"           GET  /health      - Health check")
    print(f"           GET  /models      - List available models")
    app.run(host="0.0.0.0", port=port, debug=False)
