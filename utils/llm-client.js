/**
 * TalkBro — LLM Client
 * Unified interface for local (Ollama) and remote (Groq / OpenRouter) text enhancement.
 */

import { getSettings } from './storage.js';

const PRESETS = {
  clean: {
    name: 'Clean Up',
    prompt: 'Clean up this spoken text: fix grammar, remove filler words (um, uh, like, you know), fix punctuation, and make it read naturally. Preserve the original meaning and tone. Return ONLY the cleaned text, no explanations.'
  },
  formal: {
    name: 'Formal',
    prompt: 'Rewrite this spoken text in a formal, professional tone. Fix grammar, improve vocabulary, and structure it properly. Return ONLY the rewritten text, no explanations.'
  },
  bullets: {
    name: 'Bullet Points',
    prompt: 'Convert this spoken text into clear, organized bullet points. Group related ideas together. Return ONLY the bullet points, no explanations.'
  },
  email: {
    name: 'Email',
    prompt: 'Convert this spoken text into a well-structured professional email. Include appropriate greeting and closing. Return ONLY the email text, no explanations.'
  },
  code: {
    name: 'Code Explanation',
    prompt: 'The user is explaining code or a technical concept verbally. Clean up the text, add proper technical terminology, and format it as clear technical documentation. Return ONLY the formatted text, no explanations.'
  },
  summary: {
    name: 'Summary',
    prompt: 'Summarize this spoken text into a concise paragraph capturing all key points. Return ONLY the summary, no explanations.'
  }
};

export { PRESETS };

/**
 * Enhance raw transcript using an LLM.
 * @param {string} rawText - Raw transcript from STT
 * @param {string} [presetKey] - Enhancement preset key
 * @param {string} [modeOverride] - Force 'local' or 'remote'
 * @returns {Promise<string>} Enhanced text
 */
export async function enhance(rawText, presetKey, modeOverride) {
  const settings = await getSettings();
  const mode = modeOverride || settings.llmMode;
  const preset = PRESETS[presetKey || settings.enhancementPreset] || PRESETS.clean;

  const systemPrompt = preset.prompt;
  const userMessage = rawText;

  if (mode === 'local') {
    return enhanceLocal(systemPrompt, userMessage, settings);
  } else {
    return enhanceRemote(systemPrompt, userMessage, settings);
  }
}

/**
 * Local enhancement via Ollama REST API.
 */
async function enhanceLocal(systemPrompt, userMessage, settings) {
  const endpoint = settings.ollamaEndpoint || 'http://localhost:11434';
  const model = settings.ollamaModel || 'mistral';

  try {
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

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.message?.content?.trim() || data.response?.trim() || '';
  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      throw new Error('Cannot connect to Ollama. Make sure Ollama is running (ollama serve) and a model is pulled.');
    }
    throw err;
  }
}

/**
 * Remote enhancement via Groq API (fast inference).
 */
async function enhanceRemote(systemPrompt, userMessage, settings) {
  const groqKey = settings.groqApiKey;
  const openrouterKey = settings.openrouterApiKey;

  if (groqKey) {
    return callGroq(systemPrompt, userMessage, groqKey);
  } else if (openrouterKey) {
    return callOpenRouter(systemPrompt, userMessage, openrouterKey);
  } else {
    throw new Error('No API key configured for remote LLM. Set a Groq or OpenRouter key in TalkBro settings.');
  }
}

async function callGroq(systemPrompt, userMessage, apiKey) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
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

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || '';
}

async function callOpenRouter(systemPrompt, userMessage, apiKey) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'chrome-extension://talkbro',
      'X-Title': 'TalkBro'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.3-70b-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 2048
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || '';
}

/**
 * Check if Ollama is reachable and list available models.
 */
export async function checkOllamaStatus(endpoint) {
  try {
    const url = endpoint || 'http://localhost:11434';
    const response = await fetch(`${url}/api/tags`);
    if (!response.ok) throw new Error('Not reachable');
    const data = await response.json();
    return {
      available: true,
      models: (data.models || []).map(m => m.name)
    };
  } catch {
    return { available: false, models: [] };
  }
}
