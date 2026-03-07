/**
 * TalkBro — Chrome Storage Helpers
 * Wraps chrome.storage.local with defaults and convenience methods.
 */

const DEFAULTS = {
  sttMode: 'local',         // 'local' (Whisper server) or 'remote' (OpenAI API)
  llmMode: 'local',         // 'local' (Ollama) or 'remote' (Groq/OpenRouter)
  ollamaModel: 'mistral',
  ollamaEndpoint: 'http://localhost:11434',
  whisperEndpoint: 'http://localhost:5555',
  openaiApiKey: '',
  groqApiKey: '',
  openrouterApiKey: '',
  enhancementPreset: 'clean',  // clean | formal | bullets | email | code
  silenceTimeout: 2000,        // ms of silence before auto-stop
  theme: 'auto',               // auto | dark | light
  panelPosition: { x: null, y: null },
  history: []
};

export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULTS, (result) => {
      resolve(result);
    });
  });
}

export async function getSetting(key) {
  const settings = await getSettings();
  return settings[key];
}

export async function setSetting(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

export async function setSettings(obj) {
  return new Promise((resolve) => {
    chrome.storage.local.set(obj, resolve);
  });
}

export async function addToHistory(entry) {
  const { history } = await getSettings();
  history.unshift({
    ...entry,
    id: crypto.randomUUID(),
    timestamp: Date.now()
  });
  // Keep last 100 entries
  if (history.length > 100) history.length = 100;
  await setSetting('history', history);
}

export async function clearHistory() {
  await setSetting('history', []);
}

export async function getHistory() {
  return getSetting('history');
}
