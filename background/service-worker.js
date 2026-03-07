/**
 * TalkBro — Background Service Worker
 * Orchestrates messaging between content script, STT, and LLM.
 */

import { getSettings, addToHistory } from '../utils/storage.js';

// Handle extension icon click → toggle side panel
chrome.action.onClicked.addListener((tab) => {
  // Send toggle message to content script
  chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' }).catch(() => {
    // Content script not loaded yet, inject it
    console.log('TalkBro: Content script not ready on this tab.');
  });
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'toggle-panel') {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' }).catch(() => {});
  } else if (command === 'toggle-recording') {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_RECORDING' }).catch(() => {});
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ENHANCE_TEXT') {
    handleEnhance(message.rawText, message.preset)
      .then(result => sendResponse({ success: true, enhanced: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }

  if (message.type === 'TRANSCRIBE_AUDIO') {
    handleTranscribe(message.audioData)
      .then(result => sendResponse({ success: true, transcript: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'SAVE_HISTORY') {
    addToHistory(message.entry)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    getSettings()
      .then(settings => sendResponse({ success: true, settings }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    return;
  }

  if (message.type === 'CHECK_OLLAMA') {
    checkOllamaAvailability()
      .then(result => sendResponse(result))
      .catch(() => sendResponse({ available: false }));
    return true;
  }

  if (message.type === 'CHECK_WHISPER') {
    checkWhisperServer()
      .then(result => sendResponse(result))
      .catch(() => sendResponse({ available: false }));
    return true;
  }
});

/**
 * Enhance text using the configured LLM.
 */
async function handleEnhance(rawText, preset) {
  const settings = await getSettings();
  const mode = settings.llmMode;
  const presetConfig = getPreset(preset || settings.enhancementPreset);

  if (mode === 'local') {
    return callOllama(presetConfig.prompt, rawText, settings);
  } else {
    return callRemoteLLM(presetConfig.prompt, rawText, settings);
  }
}

/**
 * Transcribe audio — routes to local Whisper server or OpenAI API based on settings.
 */
async function handleTranscribe(audioData) {
  const settings = await getSettings();

  // Convert base64 back to blob
  const binaryString = atob(audioData.base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: audioData.mimeType });

  if (settings.sttMode === 'local') {
    // ── Local Whisper Server (localhost:5555) ──
    const endpoint = settings.whisperEndpoint || 'http://localhost:5555';
    const formData = new FormData();
    formData.append('file', blob, 'recording.webm');

    try {
      const response = await fetch(`${endpoint}/transcribe`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Whisper server error (${response.status}): ${err}`);
      }

      const data = await response.json();
      if (data.success && data.text) {
        return data.text;
      }
      throw new Error(data.error || 'No transcript returned');
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error('Cannot reach Whisper server. Run start.bat in the whisper-server folder.');
      }
      throw err;
    }

  } else {
    // ── Remote OpenAI Whisper API ──
    if (!settings.openaiApiKey) {
      throw new Error('OpenAI API key required for remote transcription. Set it in TalkBro settings.');
    }

    const formData = new FormData();
    formData.append('file', blob, 'recording.webm');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${settings.openaiApiKey}` },
      body: formData
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Whisper API error (${response.status}): ${err}`);
    }

    return (await response.text()).trim();
  }
}

async function callOllama(systemPrompt, userMessage, settings) {
  const endpoint = settings.ollamaEndpoint || 'http://localhost:11434';
  const model = settings.ollamaModel || 'mistral';

  const response = await fetch(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      stream: false
    })
  });

  if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
  const data = await response.json();
  return data.message?.content?.trim() || '';
}

async function callRemoteLLM(systemPrompt, userMessage, settings) {
  if (settings.groqApiKey) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.groqApiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 2048
      })
    });
    if (!response.ok) throw new Error(`Groq error: ${response.status}`);
    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || '';
  }

  if (settings.openrouterApiKey) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openrouterApiKey}`
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3
      })
    });
    if (!response.ok) throw new Error(`OpenRouter error: ${response.status}`);
    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || '';
  }

  throw new Error('No API key configured. Set Groq or OpenRouter key in settings.');
}

async function checkOllamaAvailability() {
  try {
    const settings = await getSettings();
    const endpoint = settings.ollamaEndpoint || 'http://localhost:11434';
    const response = await fetch(`${endpoint}/api/tags`);
    if (!response.ok) return { available: false };
    const data = await response.json();
    return { available: true, models: (data.models || []).map(m => m.name) };
  } catch {
    return { available: false };
  }
}

async function checkWhisperServer() {
  try {
    const settings = await getSettings();
    const endpoint = settings.whisperEndpoint || 'http://localhost:5555';
    const response = await fetch(`${endpoint}/health`);
    if (!response.ok) return { available: false };
    const data = await response.json();
    return { available: true, model: data.model };
  } catch {
    return { available: false };
  }
}

function getPreset(key) {
  const presets = {
    clean: { name: 'Clean Up', prompt: 'Clean up this spoken text: fix grammar, remove filler words (um, uh, like, you know), fix punctuation, and make it read naturally. Preserve the original meaning and tone. Return ONLY the cleaned text, no explanations.' },
    formal: { name: 'Formal', prompt: 'Rewrite this spoken text in a formal, professional tone. Fix grammar, improve vocabulary, and structure it properly. Return ONLY the rewritten text, no explanations.' },
    bullets: { name: 'Bullet Points', prompt: 'Convert this spoken text into clear, organized bullet points. Group related ideas together. Return ONLY the bullet points, no explanations.' },
    email: { name: 'Email', prompt: 'Convert this spoken text into a well-structured professional email. Include appropriate greeting and closing. Return ONLY the email text, no explanations.' },
    code: { name: 'Code Explanation', prompt: 'The user is explaining code or a technical concept verbally. Clean up the text, add proper technical terminology, and format it as clear technical documentation. Return ONLY the formatted text, no explanations.' },
    summary: { name: 'Summary', prompt: 'Summarize this spoken text into a concise paragraph capturing all key points. Return ONLY the summary, no explanations.' }
  };
  return presets[key] || presets.clean;
}
