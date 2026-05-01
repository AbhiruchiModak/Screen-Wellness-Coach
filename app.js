'use strict';

// ═══════════════════════════════════════════════
// Service Worker Registration
// ═══════════════════════════════════════════════
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(r => console.log('SW registered:', r.scope))
            .catch(e => console.warn('SW registration failed:', e));
    });
}

// ═══════════════════════════════════════════════
// Listen for notification action messages from the Service Worker
// Uses BroadcastChannel (primary) + serviceWorker message event (fallback)
// ═══════════════════════════════════════════════
function handleSwMessage(data) {
    const { action, timerName } = data || {};
    if (!timerName || !TIMER_NAMES.includes(timerName)) return;
    if (action === 'understood') handleUnderstood(timerName);
    else if (action === 'snooze') handleSnooze(timerName);
}

// BroadcastChannel — works even when the page is not a controlled SW client
if (typeof BroadcastChannel !== 'undefined') {
    const bc = new BroadcastChannel('wellness-actions');
    bc.addEventListener('message', e => handleSwMessage(e.data));
}

// serviceWorker postMessage fallback
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', e => handleSwMessage(e.data));
}

// ═══════════════════════════════════════════════
// Guided Setup Wizard
// ═══════════════════════════════════════════════
let currentStep = 1;
const TOTAL_STEPS = 6;

function openWizard() {
    currentStep = 1;
    renderStep();
    document.getElementById('wizard-overlay').classList.remove('hidden');
}

function closeWizard() {
    document.getElementById('wizard-overlay').classList.add('hidden');
    localStorage.setItem('wizardSeen', '1');
}

function wizardNext() {
    if (currentStep < TOTAL_STEPS) { currentStep++; renderStep(); }
    else closeWizard();
}

function wizardBack() {
    if (currentStep > 1) { currentStep--; renderStep(); }
}

function renderStep() {
    for (let i = 1; i <= TOTAL_STEPS; i++) {
        document.getElementById(`step-${i}`).classList.toggle('active', i === currentStep);
        const dot = document.getElementById(`dot-${i}`);
        if (dot) dot.classList.toggle('active', i === currentStep);
    }
}

// Show wizard on first visit
document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('wizardSeen')) {
        openWizard();
    } else {
        document.getElementById('wizard-overlay').classList.add('hidden');
    }
    checkNotificationPermission();
});

// ═══════════════════════════════════════════════
// Accessibility — High Contrast & Font Size
// ═══════════════════════════════════════════════
// Font size steps in px applied directly to <html> so every rem scales
const FONT_SIZE_STEPS  = [16, 20, 24];          // px values: normal → large → extra-large
const FONTSIZE_LABELS  = ['Larger Text', 'Extra Large', 'Normal Text'];
let fontSizeIdx = 0;

function applyFontSize(idx) {
    document.documentElement.style.fontSize = FONT_SIZE_STEPS[idx] + 'px';
}

function toggleContrast() {
    const on = document.body.classList.toggle('hc');
    const btn = document.getElementById('btn-contrast');
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('on', on);
    localStorage.setItem('hc', on ? '1' : '');
}

function cycleFontSize() {
    fontSizeIdx = (fontSizeIdx + 1) % FONT_SIZE_STEPS.length;
    applyFontSize(fontSizeIdx);
    document.getElementById('fontsize-label').textContent = FONTSIZE_LABELS[fontSizeIdx];
    localStorage.setItem('fsIdx', fontSizeIdx);
}

// Restore preferences
(function restorePrefs() {
    if (localStorage.getItem('hc')) {
        document.body.classList.add('hc');
        const btn = document.getElementById('btn-contrast');
        if (btn) { btn.setAttribute('aria-pressed', 'true'); btn.classList.add('on'); }
    }
    const saved = parseInt(localStorage.getItem('fsIdx') || '0', 10);
    if (saved > 0 && saved < FONT_SIZE_STEPS.length) {
        fontSizeIdx = saved;
        applyFontSize(fontSizeIdx);
        const lbl = document.getElementById('fontsize-label');
        if (lbl) lbl.textContent = FONTSIZE_LABELS[fontSizeIdx];
    }
})();

// ═══════════════════════════════════════════════
// Notifications
// ═══════════════════════════════════════════════
function notifAllowed() {
    return 'Notification' in window && Notification.permission === 'granted';
}

async function requestNotificationPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'denied') {
        alert('Notifications are blocked. Please enable them in your browser site settings and reload the page.');
        return false;
    }
    if (Notification.permission === 'granted') { hideBanner(); return true; }
    const result = await Notification.requestPermission();
    if (result === 'granted') { hideBanner(); return true; }
    return false;
}

function checkNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') showBanner();
}

function showBanner() { document.getElementById('notif-banner')?.classList.add('visible'); }
function hideBanner()  { document.getElementById('notif-banner')?.classList.remove('visible'); }

function getSwReg() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return Promise.race([
        navigator.serviceWorker.ready,
        new Promise(r => setTimeout(() => r(null), 2000))
    ]).catch(() => null);
}

/**
 * Send a notification with "I understood" and "Snooze 10 min" action buttons.
 * Uses SW showNotification for background delivery; falls back to plain Notification.
 */
function sendNotification(title, body, tag) {
    if (!notifAllowed()) { console.warn('Notification skipped — no permission.'); return; }

    // SW notifications support actions; plain Notification() does not.
    const swOptions = {
        body,
        tag,
        icon:               'icons/icon-192.png',
        badge:              'icons/icon-192.png',
        renotify:           true,
        requireInteraction: false,
        silent:             false,
        actions: [
            { action: 'understood', title: 'I understood' },
            { action: 'snooze',     title: 'Snooze 10 min' }
        ],
        data: { timerName: tag }
    };

    // Plain Notification() does not accept actions or data — stripped version only
    const plainOptions = {
        body,
        tag,
        icon:               'icons/icon-192.png',
        renotify:           true,
        silent:             false,
    };

    getSwReg().then(swReg => {
        if (swReg && typeof swReg.showNotification === 'function') {
            swReg.showNotification(title, swOptions).catch(err => {
                console.warn('SW notification failed, using fallback:', err);
                plainNotif(title, plainOptions);
            });
        } else {
            plainNotif(title, plainOptions);
        }
    });
}

function plainNotif(title, options) {
    try { new Notification(title, options); }
    catch (e) { console.warn('Notification() failed:', e); }
}

// ═══════════════════════════════════════════════
// Timer State
// ═══════════════════════════════════════════════
const TIMER_NAMES = ['blink', 'posture', 'stretch', 'screen'];

const timerDefaults = {
    blink:   { interval: 20,   label: 'Blink Reminder',  body: 'Time to blink. Rest your eyes for a moment.' },
    posture: { interval: 300,  label: 'Posture Check',   body: 'Sit up straight and check your posture.' },
    stretch: { interval: 1200, label: 'Stretch Break',   body: 'Stand up and take a short stretching break.' },
    screen:  { interval: 1200, label: 'Screen Break',    body: 'Look away from the screen for at least 20 seconds.' },
};

// Runtime state per timer
const timers = {};
TIMER_NAMES.forEach(name => {
    timers[name] = {
        interval:     timerDefaults[name].interval,
        remaining:    timerDefaults[name].interval,
        active:       false,
        ticker:       null,
        // Frequency mode
        freqEnabled:      false,
        freqN:            timerDefaults[name].interval,
        freqM:            timerDefaults[name].interval * 3,
        freqWindow:       null,
        freqInWindow:     false,
        freqWindowCount:  0,
        freqWindowSecs:   0,
        // Snooze
        snoozed:      false,
        snoozeTimer:  null,
    };
});

// ═══════════════════════════════════════════════
// Timer Display Helpers
// ═══════════════════════════════════════════════
function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function updateDisplay(name) {
    const t = timers[name];
    const disp = document.getElementById(`disp-${name}`);
    if (disp) {
        if (t.snoozed) {
            disp.textContent = 'Snoozed';
        } else {
            disp.textContent = fmt(t.remaining);
        }
    }
    const inp = document.getElementById(`inp-${name}`);
    if (inp) inp.value = fmt(t.interval);
}

// ═══════════════════════════════════════════════
// Core Timer Logic
// ═══════════════════════════════════════════════
function toggleTimer(name) {
    const t = timers[name];
    t.active = document.getElementById(`tog-${name}`).checked;

    if (t.active) {
        if (!notifAllowed()) requestNotificationPermission();
        startTimerTicker(name);
    } else {
        stopTimerCompletely(name);
    }
}

function startTimerTicker(name) {
    const t = timers[name];
    t.remaining = t.interval;
    t.snoozed = false;
    document.getElementById(`card-${name}`)?.classList.remove('snoozed');
    updateDisplay(name);

    clearInterval(t.ticker);
    t.ticker = setInterval(() => {
        if (t.snoozed) return; // paused during snooze
        t.remaining--;
        if (t.remaining <= 0) {
            fireReminder(name);
            t.remaining = t.interval;
        }
        updateDisplay(name);
    }, 1000);
}

function stopTimerCompletely(name) {
    const t = timers[name];
    clearInterval(t.ticker);
    clearTimeout(t.snoozeTimer);
    clearTimeout(t.freqWindow);
    t.active       = false;
    t.snoozed      = false;
    t.freqInWindow = false;
    t.freqWindowCount = 0;
    t.remaining    = t.interval;
    document.getElementById(`card-${name}`)?.classList.remove('snoozed');
    updateDisplay(name);
}

function fireReminder(name) {
    const t = timers[name];
    const { label, body } = timerDefaults[name];

    if (t.freqEnabled) {
        if (!t.freqInWindow) {
            // Open the window
            t.freqInWindow    = true;
            t.freqWindowCount = 0;
            clearTimeout(t.freqWindow);
            t.freqWindow = setTimeout(() => {
                // M seconds elapsed — stop this timer entirely
                t.freqInWindow    = false;
                t.freqWindowCount = 0;
                const cb = document.getElementById(`tog-${name}`);
                if (cb) cb.checked = false;
                stopTimerCompletely(name);
            }, t.freqM * 1000);
        }
        sendNotification(label, body, name);
    } else {
        sendNotification(label, body, name);
    }
}

// ═══════════════════════════════════════════════
// Notification action handlers
// ═══════════════════════════════════════════════

/** User tapped "I understood" — turn off this timer */
function handleUnderstood(name) {
    if (!TIMER_NAMES.includes(name)) return;
    const checkbox = document.getElementById(`tog-${name}`);
    if (checkbox) checkbox.checked = false;
    stopTimerCompletely(name);
    timers[name].active = false;
    console.log(`Timer "${name}" turned off by user (I understood).`);
}

/** User tapped "Snooze 10 min" — pause this timer for 10 minutes */
function handleSnooze(name) {
    if (!TIMER_NAMES.includes(name)) return;
    const t = timers[name];
    if (!t.active) return;

    // Stop any active frequency burst
    clearInterval(t.freqBurst);
    clearTimeout(t.freqWindow);
    t.freqInWindow = false;

    t.snoozed = true;
    document.getElementById(`card-${name}`)?.classList.add('snoozed');
    updateDisplay(name);

    clearTimeout(t.snoozeTimer);
    t.snoozeTimer = setTimeout(() => {
        t.snoozed = false;
        t.remaining = t.interval;
        document.getElementById(`card-${name}`)?.classList.remove('snoozed');
        updateDisplay(name);
        console.log(`Snooze over for "${name}", resuming.`);
    }, 10 * 60 * 1000); // 10 minutes
}

// ═══════════════════════════════════════════════
// Frequency Panel UI
// ═══════════════════════════════════════════════
function toggleFreq(name) {
    const panel = document.getElementById(`freq-panel-${name}`);
    const btn   = document.getElementById(`freq-btn-${name}`);
    const open  = panel.classList.toggle('visible');
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
}

function updateFreqHint(name) {
    const nEl      = document.getElementById(`freq-n-${name}`);
    const mEl      = document.getElementById(`freq-m-${name}`);
    const hint     = document.getElementById(`freq-hint-${name}`);
    const enabledEl = document.getElementById(`freq-enabled-${name}`);
    if (!nEl || !mEl || !hint || !enabledEl) return;

    const n       = Math.max(5, parseInt(nEl.value, 10) || 5);
    const m       = Math.max(n + 1, parseInt(mEl.value, 10) || n + 1);
    const enabled = enabledEl.checked;

    // --- Immediately sync timer state ---
    const t = timers[name];
    t.freqEnabled = enabled;
    t.freqN       = n;
    t.freqM       = m;

    if (enabled) {
        // The main ticker interval becomes N seconds (fires every N s)
        t.interval = n;
        hint.textContent = `Reminder every ${n}s, repeated for ${m}s (~${Math.floor(m / n)} times) per cycle.`;
    } else {
        // Restore default interval from timerDefaults
        t.interval = timerDefaults[name].interval;
        hint.textContent = 'Frequency mode off. Reminder fires once per cycle.';
    }

    // If the timer is currently running, restart it with the new interval
    if (t.active) {
        clearInterval(t.ticker);
        clearTimeout(t.freqWindow);
        t.freqInWindow    = false;
        t.freqWindowCount = 0;
        t.remaining       = t.interval;
        updateDisplay(name);
        t.ticker = setInterval(() => {
            if (t.snoozed) return;
            t.remaining--;
            if (t.remaining <= 0) {
                fireReminder(name);
                t.remaining = t.interval;
            }
            updateDisplay(name);
        }, 1000);
    } else {
        t.remaining = t.interval;
        updateDisplay(name);
    }
}

// Wire up live input listeners after DOM ready
document.addEventListener('DOMContentLoaded', () => {
    TIMER_NAMES.forEach(name => {
        document.getElementById(`freq-n-${name}`)?.addEventListener('input', () => updateFreqHint(name));
        document.getElementById(`freq-m-${name}`)?.addEventListener('input', () => updateFreqHint(name));
        document.getElementById(`freq-enabled-${name}`)?.addEventListener('change', () => updateFreqHint(name));
    });
});

// ═══════════════════════════════════════════════
// Global Controls
// ═══════════════════════════════════════════════
async function startAll() {
    await requestNotificationPermission();
    TIMER_NAMES.forEach(name => {
        const cb = document.getElementById(`tog-${name}`);
        if (cb && !cb.checked) { cb.checked = true; toggleTimer(name); }
    });
}

function resetAll() {
    TIMER_NAMES.forEach(name => {
        const cb = document.getElementById(`tog-${name}`);
        if (cb) cb.checked = false;
        stopTimerCompletely(name);
    });
}

function adjustInterval(name, delta) {
    const t = timers[name];
    t.interval = Math.max(10, t.interval + delta);
    if (!t.active) t.remaining = t.interval;
    updateDisplay(name);
}

function setIntervalFromInput(name) {
    const val = document.getElementById(`inp-${name}`)?.value || '';
    const parts = val.split(':');
    if (parts.length === 2) {
        const secs = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        if (!isNaN(secs) && secs > 0) {
            timers[name].interval = secs;
            timers[name].remaining = secs;
            updateDisplay(name);
        }
    }
}

// ═══════════════════════════════════════════════
// Camera Posture Detection
// ═══════════════════════════════════════════════
let stream        = null;
let cameraActive  = false;
let detectionLoop = null;
let faceDetector  = null;
let blazeModel    = null;
let lastAlertTime = 0;
const ALERT_COOLDOWN = 30000;

async function toggleCamera() {
    cameraActive ? stopCamera() : await startCamera();
}

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        const video = document.getElementById('webcam');
        video.srcObject = stream;

        document.getElementById('camera-area').classList.add('visible');
        const btn = document.getElementById('cam-btn');
        btn.textContent = 'Disable Camera';
        btn.classList.add('active');
        cameraActive = true;

        await initFaceDetector();

        video.addEventListener('loadedmetadata', () => {
            const c = document.getElementById('face-canvas');
            c.width  = video.videoWidth  || 640;
            c.height = video.videoHeight || 480;
        });

        detectionLoop = setInterval(runDetection, 2000);
    } catch (err) {
        alert('Camera access denied or unavailable: ' + err.message);
    }
}

function stopCamera() {
    clearInterval(detectionLoop);
    stream?.getTracks().forEach(t => t.stop());
    stream = null; cameraActive = false;
    document.getElementById('camera-area').classList.remove('visible');
    const btn = document.getElementById('cam-btn');
    btn.textContent = 'Enable Camera';
    btn.classList.remove('active');
    resetStatusDots();
}

async function initFaceDetector() {
    if ('FaceDetector' in window) {
        try {
            faceDetector = new FaceDetector({ fastMode: false, maxDetectedFaces: 1 });
            document.getElementById('detection-info').textContent = 'Using browser Face Detection API.';
            return;
        } catch (_) {}
    }
    document.getElementById('detection-info').textContent = 'Loading TensorFlow.js BlazeFace model...';
    try {
        await waitForTF();
        blazeModel = await blazeface.load();
        document.getElementById('detection-info').textContent = 'Using TensorFlow.js BlazeFace model.';
    } catch (e) {
        document.getElementById('detection-info').textContent = 'Face detection unavailable: ' + e.message;
    }
}

function waitForTF(timeout = 10000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        (function check() {
            if (typeof blazeface !== 'undefined' && typeof tf !== 'undefined') resolve();
            else if (Date.now() - start > timeout) reject(new Error('TF.js/BlazeFace timed out'));
            else setTimeout(check, 200);
        })();
    });
}

async function runDetection() {
    const video = document.getElementById('webcam');
    if (!video || video.readyState < 2) return;
    const canvas = document.getElementById('face-canvas');
    const ctx = canvas.getContext('2d');
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    canvas.width = vw; canvas.height = vh;

    if (faceDetector) {
        try {
            const faces = await faceDetector.detect(video);
            if (!faces.length) { handleNoFace(ctx, vw, vh); return; }
            analyzePosture(faces[0].boundingBox, vw, vh, ctx);
        } catch (_) { await runBlazeFace(video, vw, vh, ctx); }
    } else if (blazeModel) {
        await runBlazeFace(video, vw, vh, ctx);
    } else {
        setDot('face', 'warn');
        document.getElementById('val-face').textContent = 'Model loading...';
    }
}

async function runBlazeFace(video, vw, vh, ctx) {
    try {
        const preds = await blazeModel.estimateFaces(video, false);
        if (!preds.length) { handleNoFace(ctx, vw, vh); return; }
        const p = preds[0];
        const x = p.topLeft[0], y = p.topLeft[1];
        analyzePosture({ x, y, width: p.bottomRight[0] - x, height: p.bottomRight[1] - y }, vw, vh, ctx);
    } catch (_) { handleNoFace(ctx, vw, vh); }
}

function handleNoFace(ctx, vw, vh) {
    ctx.clearRect(0, 0, vw, vh);
    setDot('face', 'warn');
    document.getElementById('val-face').textContent     = 'Not detected';
    document.getElementById('val-distance').textContent = '-';
    document.getElementById('val-eyelevel').textContent = '-';
    setDot('distance', ''); setDot('eyelevel', '');
}

function analyzePosture(face, vw, vh, ctx) {
    const { x, y, width: faceW, height: faceH } = face;
    const faceCenterY = y + faceH / 2;
    const faceRatio   = (faceW * faceH) / (vw * vh);

    ctx.clearRect(0, 0, vw, vh);
    ctx.strokeStyle = '#4040cc'; ctx.lineWidth = 2;
    ctx.strokeRect(x, y, faceW, faceH);

    setDot('face', 'ok');
    document.getElementById('val-face').textContent = 'Yes';

    let distStatus, distText;
    if      (faceRatio > 0.20) { distStatus = 'bad';  distText = 'Too close'; }
    else if (faceRatio > 0.13) { distStatus = 'warn'; distText = 'Slightly close'; }
    else if (faceRatio < 0.02) { distStatus = 'warn'; distText = 'Too far away'; }
    else                        { distStatus = 'ok';   distText = 'Good distance'; }
    setDot('distance', distStatus);
    document.getElementById('val-distance').textContent = distText;

    const relY = faceCenterY / vh;
    let eyeStatus, eyeText;
    if      (relY > 0.60) { eyeStatus = 'bad';  eyeText = 'Screen too high'; }
    else if (relY < 0.30) { eyeStatus = 'bad';  eyeText = 'Screen too low'; }
    else if (relY > 0.55) { eyeStatus = 'warn'; eyeText = 'Slightly high'; }
    else                   { eyeStatus = 'ok';   eyeText = 'Good eye level'; }
    setDot('eyelevel', eyeStatus);
    document.getElementById('val-eyelevel').textContent = eyeText;

    const now = Date.now();
    if (now - lastAlertTime > ALERT_COOLDOWN) {
        if (distStatus === 'bad') {
            lastAlertTime = now;
            sendNotification('Screen Distance Alert', 'You are too close to the screen. Move back at least 50-70 cm.', 'posture-distance');
        } else if (eyeStatus === 'bad') {
            lastAlertTime = now;
            const body = relY > 0.60
                ? 'Your screen is too high. Lower it or adjust your chair.'
                : 'Your screen is too low. Raise it or sit up straighter.';
            sendNotification('Eye Level Alert', body, 'posture-eyelevel');
        }
    }
}

function resetStatusDots() {
    ['distance','eyelevel','face'].forEach(k => {
        document.getElementById(`dot-${k}`).className = 'status-dot';
    });
    document.getElementById('val-distance').textContent = 'Detecting...';
    document.getElementById('val-eyelevel').textContent = 'Detecting...';
    document.getElementById('val-face').textContent     = '-';
}

function setDot(id, status) {
    document.getElementById(`dot-${id}`).className = 'status-dot' + (status ? ' ' + status : '');
}