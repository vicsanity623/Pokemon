// Input Handling with Dynamic Joystick
class InputHandler {
    constructor() {
        this.keys = {};
        window.addEventListener('keydown', e => this.keys[e.key] = true);
        window.addEventListener('keyup', e => this.keys[e.key] = false);

        // Joystick State
        this.touchId = null;
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

        // Touch Events
        window.addEventListener('touchstart', e => this.handleStart(e), { passive: false });
        window.addEventListener('touchmove', e => this.handleMove(e), { passive: false });
        window.addEventListener('touchend', e => this.handleEnd(e));

        // Mouse Events (for testing on iMac)
        window.addEventListener('mousedown', e => this.handleStart(e));
        window.addEventListener('mousemove', e => this.handleMove(e));
        window.addEventListener('mouseup', e => this.handleEnd(e));
    }

    handleStart(e) {
        // Ignore if touching buttons
        if (e.target.closest('.action-btn') || e.target.closest('#battle-ui')) return;

        e.preventDefault();
        const point = e.changedTouches ? e.changedTouches[0] : e;

        if (this.touchId === null) {
            this.touchId = (e.changedTouches ? point.identifier : 'mouse');
            this.startX = point.clientX;
            this.startY = point.clientY;
            this.currentX = point.clientX;
            this.currentY = point.clientY;
            this.active = true;

            // Show Visuals
            this.baseEl.style.display = 'block';
            this.baseEl.style.left = this.startX + 'px';
            this.baseEl.style.top = this.startY + 'px';
            this.stickEl.style.transform = `translate(-50%, -50%)`;
        }
    }

    handleMove(e) {
        if (!this.active) return;
        e.preventDefault();

        let point = null;
        if (e.changedTouches) {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.touchId) {
                    point = e.changedTouches[i];
                    break;
                }
            }
        } else if (this.touchId === 'mouse') {
            point = e;
        }

        if (point) {
            this.currentX = point.clientX;
            this.currentY = point.clientY;

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
    }

    handleEnd(e) {
        if (!this.active) return;

        let shouldEnd = false;
        if (e.changedTouches) {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.touchId) {
                    shouldEnd = true;
                    break;
                }
            }
        } else if (this.touchId === 'mouse') {
            shouldEnd = true;
        }

        if (shouldEnd) {
            this.active = false;
            this.touchId = null;
            this.baseEl.style.display = 'none';
            this.keys['ArrowUp'] = false;
            this.keys['ArrowDown'] = false;
            this.keys['ArrowLeft'] = false;
            this.keys['ArrowRight'] = false;
            this.joystickVector = { x: 0, y: 0 };
        }
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

    press(key) { this.keys[key] = true; }
    release(key) { this.keys[key] = false; }
    isDown(key) { return this.keys[key]; }
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
    if (level <= 100) return "Lv." + level;
    let tiers = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
    let tierIndex = Math.floor((level - 1) / 100) - 1;
    let subLevel = (level - 1) % 100 + 1;

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
        this.gameDays = 0;
        this.lastCheck = Date.now();
    }

    update(player) {
        let now = Date.now();
        let diff = now - this.startTime;
        // 1 Game Day = 6 Real Hours = 21600000ms
        // For testing/playability in this demo, we speed it up: 1 Game Day = 1 Real Minute
        // CHANGE THIS VALUE TO 21600000 for strict prompt adherence
        const DAY_LENGTH = 21600000;

        if (diff > (this.gameDays + 1) * DAY_LENGTH) {
            this.gameDays++;
            player.surviveLevelUp();
        }

        document.getElementById('meta-time').innerText = this.gameDays + "d " + Math.floor((diff % DAY_LENGTH) / 1000) + "s";
    }
}

// Dialog
function showDialog(text, duration = 0) {
    const box = document.getElementById('dialog-box');
    const p = document.getElementById('dialog-text');
    box.classList.remove('hidden');
    p.innerText = text;
    if (duration > 0) {
        setTimeout(() => box.classList.add('hidden'), duration);
    }
}
function hideDialog() {
    document.getElementById('dialog-box').classList.add('hidden');
}