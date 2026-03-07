/**
 * TalkBro — Side Panel Logic (History)
 */

const $ = (sel) => document.querySelector(sel);

const DEFAULTS = { history: [] };

// ── Render History ─────────────────────────────────
function renderHistory(filter = '') {
  chrome.storage.local.get(DEFAULTS, ({ history }) => {
    const list = $('#sp-history-list');
    const filtered = filter
      ? history.filter(h =>
          (h.raw || '').toLowerCase().includes(filter) ||
          (h.enhanced || '').toLowerCase().includes(filter)
        )
      : history;

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="sp-empty">
          <p>${filter ? 'No matches' : 'No history yet'}</p>
          <span>${filter ? 'Try a different search term' : 'Your voice transcriptions will appear here'}</span>
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map(item => `
      <div class="history-item" data-id="${item.id}">
        <div class="history-meta">
          <span class="history-time">${formatTime(item.timestamp)}</span>
          <span class="history-preset">${item.preset || 'clean'}</span>
        </div>
        <div class="history-raw">${escapeHtml(item.raw || '')}</div>
        <div class="history-enhanced">${escapeHtml(item.enhanced || '')}</div>
        <div class="history-actions">
          <button class="history-copy-btn" data-text="${escapeAttr(item.enhanced || item.raw || '')}">📋 Copy</button>
        </div>
      </div>
    `).join('');

    // Bind copy buttons
    list.querySelectorAll('.history-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.text).then(() => {
          btn.textContent = '✅ Copied!';
          setTimeout(() => btn.textContent = '📋 Copy', 1500);
        });
      });
    });
  });
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Search ─────────────────────────────────────────
let searchTimeout;
$('#sp-search-input').addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    renderHistory(e.target.value.toLowerCase().trim());
  }, 200);
});

// ── Clear All ──────────────────────────────────────
$('#sp-clear-all').addEventListener('click', () => {
  if (confirm('Clear all history?')) {
    chrome.storage.local.set({ history: [] }, () => renderHistory());
  }
});

// ── Open Settings ──────────────────────────────────
$('#sp-settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// ── Listen for storage changes ─────────────────────
chrome.storage.onChanged.addListener((changes) => {
  if (changes.history) renderHistory();
});

// ── Initial render ─────────────────────────────────
renderHistory();
