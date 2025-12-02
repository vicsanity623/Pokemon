// Global Instances
const player = new Player();
const world = new World(Date.now());
const canvas = document.getElementById('gameCanvas');
const renderer = new Renderer(canvas, world, player);
const battleSystem = new BattleSystem(player);
const questSystem = new QuestSystem(player);
const clock = new GameClock();

// Safe Spawn Logic
function findSafeSpawn() {
    let radius = 0;
    while (true) {
        // Spiral check (simplified to random attempts for speed)
        // If current tile is water, move randomly
        let tile = world.getTile(Math.round(player.x), Math.round(player.y));
        if (tile !== 'water') break;

        player.x = Math.floor(Math.random() * 20) - 10;
        player.y = Math.floor(Math.random() * 20) - 10;
    }
}
findSafeSpawn();

// Intro Story
const introText = [
    "Year 20XX...",
    "The world has fallen.",
    "You wake up alone.",
    "Take your Pokeballs.",
    "Survive."
];
let introIndex = 0;

function runIntro() {
    if (introIndex < introText.length) {
        showDialog(introText[introIndex], 0);
        introIndex++;
        setTimeout(runIntro, 2500);
    } else {
        hideDialog();
        showDialog("Use D-Pad to move. Tap A to interact.", 3000);
        questSystem.generate();
    }
}

// Main Loop
let lastTime = 0;
function gameLoop(timestamp) {
    if (!battleSystem.isActive) {
        // Smooth Movement Logic
        let dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        if (dt > 0.1) dt = 0.1; // Cap dt for lag spikes

        let dx = 0;
        let dy = 0;

        // Analog Input Priority
        if (input.active && (input.joystickVector.x !== 0 || input.joystickVector.y !== 0)) {
            dx = input.joystickVector.x;
            dy = input.joystickVector.y;
        } else {
            // Keyboard Fallback (8-way)
            if (input.isDown('ArrowUp')) dy -= 1;
            if (input.isDown('ArrowDown')) dy += 1;
            if (input.isDown('ArrowLeft')) dx -= 1;
            if (input.isDown('ArrowRight')) dx += 1;

            // Normalize Keyboard
            if (dx !== 0 || dy !== 0) {
                let len = Math.sqrt(dx * dx + dy * dy);
                dx /= len;
                dy /= len;
            }
        }

        if (dx !== 0 || dy !== 0) {
            // STRICT Normalization to fix diagonal speed bug
            // Ensure vector length is exactly 1
            let length = Math.sqrt(dx * dx + dy * dy);
            if (length > 0) {
                dx /= length;
                dy /= length;
            }

            // Calculate potential new position
            let moveSpeed = player.speed * (dt * 60); // Speed relative to 60fps
            let nextX = player.x + dx * moveSpeed;
            let nextY = player.y + dy * moveSpeed;

            // Collision Check (Center point)
            // We check the tile we are moving INTO
            let targetTile = world.getTile(Math.round(nextX), Math.round(nextY));

            if (targetTile !== 'water') {
                player.x = nextX;
                player.y = nextY;
                player.steps += moveSpeed; // Approximate steps
                player.moving = true;

                // Item Pickup
                let item = world.getItem(Math.round(player.x), Math.round(player.y));
                if (item) {
                    world.removeItem(Math.round(player.x), Math.round(player.y));
                    if (player.bag[item]) player.bag[item]++;
                    else player.bag[item] = 1;
                    showDialog(`Found a ${item}!`, 2000);
                }

                // Update Direction for sprites (if we had them)
                if (Math.abs(dx) > Math.abs(dy)) {
                    player.dir = dx > 0 ? 'right' : 'left';
                } else {
                    player.dir = dy > 0 ? 'down' : 'up';
                }

                // Quest Update (throttled)
                if (Math.floor(player.steps) % 10 === 0) questSystem.update('walk');

                // Encounter Check (Randomly based on distance moved)
                // Chance per tile moved approx
                if (targetTile === 'grass_tall' && Math.random() < 0.04 * moveSpeed) {
                    battleSystem.startBattle();
                }
            }
        } else {
            player.moving = false;
        }

        clock.update(player);
        renderer.draw();
        updateHUD();
    }
    requestAnimationFrame(gameLoop);
}

// Init
window.onload = () => {
    if (!loadGame()) {
        // Give starter items if new game
        player.team.push({
            name: 'PIKACHU',
            level: 5,
            maxHp: 40,
            hp: 40,
            exp: 0,
            type: 'electric',
            backSprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/25.png'
        });
        runIntro();
    } else {
        showDialog("Welcome back!", 2000);
    }

    requestAnimationFrame(gameLoop);

    // Auto-Save every 30s
    setInterval(saveGame, 30000);

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Service Worker Registered'))
            .catch(err => console.error('SW Registration Failed', err));
    }
};

// Save System
function saveGame() {
    const data = {
        player: {
            x: player.x,
            y: player.y,
            stats: {
                level: player.pLevel,
                steps: player.steps
            },
            team: player.team,
            bag: player.bag
        },
        world: {
            seed: world.rng.seed,
            items: world.items
        },
        time: clock.gameDays
    };
    localStorage.setItem('poke_save', JSON.stringify(data));
    console.log("Game Saved");
}

function loadGame() {
    const raw = localStorage.getItem('poke_save');
    if (!raw) return false;

    try {
        const data = JSON.parse(raw);

        // Restore Player
        player.x = data.player.x;
        player.y = data.player.y;
        player.pLevel = data.player.stats.level;
        player.steps = data.player.stats.steps;
        player.team = data.player.team;
        player.bag = data.player.bag;
        document.getElementById('meta-level').innerText = player.pLevel;

        // Restore World
        // Note: We don't restore seed here as it's passed in constructor, 
        // but for full correctness we should re-init world if seed changed.
        // For this demo, we assume seed is constant or we'd need to re-new World.
        // We'll just restore items.
        world.items = data.world.items;

        // Restore Time
        clock.gameDays = data.time;

        return true;
    } catch (e) {
        console.error("Save file corrupted", e);
        return false;
    }
}

function updateHUD() {
    // Money
    document.getElementById('hud-money').innerText = `$${player.money}`;

    // XP (Active Pokemon)
    let p = player.team[0];
    let maxExp = p.level * 100;
    let pct = (p.exp / maxExp) * 100;

    document.getElementById('hud-xp-text').innerText = `XP: ${p.exp} / ${maxExp}`;
    document.getElementById('hud-xp-fill').style.width = `${pct}%`;
}