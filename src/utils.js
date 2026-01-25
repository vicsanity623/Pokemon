// Input Handling with Dynamic Joystick
class InputHandler {
    constructor() {
        this.keys = {};
        window.addEventListener('keydown', (e) => (this.keys[e.key] = true));
        window.addEventListener('keyup', (e) => (this.keys[e.key] = false));

        // Joystick State
        this.pointerId = null;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;
        this.joystickVector = { x: 0, y: 0 };
        this.active = false;

        // Visuals
        this.baseEl = document.createElement('div');
        this.baseEl.className = 'joystick-base';
        this.stickEl = document.createElement('div');
        this.stickEl.className = 'joystick-stick';
        this.baseEl.appendChild(this.stickEl);
        document.body.appendChild(this.baseEl);

        // Pointer Events (Unified Mouse/Touch)
        window.addEventListener('pointerdown', (e) => this.handleStart(e));
        window.addEventListener('pointermove', (e) => this.handleMove(e));
        window.addEventListener('pointerup', (e) => this.handleEnd(e));
        window.addEventListener('pointercancel', (e) => this.handleEnd(e));
    }

    handleStart(e) {
        // Ignore if touching buttons or UI
        if (
            e.target.closest('.action-btn') ||
            e.target.closest('#battle-ui') ||
            e.target.closest('.battle-sub-menu') ||
            e.target.closest('.bag-tabs') ||
            e.target.closest('.menu-item') ||
            e.target.closest('#party-sidebar') ||
            e.target.closest('#hamburger-btn') || // Fix for Menu Button
            e.target.closest('#dialog-box') ||
            e.target.closest('#npc-prompt') ||
            e.target.closest('button')
        )
            return;

        // Ignore if Bag menu is open
        const bagMenu = document.getElementById('player-bag-menu');
        if (bagMenu && !bagMenu.classList.contains('hidden')) return;

        e.preventDefault();

        if (this.pointerId === null) {
            this.pointerId = e.pointerId;
            this.startX = e.clientX;
            this.startY = e.clientY;
            this.currentX = e.clientX;
            this.currentY = e.clientY;
            this.active = true;

            // Show Visuals
            this.baseEl.style.display = 'block';
            this.baseEl.style.left = this.startX + 'px';
            this.baseEl.style.top = this.startY + 'px';
            this.stickEl.style.transform = `translate(-50%, -50%)`;
        }
    }

    handleMove(e) {
        if (!this.active || e.pointerId !== this.pointerId) return;
        e.preventDefault();

        this.currentX = e.clientX;
        this.currentY = e.clientY;

        // Update Visual Stick
        const dx = this.currentX - this.startX;
        const dy = this.currentY - this.startY;
        const distance = Math.min(50, Math.sqrt(dx * dx + dy * dy));
        const angle = Math.atan2(dy, dx);

        const stickX = Math.cos(angle) * distance;
        const stickY = Math.sin(angle) * distance;

        this.stickEl.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;

        // Map to Keys (Legacy support)
        this.updateKeys(dx, dy, distance);

        // Analog Vector
        if (distance > 5) {
            this.joystickVector.x = dx / distance;
            this.joystickVector.y = dy / distance;
        } else {
            this.joystickVector.x = 0;
            this.joystickVector.y = 0;
        }
    }

    handleEnd(e) {
        if (!this.active || e.pointerId !== this.pointerId) return;

        this.active = false;
        this.pointerId = null;
        this.baseEl.style.display = 'none';
        this.keys['ArrowUp'] = false;
        this.keys['ArrowDown'] = false;
        this.keys['ArrowLeft'] = false;
        this.keys['ArrowRight'] = false;
        this.joystickVector = { x: 0, y: 0 };
    }

    updateKeys(dx, dy, distance) {
        // Reset
        this.keys['ArrowUp'] = false;
        this.keys['ArrowDown'] = false;
        this.keys['ArrowLeft'] = false;
        this.keys['ArrowRight'] = false;

        if (distance < 10) return; // Deadzone

        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal
            if (dx > 0) this.keys['ArrowRight'] = true;
            else this.keys['ArrowLeft'] = true;
        } else {
            // Vertical
            if (dy > 0) this.keys['ArrowDown'] = true;
            else this.keys['ArrowUp'] = true;
        }
    }

    press(key) {
        this.keys[key] = true;
    }
    release(key) {
        this.keys[key] = false;
    }
    isDown(key) {
        return this.keys[key];
    }
}
const input = new InputHandler();

// Seeded Random for Procedural World
// Simple Value Noise for Smooth Biomes
class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }
    // White noise (hash)
    hash(x, y) {
        let n = Math.sin(x * 12.9898 + y * 78.233 + this.seed) * 43758.5453123;
        return n - Math.floor(n);
    }
    // Smooth interpolation
    lerp(a, b, t) {
        return a + (b - a) * t;
    }
    // Value Noise 2D
    noise(x, y) {
        let i = Math.floor(x);
        let j = Math.floor(y);
        let u = x - i;
        let v = y - j;

        // Smoothstep
        u = u * u * (3 - 2 * u);
        v = v * v * (3 - 2 * v);

        return this.lerp(
            this.lerp(this.hash(i, j), this.hash(i + 1, j), u),
            this.lerp(this.hash(i, j + 1), this.hash(i + 1, j + 1), u),
            v
        );
    }
}

// Ascension Logic
function formatLevel(level) {
    if (level <= 100) return 'Lv.' + level;
    let tiers = [
        'A',
        'B',
        'C',
        'D',
        'E',
        'F',
        'G',
        'H',
        'I',
        'J',
        'K',
        'L',
        'M',
        'N',
        'O',
        'P',
        'Q',
        'R',
        'S',
        'T',
        'U',
        'V',
        'W',
        'X',
        'Y',
        'Z'
    ];
    let tierIndex = Math.floor((level - 1) / 100) - 1;
    let subLevel = ((level - 1) % 100) + 1;

    // Recursive logic for AA, AB etc is complex for 6 files, simplified to Single Letter + Loops
    if (tierIndex < tiers.length) return tiers[tierIndex] + subLevel;

    // Fallback for AA+
    let loop = Math.floor(tierIndex / 26);
    let char = tiers[tierIndex % 26];
    return char.repeat(loop + 1) + subLevel;
}

// Game Clock
class GameClock {
    constructor() {
        this.startTime = Date.now();
        this.elapsedTime = 0;
        this.gameDays = 0;
        this.lastCheck = Date.now();
    }

    update(player) {
        let now = Date.now();
        let diff = now - this.startTime + this.elapsedTime;
        
        // CHANGE THIS LINE (2 * 60 * 60 * 1000 = 2 Hours)
        const DAY_LENGTH = 2 * 60 * 60 * 1000; 

        if (diff > (this.gameDays + 1) * DAY_LENGTH) {
            this.gameDays++;
            player.surviveLevelUp();
        }

        // Format time as HH:MM:SS
        let totalSeconds = Math.floor((diff % DAY_LENGTH) / 1000);
        let hours = Math.floor(totalSeconds / 3600);
        let minutes = Math.floor((totalSeconds % 3600) / 60);
        let seconds = totalSeconds % 60;

        let timeStr = '';
        if (this.gameDays > 0) {
            timeStr = `${this.gameDays}d `;
        }
        timeStr += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        document.getElementById('meta-time').innerText = timeStr;
    }
}
// --- GLOBAL DIALOG QUEUE ---
const dialogQueue = [];
let isDialogPlaying = false;

function showDialog(text, duration = 0) { // Duration is ignored in batch mode, handled automatically
    // 1. Cleanup logic (same as before)
    const oldBox = document.getElementById('game-dialog');
    if (oldBox) oldBox.remove();

    // 2. Add to queue
    dialogQueue.push({ text });

    // 3. Start if not running
    if (!isDialogPlaying) {
        processDialogQueue();
    }
}

function processDialogQueue() {
    const box = document.getElementById('dialog-box');
    const p = document.getElementById('dialog-text');

    // A. Stop if queue is empty
    if (dialogQueue.length === 0) {
        box.classList.add('hidden');
        isDialogPlaying = false;
        return;
    }

    // B. Start Playing
    isDialogPlaying = true;

    // --- C. BATCHING LOGIC (The Fix) ---
    // Take up to 3 messages from the queue at once
    const batch = [];
    const MAX_LINES = 3; 

    while (dialogQueue.length > 0 && batch.length < MAX_LINES) {
        batch.push(dialogQueue.shift());
    }

    // Combine them into one HTML string with line breaks
    // We use innerHTML so <br> or <div> works
    const combinedText = batch.map(item => `<div>• ${item.text}</div>`).join('');
    
    p.innerHTML = combinedText; 
    box.classList.remove('hidden');
    
    // --- POSITIONING ---
    box.style.zIndex = "30000"; 
    box.style.position = 'fixed'; 
    box.style.top = "75%"; 
    box.style.left = "50%"; 
    box.style.transform = "translate(-50%, -50%)";
    // Adjust height automatically to fit 1-3 lines
    box.style.height = "auto"; 
    box.style.padding = "10px";

    // D. SMART TIMING
    // Base time: 2 seconds to read the batch
    let displayTime = 2000;
    
    // If the queue is STILL huge even after taking 3, speed up
    if (dialogQueue.length > 5) {
        displayTime = 1000; // 1 second per batch
    }
    if (dialogQueue.length > 15) {
        displayTime = 500;  // 0.5s (Turbo mode for massive loot drops)
    }

    // E. Schedule next batch
    setTimeout(() => {
        processDialogQueue();
    }, displayTime);
}

function hideDialog() {
    // document.getElementById('dialog-box').classList.add('hidden');
}
