// ─── Timer Logic ───────────────────────────────────────────────
const timers = {
            blink: { seconds: 20, interval: null, active: false },
            posture: { seconds: 300, interval: null, active: false },
            stretch: { seconds: 1200, interval: null, active: false },
            screen: { seconds: 1200, interval: null, active: false }
        };

        function parseTime(str) {
            const parts = str.split(':');
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }

        function formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }

        function updateTimer(type) {
            const input = document.getElementById(`input-${type}`);
            const seconds = parseTime(input.value);
            if (seconds > 0) {
                timers[type].seconds = seconds;
                document.getElementById(`timer-${type}`).textContent = formatTime(seconds);
            }
        }

        function increment(type) {
            timers[type].seconds += 60;
            const formatted = formatTime(timers[type].seconds);
            document.getElementById(`timer-${type}`).textContent = formatted;
            document.getElementById(`input-${type}`).value = formatted;
        }

        function decrement(type) {
            if (timers[type].seconds > 60) {
                timers[type].seconds -= 60;
                const formatted = formatTime(timers[type].seconds);
                document.getElementById(`timer-${type}`).textContent = formatted;
                document.getElementById(`input-${type}`).value = formatted;
            }
        }

        function toggleTimer(element, type) {
            element.classList.toggle('active');
            
            if (element.classList.contains('active')) {
                timers[type].active = true;
                startTimerCountdown(type);
            } else {
                timers[type].active = false;
                stopTimerCountdown(type);
            }
        }

        function startTimerCountdown(type) {
            if (timers[type].interval) {
                clearInterval(timers[type].interval);
            }

            const initialSeconds = timers[type].seconds;
            let remaining = initialSeconds;

            timers[type].interval = setInterval(() => {
                remaining--;
                document.getElementById(`timer-${type}`).textContent = formatTime(remaining);

                if (remaining <= 0) {
                    showAlert(type);
                    remaining = initialSeconds;
                }
            }, 1000);
        }

        function stopTimerCountdown(type) {
            if (timers[type].interval) {
                clearInterval(timers[type].interval);
                timers[type].interval = null;
            }
            document.getElementById(`timer-${type}`).textContent = formatTime(timers[type].seconds);
        }

        function showAlert(type) {
            const messages = {
                blink: '👁️ Time to blink! Give your eyes a rest.',
                posture: '🪑 Check your posture! Sit up straight.',
                stretch: '🤸 Take a stretch break! Move your body.',
                screen: '🖥️ Look away from the screen! Rest your eyes.'
            };

            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Screen Wellness Reminder', {
                    body: messages[type]
                });
            } else {
                alert(messages[type]);
            }
        }

        function startAll() {
            ['blink', 'posture', 'stretch', 'screen'].forEach(type => {
                const toggle = document.getElementById(`toggle-${type}`);
                if (!toggle.classList.contains('active')) {
                    toggle.classList.add('active');
                    timers[type].active = true;
                    startTimerCountdown(type);
                }
            });
        }

        function resetAll() {
            ['blink', 'posture', 'stretch', 'screen'].forEach(type => {
                const toggle = document.getElementById(`toggle-${type}`);
                toggle.classList.remove('active');
                timers[type].active = false;
                stopTimerCountdown(type);
            });
        }

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

// ─── Alert Toast ───────────────────────────────────────────────
let alertTimeout = null;
function showAlert(title, msg, isWarning) {
    const el = document.getElementById('posture-alert');
    document.getElementById('alert-title').textContent = (isWarning ? '⚠️ ' : '🔔 ') + title;
    document.getElementById('alert-msg').textContent = msg;
    el.className = 'show' + (isWarning ? ' warning' : '');
    clearTimeout(alertTimeout);
    alertTimeout = setTimeout(() => { el.className = ''; }, 5000);
}

// ─── Camera Posture Detection ──────────────────────────────────
let stream = null;
let cameraActive = false;
let detectionInterval = null;
let faceDetector = null;
let lastAlertTime = 0;

async function toggleCamera() {
    if (!cameraActive) {
        await startCamera();
    } else {
        stopCamera();
    }
}

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
        const video = document.getElementById('webcam');
        video.srcObject = stream;
        document.getElementById('camera-area').classList.add('visible');
        document.getElementById('cam-btn').textContent = 'Disable Camera';
        document.getElementById('cam-btn').classList.add('active');
        cameraActive = true;

        // Try Face Detection API
        if ('FaceDetector' in window) {
            faceDetector = new FaceDetector({ fastMode: false, maxDetectedFaces: 1 });
        }

        video.addEventListener('loadedmetadata', () => {
            const canvas = document.getElementById('face-canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
        });

        detectionInterval = setInterval(runDetection, 2000);
    } catch (e) {
        alert('Camera access denied or not available: ' + e.message);
    }
}

function stopCamera() {
    clearInterval(detectionInterval);
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    cameraActive = false;
    document.getElementById('camera-area').classList.remove('visible');
    document.getElementById('cam-btn').textContent = 'Enable Camera';
    document.getElementById('cam-btn').classList.remove('active');
    resetStatusDots();
}

function resetStatusDots() {
    ['distance','eyelevel','face'].forEach(k => {
        document.getElementById(`dot-${k}`).className = 'status-dot';
    });
    document.getElementById('val-distance').textContent = 'Detecting…';
    document.getElementById('val-eyelevel').textContent = 'Detecting…';
    document.getElementById('val-face').textContent = '—';
}

async function runDetection() {
    const video = document.getElementById('webcam');
    if (!video || video.readyState < 2) return;

    // Draw to canvas for analysis
    const canvas = document.getElementById('face-canvas');
    const ctx = canvas.getContext('2d');
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    canvas.width = vw; canvas.height = vh;

    // Use FaceDetector API if available
    if (faceDetector) {
        try {
            const faces = await faceDetector.detect(video);
            if (faces.length === 0) {
                setDot('face', 'warn');
                document.getElementById('val-face').textContent = 'Not detected';
                document.getElementById('val-distance').textContent = '—';
                document.getElementById('val-eyelevel').textContent = '—';
                setDot('distance', '');
                setDot('eyelevel', '');
                ctx.clearRect(0, 0, vw, vh);
                return;
            }
            const face = faces[0].boundingBox;
            analyzePosture(face, vw, vh, ctx);
        } catch(e) {
            fallbackDetection(video, vw, vh, ctx);
        }
    } else {
        fallbackDetection(video, vw, vh, ctx);
    }
}

// Fallback: skin-tone blob detection on canvas pixels
function fallbackDetection(video, vw, vh, ctx) {
    // Draw frame
    const offscreen = document.createElement('canvas');
    offscreen.width = vw; offscreen.height = vh;
    const octx = offscreen.getContext('2d');
    octx.drawImage(video, 0, 0, vw, vh);
    const imageData = octx.getImageData(0, 0, vw, vh);
    const data = imageData.data;

    let minX = vw, maxX = 0, minY = vh, maxY = 0, count = 0;
    // Sample every 4th pixel for speed
    for (let y = 0; y < vh; y += 4) {
        for (let x = 0; x < vw; x += 4) {
            const i = (y * vw + x) * 4;
            const r = data[i], g = data[i+1], b = data[i+2];
            // Simple skin tone detection
            if (isSkin(r, g, b)) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                count++;
            }
        }
    }

    const totalPixels = (vw * vh) / 16;
    if (count < totalPixels * 0.01 || (maxX - minX) < 30) {
        setDot('face', 'warn');
        document.getElementById('val-face').textContent = 'Not detected';
        document.getElementById('val-distance').textContent = '—';
        document.getElementById('val-eyelevel').textContent = '—';
        setDot('distance', '');
        setDot('eyelevel', '');
        ctx.clearRect(0, 0, vw, vh);
        return;
    }

    const bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    analyzePosture(bbox, vw, vh, ctx);
}

function isSkin(r, g, b) {
    return r > 95 && g > 40 && b > 20 &&
           r > g && r > b &&
           (r - Math.min(g,b)) > 15 &&
           Math.abs(r - g) > 15;
}

function analyzePosture(face, vw, vh, ctx) {
    const faceW = face.width, faceH = face.height;
    const faceCenterX = face.x + faceW / 2;
    const faceCenterY = face.y + faceH / 2;
    const faceArea = faceW * faceH;
    const frameArea = vw * vh;
    const faceRatio = faceArea / frameArea;

    // Draw bounding box
    ctx.clearRect(0, 0, vw, vh);
    ctx.strokeStyle = '#4040cc';
    ctx.lineWidth = 2;
    ctx.strokeRect(face.x, face.y, faceW, faceH);

    // Face detected
    setDot('face', 'ok');
    document.getElementById('val-face').textContent = 'Yes ✓';

    // Distance check: if face takes up > 20% of frame → too close
    let distStatus = 'ok', distText = '';
    if (faceRatio > 0.20) {
        distStatus = 'bad';
        distText = 'Too close! 🚨';
    } else if (faceRatio > 0.13) {
        distStatus = 'warn';
        distText = 'Slightly close';
    } else if (faceRatio < 0.02) {
        distStatus = 'warn';
        distText = 'Too far away';
    } else {
        distText = 'Good distance ✓';
    }
    setDot('distance', distStatus);
    document.getElementById('val-distance').textContent = distText;

    // Eye level check: face vertical center should be in upper 55% of frame
    const relY = faceCenterY / vh;
    let eyeStatus = 'ok', eyeText = '';
    if (relY > 0.60) {
        eyeStatus = 'bad';
        eyeText = 'Screen too high ↑';
    } else if (relY < 0.30) {
        eyeStatus = 'bad';
        eyeText = 'Screen too low ↓';
    } else if (relY > 0.55) {
        eyeStatus = 'warn';
        eyeText = 'Slightly high';
    } else {
        eyeText = 'Good eye level ✓';
    }
    setDot('eyelevel', eyeStatus);
    document.getElementById('val-eyelevel').textContent = eyeText;

    // Trigger alert (max once per 30s)
    const now = Date.now();
    if (now - lastAlertTime > 30000) {
        if (distStatus === 'bad') {
            lastAlertTime = now;
            showAlert('Too Close to Screen', 'Move back at least 50–70 cm from your monitor.', true);
        } else if (eyeStatus === 'bad') {
            lastAlertTime = now;
            const msg = relY > 0.60
                ? 'Raise your screen or sit up – it\'s too high for your eye level.'
                : 'Lower your screen or adjust your chair – screen is too low.';
            showAlert('Eye Level Alert', msg, true);
        }
    }
}

function setDot(id, status) {
    const dot = document.getElementById(`dot-${id}`);
    dot.className = 'status-dot' + (status ? ' ' + status : '');
}