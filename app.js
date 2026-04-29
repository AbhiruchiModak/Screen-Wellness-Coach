// ─────────────────────────────────────────────
// Service Worker Registration (PWA)
// ─────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered:', reg.scope))
            .catch(err => console.warn('Service Worker registration failed:', err));
    });
}

// ─────────────────────────────────────────────
// Push Notification Setup
// ─────────────────────────────────────────────

function notifSupported() {
    return 'Notification' in window;
}

function notifAllowed() {
    return notifSupported() && Notification.permission === 'granted';
}

// Request permission — called from the banner button and from startAll().
async function requestNotificationPermission() {
    if (!notifSupported()) {
        console.warn('Notifications not supported in this browser.');
        return false;
    }
    if (Notification.permission === 'denied') {
        alert('Notification permission is blocked. Please enable it in your browser site settings, then reload the page.');
        return false;
    }
    if (Notification.permission === 'granted') {
        hideBanner();
        return true;
    }
    // 'default' state — prompt the user
    const result = await Notification.requestPermission();
    if (result === 'granted') { hideBanner(); return true; }
    return false;
}

// Show the banner unless permission is already granted.
function checkNotificationPermission() {
    if (!notifSupported()) return;
    if (Notification.permission !== 'granted') showBanner();
}

function showBanner() {
    const b = document.getElementById('notif-banner');
    if (b) b.classList.add('visible');
}
function hideBanner() {
    const b = document.getElementById('notif-banner');
    if (b) b.classList.remove('visible');
}

/**
 * Get the active SW registration with a hard 2 s timeout so we never
 * hang on file:// origins or misconfigured servers.
 */
function getSwReg() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return Promise.race([
        navigator.serviceWorker.ready,
        new Promise(resolve => setTimeout(() => resolve(null), 2000))
    ]).catch(() => null);
}

/**
 * Fire a notification. Uses SW showNotification (visible even when the tab
 * is backgrounded / screen is off) when available, plain Notification() as
 * fallback. Deliberately NOT async at the call-site so callers don't need
 * to await it; all errors are handled internally.
 */
function sendNotification(title, body, tag) {
    // Always re-check at fire time — permission may have been granted after load
    if (!notifAllowed()) {
        console.warn('Notification skipped — permission not granted.');
        return;
    }

    const options = {
        body,
        tag:                tag || 'wellness',
        icon:               'icons/icon-192.png',
        badge:              'icons/icon-192.png',
        renotify:           true,
        requireInteraction: false,
        silent:             false,
    };

    getSwReg().then(swReg => {
        if (swReg && typeof swReg.showNotification === 'function') {
            swReg.showNotification(title, options).catch(err => {
                console.warn('SW showNotification failed, using fallback:', err);
                plainNotif(title, options);
            });
        } else {
            plainNotif(title, options);
        }
    });
}

function plainNotif(title, options) {
    try { new Notification(title, options); }
    catch (err) { console.warn('Notification() failed:', err); }
}

// ─────────────────────────────────────────────
// Timer Logic
// ─────────────────────────────────────────────
const timers = {
    blink:   { interval: 20,   remaining: 20,   active: false, ticker: null },
    posture: { interval: 300,  remaining: 300,  active: false, ticker: null },
    stretch: { interval: 1200, remaining: 1200, active: false, ticker: null },
    screen:  { interval: 1200, remaining: 1200, active: false, ticker: null },
};

const reminderMessages = {
    blink:   { title: 'Blink Reminder',   body: 'Time to blink. Rest your eyes for a moment.' },
    posture: { title: 'Posture Check',    body: 'Sit up straight and check your posture.' },
    stretch: { title: 'Stretch Break',    body: 'Stand up and take a short stretching break.' },
    screen:  { title: 'Screen Break',     body: 'Look away from the screen for at least 20 seconds.' },
};

function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function updateDisplay(name) {
    document.getElementById(`disp-${name}`).textContent = fmt(timers[name].remaining);
    document.getElementById(`inp-${name}`).value = fmt(timers[name].interval);
}

function toggleTimer(name) {
    const t = timers[name];
    t.active = document.getElementById(`tog-${name}`).checked;

    if (t.active) {
        // Ensure we have notification permission whenever a timer is turned on
        if (!notifAllowed()) requestNotificationPermission();

        t.remaining = t.interval;
        t.ticker = setInterval(() => {
            t.remaining--;
            if (t.remaining <= 0) {
                fireReminder(name);
                t.remaining = t.interval;
            }
            updateDisplay(name);
        }, 1000);
    } else {
        clearInterval(t.ticker);
        t.remaining = t.interval;
        updateDisplay(name);
    }
}

function fireReminder(name) {
    const { title, body } = reminderMessages[name];
    sendNotification(title, body, name);
}

async function startAll() {
    // Request permission up front so timers fire notifications immediately
    await requestNotificationPermission();
    ['blink', 'posture', 'stretch', 'screen'].forEach(name => {
        const checkbox = document.getElementById(`tog-${name}`);
        if (!checkbox.checked) {
            checkbox.checked = true;
            toggleTimer(name);
        }
    });
}

function resetAll() {
    ['blink', 'posture', 'stretch', 'screen'].forEach(name => {
        clearInterval(timers[name].ticker);
        timers[name].active = false;
        timers[name].remaining = timers[name].interval;
        document.getElementById(`tog-${name}`).checked = false;
        updateDisplay(name);
    });
}

function adjustInterval(name, delta) {
    const t = timers[name];
    t.interval = Math.max(10, t.interval + delta);
    if (!t.active) t.remaining = t.interval;
    updateDisplay(name);
}

function setIntervalFromInput(name) {
    const val = document.getElementById(`inp-${name}`).value;
    const parts = val.split(':');
    if (parts.length === 2) {
        const secs = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        if (!isNaN(secs) && secs > 0) {
            timers[name].interval = secs;
            timers[name].remaining = secs;
            updateDisplay(name);
        }
    }
}

// ─────────────────────────────────────────────
// Camera Posture Detection
// ─────────────────────────────────────────────
let stream         = null;
let cameraActive   = false;
let detectionLoop  = null;
let faceDetector   = null;   // Native FaceDetector API
let blazeModel     = null;   // TensorFlow.js BlazeFace model
let lastAlertTime  = 0;
const ALERT_COOLDOWN = 30000; // 30 seconds between posture alerts

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

        // Initialise face detection backend
        await initFaceDetector();

        video.addEventListener('loadedmetadata', () => {
            const canvas = document.getElementById('face-canvas');
            canvas.width  = video.videoWidth  || 640;
            canvas.height = video.videoHeight || 480;
        });

        detectionLoop = setInterval(runDetection, 2000);

    } catch (err) {
        alert('Camera access denied or unavailable: ' + err.message);
    }
}

function stopCamera() {
    clearInterval(detectionLoop);
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream       = null;
    cameraActive = false;
    document.getElementById('camera-area').classList.remove('visible');
    const btn = document.getElementById('cam-btn');
    btn.textContent = 'Enable Camera';
    btn.classList.remove('active');
    resetStatusDots();
}

async function initFaceDetector() {
    // Prefer native FaceDetector API (Chrome/Edge with flag)
    if ('FaceDetector' in window) {
        try {
            faceDetector = new FaceDetector({ fastMode: false, maxDetectedFaces: 1 });
            document.getElementById('detection-info').textContent =
                'Using browser Face Detection API.';
            return;
        } catch (_) { /* fall through */ }
    }

    // Fallback: TensorFlow.js BlazeFace
    document.getElementById('detection-info').textContent =
        'Loading TensorFlow.js BlazeFace model...';
    try {
        // blazeface is loaded via CDN <script> tag; wait until it is available
        await waitForTF();
        blazeModel = await blazeface.load();
        document.getElementById('detection-info').textContent =
            'Using TensorFlow.js BlazeFace model.';
    } catch (e) {
        document.getElementById('detection-info').textContent =
            'Face detection unavailable: ' + e.message;
    }
}

function waitForTF(timeout = 10000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        (function check() {
            if (typeof blazeface !== 'undefined' && typeof tf !== 'undefined') {
                resolve();
            } else if (Date.now() - start > timeout) {
                reject(new Error('TF.js / BlazeFace did not load in time'));
            } else {
                setTimeout(check, 200);
            }
        })();
    });
}

async function runDetection() {
    const video = document.getElementById('webcam');
    if (!video || video.readyState < 2) return;

    const canvas = document.getElementById('face-canvas');
    const ctx    = canvas.getContext('2d');
    const vw     = video.videoWidth  || 640;
    const vh     = video.videoHeight || 480;
    canvas.width  = vw;
    canvas.height = vh;

    if (faceDetector) {
        // Native FaceDetector API
        try {
            const faces = await faceDetector.detect(video);
            if (!faces.length) { handleNoFace(ctx, vw, vh); return; }
            analyzePosture(faces[0].boundingBox, vw, vh, ctx);
        } catch (_) {
            await runBlazeFace(video, vw, vh, ctx);
        }

    } else if (blazeModel) {
        await runBlazeFace(video, vw, vh, ctx);

    } else {
        setDot('face', 'warn');
        document.getElementById('val-face').textContent = 'Model loading...';
    }
}

async function runBlazeFace(video, vw, vh, ctx) {
    try {
        const predictions = await blazeModel.estimateFaces(video, false);
        if (!predictions.length) { handleNoFace(ctx, vw, vh); return; }

        const p = predictions[0];
        // BlazeFace returns topLeft / bottomRight as [x, y] arrays
        const x = p.topLeft[0];
        const y = p.topLeft[1];
        const w = p.bottomRight[0] - x;
        const h = p.bottomRight[1] - y;
        analyzePosture({ x, y, width: w, height: h }, vw, vh, ctx);
    } catch (e) {
        handleNoFace(ctx, vw, vh);
    }
}

function handleNoFace(ctx, vw, vh) {
    ctx.clearRect(0, 0, vw, vh);
    setDot('face', 'warn');
    document.getElementById('val-face').textContent     = 'Not detected';
    document.getElementById('val-distance').textContent = '-';
    document.getElementById('val-eyelevel').textContent = '-';
    setDot('distance', '');
    setDot('eyelevel', '');
}

function analyzePosture(face, vw, vh, ctx) {
    const faceW      = face.width;
    const faceH      = face.height;
    const faceCenterY = face.y + faceH / 2;
    const faceRatio  = (faceW * faceH) / (vw * vh);

    // Draw bounding box on overlay canvas
    ctx.clearRect(0, 0, vw, vh);
    ctx.strokeStyle = '#4040cc';
    ctx.lineWidth   = 2;
    ctx.strokeRect(face.x, face.y, faceW, faceH);

    // Face detected
    setDot('face', 'ok');
    document.getElementById('val-face').textContent = 'Yes';

    // ── Distance check ──
    // Face occupying > 20% of frame = too close; < 2% = too far
    let distStatus, distText;
    if (faceRatio > 0.20) {
        distStatus = 'bad';
        distText   = 'Too close';
    } else if (faceRatio > 0.13) {
        distStatus = 'warn';
        distText   = 'Slightly close';
    } else if (faceRatio < 0.02) {
        distStatus = 'warn';
        distText   = 'Too far away';
    } else {
        distStatus = 'ok';
        distText   = 'Good distance';
    }
    setDot('distance', distStatus);
    document.getElementById('val-distance').textContent = distText;

    // ── Eye-level check ──
    // Face vertical center should sit in the 30%–55% band of the frame
    const relY = faceCenterY / vh;
    let eyeStatus, eyeText;
    if (relY > 0.60) {
        eyeStatus = 'bad';
        eyeText   = 'Screen too high';
    } else if (relY < 0.30) {
        eyeStatus = 'bad';
        eyeText   = 'Screen too low';
    } else if (relY > 0.55) {
        eyeStatus = 'warn';
        eyeText   = 'Slightly high';
    } else {
        eyeStatus = 'ok';
        eyeText   = 'Good eye level';
    }
    setDot('eyelevel', eyeStatus);
    document.getElementById('val-eyelevel').textContent = eyeText;

    // ── Fire push notification (max once per cooldown window) ──
    const now = Date.now();
    if (now - lastAlertTime > ALERT_COOLDOWN) {
        if (distStatus === 'bad') {
            lastAlertTime = now;
            sendNotification(
                'Screen Distance Alert',
                'You are too close to the screen. Move back at least 50-70 cm.',
                'posture-distance'
            );
        } else if (eyeStatus === 'bad') {
            lastAlertTime = now;
            const body = relY > 0.60
                ? 'Your screen appears too high. Lower it or adjust your chair.'
                : 'Your screen appears too low. Raise it or sit up straighter.';
            sendNotification('Eye Level Alert', body, 'posture-eyelevel');
        }
    }
}

function resetStatusDots() {
    ['distance', 'eyelevel', 'face'].forEach(k => {
        document.getElementById(`dot-${k}`).className = 'status-dot';
    });
    document.getElementById('val-distance').textContent = 'Detecting...';
    document.getElementById('val-eyelevel').textContent = 'Detecting...';
    document.getElementById('val-face').textContent     = '-';
}

function setDot(id, status) {
    document.getElementById(`dot-${id}`).className =
        'status-dot' + (status ? ' ' + status : '');
}

// ─────────────────────────────────────────────
// Init on page load
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    checkNotificationPermission();
});
