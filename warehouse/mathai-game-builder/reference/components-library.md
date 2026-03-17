# MathAI Components Library

Complete component reference for MathAI educational game interfaces.

## 📑 Table of Contents

1. [Timer Component](#-timer-component)

2. [Progress Bar with Lives Component](#-progress-bar-with-lives-component)

3. [Transition Screen Components](#-transition-screen-components)

   - [Start Screen](#1-start-screen-component)

   - [Victory Screen (3 Stars)](#2-victory-screen-3-stars-component)

   - [Game Complete (2 Stars)](#3-game-complete-2-stars-component)

   - [Game Complete (1 Star)](#4-game-complete-1-star-component)

   - [Game Over Screen](#5-game-over-screen-component)

   - [Stars Claimed Screen](#6-stars-claimed-screen-component)

   - [Level/Round Screen (No Button)](#7-levelround-screen-no-button-component)

   - [Level/Round Screen (With Button)](#8-levelround-screen-with-button-component)

   - [Time Taken Screen](#9-time-taken-screen-component)

4. [Shared Styles](#-shared-styles)

5. [Helper Functions](#-helper-functions)

---

## ⏱️ Timer Component

### Description

A monospace digital timer display that shows elapsed or remaining time in MM:SS format. Always positioned at the top-center of the game interface.

### Specifications

- **Position:** Top-center, always visible
- **Font Family:** 'Courier New', monospace
- **Font Size:** 24px
- **Font Weight:** 700
- **Color:** #270f36
- **Format:** MM:SS (00:00)
- **Alignment:** Center
- **Padding:** 16px
- **Border Bottom:** 2px solid #e0e0e0
- **Background:** White (#ffffff)

### HTML Structure

```html
<div class="timer-section">
    <div class="timer-display" id="gameTimer">00:00</div>
    <div class="timer-label">Timer</div>
</div>
```

### CSS Styles

```css
.timer-section {
    padding: 16px;
    text-align: center;
    border-bottom: 2px solid #e0e0e0;
    background: #ffffff;
}

.timer-display {
    font-family: 'Courier New', monospace;
    font-size: 24px;
    font-weight: 700;
    color: #270f36;
    line-height: 1.2;
}

.timer-label {
    font-size: 12px;
    font-weight: 500;
    margin-top: 4px;
    color: #666666;
    font-family: 'Epilogue', sans-serif;
}
```

### JavaScript

```javascript
function updateTimerDisplay(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const timerDisplay = document.getElementById('gameTimer');
    timerDisplay.textContent =
        `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Usage
updateTimerDisplay(135); // Displays "02:15"
```

---

## 📊 Progress Bar with Lives Component

### Description

A progress indicator showing rounds completed and remaining lives (hearts).

### Specifications

- **Max Width:** 500px
- **Margin:** 20px auto
- **Background:** #f8f8f8
- **Padding:** 16px 24px
- **Border Bottom:** 2px solid #e0e0e0

#### Progress Text
- **Font Size:** 16px
- **Font Weight:** 500
- **Color:** #4a4a4a

#### Lives Display
- **Font Size:** 20px
- **Format:** ❤️ (filled) / 🤍 (empty)

#### Progress Bar
- **Height:** 12px
- **Border Radius:** 1rem (16px)
- **Background:** #e5e7eb (container)
- **Fill Color:** #2563eb
- **Transition:** width 0.5s ease-in-out

### HTML Structure

```html
<div class="progress-section">
    <div class="progress-container">
        <div class="progress-header">
            <span class="progress-text" id="progressText">0/5 rounds completed</span>
            <span class="lives-display" id="livesDisplay">❤️❤️❤️</span>
        </div>
        <div class="progress-bar-container">
            <div class="progress-bar-fill" id="progressBar" style="width: 0%;"></div>
        </div>
    </div>
</div>
```

### CSS Styles

```css
.progress-section {
    background: #f8f8f8;
    padding: 16px 24px;
    border-bottom: 2px solid #e0e0e0;
}

.progress-container {
    max-width: 500px;
    margin: 0 auto;
    font-family: 'Epilogue', sans-serif;
}

.progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.progress-text {
    font-size: 16px;
    color: #4a4a4a;
    font-weight: 500;
}

.lives-display {
    font-size: 20px;
}

.progress-bar-container {
    width: 100%;
    height: 12px;
    border-radius: 1rem;
    background: #e5e7eb;
    overflow: hidden;
}

.progress-bar-fill {
    height: 100%;
    background: #2563eb;
    transition: width 0.5s ease-in-out;
    border-radius: 1rem;
}
```

### JavaScript

```javascript
function updateProgress(currentRound, totalRounds, currentLives, totalLives) {
    // Update progress text
    document.getElementById('progressText').textContent =
        `${currentRound}/${totalRounds} rounds completed`;

    // Update progress bar
    const percentage = (currentRound / totalRounds) * 100;
    document.getElementById('progressBar').style.width = `${percentage}%`;

    // Update lives display
    const filledHearts = '❤️'.repeat(currentLives);
    const emptyHearts = '🤍'.repeat(totalLives - currentLives);
    document.getElementById('livesDisplay').textContent = filledHearts + emptyHearts;
}

// Usage
updateProgress(3, 5, 2, 3); // 3/5 rounds, 2/3 lives
```

---

## 🎬 Transition Screen Components

All transition screens share a common modal structure with variations in content and behavior.

### Shared Modal Structure

```html
<div id="transitionScreen" class="transition-screen">
    <div class="transition-content">
        <div class="transition-icons" id="transitionIcons"></div>
        <h2 class="transition-title" id="transitionTitle"></h2>
        <p class="transition-subtitle" id="transitionSubtitle"></p>
        <div class="transition-buttons" id="transitionButtons"></div>
    </div>
</div>
```

---

### 1. Start Screen Component

**Purpose:** Initial screen before game begins

**Design Specs:**
- Icon: 🎮 (large, 96px)
- Title: "Are you ready?"
- Subtitle: "Get ready to start the game!"
- Button: "I'm ready!" (primary green)

**Example Code:**

```javascript
showTransitionScreen({
    icons: ['🎮'],
    iconSize: 'large',
    title: 'Are you ready?',
    subtitle: 'Get ready to start the game!',
    buttons: [
        {
            text: "I'm ready!",
            type: 'primary',
            action: () => console.log('Game starting')
        }
    ]
});
```

---

### 2. Victory Screen (3 Stars) Component

**Purpose:** Perfect score completion screen

**Design Specs:**
- Icon: 3 active SVG stars with gradient effects
- Title: "Victory! 🎉"
- Subtitle: "Perfect score - Amazing work!"
- Button: "Claim Stars" (primary green)

**Example Code:**

```javascript
showTransitionScreen({
    svgStars: true,
    activeStars: 3,
    totalStars: 3,
    title: 'Victory! 🎉',
    subtitle: 'Perfect score - Amazing work!',
    buttons: [
        {
            text: 'Claim Stars',
            type: 'primary',
            action: () => console.log('Stars claimed')
        }
    ]
});
```

---

### 3. Game Complete (2 Stars) Component

**Purpose:** Good performance with minor mistakes

**Design Specs:**
- Icon: 2 active SVG stars + 1 gray star
- Title: "Game Complete! 🎊"
- Subtitle: "Great job! You earned 2 stars!"
- Buttons: "Retry for more stars" (secondary blue), "Claim stars" (primary green)

**Example Code:**

```javascript
showTransitionScreen({
    svgStars: true,
    activeStars: 2,
    totalStars: 3,
    title: 'Game Complete! 🎊',
    subtitle: 'Great job! You earned 2 stars!',
    buttons: [
        {
            text: 'Retry for more stars',
            type: 'secondary',
            action: () => console.log('Retrying')
        },
        {
            text: 'Claim stars',
            type: 'primary',
            action: () => console.log('Stars claimed')
        }
    ]
});
```

---

### 4. Game Complete (1 Star) Component

**Purpose:** Completed but needs improvement

**Design Specs:**
- Icon: 1 active SVG star + 2 gray stars
- Title: "Game Complete! 🎊"
- Subtitle: "Good effort! You earned 1 star!"
- Buttons: "Retry for more stars" (secondary blue), "Claim stars" (primary green)

**Example Code:**

```javascript
showTransitionScreen({
    svgStars: true,
    activeStars: 1,
    totalStars: 3,
    title: 'Game Complete! 🎊',
    subtitle: 'Good effort! You earned 1 star!',
    buttons: [
        {
            text: 'Retry for more stars',
            type: 'secondary',
            action: () => console.log('Retrying')
        },
        {
            text: 'Claim stars',
            type: 'primary',
            action: () => console.log('Stars claimed')
        }
    ]
});
```

---

### 5. Game Over Screen Component

**Purpose:** All lives lost

**Design Specs:**
- Icon: 😔 (large, 96px)
- Title: "Game Over!"
- Subtitle: "All lives lost!"
- Button: "Try again!" (primary green)

**Example Code:**

```javascript
showTransitionScreen({
    icons: ['😔'],
    iconSize: 'large',
    title: 'Game Over!',
    subtitle: 'All lives lost!',
    buttons: [
        {
            text: 'Try again!',
            type: 'primary',
            action: () => console.log('Restarting')
        }
    ]
});
```

---

### 6. Stars Claimed Screen Component

**Purpose:** Confirmation screen after claiming stars

**Design Specs:**
- Icon: 🎉 (large, 96px)
- Title: "Yay! Stars claimed!"
- Auto-dismiss: 2.5 seconds
- No buttons

**Example Code:**

```javascript
showTransitionScreen({
    icons: ['🎉'],
    iconSize: 'large',
    title: 'Yay! Stars claimed!',
    duration: 2500
});
```

---

### 7. Level/Round Screen (No Button) Component

**Purpose:** Quick level/round indicator

**Design Specs:**
- Icon: 🎯 (normal, 72px)
- Title: Dynamic (e.g., "Level 3!")
- Title Color: #270F63
- Title Font Size: 36px
- Auto-dismiss: 2 seconds
- No buttons

**Example Code:**

```javascript
showTransitionScreen({
    icons: ['🎯'],
    iconSize: 'normal',
    title: 'Level 3!',
    titleStyles: {
        color: '#270F63',
        fontSize: '36px'
    },
    duration: 2000
});
```

---

### 8. Level/Round Screen (With Button) Component

**Purpose:** Level indicator with user action

**Design Specs:**
- Icon: 🎮 (normal, 72px)
- Title: Dynamic (e.g., "Round 2!")
- Title Color: #270F63
- Title Font Size: 36px
- Button: "I'm ready!" (primary green)

**Example Code:**

```javascript
showTransitionScreen({
    icons: ['🎮'],
    iconSize: 'normal',
    title: 'Round 2!',
    titleStyles: {
        color: '#270F63',
        fontSize: '36px'
    },
    buttons: [
        {
            text: "I'm ready!",
            type: 'primary',
            action: () => console.log('Starting round')
        }
    ]
});
```

---

### 9. Time Taken Screen Component

**Purpose:** Shows average time performance

**Design Specs:**
- Icon: ⏱️ (large, 96px)
- Title: "Average time taken:" (not bold, weight 500)
- Subtitle: Dynamic time (bold, weight 700)
- Auto-dismiss: 3 seconds
- No buttons

**Example Code:**

```javascript
// Apply custom styling
const titleElement = document.getElementById('transitionTitle');
const subtitleElement = document.getElementById('transitionSubtitle');
titleElement.style.fontWeight = '500';
subtitleElement.style.fontWeight = '700';

showTransitionScreen({
    icons: ['⏱️'],
    iconSize: 'large',
    title: 'Average time taken:',
    subtitle: '2 minutes 15 seconds',
    duration: 3000
});
```

---

## 🎨 Shared Styles

### Common CSS for All Components

```css
/* Transition Screen Modal */
.transition-screen {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    z-index: 1000;
    animation: fadeIn 0.3s ease;
    backdrop-filter: blur(4px);
}

.transition-screen.active {
    display: flex;
    justify-content: center;
    align-items: center;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

/* Modal Content */
.transition-content {
    background: #ffffff;
    border-radius: 24px;
    padding: 56px 40px;
    min-width: 360px;
    max-width: 520px;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes slideIn {
    from {
        transform: translateY(-30px) scale(0.9);
        opacity: 0;
    }
    to {
        transform: translateY(0) scale(1);
        opacity: 1;
    }
}

/* Icon Section */
.transition-icons {
    margin-bottom: 28px;
    min-height: 80px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
}

.transition-icon {
    font-size: 72px;
    line-height: 1;
    animation: iconPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.transition-icon.small {
    font-size: 48px;
}

.transition-icon.large {
    font-size: 96px;
}

@keyframes iconPop {
    0% {
        transform: scale(0) rotate(-180deg);
        opacity: 0;
    }
    50% {
        transform: scale(1.2) rotate(10deg);
    }
    100% {
        transform: scale(1) rotate(0deg);
        opacity: 1;
    }
}

/* Title */
.transition-title {
    font-size: 32px;
    font-weight: 700;
    color: #270f36;
    margin-bottom: 16px;
    line-height: 1.2;
    font-family: 'Epilogue', sans-serif;
}

/* Subtitle */
.transition-subtitle {
    font-size: 18px;
    font-weight: 500;
    color: #666666;
    margin-bottom: 36px;
    line-height: 1.5;
    font-family: 'Epilogue', sans-serif;
}

/* Button Container */
.transition-buttons {
    display: flex;
    justify-content: center;
    gap: 16px;
    flex-wrap: wrap;
}

/* Buttons */
.transition-btn {
    padding: 14px 36px;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 600;
    font-family: 'Epilogue', sans-serif;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    min-width: 140px;
}

.transition-btn.primary {
    background: #219653;
    color: #ffffff;
}

.transition-btn.primary:hover {
    transform: translateY(-4px);
    box-shadow: 0 6px 20px rgba(33, 150, 83, 0.4);
}

.transition-btn.secondary {
    background: #667eea;
    color: #ffffff;
}

.transition-btn.secondary:hover {
    transform: translateY(-4px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

/* SVG Stars */
.stars-container {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-bottom: 24px;
}

.star {
    width: 48px;
    height: 48px;
    transition: all 0.3s ease;
}

.star svg {
    width: 100%;
    height: 100%;
}

.star.active {
    animation: starBounce 0.5s ease;
}

.star:nth-child(1) {
    animation-delay: 0.1s;
}

.star:nth-child(2) {
    animation-delay: 0.2s;
}

.star:nth-child(3) {
    animation-delay: 0.3s;
}

@keyframes starBounce {
    0% { transform: scale(0) rotate(0deg); }
    50% { transform: scale(1.2) rotate(180deg); }
    100% { transform: scale(1) rotate(360deg); }
}
```

---

## 🔧 Helper Functions

### SVG Star Generator

```javascript
function createSVGStar(isActive = true) {
    const color = isActive ? '#FFDE49' : '#E0E0E0';
    const highlightColor = isActive ? '#ffff8d' : '#E0E0E0';
    const shadowColor = isActive ? '#f4b400' : '#E0E0E0';

    return `
        <svg class="star-svg" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
            <path d="M68.05 7.23l13.46 30.7a7.047 7.047 0 0 0 5.82 4.19l32.79 2.94c3.71.54 5.19 5.09 2.5 7.71l-24.7 20.75c-2 1.68-2.91 4.32-2.36 6.87l7.18 33.61c.63 3.69-3.24 6.51-6.56 4.76L67.56 102a7.033 7.033 0 0 0-7.12 0l-28.62 16.75c-3.31 1.74-7.19-1.07-6.56-4.76l7.18-33.61c.54-2.55-.36-5.19-2.36-6.87L5.37 52.78c-2.68-2.61-1.2-7.17 2.5-7.71l32.79-2.94a7.047 7.047 0 0 0 5.82-4.19l13.46-30.7c1.67-3.36 6.45-3.36 8.11-.01z" fill="${color}"/>
            <path d="M67.07 39.77l-2.28-22.62c-.09-1.26-.35-3.42 1.67-3.42c1.6 0 2.47 3.33 2.47 3.33l6.84 18.16c2.58 6.91 1.52 9.28-.97 10.68c-2.86 1.6-7.08.35-7.73-6.13z" fill="${highlightColor}"/>
            <path d="M95.28 71.51L114.9 56.2c.97-.81 2.72-2.1 1.32-3.57c-1.11-1.16-4.11.51-4.11.51l-17.17 6.71c-5.12 1.77-8.52 4.39-8.82 7.69c-.39 4.4 3.56 7.79 9.16 3.97z" fill="${shadowColor}"/>
        </svg>
    `;
}
```

### Stars Container Generator

```javascript
function createStarsHTML(activeStars, totalStars = 3) {
    let starsHTML = '<div class="stars-container">';
    for (let i = 0; i < totalStars; i++) {
        const isActive = i < activeStars;
        const className = isActive ? 'star active' : 'star';
        starsHTML += `<div class="${className}">${createSVGStar(isActive)}</div>`;
    }
    starsHTML += '</div>';
    return starsHTML;
}
```

### Main Transition Screen Function

```javascript
function showTransitionScreen(config) {
    const screen = document.getElementById('transitionScreen');
    const iconsContainer = document.getElementById('transitionIcons');
    const titleElement = document.getElementById('transitionTitle');
    const subtitleElement = document.getElementById('transitionSubtitle');
    const buttonsContainer = document.getElementById('transitionButtons');

    // Clear previous content
    iconsContainer.innerHTML = '';
    buttonsContainer.innerHTML = '';

    // Reset any custom styles
    iconsContainer.style.minHeight = '80px';
    titleElement.style.color = '';
    titleElement.style.fontSize = '';
    titleElement.style.fontWeight = '';
    subtitleElement.style.fontWeight = '';

    // Handle SVG Stars
    if (config.svgStars) {
        iconsContainer.innerHTML = createStarsHTML(
            config.activeStars || 3,
            config.totalStars || 3
        );
    }
    // Handle regular icons
    else if (config.icons) {
        const icons = Array.isArray(config.icons) ? config.icons : [config.icons];
        icons.forEach((icon, index) => {
            const iconElement = document.createElement('span');
            iconElement.className = 'transition-icon';

            if (config.iconSize) {
                iconElement.classList.add(config.iconSize);
            }

            if (config.iconStyles && config.iconStyles[index]) {
                Object.assign(iconElement.style, config.iconStyles[index]);
            }

            iconElement.style.animationDelay = `${index * 0.1}s`;
            iconElement.textContent = icon;
            iconsContainer.appendChild(iconElement);
        });
    }

    // Apply custom title styles if provided
    if (config.titleStyles) {
        Object.assign(titleElement.style, config.titleStyles);
    }

    // Set title
    titleElement.textContent = config.title || '';

    // Set subtitle
    if (config.subtitle) {
        subtitleElement.innerHTML = config.subtitle.replace(/\n/g, '<br>');
        subtitleElement.style.display = 'block';
    } else {
        subtitleElement.style.display = 'none';
    }

    // Set buttons
    if (config.buttons && config.buttons.length > 0) {
        config.buttons.forEach(button => {
            const btnElement = document.createElement('button');
            btnElement.className = `transition-btn ${button.type || 'primary'}`;
            btnElement.textContent = button.text;

            btnElement.onclick = () => {
                if (button.action) {
                    button.action();
                }
                hideTransitionScreen();
            };

            buttonsContainer.appendChild(btnElement);
        });
        buttonsContainer.style.display = 'flex';
    } else {
        buttonsContainer.style.display = 'none';
    }

    // Show the screen
    screen.classList.add('active');

    // Auto-hide if duration specified
    if ((!config.buttons || config.buttons.length === 0) && config.duration !== null) {
        setTimeout(() => {
            hideTransitionScreen();
        }, config.duration || 3000);
    }
}

function hideTransitionScreen() {
    const screen = document.getElementById('transitionScreen');
    screen.classList.remove('active');
}
```

### Configuration Object

```javascript
const configTemplate = {
    svgStars: false,           // Use SVG stars instead of icons
    activeStars: 3,            // Number of active stars (1-3)
    totalStars: 3,             // Total stars to display
    icons: ['🎮'],            // Array or string of emoji/text icons
    iconSize: 'normal',        // 'small', 'normal', or 'large'
    iconStyles: [],            // Array of custom style objects
    title: 'Title Text',       // Required - main message
    titleStyles: {},           // Custom title styles object
    subtitle: 'Subtitle',      // Optional - supporting text
    buttons: [                 // Array of button objects
        {
            text: 'Button Text',
            type: 'primary',   // 'primary', 'secondary'
            action: () => {}   // Callback function
        }
    ],
    duration: 3000             // Auto-dismiss time in ms (null = no auto-dismiss)
};
```

---

**Version:** 2.5
**Last Updated:** November 2024
**Framework:** Vanilla JavaScript + CSS3
