# Screen Wellness Coach

A web-based application to help you maintain healthy habits while working at your computer. Get timely reminders to blink, check your posture, stretch, and take screen breaks.

## Features

### 🎯 Four Wellness Reminders

1. **Blink Reminder** - Reminds you to blink regularly to keep your eyes moist
2. **Posture Check** - Alerts you to check and correct your sitting posture
3. **Stretch Break** - Prompts you to stand up and stretch your body
4. **Screen Break** - Reminds you to look away from the screen (20-20-20 rule)

### ⚙️ Customizable Timers

- **Adjustable intervals**: Use +/- buttons or type custom times for each reminder
- **Individual controls**: Toggle each reminder on/off independently
- **Batch controls**: Start or reset all timers at once
- **Real-time countdown**: Watch your timers count down in real-time

### 🔔 Notifications

- Browser notifications when timers complete (requires permission)
- Fallback to alert dialogs if notifications are disabled
- Timers automatically restart after each notification

## How to Use

### Getting Started

1. Open `screen-wellness-coach.html` in any modern web browser
2. Grant notification permissions when prompted (optional but recommended)

### Setting Up Your Timers

1. **Customize timer duration**:
   - Click the **+** button to increase time by 1 minute
   - Click the **-** button to decrease time by 1 minute
   - Type directly in the input field (format: `MM:SS`)

2. **Activate reminders**:
   - Click the toggle switch on any card to start that timer
   - Or click **Start All** to activate all timers at once

3. **Stop reminders**:
   - Click the toggle switch again to stop individual timers
   - Or click **Reset All** to stop all timers

### Default Timer Values

- **Blink Reminder**: 20 seconds
- **Posture Check**: 5 minutes
- **Stretch Break**: 20 minutes
- **Screen Break**: 20 minutes

## Health Tips

### Blink Regularly
Blinking helps keep your eyes moist and reduce eye strain. Most people blink less when staring at screens.

### 20-20-20 Rule
Every 20 minutes, look at something 20 feet away for 20 seconds. This helps reduce digital eye strain.

### Good Posture
Keep your back straight, shoulders relaxed, and feet flat on the floor. Your monitor should be at or slightly below eye level.

### Stretch Regularly
Stand up and stretch every 20-30 minutes to prevent RSI (Repetitive Strain Injury) and reduce the risk of carpal tunnel syndrome.

### Screen Distance
Keep your screen at an arm's length away and slightly below eye level to reduce neck and eye strain.

## Technical Requirements

### Browser Compatibility
- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

### Features Used
- HTML5
- CSS3 (Flexbox, Grid, Gradients, Animations)
- Vanilla JavaScript (ES6+)
- Notification API (optional)

### No Dependencies
This application runs entirely in the browser with no external dependencies or internet connection required.

## Browser Notifications

To enable desktop notifications:

1. When you first open the app, click "Allow" when prompted
2. If you missed it, check your browser's address bar for the notification icon
3. In browser settings, ensure notifications are allowed for this page

**Note**: Notifications work best on desktop browsers. Mobile browsers may have limited support.

## Customization

### Changing Timer Increments

The default increment/decrement is 60 seconds (1 minute). To change this, modify the `increment()` and `decrement()` functions in the JavaScript section:

```javascript
function increment(type) {
    timers[type].seconds += 60;  // Change 60 to your desired seconds
    // ...
}
```

### Changing Default Timer Values

Edit the initial values in the `timers` object:

```javascript
const timers = {
    blink: { seconds: 20, interval: null, active: false },     // 20 seconds
    posture: { seconds: 300, interval: null, active: false },  // 5 minutes
    stretch: { seconds: 1200, interval: null, active: false }, // 20 minutes
    screen: { seconds: 1200, interval: null, active: false }   // 20 minutes
};
```

### Styling

All styles are contained in the `<style>` section. Key colors:

- Primary Blue: `#4F46E5`
- Background Gradient: `#E8EBF7` to `#D4D9ED`
- Text Primary: `#1F2937`
- Text Secondary: `#6B7280`

## Privacy

This application:
- ✅ Runs entirely in your browser
- ✅ Stores no data on any server
- ✅ Collects no personal information
- ✅ Requires no account or login
- ✅ Works completely offline

Timer settings are not saved between sessions. Close the browser and all timers reset.

## Troubleshooting

### Notifications Not Working

1. Check if notifications are blocked in your browser settings
2. Try refreshing the page and allowing notifications when prompted
3. Some browsers require user interaction before requesting permissions

### Timer Not Counting Down

1. Make sure the toggle switch is activated (should be blue)
2. Check if the timer value is greater than 0
3. Try refreshing the page if the timer seems stuck

### Input Field Not Accepting Values

- Use the format `M:SS` or `MM:SS` (e.g., `5:00` for 5 minutes, `0:30` for 30 seconds)
- Minutes and seconds should be numbers
- Press Enter or click outside the field to confirm changes

## License

This is free and open-source software. Feel free to use, modify, and distribute as needed.

## Health Disclaimer

This application is designed to promote healthy computer usage habits. It is not a substitute for professional medical advice. If you experience persistent pain, discomfort, or vision problems, please consult a healthcare professional.

---

**Stay healthy, stay productive! 💪**