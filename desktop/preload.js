/**
 * TalkBro Desktop — Preload Script
 * Securely exposes IPC bridge to renderer processes.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('talkbro', {
  // ── Recording Control ──
  onStartRecording: (callback) => ipcRenderer.on('start-recording', callback),
  onStopRecording: (callback) => ipcRenderer.on('stop-recording', callback),

  // ── Text Insertion ──
  insertText: (text) => ipcRenderer.invoke('insert-text', text),

  // ── Settings ──
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // ── Widget Control ──
  getCursorPosition: () => ipcRenderer.invoke('get-cursor-position'),
  getTransformersPath: () => ipcRenderer.invoke('get-transformers-path'),
  resizeWidget: (w, h) => ipcRenderer.invoke('resize-widget', w, h),
  setFocusable: (val) => ipcRenderer.invoke('set-widget-focusable', val)
});
