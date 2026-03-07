/**
 * TalkBro — Audio Recorder
 * MediaRecorder wrapper with silence detection and waveform data.
 */

export class AudioRecorder {
  constructor(options = {}) {
    this.silenceTimeout = options.silenceTimeout || 2000;
    this.onSilence = options.onSilence || null;
    this.onWaveform = options.onWaveform || null;
    this.onStateChange = options.onStateChange || null;

    this.mediaRecorder = null;
    this.audioContext = null;
    this.analyser = null;
    this.stream = null;
    this.chunks = [];
    this.silenceTimer = null;
    this.animationFrame = null;
    this.state = 'idle'; // idle | recording | paused
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      });

      // Set up analyser for waveform and silence detection
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
      this.state = 'recording';
      this._emitState();
      this._startWaveformLoop();
      this._startSilenceDetection();

    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Microphone access denied. Please allow microphone access in your browser settings.');
      }
      throw err;
    }
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
        this._cleanup();
        resolve(blob);
      };

      this.mediaRecorder.stop();
      this.state = 'idle';
      this._emitState();
    });
  }

  _cleanup() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.audioContext) this.audioContext.close();
    this.analyser = null;
    this.audioContext = null;
    this.stream = null;
    this.chunks = [];
  }

  _startWaveformLoop() {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const loop = () => {
      if (this.state !== 'recording') return;
      this.analyser.getByteFrequencyData(dataArray);
      if (this.onWaveform) this.onWaveform(dataArray);
      this.animationFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  _startSilenceDetection() {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    const SILENCE_THRESHOLD = 10;

    const check = () => {
      if (this.state !== 'recording') return;

      this.analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

      if (avg < SILENCE_THRESHOLD) {
        if (!this.silenceTimer) {
          this.silenceTimer = setTimeout(() => {
            if (this.onSilence) this.onSilence();
          }, this.silenceTimeout);
        }
      } else {
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
      }

      setTimeout(check, 200);
    };
    check();
  }

  _emitState() {
    if (this.onStateChange) this.onStateChange(this.state);
  }

  getState() {
    return this.state;
  }
}
