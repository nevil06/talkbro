/**
 * TalkBro Settings — Logic
 */

const $ = (sel) => document.querySelector(sel);

// ── Load Settings ──
window.talkbro.getSettings().then(settings => {
  $('#whisper-model').value = settings.whisperModel || 'tiny';
  $('#silence-timeout').value = (settings.silenceTimeout || 2000) / 1000;
  $('#silence-val').textContent = ((settings.silenceTimeout || 2000) / 1000).toFixed(1) + 's';
  $('#shortcut').value = settings.shortcut || 'Ctrl+Shift+V';
  $('#theme').value = settings.theme || 'dark';
  $('#auto-start').checked = settings.autoStart || false;
});

// ── Silence slider ──
$('#silence-timeout').addEventListener('input', (e) => {
  $('#silence-val').textContent = parseFloat(e.target.value).toFixed(1) + 's';
});

// ── Save ──
$('#save-btn').addEventListener('click', async () => {
  const settings = {
    whisperModel: $('#whisper-model').value,
    silenceTimeout: parseFloat($('#silence-timeout').value) * 1000,
    shortcut: $('#shortcut').value,
    theme: $('#theme').value,
    autoStart: $('#auto-start').checked
  };

  await window.talkbro.saveSettings(settings);

  const status = $('#save-status');
  status.classList.remove('hidden');
  setTimeout(() => status.classList.add('hidden'), 2500);
});
