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

  if (message.type === 'SAVE_POSITION') {
    chrome.storage.local.set({ panelPosition: message.position });
    return;
  }

  if (message.type === 'DISABLE_SITE') {
    getSettings().then(s => {
      const sites = s.disabledSites || [];
      if (!sites.includes(message.domain)) {
        sites.push(message.domain);
        chrome.storage.local.set({ disabledSites: sites });
      }
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'ENABLE_SITE') {
    getSettings().then(s => {
      const sites = (s.disabledSites || []).filter(d => d !== message.domain);
      chrome.storage.local.set({ disabledSites: sites });
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'CHECK_SITE') {
    getSettings().then(s => {
      const disabled = (s.disabledSites || []).includes(message.domain);
      sendResponse({ disabled });
    });
    return true;
  }

  if (message.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    return;
  }



  if (message.type === 'CHECK_WHISPER') {
    checkLocalWhisper()
      .then(result => sendResponse(result))
      .catch(() => sendResponse({ available: false }));
    return true;
  }

  if (message.type === 'LOAD_WHISPER_MODEL') {
    ensureOffscreen()
      .then(() => chrome.runtime.sendMessage({ target: 'offscreen', type: 'WHISPER_LOAD_MODEL', modelSize: message.modelSize || 'tiny' }))
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Forward progress from offscreen to any listening tabs
  if (message.type === 'WHISPER_PROGRESS') {
    // Broadcast to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      });
    });
    return;
  }
});

/**
 * Enhance text using the local DeepSeek server backend.
 */
async function handleEnhance(rawText, preset) {
  const settings = await getSettings();
  const presetConfig = getPreset(preset || settings.enhancementPreset);

  try {
    const response = await fetch('http://localhost:5555/enhance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: presetConfig.prompt,
        text: rawText
      })
    });

    if (!response.ok) {
      let errMsg = `Local server error: ${response.status}`;
      try {
        const err = await response.json();
        errMsg = err.error || errMsg;
      } catch (e) {}
      throw new Error(errMsg);
    }

    const data = await response.json();
    return data.enhanced_text || '';
  } catch (err) {
    throw new Error(`Failed to reach local enhancement server. Is the Python server running? (${err.message})`);
  }
}

/**
 * Transcribe audio — routes to on-device Whisper (offscreen) or OpenAI API.
 */
async function handleTranscribe(audioData) {
  const settings = await getSettings();

  if (settings.sttMode === 'local') {
    // ── On-Device Whisper via Offscreen Document ──
    await ensureOffscreen();

    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'WHISPER_TRANSCRIBE',
      audioData: {
        base64: audioData.base64,
        mimeType: audioData.mimeType,
        modelSize: settings.whisperModel || 'tiny'
      }
    });

    if (response && response.success) {
      return response.text;
    }
    throw new Error(response?.error || 'On-device transcription failed');

  } else {
    // ── Remote OpenAI Whisper API ──
    if (!settings.openaiApiKey) {
      throw new Error('OpenAI API key required for remote transcription. Set it in TalkBro settings.');
    }

    const binaryString = atob(audioData.base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: audioData.mimeType });

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



async function checkLocalWhisper() {
  try {
    await ensureOffscreen();
    const result = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'WHISPER_STATUS'
    });
    return {
      available: true,
      loaded: result?.loaded || false,
      model: result?.model || null,
      isLoading: result?.isLoading || false
    };
  } catch {
    return { available: false };
  }
}

// ── Offscreen Document Management ─────────────────────
let creatingOffscreen = null;

async function ensureOffscreen() {
  const exists = await chrome.offscreen.hasDocument?.() || false;
  if (exists) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: 'offscreen/offscreen.html',
    reasons: ['WORKERS'],
    justification: 'Run Whisper speech-to-text model on-device via Transformers.js'
  });

  await creatingOffscreen;
  creatingOffscreen = null;
}

function getPreset(key) {
  const presets = {
    clean: {
      name: 'Clean Up',
      prompt: `You are an expert text editor specializing in cleaning up spoken transcripts. Your task:

1. Remove ALL filler words: "um", "uh", "like", "you know", "I mean", "sort of", "kind of", "basically", "actually", "right", "so yeah", "well"
2. Fix grammar, spelling, and punctuation thoroughly
3. Break run-on sentences into clear, properly punctuated sentences
4. Remove false starts, self-corrections, and repeated words/phrases
5. Preserve the speaker's original meaning, intent, and natural voice — do NOT change what they said, only HOW it reads
6. Keep contractions if the tone is casual; expand them if the tone is professional
7. Maintain the original paragraph structure — add paragraph breaks only where there's a clear topic shift

Output ONLY the cleaned text. No commentary, no labels, no quotation marks around the output.`
    },
    formal: {
      name: 'Formal',
      prompt: `You are a professional writing coach. Transform this spoken text into polished, formal writing:

1. Elevate vocabulary — replace casual words with precise, professional alternatives (e.g., "get" → "obtain", "big" → "significant", "a lot" → "considerably")
2. Use complete sentences with proper subordinate clauses and transitions
3. Remove ALL slang, colloquialisms, filler words, and contractions
4. Structure into clear paragraphs with logical flow: topic sentence → supporting details → transition
5. Use active voice where possible; passive voice only when the object is more important than the subject
6. Ensure subject-verb agreement, proper tense consistency, and parallel structure
7. Add appropriate transition words between ideas (however, furthermore, consequently, moreover)
8. Preserve every piece of information and intent from the original — do NOT add new information or opinions

Output ONLY the formal rewrite. No meta-commentary, no "Here is the rewritten text:" prefix.`
    },
    bullets: {
      name: 'Bullet Points',
      prompt: `You are an expert at organizing information into clear, actionable bullet points. Transform this spoken text:

1. Extract every distinct idea, fact, or action item from the spoken text
2. Group related points under clear, bold section headers if there are multiple topics
3. Use "•" for main points, "  –" for sub-points
4. Each bullet should be one concise, complete thought (5-15 words ideal)
5. Start each bullet with a strong verb or key noun — no "I think" or "We should maybe"
6. Order points logically: by priority, chronologically, or by category
7. Remove all filler, hedging language, and redundancy
8. If there are action items, mark them clearly
9. Do NOT omit any substantive information from the original

Output ONLY the bullet points. No intro sentence, no summary at the end.`
    },
    email: {
      name: 'Email',
      prompt: `You are a professional email writer. Convert this spoken text into a polished, well-structured email:

1. Add an appropriate greeting: "Hi [Name]," if a name is mentioned, otherwise "Hi," or "Hello,"
2. Write a clear opening line that states the purpose immediately (no "I hope this email finds you well" unless context demands it)
3. Organize the body into short paragraphs (2-4 sentences each):
   - Paragraph 1: Context/purpose
   - Middle paragraphs: Details, requests, or information
   - Final paragraph: Clear next steps or call to action
4. Use professional but warm tone — not stiff or robotic
5. If there are multiple requests or items, use a numbered list
6. End with an appropriate closing: "Best regards," / "Thanks," / "Best," depending on the formality
7. Add "[Your Name]" as the sign-off placeholder
8. Keep it concise — busy people skim emails
9. If a subject line is obvious from the content, suggest one as: "Subject: ..."

Output ONLY the email text (with subject line if applicable). No explanations.`
    },
    code: {
      name: 'Code Explanation',
      prompt: `You are a senior technical writer. The user is verbally explaining code, a technical concept, or a development task. Transform their speech into clear technical documentation:

1. Use proper technical terminology — replace vague descriptions with precise terms (e.g., "that thing that stores data" → "the database", "it goes through each one" → "iterates over the collection")
2. Format code references with backtick notation: \`functionName()\`, \`variableName\`, \`ClassName\`
3. Structure as:
   - Brief overview (1-2 sentences)
   - Technical details with proper formatting
   - Step-by-step process if describing a workflow
4. Use precise language: "invokes", "returns", "accepts", "initializes", "propagates" instead of casual equivalents
5. If describing an algorithm or process, use numbered steps
6. If mentioning parameters, types, or return values, format them clearly
7. Remove all filler words, false starts, and verbal thinking ("so basically what happens is...")
8. Preserve ALL technical information — do not simplify or omit technical details

Output ONLY the technical documentation. No preamble.`
    },
    summary: {
      name: 'Summary',
      prompt: `You are an expert summarizer. Condense this spoken text into a clear, comprehensive summary:

1. Capture ALL key points, decisions, action items, and important details — omit nothing substantive
2. Write 2-4 concise sentences for short content, up to a short paragraph for longer content
3. Lead with the most important point or main conclusion
4. Use specific details and numbers from the original (don't generalize "several" if they said "three")
5. Maintain the speaker's intent and emphasis — if they stressed something, it should be prominent in the summary
6. Remove all filler, tangents, anecdotes, and repetition
7. Use clear, direct language — every word should earn its place
8. If there are action items or next steps, include them at the end

Output ONLY the summary. No "In summary:" prefix or meta-commentary.`
    }
  };
  return presets[key] || presets.clean;
}
