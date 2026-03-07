/**
 * TalkBro — Content Script (fully self-contained)
 * All HTML, CSS, and JS inline — guaranteed to render.
 */

(function () {
  'use strict';
  console.log('%c[TalkBro] Content script loaded', 'color:#7c5cfc;font-weight:bold');

  // ── CSS (must be defined BEFORE init() is called) ──
  const CSS_TEXT = `
    * { box-sizing:border-box; margin:0; padding:0; }

    .tb { font-family:'Segoe UI',system-ui,sans-serif; font-size:14px; color:#e8e8f0; line-height:1.5; }
    .tb-pill { display:flex; align-items:center; gap:8px; padding:10px 18px; background:rgba(15,15,25,0.95); border:1px solid rgba(255,255,255,0.12); border-radius:50px; color:#e8e8f0; font-size:13px; font-weight:600; cursor:pointer; box-shadow:0 8px 32px rgba(0,0,0,0.5); transition:all 0.25s; user-select:none; }
    .tb-pill:hover { transform:scale(1.05); border-color:#7c5cfc; box-shadow:0 8px 32px rgba(0,0,0,0.5),0 0 20px rgba(124,92,252,0.3); }
    .tb-pill svg { width:18px; height:18px; color:#7c5cfc; flex-shrink:0; }

    .tb-panel { display:none; flex-direction:column; width:370px; max-height:540px; background:rgba(15,15,25,0.95); border:1px solid rgba(255,255,255,0.12); border-radius:16px; box-shadow:0 8px 32px rgba(0,0,0,0.5); overflow:hidden; animation:tbIn 0.3s ease; }
    @keyframes tbIn { from{opacity:0;transform:translateY(12px) scale(0.97)} to{opacity:1;transform:none} }

    .tb-hdr { display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid rgba(255,255,255,0.08); cursor:grab; user-select:none; }
    .tb-hdr:active { cursor:grabbing; }
    .tb-hdr-l { display:flex; align-items:center; gap:8px; }
    .tb-hdr-l svg { width:20px; height:20px; color:#7c5cfc; }
    .tb-title { font-size:14px; font-weight:700; background:linear-gradient(135deg,#7c5cfc,#a78bfa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .tb-hdr-r { display:flex; align-items:center; gap:4px; }
    .tb-sel { appearance:none; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:#e8e8f0; font-size:12px; padding:4px 8px; cursor:pointer; }
    .ib { display:flex; align-items:center; justify-content:center; width:30px; height:30px; border:none; background:transparent; color:#8888a0; border-radius:8px; cursor:pointer; transition:0.2s; }
    .ib:hover { background:rgba(255,255,255,0.1); color:#e8e8f0; }
    .ib svg { width:16px; height:16px; }

    .tb-body { flex:1; overflow-y:auto; }
    .tb-idle { display:flex; flex-direction:column; align-items:center; gap:12px; padding:32px 14px; text-align:center; color:#8888a0; }
    .tb-idle svg { width:40px; height:40px; opacity:0.4; animation:fl 3s ease-in-out infinite; }
    .tb-idle p { font-size:13px; }
    @keyframes fl { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }

    .tb-wave { display:none; flex-direction:column; align-items:center; gap:8px; padding:12px 14px; }
    .tb-wave canvas { width:100%; height:48px; border-radius:10px; background:rgba(255,255,255,0.06); }
    .rdot { display:flex; align-items:center; gap:6px; font-size:12px; color:#f87171; font-weight:500; }
    .rdot::before { content:''; width:8px; height:8px; background:#f87171; border-radius:50%; animation:bk 1s infinite; }
    @keyframes bk { 0%,100%{opacity:1} 50%{opacity:0.3} }

    .tb-res { display:none; flex-direction:column; gap:10px; padding:12px 14px; overflow-y:auto; max-height:360px; }
    .tb-card { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); border-radius:10px; overflow:hidden; animation:ci 0.3s ease; }
    @keyframes ci { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
    .tb-card.enh { border-color:rgba(124,92,252,0.25); background:rgba(124,92,252,0.08); }
    .ch { display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-bottom:1px solid rgba(255,255,255,0.06); }
    .cl { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#8888a0; }
    .ehl { color:#7c5cfc; }
    .cb { display:flex; align-items:center; justify-content:center; width:28px; height:28px; border:none; background:transparent; color:#8888a0; border-radius:6px; cursor:pointer; transition:0.2s; }
    .cb:hover { background:rgba(124,92,252,0.15); color:#7c5cfc; }
    .cb.cpd { color:#34d399 !important; }
    .cb svg { width:14px; height:14px; }
    .cc { padding:10px 12px; font-size:13px; line-height:1.6; white-space:pre-wrap; word-break:break-word; color:#e8e8f0; max-height:160px; overflow-y:auto; }
    .raw .cc { color:#8888a0; font-size:12px; }

    .tb-proc { display:none; flex-direction:column; align-items:center; gap:12px; padding:24px 14px; }
    .shim { width:100%; display:flex; flex-direction:column; gap:8px; }
    .sl { height:12px; border-radius:6px; background:linear-gradient(90deg,rgba(255,255,255,0.06) 25%,rgba(255,255,255,0.1) 50%,rgba(255,255,255,0.06) 75%); background-size:200% 100%; animation:sh 1.5s infinite; }
    .sl.s { width:60%; }
    @keyframes sh { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    .pt { font-size:12px; color:#8888a0; }

    .tb-toast { display:none; position:absolute; bottom:72px; left:14px; right:14px; padding:10px 14px; border-radius:10px; font-size:12px; font-weight:500; z-index:10; }
    .tb-toast.show { display:block; }
    .tb-toast.error { background:rgba(248,113,113,0.15); border:1px solid rgba(248,113,113,0.3); color:#f87171; }
    .tb-toast.info { background:rgba(124,92,252,0.1); border:1px solid rgba(124,92,252,0.3); color:#7c5cfc; }

    .tb-foot { display:flex; align-items:center; justify-content:center; gap:12px; padding:14px; border-top:1px solid rgba(255,255,255,0.08); }
    .mic { display:flex; align-items:center; justify-content:center; width:52px; height:52px; border:none; border-radius:50%; background:linear-gradient(135deg,#7c5cfc,#6d28d9); color:white; cursor:pointer; box-shadow:0 4px 16px rgba(124,92,252,0.4); transition:0.25s; }
    .mic svg { width:24px; height:24px; }
    .mic:hover { transform:scale(1.08); }
    .mic:active { transform:scale(0.95); }
    .mic.rec { background:linear-gradient(135deg,#f87171,#dc2626); box-shadow:0 4px 16px rgba(248,113,113,0.4); animation:mp 1.5s infinite; }
    @keyframes mp { 0%,100%{box-shadow:0 4px 16px rgba(248,113,113,0.4)} 50%{box-shadow:0 4px 32px rgba(248,113,113,0.6)} }

    .clr { display:none; align-items:center; gap:6px; padding:8px 14px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.06); color:#8888a0; border-radius:10px; font-family:inherit; font-size:12px; cursor:pointer; transition:0.2s; }
    .clr:hover { background:rgba(255,255,255,0.1); color:#e8e8f0; }
    .clr svg { width:14px; height:14px; }
  `;

  // Don't run on chrome:// or extension pages
  if (location.protocol === 'chrome:' || location.protocol === 'chrome-extension:') {
    console.log('[TalkBro] Skipping — chrome:// or extension page');
    return;
  }

  // Prevent double injection
  if (document.getElementById('talkbro-host')) {
    console.log('[TalkBro] Already injected, skipping');
    return;
  }

  // Wait for body
  if (!document.body) {
    console.log('[TalkBro] Waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[TalkBro] DOMContentLoaded fired, calling init()');
      init();
    });
    return;
  }
  console.log('[TalkBro] Body exists, calling init() immediately');
  init();

  function init() {
    if (document.getElementById('talkbro-host')) {
      console.log('[TalkBro] init() — host already exists, skipping');
      return;
    }
    try {
    console.log('[TalkBro] init() — creating shadow DOM host...');

    // ── Create Shadow Host with INLINE styles ──
    const host = document.createElement('div');
    host.id = 'talkbro-host';
    host.setAttribute('style', 'position:fixed !important; bottom:20px !important; right:20px !important; z-index:2147483647 !important; display:block !important; visibility:visible !important; opacity:1 !important; pointer-events:auto !important; width:auto !important; height:auto !important; margin:0 !important; padding:0 !important; transform:none !important; overflow:visible !important;');
    
    // Prefer body over documentElement for more reliable rendering
    const parent = document.body || document.documentElement;
    parent.appendChild(host);
    console.log('[TalkBro] Host element appended to', parent.tagName);

    const shadow = host.attachShadow({ mode: 'open' });

    // ── CSS ──
    const style = document.createElement('style');
    style.textContent = CSS_TEXT;
    shadow.appendChild(style);

    // ── HTML ──
    const micSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
    const copySVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    const checkSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';

    const container = document.createElement('div');
    container.innerHTML = `
      <div class="tb" id="tb">
        <div class="tb-pill" id="pill">${micSVG}<span>TalkBro</span></div>
        <div class="tb-panel" id="panel">
          <div class="tb-hdr" id="drag">
            <div class="tb-hdr-l">${micSVG}<span class="tb-title">TalkBro</span></div>
            <div class="tb-hdr-r">
              <select class="tb-sel" id="preset"><option value="clean">Clean Up</option><option value="formal">Formal</option><option value="bullets">Bullets</option><option value="email">Email</option><option value="code">Code Docs</option><option value="summary">Summary</option></select>
              <button class="ib" id="setBtn" title="Settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg></button>
              <button class="ib" id="minBtn" title="Minimize"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
            </div>
          </div>
          <div class="tb-body">
            <div class="tb-idle" id="idle">${micSVG}<p>Tap the mic to start speaking</p></div>
            <div class="tb-wave" id="wave"><canvas id="cv"></canvas><span class="rdot">Recording...</span></div>
            <div class="tb-res" id="res">
              <div class="tb-card raw"><div class="ch"><span class="cl">Raw Transcript</span><button class="cb" id="cpR">${copySVG}</button></div><div class="cc" id="rTxt"></div></div>
              <div class="tb-card enh"><div class="ch"><span class="cl ehl">Enhanced</span><button class="cb" id="cpE">${copySVG}</button></div><div class="cc" id="eTxt"></div></div>
            </div>
            <div class="tb-proc" id="proc"><div class="shim"><div class="sl"></div><div class="sl s"></div><div class="sl"></div></div><span class="pt">Enhancing your text...</span></div>
          </div>
          <div class="tb-toast" id="toast"></div>
          <div class="tb-foot">
            <button class="mic" id="mic">${micSVG}</button>
            <button class="clr" id="clr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Clear</button>
          </div>
        </div>
      </div>
    `;
    shadow.appendChild(container.firstElementChild);

    // ── LOGIC ──
    const q = (id) => shadow.getElementById(id);
    const tb = q('tb'), pill = q('pill'), panel = q('panel');
    const mic = q('mic'), clr = q('clr'), minBtn = q('minBtn'), setBtn = q('setBtn');
    const preset = q('preset'), wave = q('wave'), cv = q('cv');
    const idle = q('idle'), res = q('res'), proc = q('proc');
    const rTxt = q('rTxt'), eTxt = q('eTxt'), toast = q('toast');
    const cpR = q('cpR'), cpE = q('cpE'), drag = q('drag');
    const ctx = cv ? cv.getContext('2d') : null;

    let recording = false, mr = null, chunks = [], actx = null, an = null;
    let strm = null, stmr = null, af = null, dragging = false, doff = {x:0,y:0};
    let silMs = 2000, sr = null, ltx = '';

    // Toggle
    pill.onclick = () => { panel.style.display = 'flex'; pill.style.display = 'none'; };
    minBtn.onclick = () => { panel.style.display = 'none'; pill.style.display = 'flex'; if (recording) stopR(); };

    // Drag
    drag.onmousedown = (e) => {
      dragging = true;
      const r = host.getBoundingClientRect();
      doff = { x: e.clientX - r.left, y: e.clientY - r.top };
      const mv = (e2) => { if (!dragging) return; host.style.right = 'auto'; host.style.bottom = 'auto'; host.style.left = (e2.clientX - doff.x)+'px'; host.style.top = (e2.clientY - doff.y)+'px'; };
      const up = () => { dragging = false; document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    };

    // Record
    mic.onclick = () => { if (recording) stopR(); else startR(); };

    async function startR() {
      try {
        strm = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        actx = new AudioContext();
        const s = actx.createMediaStreamSource(strm);
        an = actx.createAnalyser(); an.fftSize = 256;
        s.connect(an);
        const mt = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
        mr = new MediaRecorder(strm, { mimeType: mt });
        chunks = [];
        mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        mr.start(100);
        recording = true;
        startSR();
        mic.classList.add('rec');
        idle.style.display = 'none'; res.style.display = 'none'; proc.style.display = 'none';
        wave.style.display = 'flex'; clr.style.display = 'none';
        drawW(); detectS();
      } catch (e) { showT(e.message || 'Mic denied', 'error'); }
    }

    async function stopR() {
      recording = false; mic.classList.remove('rec');
      if (af) cancelAnimationFrame(af);
      if (stmr) { clearTimeout(stmr); stmr = null; }
      stopSR();
      const blob = await new Promise(r => {
        if (!mr || mr.state === 'inactive') { r(null); return; }
        mr.onstop = () => r(new Blob(chunks, { type: mr.mimeType }));
        mr.stop();
      });
      if (strm) strm.getTracks().forEach(t => t.stop());
      if (actx) actx.close(); actx = null; an = null;
      wave.style.display = 'none';
      if (ltx.trim()) processT(ltx.trim());
      else if (blob && blob.size > 0) processB(blob);
      else { showT('No speech detected', 'info'); idle.style.display = ''; }
    }

    // Live speech
    function startSR() {
      const S = window.SpeechRecognition || window.webkitSpeechRecognition; if (!S) return;
      ltx = ''; sr = new S(); sr.continuous = true; sr.interimResults = true; sr.lang = 'en-US';
      sr.onresult = (e) => { let f='',i=''; for (let j=0;j<e.results.length;j++) { if (e.results[j].isFinal) f+=e.results[j][0].transcript; else i+=e.results[j][0].transcript; } ltx = f||i; };
      sr.onerror = () => {}; try { sr.start(); } catch {}
    }
    function stopSR() { if (sr) { try { sr.stop(); } catch {} sr = null; } }

    // Process text → LLM
    async function processT(raw) {
      rTxt.textContent = raw; res.style.display = 'flex'; proc.style.display = 'flex'; idle.style.display = 'none';
      try {
        const r = await chrome.runtime.sendMessage({ type: 'ENHANCE_TEXT', rawText: raw, preset: preset.value });
        proc.style.display = 'none';
        if (r && r.success) { eTxt.textContent = r.enhanced; clr.style.display = 'flex'; chrome.runtime.sendMessage({ type: 'SAVE_HISTORY', entry: { raw, enhanced: r.enhanced, preset: preset.value } }); }
        else { eTxt.textContent = raw; showT((r&&r.error)||'Enhancement failed','error'); clr.style.display = 'flex'; }
      } catch { proc.style.display = 'none'; eTxt.textContent = raw; showT('Cannot reach LLM','error'); clr.style.display = 'flex'; }
    }

    // Process blob → Whisper
    async function processB(blob) {
      proc.style.display = 'flex'; idle.style.display = 'none';
      try {
        const rd = new FileReader();
        const b64 = await new Promise((ok,no) => { rd.onloadend = () => ok(rd.result.split(',')[1]); rd.onerror = no; rd.readAsDataURL(blob); });
        const r = await chrome.runtime.sendMessage({ type: 'TRANSCRIBE_AUDIO', audioData: { base64: b64, mimeType: blob.type } });
        if (r && r.success && r.transcript) processT(r.transcript);
        else { proc.style.display = 'none'; idle.style.display = ''; showT((r&&r.error)||'Transcription failed','error'); }
      } catch { proc.style.display = 'none'; idle.style.display = ''; showT('Whisper server unreachable','error'); }
    }

    // Waveform
    function drawW() {
      if (!recording||!an||!ctx) return;
      const b = new Uint8Array(an.frequencyBinCount); an.getByteFrequencyData(b);
      const W = cv.width = cv.offsetWidth*2, H = cv.height = cv.offsetHeight*2;
      ctx.clearRect(0,0,W,H);
      const bw = (W/b.length)*2.5; let x = 0;
      for (let i=0;i<b.length;i++) { const bh=(b[i]/255)*H*0.8; ctx.fillStyle=`hsla(${250+(b[i]/255)*30},70%,65%,0.8)`; ctx.fillRect(x,H-bh,bw-1,bh); x+=bw; }
      af = requestAnimationFrame(drawW);
    }

    // Silence
    function detectS() {
      const b = new Uint8Array(an.frequencyBinCount);
      (function ck() { if (!recording) return; an.getByteFrequencyData(b); const a=b.reduce((a,b)=>a+b,0)/b.length;
        if (a<10) { if (!stmr) stmr = setTimeout(()=>{if(recording)stopR();}, silMs); } else { if (stmr){clearTimeout(stmr);stmr=null;} }
        setTimeout(ck,200);
      })();
    }

    // Copy
    function bindC(btn, fn) {
      btn.onclick = () => navigator.clipboard.writeText(fn()).then(() => { btn.classList.add('cpd'); const o=btn.innerHTML; btn.innerHTML=checkSVG; setTimeout(()=>{btn.classList.remove('cpd');btn.innerHTML=o;},1500); });
    }
    bindC(cpR, () => rTxt.textContent);
    bindC(cpE, () => eTxt.textContent);

    // Clear
    clr.onclick = () => { rTxt.textContent=''; eTxt.textContent=''; res.style.display='none'; clr.style.display='none'; idle.style.display=''; ltx=''; };

    // Settings
    setBtn.onclick = () => chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });

    // Toast
    function showT(m, t) { toast.textContent = m; toast.className = 'tb-toast show ' + t; setTimeout(() => toast.classList.remove('show'), 4000); }

    // Background messages
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'TOGGLE_PANEL') { if (panel.style.display === 'flex') { panel.style.display='none'; pill.style.display='flex'; } else { panel.style.display='flex'; pill.style.display='none'; } }
      if (msg.type === 'TOGGLE_RECORDING') { if (panel.style.display !== 'flex') { panel.style.display='flex'; pill.style.display='none'; } setTimeout(()=>{if(recording)stopR();else startR();},300); }
    });

    // Load settings
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }).then(r => { if (r&&r.success) { silMs = r.settings.silenceTimeout||2000; if (r.settings.enhancementPreset) preset.value = r.settings.enhancementPreset; } }).catch(()=>{});

    console.log('%c[TalkBro] Ready! Panel and pill created successfully.', 'color:#34d399;font-size:16px;font-weight:bold');
    console.log('[TalkBro] Pill display:', pill.style.display || 'default (flex via CSS)');
    console.log('[TalkBro] Panel display:', panel.style.display || 'default (none via CSS)');
    console.log('[TalkBro] Host computed visibility:', window.getComputedStyle(host).visibility);
    console.log('[TalkBro] Host computed display:', window.getComputedStyle(host).display);
    } catch (err) {
      console.error('[TalkBro] FATAL ERROR in init():', err);
    }
  }
})();

