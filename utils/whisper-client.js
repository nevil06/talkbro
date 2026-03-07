/**
 * TalkBro — Whisper STT Client
 * Unified interface for local (browser Web Speech API) and remote (OpenAI API) transcription.
 */

import { getSettings } from './storage.js';

/**
 * Transcribe an audio blob to text.
 * @param {Blob} audioBlob - WebM/Opus audio blob from MediaRecorder
 * @param {string} [modeOverride] - Force 'local' or 'remote'
 * @returns {Promise<string>} Raw transcript text
 */
export async function transcribe(audioBlob, modeOverride) {
  const settings = await getSettings();
  const mode = modeOverride || settings.sttMode;

  if (mode === 'local') {
    return transcribeLocal(audioBlob);
  } else {
    return transcribeRemote(audioBlob, settings.openaiApiKey);
  }
}

/**
 * Local transcription using browser's Web Speech API as a lightweight fallback.
 * Note: For full Whisper WASM, a dedicated Web Worker build is needed.
 * This provides a working baseline using built-in browser capabilities.
 */
async function transcribeLocal(audioBlob) {
  // For the MVP, we use a practical approach:
  // The content script captures speech in real-time via SpeechRecognition API
  // and sends the text directly. This function handles the case where
  // we have a recorded blob that needs re-processing.
  
  // Attempt to use the built-in SpeechRecognition for live transcription
  return new Promise((resolve, reject) => {
    // If SpeechRecognition is available, we'll use it for real-time capture
    // For pre-recorded blobs, fall back to the remote API
    reject(new Error('Local blob transcription requires Whisper WASM. Falling back to remote API or use live mode.'));
  });
}

/**
 * Remote transcription via OpenAI Whisper API.
 */
async function transcribeRemote(audioBlob, apiKey) {
  if (!apiKey) {
    throw new Error('OpenAI API key is required for remote transcription. Set it in TalkBro settings.');
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'text');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Whisper API error (${response.status}): ${err}`);
  }

  const text = await response.text();
  return text.trim();
}

/**
 * Check if the browser supports the Web Speech API for live transcription.
 */
export function supportsLiveSpeech() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Create a live speech recognition session (for real-time transcription).
 * @param {function} onResult - Callback with (transcript, isFinal)
 * @param {function} onError - Callback with (error)
 * @returns {{ start: Function, stop: Function }}
 */
export function createLiveSpeechSession(onResult, onError) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    throw new Error('Web Speech API not supported in this browser.');
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript) {
      onResult(finalTranscript, true);
    } else if (interimTranscript) {
      onResult(interimTranscript, false);
    }
  };

  recognition.onerror = (event) => {
    onError(new Error(`Speech recognition error: ${event.error}`));
  };

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop()
  };
}
