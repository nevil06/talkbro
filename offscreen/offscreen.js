/**
 * TalkBro — Offscreen Whisper Engine
 * Runs Whisper tiny/base model on-device using Transformers.js.
 * This document is created by the service worker when local STT is needed.
 */

import { pipeline, env } from '../lib/transformers/transformers.min.js';

// ── Configuration ─────────────────────────────────────
// Point WASM files to our local copies
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('lib/transformers/');
// Allow remote model loading from HuggingFace Hub
env.allowRemoteModels = true;
// Use browser cache (IndexedDB) for downloaded models
env.useBrowserCache = true;

// ── State ─────────────────────────────────────────────
let whisperPipeline = null;
let currentModel = null;
let isLoading = false;

// ── Model Loading ─────────────────────────────────────
async function loadModel(modelSize = 'tiny') {
  if (whisperPipeline && currentModel === modelSize) {
    return { success: true, cached: true, model: modelSize };
  }

  if (isLoading) {
    return { success: false, error: 'Model is already loading' };
  }

  isLoading = true;
  const modelId = `onnx-community/whisper-${modelSize}`;

  try {
    // Send progress updates to the service worker
    const progressCallback = (progress) => {
      if (progress.status === 'download' || progress.status === 'progress') {
        chrome.runtime.sendMessage({
          type: 'WHISPER_PROGRESS',
          progress: {
            status: progress.status,
            file: progress.file || '',
            loaded: progress.loaded || 0,
            total: progress.total || 0,
            percent: progress.progress || 0
          }
        }).catch(() => {});
      }
    };

    whisperPipeline = await pipeline(
      'automatic-speech-recognition',
      modelId,
      {
        dtype: 'q8',          // Quantized for speed
        device: 'wasm',       // Use WASM backend
        progress_callback: progressCallback
      }
    );

    currentModel = modelSize;
    isLoading = false;

    chrome.runtime.sendMessage({
      type: 'WHISPER_PROGRESS',
      progress: { status: 'ready', model: modelSize }
    }).catch(() => {});

    return { success: true, cached: false, model: modelSize };

  } catch (err) {
    isLoading = false;
    whisperPipeline = null;
    currentModel = null;
    console.error('[TalkBro Offscreen] Model load error:', err);
    return { success: false, error: err.message };
  }
}

// ── Transcription ─────────────────────────────────────
async function transcribeAudio(audioData) {
  // Ensure model is loaded
  if (!whisperPipeline) {
    const loadResult = await loadModel(audioData.modelSize || 'tiny');
    if (!loadResult.success) {
      return { success: false, error: loadResult.error };
    }
  }

  try {
    // Convert base64 to Float32Array audio samples
    const audioBuffer = await decodeAudioToFloat32(audioData.base64, audioData.mimeType);

    // Run Whisper inference
    const result = await whisperPipeline(audioBuffer, {
      language: 'en',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5
    });

    return {
      success: true,
      text: result.text.trim()
    };

  } catch (err) {
    console.error('[TalkBro Offscreen] Transcription error:', err);
    return { success: false, error: err.message };
  }
}

// ── Audio Decoding ────────────────────────────────────
async function decodeAudioToFloat32(base64, mimeType) {
  // Convert base64 → ArrayBuffer
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const arrayBuffer = bytes.buffer;

  // Decode using OfflineAudioContext (16kHz mono — what Whisper expects)
  const audioCtx = new OfflineAudioContext(1, 16000 * 60, 16000); // 1 channel, up to 60s, 16kHz
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  // Get mono channel data as Float32Array
  const float32 = decoded.getChannelData(0);

  // Trim to actual length (remove trailing silence padding)
  const actualLength = Math.min(float32.length, decoded.duration * 16000);
  return float32.slice(0, actualLength);
}

// ── Message Handler ───────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  if (message.type === 'WHISPER_TRANSCRIBE') {
    transcribeAudio(message.audioData)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }

  if (message.type === 'WHISPER_LOAD_MODEL') {
    loadModel(message.modelSize || 'tiny')
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'WHISPER_STATUS') {
    sendResponse({
      loaded: !!whisperPipeline,
      model: currentModel,
      isLoading
    });
    return false;
  }
});

console.log('[TalkBro Offscreen] Whisper engine ready, waiting for commands...');
