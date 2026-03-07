/**
 * TalkBro — Options Page Logic
 */

const DEFAULTS = {
  sttMode: 'local',
  llmMode: 'local',
  ollamaModel: 'mistral',
  ollamaEndpoint: 'http://localhost:11434',
  whisperModel: 'tiny',
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
  $('#whisper-model').value = settings.whisperModel;
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

// ── Check On-Device Whisper Model ──────────────────
$('#check-whisper').addEventListener('click', checkWhisperModel);

async function checkWhisperModel() {
  const statusBadge = $('#whisper-status');
  const statusText = statusBadge.querySelector('.status-text');
  statusText.textContent = 'Checking...';
  statusBadge.className = 'status-badge';

  try {
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_WHISPER' });
    
    if (response && response.available) {
      if (response.loaded) {
        statusBadge.classList.add('connected');
        statusText.textContent = `Model loaded: whisper-${response.model}`;
      } else if (response.isLoading) {
        statusBadge.classList.add('connected');
        statusText.textContent = 'Model is loading...';
      } else {
        statusBadge.classList.add('connected');
        statusText.textContent = 'Engine ready — model will load on first use';
      }
    } else {
      statusBadge.classList.add('disconnected');
      statusText.textContent = 'Whisper engine not initialized';
    }
  } catch {
    statusBadge.classList.add('disconnected');
    statusText.textContent = 'Could not check model status';
  }
}

// ── Download Whisper Model ─────────────────────────
$('#download-whisper').addEventListener('click', downloadWhisperModel);

async function downloadWhisperModel() {
  const modelSize = $('#whisper-model').value;
  const progressRow = $('#whisper-progress');
  const progressBar = $('#whisper-progress-bar');
  const progressText = $('#whisper-progress-text');
  const statusBadge = $('#whisper-status');
  const statusText = statusBadge.querySelector('.status-text');

  progressRow.classList.remove('hidden');
  progressBar.style.width = '0%';
  progressText.textContent = `Downloading whisper-${modelSize} model...`;
  statusText.textContent = 'Downloading...';
  statusBadge.className = 'status-badge';

  // Listen for progress updates
  const progressListener = (message) => {
    if (message.type === 'WHISPER_PROGRESS') {
      if (message.progress.status === 'progress') {
        const pct = Math.round(message.progress.percent || 0);
        progressBar.style.width = pct + '%';
        progressText.textContent = `Downloading: ${pct}%`;
      } else if (message.progress.status === 'ready') {
        progressBar.style.width = '100%';
        progressText.textContent = 'Model cached and ready!';
        statusBadge.classList.add('connected');
        statusText.textContent = `Model loaded: whisper-${message.progress.model}`;
        setTimeout(() => progressRow.classList.add('hidden'), 3000);
        chrome.runtime.onMessage.removeListener(progressListener);
      }
    }
  };
  chrome.runtime.onMessage.addListener(progressListener);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'LOAD_WHISPER_MODEL',
      modelSize
    });

    if (response && !response.success) {
      progressText.textContent = `Error: ${response.error}`;
      statusBadge.classList.add('disconnected');
      statusText.textContent = 'Download failed';
      chrome.runtime.onMessage.removeListener(progressListener);
    }
  } catch (err) {
    progressText.textContent = `Error: ${err.message}`;
    statusBadge.classList.add('disconnected');
    statusText.textContent = 'Download failed';
    chrome.runtime.onMessage.removeListener(progressListener);
  }
}

// Initial checks
setTimeout(checkOllama, 500);
setTimeout(checkWhisperModel, 800);

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
    whisperModel: $('#whisper-model').value,
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
