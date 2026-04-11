/**
 * TalkBro — Options Page Logic
 */

const DEFAULTS = {
  sttMode: 'local',
  whisperModel: 'tiny',
  openaiApiKey: '',
  geminiApiKey: '',
  enhancementPreset: 'clean',
  silenceTimeout: 2000,
  theme: 'auto'
};

const $ = (sel) => document.querySelector(sel);

// ── Load Settings ──────────────────────────────────
chrome.storage.local.get(DEFAULTS, (settings) => {
  $('#stt-mode').value = settings.sttMode;
  $('#whisper-model').value = settings.whisperModel;
  $('#openai-key').value = settings.openaiApiKey;
  $('#gemini-key').value = settings.geminiApiKey;
  $('#preset').value = settings.enhancementPreset;
  $('#silence-timeout').value = settings.silenceTimeout / 1000;
  $('#theme').value = settings.theme;

  toggleSttSections(settings.sttMode);
  renderDisabledSites(settings.disabledSites || []);
});

// ── Permissions Management ─────────────────────────
function renderDisabledSites(sites) {
  const container = $('#disabled-sites-list');
  const emptyState = $('#disabled-sites-empty');
  
  container.innerHTML = '';
  
  if (!sites || sites.length === 0) {
    emptyState.classList.remove('hidden');
    container.classList.add('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  container.classList.remove('hidden');
  
  sites.forEach(domain => {
    const li = document.createElement('li');
    li.className = 'permission-item';
    
    const span = document.createElement('span');
    span.className = 'permission-domain';
    span.textContent = domain;
    
    const btn = document.createElement('button');
    btn.className = 'btn-remove-site';
    btn.textContent = 'Re-enable';
    btn.title = `Allow TalkBro to run on ${domain}`;
    
    btn.addEventListener('click', () => removeDisabledSite(domain));
    
    li.appendChild(span);
    li.appendChild(btn);
    container.appendChild(li);
  });
}

function removeDisabledSite(domainToRemove) {
  chrome.storage.local.get({ disabledSites: [] }, (result) => {
    const updatedSites = result.disabledSites.filter(d => d !== domainToRemove);
    chrome.storage.local.set({ disabledSites: updatedSites }, () => {
      renderDisabledSites(updatedSites);
      
      // Show save status briefly
      const status = $('#save-status');
      status.textContent = `✅ Re-enabled on ${domainToRemove}`;
      status.classList.remove('hidden');
      setTimeout(() => {
        status.classList.add('hidden');
        setTimeout(() => status.textContent = '✅ Saved!', 300); // Reset text
      }, 2500);
    });
  });
}

// ── Toggle Sections Based on Mode ──────────────────
$('#stt-mode').addEventListener('change', (e) => toggleSttSections(e.target.value));

function toggleSttSections(mode) {
  if (mode === 'local') {
    $('#whisper-settings').classList.remove('hidden');
    $('#openai-key-row').classList.add('hidden');
  } else {
    $('#whisper-settings').classList.add('hidden');
    $('#openai-key-row').classList.remove('hidden');
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
    whisperModel: $('#whisper-model').value,
    openaiApiKey: $('#openai-key').value,
    geminiApiKey: $('#gemini-key').value,
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
