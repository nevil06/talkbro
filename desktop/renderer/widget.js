/**
 * TalkBro Desktop — Widget Logic
 * Handles recording, on-device Whisper transcription, and text insertion.
 */

// ── State ─────────────────────────────────────────────
let recording = false;
let processing = false;
let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;
let analyser = null;
let stream = null;
let silenceTimer = null;
let animFrame = null;
let whisperPipeline = null;
let isModelLoading = false;
let settings = {};

// ── DOM ───────────────────────────────────────────────
const widget = document.getElementById('widget');
const micBtn = document.getElementById('mic-btn');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('status-text');
const waveform = document.getElementById('waveform');
const waveCtx = waveform.getContext('2d');

// ── Init ──────────────────────────────────────────────
async function init() {
  settings = await window.talkbro.getSettings();
  console.log('[TalkBro Widget] Initialized with settings:', settings);

  // Pre-load whisper model in background
  loadWhisperModel(settings.whisperModel || 'tiny');
}

init();

// ══════════════════════════════════════════════════════
// ██ WHISPER MODEL LOADING ██
// ══════════════════════════════════════════════════════

async function loadWhisperModel(modelSize) {
  if (whisperPipeline || isModelLoading) return;
  isModelLoading = true;

  setStatus('Loading Whisper model...', 'processing');

  try {
    // Dynamic import of Transformers.js
    const transformersPath = await window.talkbro.getTransformersPath();
    const { pipeline, env } = await import(`file://${transformersPath}/transformers.min.js`);

    // Configure WASM paths
    env.backends.onnx.wasm.wasmPaths = `file://${transformersPath}/`;
    env.allowRemoteModels = true;
    env.useBrowserCache = true;

    const modelId = `onnx-community/whisper-${modelSize}`;

    whisperPipeline = await pipeline('automatic-speech-recognition', modelId, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p) => {
        if (p.status === 'progress') {
          setStatus(`Downloading: ${Math.round(p.progress || 0)}%`, 'processing');
        }
      }
    });

    isModelLoading = false;
    setStatus('Ready — click mic or Ctrl+Shift+V', 'idle');
    setTimeout(() => hideStatus(), 3000);

    console.log(`[TalkBro Widget] Whisper ${modelSize} loaded successfully`);
  } catch (err) {
    isModelLoading = false;
    setStatus('Model load failed', 'idle');
    console.error('[TalkBro Widget] Model load error:', err);
  }
}

// ══════════════════════════════════════════════════════
// ██ RECORDING ██
// ══════════════════════════════════════════════════════

async function startRecording() {
  if (recording || processing) return;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 }
    });

    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';
    mediaRecorder = new MediaRecorder(stream, { mimeType });
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.start(100);
    recording = true;

    setState('recording');
    setStatus('Listening...', 'recording');
    showWaveform();
    startSilenceDetection();

    // Expand widget to show waveform
    window.talkbro.resizeWidget(220, 120);

    console.log('[TalkBro Widget] Recording started');
  } catch (err) {
    setStatus('Mic access denied', 'idle');
    console.error('[TalkBro Widget] Mic error:', err);
  }
}

async function stopRecording() {
  if (!recording) return;
  recording = false;

  if (animFrame) cancelAnimationFrame(animFrame);
  if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }

  const blob = await new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') { resolve(null); return; }
    mediaRecorder.onstop = () => resolve(new Blob(audioChunks, { type: mediaRecorder.mimeType }));
    mediaRecorder.stop();
  });

  if (stream) stream.getTracks().forEach(t => t.stop());
  if (audioContext) audioContext.close();
  audioContext = null;
  analyser = null;

  hideWaveform();
  window.talkbro.resizeWidget(72, 72);

  if (blob && blob.size > 0) {
    await processAudio(blob);
  } else {
    setState('idle');
    setStatus('No speech detected', 'idle');
    setTimeout(() => hideStatus(), 2000);
  }
}

// ══════════════════════════════════════════════════════
// ██ TRANSCRIPTION ██
// ══════════════════════════════════════════════════════

async function processAudio(blob) {
  setState('processing');
  setStatus('Transcribing...', 'processing');

  try {
    if (!whisperPipeline) {
      await loadWhisperModel(settings.whisperModel || 'tiny');
      if (!whisperPipeline) throw new Error('Model not loaded');
    }

    // Convert blob → Float32Array at 16kHz
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new OfflineAudioContext(1, 16000 * 120, 16000); // up to 2min
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    const float32 = decoded.getChannelData(0);

    // Run Whisper inference
    const result = await whisperPipeline(float32, {
      language: 'en',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5
    });

    const text = result.text.trim();

    if (text) {
      setStatus('Inserting text...', 'processing');
      const insertResult = await window.talkbro.insertText(text);

      if (insertResult.success) {
        setStatus('✓ Text inserted', 'idle');
      } else {
        setStatus('Insert failed — ' + insertResult.error, 'idle');
      }
    } else {
      setStatus('No speech detected', 'idle');
    }

    setState('idle');
    setTimeout(() => hideStatus(), 3000);
  } catch (err) {
    setState('idle');
    setStatus('Error: ' + err.message, 'idle');
    console.error('[TalkBro Widget] Transcription error:', err);
    setTimeout(() => hideStatus(), 4000);
  }
}

// ══════════════════════════════════════════════════════
// ██ WAVEFORM VISUALIZATION ██
// ══════════════════════════════════════════════════════

function showWaveform() {
  waveform.classList.remove('hidden');
  drawWaveform();
}

function hideWaveform() {
  waveform.classList.add('hidden');
  if (animFrame) cancelAnimationFrame(animFrame);
}

function drawWaveform() {
  if (!recording || !analyser) return;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  const W = waveform.width;
  const H = waveform.height;
  waveCtx.clearRect(0, 0, W, H);

  const barW = (W / bufferLength) * 2.5;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    const barH = (dataArray[i] / 255) * H * 0.85;
    const hue = 250 + (dataArray[i] / 255) * 30;
    waveCtx.fillStyle = `hsla(${hue}, 70%, 65%, 0.8)`;
    waveCtx.fillRect(x, H - barH, barW - 1, barH);
    x += barW;
  }

  animFrame = requestAnimationFrame(drawWaveform);
}

// ══════════════════════════════════════════════════════
// ██ SILENCE DETECTION ██
// ══════════════════════════════════════════════════════

function startSilenceDetection() {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const timeout = settings.silenceTimeout || 2000;

  function check() {
    if (!recording) return;
    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;

    if (avg < 10) {
      if (!silenceTimer) {
        silenceTimer = setTimeout(() => {
          if (recording) stopRecording();
        }, timeout);
      }
    } else {
      if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
    }

    setTimeout(check, 200);
  }

  check();
}

// ══════════════════════════════════════════════════════
// ██ UI HELPERS ██
// ══════════════════════════════════════════════════════

function setState(state) {
  widget.className = 'widget ' + state;
}

function setStatus(msg, state) {
  statusText.textContent = msg;
  statusEl.classList.remove('hidden');
  if (state) setState(state);
}

function hideStatus() {
  statusEl.classList.add('hidden');
}

// ── Click handler ──
micBtn.addEventListener('click', () => {
  if (recording) {
    stopRecording();
  } else {
    startRecording();
  }
});

// ── Listen for global hotkey triggers from main process ──
window.talkbro.onStartRecording(() => {
  if (!recording) startRecording();
});

window.talkbro.onStopRecording(() => {
  if (recording) stopRecording();
});

console.log('[TalkBro Widget] Widget renderer loaded');
