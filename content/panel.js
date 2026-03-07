/**
 * TalkBro — Panel Logic
 * Handles recording, transcription, LLM enhancement, copy, drag, and state management.
 * This file is loaded inside the Shadow DOM by inject.js.
 */

(function () {
  const root = document.currentScript?.getRootNode?.() || document;
  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => root.querySelectorAll(sel);

  // ── DOM References ──────────────────────────────
  const panel = $('#talkbro-panel');
  const pill = $('#talkbro-pill');
  const expanded = $('#talkbro-expanded');
  const dragHandle = $('#talkbro-drag-handle');
  const micBtn = $('#talkbro-mic');
  const clearBtn = $('#talkbro-clear');
  const minimizeBtn = $('#talkbro-minimize');
  const closeBtn = $('#talkbro-close');
  const settingsBtn = $('#talkbro-settings-btn');
  const presetSelect = $('#talkbro-preset');
  const waveformContainer = $('#talkbro-waveform-container');
  const waveformCanvas = $('#talkbro-waveform');
  const statusArea = $('#talkbro-status');
  const resultsArea = $('#talkbro-results');
  const processingArea = $('#talkbro-processing');
  const rawTextEl = $('#talkbro-raw-text');
  const enhancedTextEl = $('#talkbro-enhanced-text');
  const toast = $('#talkbro-toast');

  const canvasCtx = waveformCanvas?.getContext('2d');

  // ── State ───────────────────────────────────────
  let isRecording = false;
  let mediaRecorder = null;
  let audioChunks = [];
  let audioContext = null;
  let analyser = null;
  let audioStream = null;
  let silenceTimer = null;
  let animFrame = null;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let silenceTimeout = 2000;
  let speechRecognition = null;
  let liveTranscript = '';

  // ── Init ────────────────────────────────────────
  loadSettings();

  // ── Panel Toggle (Pill ↔ Expanded) ──────────────
  pill?.addEventListener('click', () => expandPanel());
  minimizeBtn?.addEventListener('click', () => collapsePanel());
  closeBtn?.addEventListener('click', () => collapsePanel());

  function expandPanel() {
    panel.classList.remove('talkbro-collapsed');
  }

  function collapsePanel() {
    panel.classList.add('talkbro-collapsed');
    if (isRecording) stopRecording();
  }

  // ── Dragging ────────────────────────────────────
  dragHandle?.addEventListener('mousedown', startDrag);
  dragHandle?.addEventListener('touchstart', startDrag, { passive: false });

  function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    const rect = panel.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragOffset.x = clientX - rect.left;
    dragOffset.y = clientY - rect.top;

    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);
  }

  function onDrag(e) {
    if (!isDragging) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - dragOffset.x;
    const y = clientY - dragOffset.y;

    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('touchend', stopDrag);
  }

  // ── Recording ───────────────────────────────────
  micBtn?.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  async function startRecording() {
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });

      // Set up audio analyser for waveform
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(audioStream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      mediaRecorder = new MediaRecorder(audioStream, { mimeType });
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.start(100);
      isRecording = true;

      // Also try live speech recognition for real-time transcript
      startLiveSpeech();

      // UI updates
      micBtn.classList.add('recording');
      statusArea.classList.add('hidden');
      resultsArea.classList.add('hidden');
      processingArea.classList.add('hidden');
      waveformContainer.classList.remove('hidden');
      clearBtn.classList.add('hidden');

      drawWaveform();
      startSilenceDetection();

    } catch (err) {
      showToast(err.message || 'Failed to access microphone', 'error');
    }
  }

  async function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('recording');
    if (animFrame) cancelAnimationFrame(animFrame);
    if (silenceTimer) clearTimeout(silenceTimer);

    // Stop live speech recognition
    stopLiveSpeech();

    // Stop MediaRecorder and get blob
    const blob = await new Promise((resolve) => {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }
      mediaRecorder.onstop = () => {
        const b = new Blob(audioChunks, { type: mediaRecorder.mimeType });
        resolve(b);
      };
      mediaRecorder.stop();
    });

    // Cleanup audio
    if (audioStream) audioStream.getTracks().forEach(t => t.stop());
    if (audioContext) audioContext.close();
    audioContext = null;
    analyser = null;

    waveformContainer.classList.add('hidden');

    if (liveTranscript.trim()) {
      // We have a transcript from live speech recognition
      processTranscript(liveTranscript.trim());
    } else if (blob && blob.size > 0) {
      // Fall back to sending audio blob to background for Whisper API
      processAudioBlob(blob);
    } else {
      showToast('No audio captured. Try speaking louder.', 'info');
      statusArea.classList.remove('hidden');
    }
  }

  // ── Live Speech Recognition ─────────────────────
  function startLiveSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    liveTranscript = '';
    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = 'en-US';

    speechRecognition.onresult = (event) => {
      let interim = '';
      let finalText = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      liveTranscript = finalText || interim;
    };

    speechRecognition.onerror = () => {
      // Silently fail — we'll fall back to blob transcription
    };

    try {
      speechRecognition.start();
    } catch {
      // Already started or not available
    }
  }

  function stopLiveSpeech() {
    if (speechRecognition) {
      try { speechRecognition.stop(); } catch {}
      speechRecognition = null;
    }
  }

  // ── Process transcript → LLM enhancement ───────
  async function processTranscript(rawText) {
    // Show raw text immediately
    rawTextEl.textContent = rawText;
    resultsArea.classList.remove('hidden');
    processingArea.classList.remove('hidden');
    statusArea.classList.add('hidden');

    // Call LLM via background service worker
    try {
      const preset = presetSelect.value;
      const response = await chrome.runtime.sendMessage({
        type: 'ENHANCE_TEXT',
        rawText,
        preset
      });

      processingArea.classList.add('hidden');

      if (response.success) {
        enhancedTextEl.textContent = response.enhanced;
        clearBtn.classList.remove('hidden');

        // Save to history
        chrome.runtime.sendMessage({
          type: 'SAVE_HISTORY',
          entry: { raw: rawText, enhanced: response.enhanced, preset }
        });
      } else {
        enhancedTextEl.textContent = rawText; // Fall back to raw
        showToast(response.error || 'Enhancement failed', 'error');
      }
    } catch (err) {
      processingArea.classList.add('hidden');
      enhancedTextEl.textContent = rawText;
      showToast('Could not connect to LLM. Check settings.', 'error');
    }
  }

  // ── Process audio blob (Whisper API fallback) ───
  async function processAudioBlob(blob) {
    statusArea.classList.add('hidden');
    processingArea.classList.remove('hidden');

    try {
      // Convert blob to base64 for messaging
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const dataUrl = reader.result;
          const base64Data = dataUrl.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const response = await chrome.runtime.sendMessage({
        type: 'TRANSCRIBE_AUDIO',
        audioData: { base64, mimeType: blob.type }
      });

      if (response.success && response.transcript) {
        processTranscript(response.transcript);
      } else {
        processingArea.classList.add('hidden');
        statusArea.classList.remove('hidden');
        showToast(response.error || 'Transcription failed', 'error');
      }
    } catch (err) {
      processingArea.classList.add('hidden');
      statusArea.classList.remove('hidden');
      showToast('Transcription failed. Set OpenAI API key in settings.', 'error');
    }
  }

  // ── Waveform Drawing ────────────────────────────
  function drawWaveform() {
    if (!isRecording || !analyser || !canvasCtx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const W = waveformCanvas.width = waveformCanvas.offsetWidth * 2;
    const H = waveformCanvas.height = waveformCanvas.offsetHeight * 2;
    canvasCtx.clearRect(0, 0, W, H);

    const barW = (W / bufferLength) * 2.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barH = (dataArray[i] / 255) * H * 0.8;
      const hue = 250 + (dataArray[i] / 255) * 30; // Purple range
      canvasCtx.fillStyle = `hsla(${hue}, 70%, 65%, 0.8)`;
      canvasCtx.fillRect(x, H - barH, barW - 1, barH);
      x += barW;
    }

    animFrame = requestAnimationFrame(drawWaveform);
  }

  // ── Silence Detection ───────────────────────────
  function startSilenceDetection() {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const THRESHOLD = 10;

    function check() {
      if (!isRecording) return;
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

      if (avg < THRESHOLD) {
        if (!silenceTimer) {
          silenceTimer = setTimeout(() => {
            if (isRecording) stopRecording();
          }, silenceTimeout);
        }
      } else {
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
      }
      setTimeout(check, 200);
    }
    check();
  }

  // ── Copy Buttons ────────────────────────────────
  $$('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      const text = target === 'raw' ? rawTextEl.textContent : enhancedTextEl.textContent;

      navigator.clipboard.writeText(text).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        }, 2000);
      }).catch(() => {
        showToast('Copy failed — try selecting the text manually', 'error');
      });
    });
  });

  // ── Clear Button ────────────────────────────────
  clearBtn?.addEventListener('click', () => {
    rawTextEl.textContent = '';
    enhancedTextEl.textContent = '';
    resultsArea.classList.add('hidden');
    clearBtn.classList.add('hidden');
    statusArea.classList.remove('hidden');
    liveTranscript = '';
  });

  // ── Settings Button ─────────────────────────────
  settingsBtn?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
  });

  // ── Toast ───────────────────────────────────────
  function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
  }

  // ── Settings Load ───────────────────────────────
  async function loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response?.success) {
        const s = response.settings;
        silenceTimeout = s.silenceTimeout || 2000;
        if (presetSelect && s.enhancementPreset) {
          presetSelect.value = s.enhancementPreset;
        }
        // Apply theme
        applyTheme(s.theme);
      }
    } catch {
      // First load, use defaults
    }
  }

  function applyTheme(theme) {
    const host = root.host || root;
    if (theme === 'light') {
      host.classList.add('light');
    } else if (theme === 'dark') {
      host.classList.remove('light');
    } else {
      // Auto: follow system
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        host.classList.add('light');
      } else {
        host.classList.remove('light');
      }
    }
  }

  // ── Listen for messages from background ─────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TOGGLE_PANEL') {
      if (panel.classList.contains('talkbro-collapsed')) {
        expandPanel();
      } else {
        collapsePanel();
      }
    }
    if (msg.type === 'TOGGLE_RECORDING') {
      if (!panel.classList.contains('talkbro-collapsed')) {
        if (isRecording) stopRecording();
        else startRecording();
      } else {
        expandPanel();
        setTimeout(startRecording, 300);
      }
    }
  });

})();
