/**
 * TalkBro — Chrome Storage Helpers
 * Wraps chrome.storage.local with defaults and convenience methods.
 */

const DEFAULTS = {
  sttMode: 'local',            // 'local' (on-device Whisper) or 'remote' (OpenAI API)
  whisperModel: 'tiny',        // 'tiny' (~39MB) or 'base' (~74MB)
  openaiApiKey: '',             // OpenAI key for remote Whisper STT only
  geminiApiKey: '',             // Google Gemini API key for text enhancement
  enhancementPreset: 'clean',   // clean | formal | bullets | email | code | summary
  silenceTimeout: 2000,         // ms of silence before auto-stop
  theme: 'auto',                // auto | dark | light
  panelPosition: { x: null, y: null },
  disabledSites: [],            // domain list where TalkBro is hidden
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
