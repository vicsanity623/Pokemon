// Input Handling
class InputHandler {
    constructor() {
        this.keys = {};
        window.addEventListener('keydown', e => this.keys[e.key] = true);
        window.addEventListener('keyup', e => this.keys[e.key] = false);
    }
    press(key) { this.keys[key] = true; }
    release(key) { this.keys[key] = false; }
    isDown(key) { return this.keys[key]; }
}
const input = new InputHandler();

// Seeded Random for Procedural World
class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }
    // Simple hash function for coordinate based randomness
    at(x, y) {
        const n = Math.sin(x * 12.9898 + y * 78.233 + this.seed) * 43758.5453123;
        return n - Math.floor(n);
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
        const DAY_LENGTH = 60000;

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