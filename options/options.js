/**
 * TalkBro — Options Page Logic
 */

const DEFAULTS = {
  sttMode: 'local',
  llmMode: 'local',
  ollamaModel: 'mistral',
  ollamaEndpoint: 'http://localhost:11434',
  whisperEndpoint: 'http://localhost:5555',
  openaiApiKey: '',
  groqApiKey: '',
  openrouterApiKey: '',
  enhancementPreset: 'clean',
  silenceTimeout: 2000,
  theme: 'auto'
};

const $ = (sel) => document.querySelector(sel);

// ── Load Settings ──────────────────────────────────
chrome.storage.local.get(DEFAULTS, (settings) => {
  $('#stt-mode').value = settings.sttMode;
  $('#llm-mode').value = settings.llmMode;
  $('#ollama-endpoint').value = settings.ollamaEndpoint;
  $('#ollama-model').value = settings.ollamaModel;
  $('#whisper-endpoint').value = settings.whisperEndpoint;
  $('#openai-key').value = settings.openaiApiKey;
  $('#groq-key').value = settings.groqApiKey;
  $('#openrouter-key').value = settings.openrouterApiKey;
  $('#preset').value = settings.enhancementPreset;
  $('#silence-timeout').value = settings.silenceTimeout / 1000;
  $('#theme').value = settings.theme;

  toggleLlmSections(settings.llmMode);
  toggleSttSections(settings.sttMode);
});

// ── Toggle Sections Based on Mode ──────────────────
$('#llm-mode').addEventListener('change', (e) => toggleLlmSections(e.target.value));
$('#stt-mode').addEventListener('change', (e) => toggleSttSections(e.target.value));

function toggleLlmSections(mode) {
  if (mode === 'local') {
    $('#ollama-settings').classList.remove('hidden');
    $('#remote-llm-settings').classList.add('hidden');
  } else {
    $('#ollama-settings').classList.add('hidden');
    $('#remote-llm-settings').classList.remove('hidden');
  }
}

function toggleSttSections(mode) {
  if (mode === 'local') {
    $('#whisper-settings').classList.remove('hidden');
    $('#openai-key-row').classList.add('hidden');
  } else {
    $('#whisper-settings').classList.add('hidden');
    $('#openai-key-row').classList.remove('hidden');
  }
}

// ── Check Ollama ───────────────────────────────────
$('#check-ollama').addEventListener('click', checkOllama);

async function checkOllama() {
  const statusBadge = $('#ollama-status');
  const statusText = statusBadge.querySelector('.status-text');
  statusText.textContent = 'Checking...';
  statusBadge.className = 'status-badge';

  try {
    const endpoint = $('#ollama-endpoint').value || 'http://localhost:11434';
    const response = await fetch(`${endpoint}/api/tags`);
    
    if (response.ok) {
      const data = await response.json();
      const models = (data.models || []).map(m => m.name);
      statusBadge.classList.add('connected');
      statusText.textContent = `Connected — ${models.length} model(s): ${models.slice(0, 3).join(', ')}`;
    } else {
      statusBadge.classList.add('disconnected');
      statusText.textContent = 'Ollama not responding';
    }
  } catch {
    statusBadge.classList.add('disconnected');
    statusText.textContent = 'Cannot reach Ollama. Is it running?';
  }
}

// ── Check Whisper Server ───────────────────────────
$('#check-whisper').addEventListener('click', checkWhisper);

async function checkWhisper() {
  const statusBadge = $('#whisper-status');
  const statusText = statusBadge.querySelector('.status-text');
  statusText.textContent = 'Checking...';
  statusBadge.className = 'status-badge';

  try {
    const endpoint = $('#whisper-endpoint').value || 'http://localhost:5555';
    const response = await fetch(`${endpoint}/health`);
    
    if (response.ok) {
      const data = await response.json();
      statusBadge.classList.add('connected');
      statusText.textContent = `Connected — Whisper model: ${data.model || 'base'}`;
    } else {
      statusBadge.classList.add('disconnected');
      statusText.textContent = 'Whisper server not responding';
    }
  } catch {
    statusBadge.classList.add('disconnected');
    statusText.textContent = 'Cannot reach Whisper server. Run start.bat first.';
  }
}

// Initial checks
setTimeout(checkOllama, 500);
setTimeout(checkWhisper, 800);

// ── Toggle Password Visibility ─────────────────────
document.querySelectorAll('.toggle-visibility').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = $(`#${btn.dataset.target}`);
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁️' : '🙈';
  });
});

// ── Save Settings ──────────────────────────────────
$('#save-btn').addEventListener('click', () => {
  const settings = {
    sttMode: $('#stt-mode').value,
    llmMode: $('#llm-mode').value,
    ollamaEndpoint: $('#ollama-endpoint').value,
    ollamaModel: $('#ollama-model').value,
    whisperEndpoint: $('#whisper-endpoint').value,
    openaiApiKey: $('#openai-key').value,
    groqApiKey: $('#groq-key').value,
    openrouterApiKey: $('#openrouter-key').value,
    enhancementPreset: $('#preset').value,
    silenceTimeout: parseFloat($('#silence-timeout').value) * 1000,
    theme: $('#theme').value
  };

  chrome.storage.local.set(settings, () => {
    const status = $('#save-status');
    status.classList.remove('hidden');
    setTimeout(() => status.classList.add('hidden'), 2500);
  });
});
