/**
 * TalkBro Desktop — Main Process
 * System tray, floating widget window, global hotkey, text insertion.
 */

const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, clipboard, screen, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');

// ── Settings Store ────────────────────────────────────
const store = new Store({
  defaults: {
    whisperModel: 'tiny',
    silenceTimeout: 2000,
    shortcut: 'Ctrl+Shift+V',
    theme: 'dark',
    autoStart: false,
    widgetPosition: null  // { x, y } or null for auto
  }
});

let tray = null;
let widgetWin = null;
let settingsWin = null;
let isRecording = false;

// ── App Ready ─────────────────────────────────────────
app.whenReady().then(() => {
  createTray();
  createWidgetWindow();
  registerGlobalShortcut();

  // Auto-start on login
  app.setLoginItemSettings({
    openAtLogin: store.get('autoStart', false)
  });
});

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (widgetWin) showWidget();
  });
}

// Prevent app from quitting when all windows closed (runs in tray)
app.on('window-all-closed', (e) => e.preventDefault());
app.on('will-quit', () => globalShortcut.unregisterAll());

// ══════════════════════════════════════════════════════
// ██ SYSTEM TRAY ██
// ══════════════════════════════════════════════════════

function createTray() {
  // Create a simple 16x16 icon programmatically (purple mic)
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    // Fallback: create a simple colored icon
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('TalkBro — Voice Typing');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '🎤 Start Dictation',
      click: () => toggleRecording()
    },
    { type: 'separator' },
    {
      label: '⚙️ Settings',
      click: () => openSettings()
    },
    {
      label: '📌 Show Widget',
      click: () => showWidget()
    },
    { type: 'separator' },
    {
      label: '❌ Quit TalkBro',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => toggleRecording());
}

// ══════════════════════════════════════════════════════
// ██ FLOATING WIDGET WINDOW ██
// ══════════════════════════════════════════════════════

function createWidgetWindow() {
  const savedPos = store.get('widgetPosition');
  const display = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = display.workAreaSize;

  widgetWin = new BrowserWindow({
    width: 72,
    height: 72,
    x: savedPos?.x ?? sw - 100,
    y: savedPos?.y ?? sh - 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,         // Don't steal focus from active app
    type: 'toolbar',          // Prevents alt-tab visibility on Windows
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  widgetWin.loadFile(path.join(__dirname, 'renderer', 'widget.html'));
  widgetWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Save position when moved
  widgetWin.on('moved', () => {
    const [x, y] = widgetWin.getPosition();
    store.set('widgetPosition', { x, y });
  });

  // Don't close, just hide
  widgetWin.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      widgetWin.hide();
    }
  });

  widgetWin.show();
}

function showWidget() {
  if (widgetWin) {
    widgetWin.show();
    widgetWin.moveTop();
  }
}

// Position widget near the cursor
function positionWidgetNearCursor() {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;

  // Position below-right of cursor, clamped to screen
  let wx = Math.min(cursor.x + 20, dx + dw - 80);
  let wy = Math.min(cursor.y + 20, dy + dh - 80);
  wx = Math.max(wx, dx);
  wy = Math.max(wy, dy);

  widgetWin.setPosition(wx, wy);
}

// ══════════════════════════════════════════════════════
// ██ GLOBAL SHORTCUT ██
// ══════════════════════════════════════════════════════

function registerGlobalShortcut() {
  const shortcut = store.get('shortcut', 'Ctrl+Shift+V');
  try {
    globalShortcut.register(shortcut, () => {
      toggleRecording();
    });
  } catch (err) {
    console.error('Failed to register shortcut:', err);
  }
}

function toggleRecording() {
  if (!widgetWin) return;

  if (!widgetWin.isVisible()) {
    showWidget();
  }

  isRecording = !isRecording;
  widgetWin.webContents.send(isRecording ? 'start-recording' : 'stop-recording');
}

// ══════════════════════════════════════════════════════
// ██ TEXT INSERTION (clipboard + Ctrl+V) ██
// ══════════════════════════════════════════════════════

ipcMain.handle('insert-text', async (event, text) => {
  if (!text || !text.trim()) return { success: false, error: 'Empty text' };

  try {
    // 1. Save current clipboard
    const originalClipboard = clipboard.readText();

    // 2. Copy transcript to clipboard
    clipboard.writeText(text);

    // 3. Small delay to ensure clipboard is updated
    await sleep(50);

    // 4. Simulate Ctrl+V using PowerShell (most reliable on Windows)
    const { exec } = require('child_process');
    await new Promise((resolve, reject) => {
      exec(
        'powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'^v\')"',
        (err) => err ? reject(err) : resolve()
      );
    });

    // 5. Wait for paste to complete
    await sleep(200);

    // 6. Restore original clipboard
    clipboard.writeText(originalClipboard);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ══════════════════════════════════════════════════════
// ██ IPC HANDLERS ██
// ══════════════════════════════════════════════════════

ipcMain.handle('get-settings', () => store.store);

ipcMain.handle('save-settings', (event, settings) => {
  Object.entries(settings).forEach(([k, v]) => store.set(k, v));

  // Re-register shortcut if changed
  if (settings.shortcut) {
    globalShortcut.unregisterAll();
    registerGlobalShortcut();
  }

  // Update auto-start
  if (settings.autoStart !== undefined) {
    app.setLoginItemSettings({ openAtLogin: settings.autoStart });
  }

  return { success: true };
});

ipcMain.handle('get-cursor-position', () => screen.getCursorScreenPoint());

ipcMain.handle('get-transformers-path', () => {
  // In dev: use ../lib/transformers relative to desktop/
  // In production: use extraResources
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'transformers');
  }
  return path.join(__dirname, '..', 'lib', 'transformers');
});

ipcMain.handle('resize-widget', (event, width, height) => {
  if (widgetWin) {
    widgetWin.setSize(Math.round(width), Math.round(height));
  }
});

ipcMain.handle('set-widget-focusable', (event, focusable) => {
  if (widgetWin) {
    widgetWin.setFocusable(focusable);
  }
});

// ══════════════════════════════════════════════════════
// ██ SETTINGS WINDOW ██
// ══════════════════════════════════════════════════════

function openSettings() {
  if (settingsWin) {
    settingsWin.focus();
    return;
  }

  settingsWin = new BrowserWindow({
    width: 520,
    height: 600,
    frame: true,
    resizable: false,
    title: 'TalkBro Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWin.loadFile(path.join(__dirname, 'settings', 'settings.html'));
  settingsWin.setMenuBarVisibility(false);

  settingsWin.on('closed', () => {
    settingsWin = null;
  });
}

// ── Utilities ─────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
