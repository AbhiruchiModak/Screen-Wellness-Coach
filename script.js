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