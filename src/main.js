// Global Instances
const VERSION = 'v3.0.5'; // Bumped Version
const player = new Player();
const world = new World(Date.now());
/** @type {HTMLCanvasElement} */
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('gameCanvas'));
const renderer = new Renderer(canvas, world, player);
const battleSystem = new BattleSystem(player);
const questSystem = new QuestSystem(player);
const clock = new GameClock();
const mergeSystem = new CombineSystem(player);
const arenaSystem = new ArenaSystem(player);
const rivalSystem = new RivalSystem(player);
const homeSystem = new HomeSystem(player);
const storeSystem = new StoreSystem(player);
const defenseSystem = new DefenseSystem(player, world);
const liminalSystem = new LiminalSystem(player, world);
const rpgSystem = new RPGSystem(player);
const guardianSystem = new GuardianSystem(player);
const resourceSystem = new ResourceSystem(player, world);
const enemySystem = new EnemySystem(player, world);
const craftingSystem = new CraftingSystem(player);
const mapSystem = new MapSystem(player, world);
world.init();
let isPartyOpen = true; // Default to open

// --- GLOBAL STATE VARIABLES (Declared early to avoid reference errors) ---
let isPaused = false;
let gameSpeed = 1.0;
let needsUIUpdate = false;
let catchCombo = { species: null, count: 0 };
let dungeonSystem = null; // Will be initialized if DungeonSystem class exists

// --- OPTIMIZATION VARIABLES ---
// We use these to throttle heavy logic (AI, HUD updates)
// so they run 10 times a second instead of 60.
let lastSlowUpdate = 0;
const SLOW_UPDATE_INTERVAL = 100; // 100ms = 10 FPS for logic
let isTabActive = true;

// DOM Cache (Stores elements so we don't search for them every frame)
const DOM = {
    npcPrompt: document.getElementById('npc-prompt'),
    hudMoney: document.getElementById('hud-money'),
    hudXpText: document.getElementById('hud-xp-text'),
    hudXpFill: document.getElementById('hud-xp-fill'),
    metaLevel: document.getElementById('meta-level') // If you have this
};

// Visibility Handler (Stops the game processing when you close the app/tab)
document.addEventListener('visibilitychange', () => {
    isTabActive = !document.hidden;
    if (!isTabActive) {
        if (mainMusic && !mainMusic.paused) mainMusic.pause();
    } else {
        if (mainMusic && !liminalSystem.active) mainMusic.play().catch(e => { });
    }
});
// --- AUTO HARVEST VARIABLES ---
let autoHarvestTarget = null;
let lastAutoAttackTime = 0;
const TILE_SIZE_VISUAL = 64; // Adjust to 32 or 64 if clicks are slightly offset

// --- AUTO ATTACK ENEMY VARIABLES ---
let autoAttackEnemyTarget = null; // The enemy object being auto-attacked
let lastEnemyAttackTime = 0;

// Music System
/** @type {HTMLAudioElement} */
const mainMusic = /** @type {HTMLAudioElement} */ (document.getElementById('main-music'));
/** @type {HTMLAudioElement} */
const battleMusic = /** @type {HTMLAudioElement} */ (document.getElementById('battle-music'));
let musicVolume = 0.5; // 50% default volume

// --- OPTIMIZED SFX CACHE ---
const sfxCache = {};

function playSFX(id) {
    // Only search the DOM once per sound, then remember it
    if (!sfxCache[id]) {
        sfxCache[id] = document.getElementById(id);
    }
    
    const sfx = sfxCache[id];
    if (sfx) {
        // Reset and play immediately
        sfx.currentTime = 0;
        sfx.play().catch(e => { /* Ignore auto-play errors */ });
    }
}

// NOTE: updateHUD, toggleMainMenu, and renderPC are defined later in the file\n// JavaScript function declarations are hoisted, so forward declarations are unnecessary\n
// Generate random stats for Pokemon (12-100 range)
function generatePokemonStats() {
    return {
        strength: Math.floor(Math.random() * 89) + 12, // 12-100
        defense: Math.floor(Math.random() * 89) + 12, // 12-100
        speed: Math.floor(Math.random() * 89) + 12, // 12-100
        hp: Math.floor(Math.random() * 89) + 12, // 12-100
        special: Math.floor(Math.random() * 89) + 12 // 12-100
    };
}

// Safe Spawn Logic
function findSafeSpawn() {
    let attempts = 0;
    while (attempts < 100) {
        attempts++;
        // Spiral check (simplified to random attempts for speed)
        // If current tile is water, move randomly
        let x = Math.floor(Math.random() * 20) - 10;
        let y = Math.floor(Math.random() * 20) - 10;

        let tile = world.getTile(x, y);
        if (tile !== 'water') {
            // Check neighbors to ensure not isolated
            let neighbors = 0;
            if (world.getTile(x + 1, y) !== 'water') neighbors++;
            if (world.getTile(x - 1, y) !== 'water') neighbors++;
            if (world.getTile(x, y + 1) !== 'water') neighbors++;
            if (world.getTile(x, y - 1) !== 'water') neighbors++;

            if (neighbors >= 2) {
                player.x = x;
                player.y = y;
                break;
            }
        }
    }
}
findSafeSpawn();

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W')
        input.press('up');
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S')
        input.press('down');
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A')
        input.press('left');
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')
        input.press('right');
    if (e.key === 'z' || e.key === 'Z') input.press('a');
    if (e.key === 'x' || e.key === 'X') input.press('b');
    if (e.key === 'Enter') input.press('start');
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W')
        input.release('up');
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S')
        input.release('down');
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A')
        input.release('left');
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')
        input.release('right');
    if (e.key === 'z' || e.key === 'Z') input.release('a');
    if (e.key === 'x' || e.key === 'X') input.release('b');
    if (e.key === 'Enter') input.release('start');
});

// --- SMART TOUCH INTERACTION (REPLACES ALL POINTERDOWN LISTENERS) ---
const gameCanvas = document.getElementById('gameCanvas');
gameCanvas.addEventListener('pointerdown', (e) => {
    // 1. Ignore clicks if menus are open
    if (storeSystem.isOpen || isPaused || document.getElementById('crafting-ui')) return;

    // 2. Calculate World Coordinates
    const rect = gameCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const worldClickX = player.x + (clickX - centerX) / TILE_SIZE_VISUAL;
    const worldClickY = player.y + (clickY - centerY) / TILE_SIZE_VISUAL;

    // --- NEW: CHECK WORKBENCH FIRST ---
    if (typeof craftingSystem !== 'undefined' && craftingSystem.workbenchLocation) {
        const wb = craftingSystem.workbenchLocation;
        // Check if tap is close to workbench (radius 1.5 tiles)
        if (Math.abs(worldClickX - wb.x) < 1.5 && Math.abs(worldClickY - wb.y) < 1.5) {
            // Distance Check from Player
            const dist = Math.sqrt(Math.pow(wb.x - player.x, 2) + Math.pow(wb.y - player.y, 2));
            if (dist < 3.0) { // Allow range of 3
                craftingSystem.interact();
                return; // Stop here, don't auto-harvest
            } else {
                showDialog("Too far from Workbench!", 1000);
                // Optionally: Walk to it (Advanced logic), but for now just tell player
                return;
            }
        }
    }

    // 1. PRIORITY: Check for NPC Tap
    const nearbyNPC = world.npcs.find(n => Math.hypot(n.x - worldClickX, n.y - worldClickY) < 1.2);
    if (nearbyNPC) {
        // Only talk if player is physically near the NPC too
        if (Math.hypot(player.x - nearbyNPC.x, player.y - nearbyNPC.y) < 2.5) {
            handleNPCInteraction(nearbyNPC);
            autoHarvestTarget = null;
            autoAttackEnemyTarget = null;
            return; // 🔒 Stop event here
        }
    }

    // 2. PRIORITY: Check for Building Tap (PokeCenter, Arena, Home)
    const nearbyBuilding = world.buildings.find(b => Math.hypot(b.x - worldClickX, b.y - worldClickY) < 1.5);
    if (nearbyBuilding) {
        if (Math.hypot(player.x - nearbyBuilding.x, player.y - nearbyBuilding.y) < 2.5) {
            if (nearbyBuilding.type === 'pokecenter') handlePokeCenterInteraction();
            else if (nearbyBuilding.type === 'arena') arenaSystem.enter();
            else if (nearbyBuilding.type === 'home' || homeSystem.isNearHome(player.x, player.y)) homeSystem.interact();
            return;
        }
    }

    // 3. Check for Enemies
    if (typeof enemySystem !== 'undefined') {
        const enemy = enemySystem.enemies.find(en => Math.hypot(en.x - worldClickX, en.y - worldClickY) < 1.2);
        if (enemy) {
            autoAttackEnemyTarget = enemy;
            autoHarvestTarget = null;
            return;
        }
    }

    // 4. Resource Node (Auto-Harvest)
    const tx = Math.round(worldClickX), ty = Math.round(worldClickY);
    const candidates = [`${tx},${ty}`, `${tx+1},${ty}`, `${tx-1},${ty}`, `${tx},${ty+1}`, `${tx},${ty-1}`];
    for (let key of candidates) {
        if (resourceSystem.nodes[key]) {
            const parts = key.split(',').map(Number);
            autoHarvestTarget = { x: parts[0], y: parts[1], key: key };
            autoAttackEnemyTarget = null;
            return;
        }
    }

    autoHarvestTarget = null;
    autoAttackEnemyTarget = null;
});

// Intro Story
const introText = [
    'Year 20XX...',
    'The world has fallen.',
    'You wake up alone.',
    'Take your Pokeballs.',
    'Survive.'
];
let introIndex = 0;

function runIntro() {
    if (introIndex < introText.length) {
        showDialog(introText[introIndex], 0);
        introIndex++;
        setTimeout(runIntro, 2500);
    } else {
        hideDialog();
        showDialog('Use D-Pad to move. Tap A to interact.', 3000);
        questSystem.generate();
    }
}

// Main Loop (Optimized)
let lastTime = 0;
const TARGET_FPS = 30; // 30 is ideal for battery saver, 60 for smoothness
const FRAME_INTERVAL = 1000 / TARGET_FPS;
let timeAccumulator = 0;

function gameLoop(timestamp) {

    // ============================================================
    // 1. PAUSE / TAB HIDDEN
    // ============================================================
    if (isPaused || !isTabActive) {
        lastTime = timestamp;
        requestAnimationFrame(gameLoop);
        return;
    }

    // Calculate Delta Time
    let deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    // Cap huge lag spikes (prevent teleporting through walls)
    if (deltaTime > 1000) deltaTime = FRAME_INTERVAL;

    // Add to accumulator
    timeAccumulator += deltaTime;

    // ============================================================
    // 2. STORE MODE (Throttled)
    // ============================================================
    if (storeSystem && storeSystem.isOpen) {
        if (timeAccumulator >= FRAME_INTERVAL) {
            renderer.draw();
            if (timestamp - lastSlowUpdate > SLOW_UPDATE_INTERVAL) {
                updateHUD();
                lastSlowUpdate = timestamp;
            }
            timeAccumulator -= FRAME_INTERVAL;
            if (timeAccumulator > FRAME_INTERVAL) timeAccumulator = 0;
        }
        requestAnimationFrame(gameLoop);
        return;
    }

    // ============================================================
    // 3. BATTLE MODE (Throttled)
    // ============================================================
    if (battleSystem.isActive) {
        if (timeAccumulator >= FRAME_INTERVAL) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            timeAccumulator -= FRAME_INTERVAL;
            if (timeAccumulator > FRAME_INTERVAL) timeAccumulator = 0;
        }
        requestAnimationFrame(gameLoop);
        return;
    }

    // ============================================================
    // MAIN LOOP - WAIT FOR ACCUMULATOR
    // ============================================================
    if (timeAccumulator < FRAME_INTERVAL) {
        requestAnimationFrame(gameLoop);
        return;
    }

    // ============================================================
    // 4. CALCULATE DT (For 30 FPS Logic)
    // ============================================================
    // dt will be roughly 0.033s
    let dt = (timeAccumulator / 1000) * gameSpeed;
    if (dt > 0.1) dt = 0.1; // Safety cap

    // Consume time
    timeAccumulator -= FRAME_INTERVAL;
    if (timeAccumulator > FRAME_INTERVAL) timeAccumulator = 0;

    // ============================================================
    // PART A: FAST LOGIC (30 FPS)
    // MOVED COMBAT/MOVEMENT SYSTEMS HERE SO THEY MATCH PLAYER SPEED
    // ============================================================

    // 1. Update Player Movement (Calculations moved below)

    // 2. Update Systems that need smooth movement/projectiles
    if (typeof enemySystem !== 'undefined') enemySystem.update(dt);
    if (typeof guardianSystem !== 'undefined') guardianSystem.update(dt);
    if (typeof defenseSystem !== 'undefined' && defenseSystem.active) {
        try {
            defenseSystem.update(dt);
        } catch (e) {
            defenseSystem.active = false;
            document.getElementById('raid-hud').classList.add('hidden');
            document.getElementById('flash-overlay').classList.remove('blood-moon');
        }
    }
    if (typeof liminalSystem !== 'undefined') liminalSystem.update(dt);

    // ============================================================
    // PART B: SLOW LOGIC (10 FPS)
    // ONLY BACKGROUND STATS/RESOURCES REMAIN HERE
    // ============================================================
    if (timestamp - lastSlowUpdate > SLOW_UPDATE_INTERVAL) {

        // Light Systems (Stats, Time, Resources)
        if (typeof rpgSystem !== 'undefined') rpgSystem.update(dt); // Regen HP/Stamina
        if (typeof resourceSystem !== 'undefined') resourceSystem.update(dt); // Respawn trees

        // World / Time
        clock.update(player);
        world.updateNPCs(); // Walking NPCs don't need high precision

        // HUD Updates
        updateHUD();

        // Proximity Checks (Optimized)
        checkProximityPrompts();

        // Spawning Logic
        arenaSystem.checkSpawn(world, clock.gameDays);
        storeSystem.checkSpawn(world, arenaSystem);
        if (typeof craftingSystem !== 'undefined') craftingSystem.spawnWorkbench(world);

        // Random PokeCenter Spawn
        if (
            Math.floor(player.steps) % 300 === 0 &&
            player.steps > player.lastPokeCenterStep + 250 &&
            !world.buildings.some(b => b.type === 'pokecenter')
        ) {
            let cx = Math.round(player.x + (Math.random() * 40 - 20));
            let cy = Math.round(player.y + (Math.random() * 40 - 20));
            world.spawnPokeCenter(cx, cy);
            player.lastPokeCenterStep = Math.floor(player.steps);
            showDialog('A Poke Center appeared nearby!', 3000);
        }

        // Rival Logic
        const elapsedSeconds = Math.floor(
            (Date.now() - clock.startTime + clock.elapsedTime) / 1000
        );
        rivalSystem.update(clock.gameDays, world, elapsedSeconds);

        // Blood Moon Trigger
        if (clock.gameDays > 0 && clock.gameDays % 2 === 0 && !defenseSystem.active) {
            if (defenseSystem.lastRaidDay !== clock.gameDays) {
                defenseSystem.startRaid();
                defenseSystem.lastRaidDay = clock.gameDays;
            }
        }

        // Egg Hatching
        player.team.forEach(p => {
            if (p.isEgg) {
                // 1. Check for NaN or Undefined (Fixes broken eggs from old saves)
                if (typeof p.eggSteps !== 'number' || isNaN(p.eggSteps)) {
                    p.eggSteps = 500; // Reset to a default value if broken
                }

                // 2. Decrement steps
                p.eggSteps--;

                // 3. Hatching Trigger
                if (p.eggSteps <= 0) {
                    p.isEgg = false;

                    // Restore Name and Species
                    p.name = p.species || "PIKACHU";

                    // Setup Sprites
                    p.backSprite = p.storedSprite ||
                        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/25.png';

                    // Initialize Stats if they don't exist
                    if (!p.stats) p.stats = generatePokemonStats();

                    // Ensure Level is set for HP calculation
                    p.level = p.level || 5;
                    p.maxHp = p.level * 5 + (p.stats.hp || 10);
                    p.hp = p.maxHp;

                    showDialog(`Oh? The Egg hatched into ${p.name}!`, 4000);

                    // Trigger a UI refresh
                    if (typeof needsUIUpdate !== 'undefined') needsUIUpdate = true;
                    updateHUD();
                }
            }
        });

        lastSlowUpdate = timestamp;
    }

    // ============================================================
    // PART C: PLAYER MOVEMENT (30 FPS)
    // ============================================================
    let dx = 0;
    let dy = 0;

    if (input.active && (input.joystickVector.x || input.joystickVector.y)) {
        dx = input.joystickVector.x;
        dy = input.joystickVector.y;
    } else {
        if (input.isDown('ArrowUp') || input.isDown('w')) dy -= 1;
        if (input.isDown('ArrowDown') || input.isDown('s')) dy += 1;
        if (input.isDown('ArrowLeft') || input.isDown('a')) dx -= 1;
        if (input.isDown('ArrowRight') || input.isDown('d')) dx += 1;
    }

    if (rivalSystem.isPlayerFrozen()) {
        dx = 0; dy = 0;
    }

    // Auto Harvest / Auto Attack Enemy
    if (dx !== 0 || dy !== 0) {
        // Manual movement cancels all auto-targets
        autoHarvestTarget = null;
        autoAttackEnemyTarget = null;
    } else if (autoAttackEnemyTarget) {
        // Priority: Attack enemy if target exists
        processAutoAttackEnemy(dt, timestamp);
    } else if (autoHarvestTarget) {
        processAutoHarvest(dt, timestamp);
    }

    if (dx !== 0 || dy !== 0) {
        // 1. Normalize movement (Optimized with Math.hypot)
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;

        const speed = player.speed * (dt * 60);
        const nextX = player.x + dx * speed;
        const nextY = player.y + dy * speed;

        // 2. Collision Check
        const blocked = world.isBlocked(Math.round(nextX), Math.round(nextY));

        if (!blocked) {
            player.x = nextX;
            player.y = nextY;
            player.steps += speed;
            player.moving = true;

            // Set Direction Sprite
            if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
            else player.dir = dy > 0 ? 'down' : 'up';

            // 3. Quest & UI Thresholds
            if (Math.floor(player.steps) % 10 === 0) {
                questSystem.update('walk');
                // Refresh UI occasionally while walking to update XP/Step counters
                if (typeof needsUIUpdate !== 'undefined') needsUIUpdate = true;
            }

            // 4. Item Pickup Logic
            const ix = Math.round(player.x);
            const iy = Math.round(player.y);
            const item = world.getItem(ix, iy);

            if (item) {
                world.removeItem(ix, iy);
                playSFX('sfx-pickup');
                player.bag[item] = (player.bag[item] || 0) + 1;
                showDialog(`Found a ${item}!`, 1000);

                // Ensure the Bag/Inventory UI knows to refresh
                if (typeof needsUIUpdate !== 'undefined') needsUIUpdate = true;
            }

            // 5. Wild Encounter Logic
            const tile = world.getTile(ix, iy);
            const ENCOUNTER_TILES = ['grass_tall', 'snow_tall', 'sand_tall'];

            if (ENCOUNTER_TILES.includes(tile) && Math.random() < 0.08 * speed) {
                const canFight = player.team.some(p => p.hp > 0);
                if (canFight) {
                    const biome = tile === 'snow_tall' ? 'snow' :
                        tile === 'sand_tall' ? 'desert' : 'grass';
                    battleSystem.startBattle(false, 0, false, null, biome);
                }
            }
        }
    } else {
        // Logic for when player is standing still
        if (!autoHarvestTarget) player.moving = false;
    }

    // ============================================================
    // RENDER
    // ============================================================
    renderer.draw();
    requestAnimationFrame(gameLoop);
}

// --- OPTIMIZATION HELPERS (Unchanged but included for completeness) ---

function checkProximityPrompts() {
    // 1. NPC Prompt (Distance < 1) -> Squared Distance < 1
    // We use a simple loop which is faster than .find() for small arrays
    let nearbyNPC = null;
    for (let i = 0; i < world.npcs.length; i++) {
        let n = world.npcs[i];
        let dx = n.x - player.x;
        let dy = n.y - player.y;
        if ((dx * dx + dy * dy) < 1) { // No Math.sqrt needed
            nearbyNPC = n;
            break;
        }
    }

    if (DOM.npcPrompt) {
        if (nearbyNPC) DOM.npcPrompt.classList.remove('hidden');
        else DOM.npcPrompt.classList.add('hidden');
    }

    // 2. PokeCenter Prompt (Distance < 1.5) -> Squared Distance < 2.25
    let nearbyCenter = null;
    for (let i = 0; i < world.buildings.length; i++) {
        let b = world.buildings[i];
        if (b.type === 'pokecenter') {
            let dx = b.x - player.x;
            let dy = b.y - player.y;
            if ((dx * dx + dy * dy) < 2.25) { // 1.5 * 1.5 = 2.25
                nearbyCenter = b;
                break;
            }
        }
    }

    if (DOM.npcPrompt && nearbyCenter) {
        DOM.npcPrompt.innerText = 'Press A to heal';
        DOM.npcPrompt.classList.remove('hidden');
    }
}

function processAutoHarvest(dt, timestamp) {
    if (!resourceSystem.nodes[autoHarvestTarget.key]) {
        autoHarvestTarget = null;
        player.moving = false;
        return;
    }

    // Optimization: Calculate Squared Distance
    const dx = autoHarvestTarget.x - player.x;
    const dy = autoHarvestTarget.y - player.y;
    const distSq = (dx * dx) + (dy * dy);

    // 1.2 distance squared is 1.44
    if (distSq > 1.44) {
        // --- WALK TOWARDS (WITH COLLISION CHECK) ---
        const angle = Math.atan2(dy, dx);
        const speed = player.speed * (dt * 60);

        let nextX = player.x + Math.cos(angle) * speed;
        let nextY = player.y + Math.sin(angle) * speed;

        // CHECK COLLISION BEFORE MOVING
        // We use the new circular collision logic we added earlier
        let blocked = world.isBlocked(Math.round(nextX), Math.round(nextY));

        // If we are blocked by something OTHER than the target resource itself
        if (blocked) {
            // Check if the thing blocking us IS the target
            let tx = Math.round(nextX);
            let ty = Math.round(nextY);
            if (`${tx},${ty}` === autoHarvestTarget.key) {
                blocked = false; // Allow moving closer to target
            }
        }

        if (!blocked) {
            player.x = nextX;
            player.y = nextY;
            player.moving = true;

            // Update Direction
            if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle)))
                player.dir = Math.cos(angle) > 0 ? 'right' : 'left';
            else
                player.dir = Math.sin(angle) > 0 ? 'down' : 'up';
        } else {
            // Path Blocked (Water/Wall) -> Cancel
            showDialog("Can't reach that!", 1000);
            autoHarvestTarget = null;
            player.moving = false;
        }

    } else {
        // --- ARRIVED: ATTACK LOGIC ---
        player.moving = false;

        // Face target
        const angle = Math.atan2(dy, dx);
        if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
            player.dir = Math.cos(angle) > 0 ? 'right' : 'left';
        } else {
            player.dir = Math.sin(angle) > 0 ? 'down' : 'up';
        }

        // Auto-Swing Timer (Every 250ms)
        if (timestamp - lastAutoAttackTime > 250) {

            // --- STAMINA FIX: Check Stamina First ---
            if (typeof rpgSystem !== 'undefined') {
                if (rpgSystem.stamina < 10) {
                    showDialog("Too tired!", 500);
                    // Don't cancel immediately, wait for regen
                    return;
                }

                // Manually deduct stamina since we aren't calling triggerAttack()
                // (triggerAttack has logic we don't want, like screen shake on every frame)
                rpgSystem.stamina -= 10;
                rpgSystem.updateHUD(); // Visual update

                // Play Sound
                playSFX('sfx-attack1');

                // Apply Damage
                let dmg = rpgSystem.getDamage();
                resourceSystem.checkHit(autoHarvestTarget.x, autoHarvestTarget.y, dmg);

                lastAutoAttackTime = timestamp;
            }
        }
    }
}

// --- AUTO ATTACK ENEMY FUNCTION (FIXED) ---
function processAutoAttackEnemy(dt, timestamp) {
    // 1. Check if target still exists and is alive
    if (!autoAttackEnemyTarget) return;

    // Verify enemy is still in the enemies array (wasn't killed)
    const stillExists = enemySystem.enemies.includes(autoAttackEnemyTarget);
    if (!stillExists || autoAttackEnemyTarget.hp <= 0) {
        autoAttackEnemyTarget = null;
        player.moving = false;
        return;
    }

    // 2. Calculate distance to enemy
    const dx = autoAttackEnemyTarget.x - player.x;
    const dy = autoAttackEnemyTarget.y - player.y;
    const distSq = (dx * dx) + (dy * dy);

    // Attack range is 1.5 tiles (squared = 2.25)
    const ATTACK_RANGE_SQ = 2.25;

    if (distSq > ATTACK_RANGE_SQ) {
        // WALK TOWARDS ENEMY
        const angle = Math.atan2(dy, dx);
        const speed = player.speed * (dt * 60);
        player.x += Math.cos(angle) * speed;
        player.y += Math.sin(angle) * speed;
        player.moving = true;

        if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
            player.dir = Math.cos(angle) > 0 ? 'right' : 'left';
        } else {
            player.dir = Math.sin(angle) > 0 ? 'down' : 'up';
        }
    } else {
        // IN RANGE - AUTO ATTACK!
        player.moving = false;

        if (Math.abs(dx) > Math.abs(dy)) {
            player.dir = dx > 0 ? 'right' : 'left';
        } else {
            player.dir = dy > 0 ? 'down' : 'up';
        }

        if (timestamp - lastEnemyAttackTime > 200) {
            lastEnemyAttackTime = timestamp;

            if (typeof rpgSystem !== 'undefined' && rpgSystem.stamina >= 10) {
                rpgSystem.stamina -= 10;
                const damage = rpgSystem.getDamage();
                
                autoAttackEnemyTarget.hp -= damage;

                // --- FIX: REMOVED CSS SCREEN SHAKE HERE ---
                // The lines accessing canvas.style.transform were causing the pause.
                playSFX('sfx-attack1');

                // Knockback effect on enemy
                const pushAngle = Math.atan2(autoAttackEnemyTarget.y - player.y, autoAttackEnemyTarget.x - player.x);
                autoAttackEnemyTarget.x += Math.cos(pushAngle) * 0.2;
                autoAttackEnemyTarget.y += Math.sin(pushAngle) * 0.2;

                // Check if enemy died
                if (autoAttackEnemyTarget.hp <= 0) {
                    const idx = enemySystem.enemies.indexOf(autoAttackEnemyTarget);
                    if (idx !== -1) {
                        enemySystem.killEnemy(idx);
                    }
                    autoAttackEnemyTarget = null;
                }

                rpgSystem.updateHUD();
            } else {
                // Prevent dialog spam
                if(!document.getElementById('dialog-box') || document.getElementById('dialog-box').classList.contains('hidden')) {
                    showDialog("Out of stamina!", 500);
                }
            }
        }
    }
}

// --- FIXED INTERACTION HANDLER ---
input.press = (key) => {
    input.keys[key] = true;

    // 1. If a menu is open, don't allow world interactions
    if (storeSystem.isOpen || isPaused) return;

    // 2. Map all interaction keys (A button, Enter, Start) to the same logic
    if (key === 'Enter' || key === 'a' || key === 'start') {

        // --- 0. CHECK LIMINAL INTERACTIONS (Priority) ---
        if (typeof liminalSystem !== 'undefined' && liminalSystem.active) {
            if (liminalSystem.tryInteract()) return;
        }

        // 1. Check for nearby Poke Center (PRIORITY)
        let nearbyPokeCenter = world.buildings.find((building) => {
            let dx = building.x - player.x;
            let dy = building.y - player.y;
            return (dx * dx + dy * dy) < 2.25 && building.type === 'pokecenter';
        });

        if (nearbyPokeCenter) {
            handlePokeCenterInteraction();
            return;
        }

        // 2. Check for nearby Home (PRIORITY)
        if (homeSystem.isNearHome(player.x, player.y)) {
            if (typeof rpgSystem !== 'undefined') {
                rpgSystem.hp = rpgSystem.maxHp;
                rpgSystem.stamina = rpgSystem.maxStamina;
                rpgSystem.updateHUD();
            }
            homeSystem.interact();
            return;
        }

        // 3. Check for nearby Arena
        let nearbyArena = world.buildings.find((building) => {
            let dx = building.x - player.x;
            let dy = building.y - player.y;
            return (dx * dx + dy * dy) < 2.25 && building.type === 'arena';
        });

        if (nearbyArena) {
            arenaSystem.enter();
            return;
        }

        // 4. Check Liminal Trigger (The Red Phone)
        if (typeof liminalSystem !== 'undefined' && homeSystem.houseLocation && !liminalSystem.active) {
            const doorX = homeSystem.houseLocation.x;
            const doorY = homeSystem.houseLocation.y + 666;
            let dx = doorX - player.x;
            let dy = doorY - player.y;
            if ((dx * dx + dy * dy) < 2.25) {
                if (confirm("Answer the call?")) liminalSystem.enter();
                return;
            }
        }

        // 4.5 Check Dungeon Entrance (Phase 6)
        if (typeof dungeonSystem !== 'undefined' && dungeonSystem && dungeonSystem.hasSpawned) {
            const dx = dungeonSystem.entrance.x - player.x;
            const dy = dungeonSystem.entrance.y - player.y;
            if ((dx * dx + dy * dy) < 2.25) {
                if (confirm("Enter the Dungeon? High Level Recommended!")) dungeonSystem.enter();
                return;
            }
        }

        // 5. Check for nearby NPC
        let nearbyNPC = world.npcs.find(
            (npc) =>
                Math.abs(npc.x - player.x) < 1.5 &&
                Math.abs(npc.y - player.y) < 1.5
        );
        if (nearbyNPC) {
            handleNPCInteraction(nearbyNPC);
            return;
        }

        // 6. Check for nearby Store
        if (storeSystem.location) {
            let dx = storeSystem.location.x - player.x;
            let dy = storeSystem.location.y - player.y;
            if ((dx * dx + dy * dy) < 2.25) {
                storeSystem.interact();
                return;
            }
        }
    }

    // Handle Bag Toggle
    if (key === 'b') {
        togglePlayerBag();
    }
};

function handlePokeCenterInteraction() {
    player.healAllPokemon();
    showDialog('♪ Your Pokemon have been restored to full health! ♪', 3000);
}

// Go Home function (teleport)
function goHome() {
    const success = homeSystem.teleportHome();
    if (success) {
        toggleMainMenu(); // Close menu after teleport
    }
}

// B Button - Open Player Bag
input.keys['b'] = false; // Initialize B key

// --- SORTING STATE ---
let currentSortMode = 'default'; // default, name, strong, weak, recent

function toggleSortMode(context) {
    const modes = ['default', 'name', 'strong', 'weak', 'recent'];
    let idx = modes.indexOf(currentSortMode);
    currentSortMode = modes[(idx + 1) % modes.length];

    showDialog(`Sorting by: ${currentSortMode.toUpperCase()}`, 1000);

    if (context === 'pc') renderPC();
    else if (context === 'bag') showBagTab('pokemon'); // Only sorting pokemon tab for now
}

// Helper to sort a list of Pokemon
function getSortedPokemonList(list) {
    // Filter out nulls first
    let pokemons = list.filter(p => p !== null);
    let empties = list.filter(p => p === null);

    if (currentSortMode === 'name') {
        pokemons.sort((a, b) => a.name.localeCompare(b.name));
    } else if (currentSortMode === 'strong') {
        pokemons.sort((a, b) => {
            let srA = a.stats.strength + a.stats.defense + a.stats.speed + a.stats.hp + a.stats.special;
            let srB = b.stats.strength + b.stats.defense + b.stats.speed + b.stats.hp + b.stats.special;
            return srB - srA; // Descending
        });
    } else if (currentSortMode === 'weak') {
        pokemons.sort((a, b) => {
            let srA = a.stats.strength + a.stats.defense + a.stats.speed + a.stats.hp + a.stats.special;
            let srB = b.stats.strength + b.stats.defense + b.stats.speed + b.stats.hp + b.stats.special;
            return srA - srB; // Ascending
        });
    } else if (currentSortMode === 'recent') {
        // Assuming higher index/later addition is recent. If no timestamp, default is basically recent.
        // We can just reverse default for "Oldest" vs "Newest"
        pokemons.reverse();
    }

    // Combine back with empty slots at the end
    // Note: This changes the box structure in memory!
    // Fill the rest with nulls up to the original length (usually 25 for box)
    let sortedList = [...pokemons, ...empties];
    while (sortedList.length < list.length) sortedList.push(null);

    return sortedList;
}

function togglePlayerBag() {
    // Prevent opening Overworld Bag during Battle
    if (battleSystem.isActive) {
        showDialog("Use the Battle Menu to access items!", 1500);
        return;
    }

    const bagMenu = document.getElementById('player-bag-menu');
    const sidebar = document.getElementById('party-sidebar');

    if (bagMenu.classList.contains('hidden')) {
        bagMenu.classList.remove('hidden');
        if (sidebar) sidebar.classList.add('hidden'); // Hide sidebar
        selectedBagItem = null; // Reset selection on open
        showBagTab('pokemon'); // Default tab
    } else {
        bagMenu.classList.add('hidden');
        if (sidebar && !battleSystem.isActive) sidebar.classList.remove('hidden'); // Show sidebar if not in battle
        selectedBagItem = null;
    }
}

function closePlayerBag() {
    document.getElementById('player-bag-menu').classList.add('hidden');
    const sidebar = document.getElementById('party-sidebar');
    if (sidebar && !battleSystem.isActive) sidebar.classList.remove('hidden'); // Show sidebar if not in battle
}

let selectedBagItem = null; // Track what is highlighted

// --- UPDATED SHOW BAG TAB ---
function showBagTab(tab) {
    document.getElementById('tab-pokemon').classList.toggle('active', tab === 'pokemon');
    document.getElementById('tab-items').classList.toggle('active', tab === 'items');

    const content = document.getElementById('bag-content');
    content.innerHTML = '';

    // Add Sort Button to Header if missing
    let sortBtn = document.getElementById('bag-sort-btn');
    if (!sortBtn) {
        sortBtn = document.createElement('button');
        sortBtn.id = 'bag-sort-btn';
        sortBtn.innerText = 'SORT';
        sortBtn.className = 'back-btn';
        sortBtn.style.textAlign = 'center'; // Fix centering
        sortBtn.style.marginBottom = '10px';
        sortBtn.style.backgroundColor = '#34495e';
        // FIXED: Mobile touch support
        sortBtn.onpointerdown = (e) => {
            e.stopPropagation();
            toggleSortMode('bag');
        };

        // Insert before content container
        document.getElementById('player-bag-menu').insertBefore(sortBtn, content);
    }
    sortBtn.innerText = `SORT: ${currentSortMode.toUpperCase()}`;

    if (tab === 'pokemon') {
        selectedBagItem = null;
        if (player.team.length === 0) {
            content.innerHTML = '<p style="text-align:center; color: #999;">No Pokemon</p>';
            return;
        }

        // We sort a COPY of the team for display, but we need to keep original indices for swapping!
        // This is tricky. If we sort the bag view, the indices passed to swapPokemon will be wrong.
        // Solution: Only sort Player Team visually if we map indices back, OR strictly sort the actual team array.
        // Let's sort the actual team array for consistency.
        if (currentSortMode !== 'default') {
            player.team = getSortedPokemonList(player.team).filter(p => p !== null);
        }

        player.team.forEach((p, index) => {
            let div = document.createElement('div');
            div.className = 'pokemon-item' + (p.hp <= 0 ? ' fainted' : '');
            div.style.cursor = 'pointer';

            let isFainted = p.hp <= 0 || (p.hp === undefined && !p.isEgg);
            let status = p.isEgg ? 'EGG' : isFainted ? 'FAINTED' : `HP: ${p.hp}/${p.maxHp}`;
            const stats = p.stats || { strength: 0, defense: 0, speed: 0, hp: 0, special: 0 };
            const scoreRating = stats.strength + stats.defense + stats.speed + stats.hp + stats.special;

            div.innerHTML = `
                <div class="pokemon-info">
                    <div><strong>${p.name}</strong> Lv.${p.level}</div>
                    <div style="font-size: 10px; color: ${isFainted ? '#e74c3c' : '#2ecc71'};">${status}</div>
                    ${!p.isEgg ? `<div style="font-size: 11px; color: #2ecc71;">SR: ${scoreRating}</div>` : ''}
                </div>
                <div class="pokemon-actions">
                    ${index > 0 ? `<button onpointerdown="event.stopPropagation(); swapPokemon(${index}, ${index - 1})">↑</button>` : ''}
                    ${index < player.team.length - 1 ? `<button onpointerdown="event.stopPropagation(); swapPokemon(${index}, ${index + 1})">↓</button>` : ''}
                    <button onpointerdown="event.stopPropagation(); guardianSystem.assignGuardian(${index})" style="background:#f1c40f; color:black;">★</button>
                </div>
            `;
            // FIXED: Mobile touch support
            div.onpointerdown = (e) => {
                e.preventDefault(); // Stop ghost clicks
                if (!p.isEgg) showPokemonStats(p);
            };
            content.appendChild(div);
        });

    } else if (tab === 'items') {
        let hasItems = false;

        // Convert bag object to array for sorting
        let bagArray = Object.entries(player.bag);

        // Sort Bag Array
        if (currentSortMode === 'name') {
            bagArray.sort((a, b) => a[0].localeCompare(b[0]));
        } else if (currentSortMode === 'strong' || currentSortMode === 'weak') {
            // Sort by Quantity
            bagArray.sort((a, b) => currentSortMode === 'strong' ? b[1] - a[1] : a[1] - b[1]);
        }

        for (let [item, count] of bagArray) {
            if (count > 0) {
                hasItems = true;
                let div = document.createElement('div');
                div.className = 'menu-item';
                if (selectedBagItem === item) div.classList.add('selected');
                div.innerHTML = `${item} x${count}`;
                // FIXED: Mobile touch support
                div.onpointerdown = (e) => {
                    e.preventDefault();
                    selectedBagItem = item;
                    showBagTab('items');
                };
                content.appendChild(div);
            }
        }

        if (!hasItems) {
            content.innerHTML = '<p style="text-align:center; color: #999;">No Items</p>';
            selectedBagItem = null;
        }

        const actionDiv = document.createElement('div');
        actionDiv.className = 'bag-actions';
        const useBtn = document.createElement('button');
        useBtn.className = 'bag-btn btn-use';
        useBtn.innerText = 'USE';
        useBtn.disabled = !selectedBagItem;
        useBtn.onpointerdown = (e) => {
            e.stopPropagation();
            if (selectedBagItem) useBagItem(selectedBagItem);
        };

        const tossBtn = document.createElement('button');
        tossBtn.className = 'bag-btn btn-toss';
        tossBtn.innerText = 'TOSS';
        tossBtn.disabled = !selectedBagItem;
        tossBtn.onpointerdown = (e) => {
            e.stopPropagation();
            if (selectedBagItem) tossBagItem(selectedBagItem);
        };

        actionDiv.appendChild(useBtn);
        actionDiv.appendChild(tossBtn);
        content.appendChild(actionDiv);
    }
}

function tossBagItem(itemName) {
    if (!player.bag[itemName] || player.bag[itemName] <= 0) return;

    // Decrease count
    player.bag[itemName]--;

    // Remove from bag if 0
    if (player.bag[itemName] === 0) {
        delete player.bag[itemName];
        selectedBagItem = null; // Deselect if gone
    }

    playSFX('sfx-attack1'); // Sound effect
    showDialog(`Tossed 1 ${itemName}.`, 1000);

    // Refresh UI
    showBagTab('items');
    updateHUD();
}

function swapPokemon(index1, index2) {
    let temp = player.team[index1];
    player.team[index1] = player.team[index2];
    player.team[index2] = temp;
    showBagTab('pokemon'); // Refresh
}

// Show detailed Pokemon stats modal
async function showPokemonStats(pokemon) {
    const modal = document.getElementById('pokemon-stats-modal');
    const display = document.getElementById('pokemon-stats-display');

    // Ensure stats exist (Safety check)
    const stats = pokemon.stats || {
        strength: 0,
        defense: 0,
        speed: 0,
        hp: 0,
        special: 0
    };

    // Get animated sprite if possible
    let sprite =
        pokemon.animatedSprite || pokemon.sprite || pokemon.backSprite || '';

    // If no animated sprite, try to fetch it
    if (!pokemon.animatedSprite && pokemon.id) {
        try {
            const res = await fetch(
                `https://pokeapi.co/api/v2/pokemon/${pokemon.id}`
            );
            const data = await res.json();
            sprite =
                data.sprites.versions['generation-v']['black-white'][
                'animated'
                ]['front_default'] || data.sprites.front_default;
        } catch (e) {
            console.log('Could not fetch animated sprite');
        }
    }

    const isFainted = pokemon.hp <= 0;
    const hpPercent = (pokemon.hp / pokemon.maxHp) * 100;
    const scoreRating =
        stats.strength + stats.defense + stats.speed + stats.hp + stats.special;

    // --- NEW CALCULATIONS ---

    // 1. Critical Chance (Based on Special, Capped at 15%)
    const critChance = Math.min(15, (stats.special / 1000) * 15).toFixed(1);

    // 2. First Strike Chance (Based on Speed, Capped at 81%)
    const speedAdvantage = Math.min(81, (stats.speed / 1.5)).toFixed(1);

    // 3. Estimated Damage Output (Rough formula based on Level & Strength)
    const estDamage = Math.floor((pokemon.level * 0.4) * (stats.strength / 2) + 10);

    // 4. Moves List HTML
    let movesHtml = '';
    if (pokemon.moves && pokemon.moves.length > 0) {
        movesHtml = pokemon.moves.map(m =>
            `<div style="background: #fff; color: #000; padding: 5px; border-radius: 4px; font-size: 10px; text-align: center; border: 1px solid #ccc; font-weight: bold;">${m.name}</div>`
        ).join('');
    } else {
        movesHtml = '<div style="color:#666; font-size:10px;">No moves known</div>';
    }

    // --- RENDER HTML ---
    display.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <img src="${sprite}" style="width: 128px; height: 128px; image-rendering: pixelated; margin-bottom: 15px;">
            <h2 style="margin: 10px 0; color: #ffd700;">${pokemon.name}</h2>
            <div style="font-size: 16px; color: #aaa; margin-bottom: 10px;">
                Level ${pokemon.level} | Type: ${pokemon.type || 'Unknown'}
            </div>
            <div style="font-size: 24px; color: #2ecc71; font-weight: bold; margin-bottom: 15px;">
                SR: ${scoreRating}
            </div>
            
            <div style="text-align: left; display: inline-block; width: 90%; max-width: 350px;">
                <!-- HP BAR -->
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: #e74c3c;"><strong>HP:</strong></span>
                        <span>${pokemon.hp}/${pokemon.maxHp}</span>
                    </div>
                    <div style="background: #333; height: 20px; border-radius: 10px; overflow: hidden;">
                        <div style="background: ${isFainted ? '#e74c3c' : '#2ecc71'}; height: 100%; width: ${hpPercent}%; transition: width 0.3s;"></div>
                    </div>
                </div>
                
                <!-- MAIN STATS GRID -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px; margin-bottom: 15px;">
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
                        <div style="color: #f39c12;"><strong>⚔️ Strength</strong></div>
                        <div style="font-size: 20px; color: #fff;">${stats.strength}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
                        <div style="color: #3498db;"><strong>🛡️ Defense</strong></div>
                        <div style="font-size: 20px; color: #fff;">${stats.defense}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
                        <div style="color: #9b59b6;"><strong>⚡ Speed</strong></div>
                        <div style="font-size: 20px; color: #fff;">${stats.speed}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
                        <div style="color: #e91e63;"><strong>✨ Special</strong></div>
                        <div style="font-size: 20px; color: #fff;">${stats.special}</div>
                    </div>
                </div>
                
                <div style="margin-top: 5px; font-size: 12px; color: #aaa; text-align: center;">
                    EXP: ${pokemon.exp || 0} / ${pokemon.level * 100}
                </div>

                <!-- NEW: DETAILED BATTLE STATS PANEL -->
                <div style="margin-top: 15px; background: #222; border: 2px solid #444; border-radius: 8px; padding: 10px;">
                    <h3 style="margin: 0 0 10px 0; color: gold; font-size: 12px; border-bottom: 1px solid #555; padding-bottom: 5px; text-align:center;">BATTLE DETAILS</h3>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11px; color: #ccc; margin-bottom: 15px;">
                        <div>💥 Crit Chance: <span style="color:white; float:right;">${critChance}%</span></div>
                        <div>⏩ First Strike: <span style="color:white; float:right;">${speedAdvantage}%</span></div>
                        <div style="grid-column: span 2; border-top: 1px dashed #444; padding-top: 5px;">
                            ⚔️ Est. Damage Output: <span style="color:white; float:right;">${estDamage}</span>
                        </div>
                    </div>

                    <h3 style="margin: 0 0 5px 0; color: gold; font-size: 12px; text-align:center;">KNOWN MOVES</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                        ${movesHtml}
                    </div>
                </div>

            </div>
        </div>
    `;

    modal.classList.remove('hidden');
}

function closePokemonStats() {
    document.getElementById('pokemon-stats-modal').classList.add('hidden');
}

function closePokemonList() {
    document.getElementById('pokemon-list-modal').classList.add('hidden');
}

// --- UPDATED BAG LOGIC (Handles Candies) ---
function useBagItem(itemName) {
    if (!player.bag[itemName] || player.bag[itemName] <= 0) return;

    // 1. CANDY LOGIC
    if (itemName.includes('Candy')) {
        let p = player.team[0]; // Apply to lead Pokemon

        // Extract Species from "Pikachu Candy" -> "Pikachu"
        let requiredSpecies = itemName.replace(' Candy', '');

        // Clean player pokemon name (Remove stars for comparison)
        let currentSpecies = p.name.split(' ')[0];

        if (currentSpecies !== requiredSpecies) {
            showDialog(`Can't use this! It's for ${requiredSpecies} only.`, 2000);
            return;
        }

        // Apply XP Boost (10% of current level requirement)
        let xpNeededForLevel = p.level * 100;
        let xpBoost = Math.floor(xpNeededForLevel * 0.10);

        p.exp += xpBoost;
        player.bag[itemName]--;
        if (player.bag[itemName] === 0) delete player.bag[itemName];

        // Check for Level Up immediately
        if (p.exp >= xpNeededForLevel) {
            // Perform silent level up
            p.exp -= xpNeededForLevel;
            p.level++;

            // Recalculate stats briefly
            if (p.stats) {
                p.maxHp = p.level * 5 + p.stats.hp;
                p.hp = p.maxHp;
            }

            showDialog(`${p.name} leveled up to ${p.level}!`, 2000);
        } else {
            showDialog(`Used ${itemName}! +${xpBoost} XP.`, 1000);
        }

        updateHUD();
        showBagTab('items'); // Refresh menu
        return;
    }

    // Check if item data exists to prevent crash
    const itemData = (typeof ITEMS !== 'undefined') ? ITEMS[itemName] : null;
    if (!itemData) {
        showDialog("Unknown Item Data!", 1000);
        return;
    }

    if (battleSystem.isActive) {
        // Battle Mode Usage
        if (itemData.type === 'potion') {
            battleSystem.useItem(itemName);
            togglePlayerBag(); // Close bag
        } else if (itemData.type === 'ball') {
            battleSystem.throwPokeball(itemName);
            togglePlayerBag(); // Close bag
        } else {
            showDialog("Can't use that here!");
        }
    } else {
        // World Mode Usage
        if (itemData.type === 'potion') {
            // Heal first pokemon
            let p = player.team[0];
            if (p.hp < p.maxHp) {
                let healAmount = itemData.val;
                p.hp = Math.min(p.maxHp, p.hp + healAmount);
                player.bag[itemName]--;
                if (player.bag[itemName] === 0) delete player.bag[itemName];
                showDialog(`Healed ${p.name} for ${healAmount} HP!`);
                updateHUD();
                showBagTab('items'); // Refresh list
            } else {
                showDialog("It's already full HP!");
            }
        } else {
            showDialog("Can't use that now.");
        }
    }
}

function handleNPCInteraction(npc) {
    if (npc.type === 'talk') {
        showDialog(`${npc.name}: "${npc.dialog}"`, 3000);
    } else if (npc.type === 'quest') {
        if (npc.questCompleted) {
            showDialog('Herbalist: Thanks again for the herbs!', 3000);
        } else if (npc.questGiven && player.bag['Herb'] >= 10) {
            player.bag['Herb'] -= 10;

            // --- NEW DYNAMIC REWARD ---
            // Base $500 + ($100 for every Player Level)
            // Level 5 = $1000, Level 10 = $1500, etc.
            let rewardMoney = 500 + (player.pLevel * 100);

            player.money += rewardMoney;
            player.team[0].exp += 200;

            npc.questCompleted = true;
            npc.color = '#2ecc71'; // Green when complete

            showDialog(
                `Herbalist: Perfect! Here is $${rewardMoney} and XP. Quest complete!`,
                3000
            );
            updateHUD(); // Force Money UI to update immediately

        } else if (npc.questGiven) {
            let remaining = 10 - (player.bag['Herb'] || 0);
            showDialog(`Herbalist: Still need ${remaining} more Herbs!`, 3000);
        } else {
            npc.questGiven = true;
            npc.color = '#e74c3c'; // Red when quest active
            showDialog('Herbalist: Bring me 10 Herbs for a reward!', 3000);
        }
    } else if (npc.type === 'daycare') {
        // 1. Check Party Size
        if (player.team.length < 2) {
            showDialog("Daycare: Come back with at least 2 Pokemon.", 3000);
            return;
        }

        let p1 = player.team[0];
        let p2 = player.team[1];

        // 2. Check if Eggs
        if (p1.isEgg || p2.isEgg) {
            showDialog("Daycare: Eggs cannot breed!", 3000);
            return;
        }

        // 3. SAFETY CHECK: Ensure Game Days exists
        let currentDay = (clock && typeof clock.gameDays === 'number') ? clock.gameDays : 0;
        let lastBredP1 = (typeof p1.lastBredDay === 'number') ? p1.lastBredDay : -100;
        let lastBredP2 = (typeof p2.lastBredDay === 'number') ? p2.lastBredDay : -100;

        // 4. COOLDOWN CHECK (1 Day)
        if ((currentDay - lastBredP1 < 1) || (currentDay - lastBredP2 < 1)) {
            showDialog(`Daycare: They are tired. Come back tomorrow.`, 3000);
            return;
        }

        // 5. Type Match Check
        if (p1.type === p2.type) {
            if (player.team.length >= 6) {
                showDialog("Daycare: Your party is full.", 3000);
            } else {
                showDialog("Daycare: They get along great! Here is an Egg!", 3000);

                // MARK THEM AS BRED
                p1.lastBredDay = currentDay;
                p2.lastBredDay = currentDay;

                // Ensure parents have stats
                if (!p1.stats) p1.stats = generatePokemonStats();
                if (!p2.stats) p2.stats = generatePokemonStats();

                // --- NEW INHERITANCE LOGIC ---

                // 1. Start with completely Random Stats (The "Re-Roll")
                let eggStats = generatePokemonStats();

                // 2. Helper to find the Key of the highest stat
                const getBestStatKey = (statsObj) => {
                    return Object.keys(statsObj).reduce((a, b) => statsObj[a] > statsObj[b] ? a : b);
                };

                // 3. Find Best Stats of Parents
                const p1BestKey = getBestStatKey(p1.stats);
                const p2BestKey = getBestStatKey(p2.stats);

                // 4. Inherit specific values
                eggStats[p1BestKey] = p1.stats[p1BestKey]; // Inherit P1's best
                eggStats[p2BestKey] = p2.stats[p2BestKey]; // Inherit P2's best

                // 5. MUTATION LOGIC (0.02% Chance for 3x Boost)
                let isMutated = false;
                if (Math.random() < 0.0002) { // 0.02%
                    const statKeys = ['strength', 'defense', 'speed', 'hp', 'special'];
                    const mutationKey = statKeys[Math.floor(Math.random() * statKeys.length)];

                    // Apply 3x Multiplier
                    eggStats[mutationKey] = Math.floor(eggStats[mutationKey] * 3);
                    isMutated = true;
                }

                // ADD EGG
                player.team.push({
                    name: 'EGG',
                    species: p1.name, // Offspring is mother's species
                    level: 1,
                    maxHp: 15, // Temporary HP
                    hp: 15,
                    exp: 0,
                    type: p1.type,
                    backSprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dream-world/egg.png',
                    storedSprite: p1.backSprite,
                    isEgg: true,
                    eggSteps: 500,
                    stats: eggStats, // Save the calculated stats
                    mutatedStat: isMutated ? 'Mutation' : null
                });

                if (isMutated) {
                    setTimeout(() => showDialog("Something feels different about this egg...", 4000), 3500);
                }
            }
        } else {
            showDialog("Daycare: They don't seem to like each other...", 3000);
        }
    }
}

// Init
window.onload = async () => {
    const rawSave = localStorage.getItem('poke_save');
    if (rawSave) {
        const check = JSON.parse(rawSave);
        if (check.status === "CORRUPTED") {
            document.body.innerHTML = `
                <div style="background:black; color:red; height:100vh; display:flex; align-items:center; justify-content:center; font-family:monospace; flex-direction:column;">
                    <h1>FATAL ERROR</h1>
                    <p>SAVE FILE CORRUPTED</p>
                    <p>REASON: ${check.reason || "UNKNOWN"}</p>
                    <br>
                    <button onclick="localStorage.removeItem('poke_save'); window.location.reload();" style="background:#333; color:white; border:1px solid red; padding:10px;">RESET MEMORY</button>
                </div>
            `;
            return; // STOP GAME LOADING
        }
    }
    // 1. UPDATE VERSION TEXT IN MENU
    const verEl = document.getElementById('game-version');
    if (verEl) verEl.innerText = `Version: ${VERSION}`;

    // Start Loading Assets
    await assetLoader.loadAll();

    if (!loadGame()) {
        console.log("New Game: clearing spawn area...");

        // 1. FORCE PLAYER TO CENTER (0,0)
        player.x = 0;
        player.y = 0;

        // 2. ORIGINAL STARTER LOGIC
        const starterStats = generatePokemonStats();
        const starterMaxHp = 5 * 5 + starterStats.hp;

        // Pikachu 1
        player.team.push({
            name: 'PIKACHU',
            level: 5,
            maxHp: starterMaxHp,
            hp: starterMaxHp,
            exp: 0,
            type: 'electric',
            backSprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/25.png',
            stats: starterStats
        });

        // Pikachu 2 (Different Stats for breeding test)
        const p2Stats = generatePokemonStats();
        const p2MaxHp = 5 * 5 + p2Stats.hp;
        player.team.push({
            name: 'PIKACHU',
            level: 5,
            maxHp: p2MaxHp,
            hp: p2MaxHp,
            exp: 0,
            type: 'electric',
            backSprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/25.png',
            stats: p2Stats
        });

        runIntro();
        
        // 3. GENERATE RESOURCES (Trees/Rocks)
        resourceSystem.generate();

        // 4. CLEAN THE SAFE ZONE (The Fix)
        // This runs AFTER generation to wipe the center clean
        const SAFE_RADIUS = 25; // 25 radius = 50 tiles wide

        for (let y = -SAFE_RADIUS; y <= SAFE_RADIUS; y++) {
            for (let x = -SAFE_RADIUS; x <= SAFE_RADIUS; x++) {
                // Check if inside circle
                if ((x * x) + (y * y) < (SAFE_RADIUS * SAFE_RADIUS)) {
                    const key = `${x},${y}`;
                    
                    // A. DELETE RESOURCES (Trees/Rocks)
                    if (resourceSystem.nodes[key]) {
                        delete resourceSystem.nodes[key];
                    }

                    // B. FORCE GRASS TILES (Remove Water/Tall Grass)
                    // Checks if map is stored in world.map or world.tiles
                    if (world.map) world.map[key] = 'grass';
                    else if (world.tiles) world.tiles[key] = 'grass';
                    
                    // C. DELETE GROUND ITEMS
                    if (world.items && world.items[key]) delete world.items[key];
                }
            }
        }

        // 5. REMOVE ENEMIES FROM SAFE ZONE
        if (typeof enemySystem !== 'undefined' && enemySystem.enemies) {
            enemySystem.enemies = enemySystem.enemies.filter(e => {
                const dist = Math.sqrt(e.x*e.x + e.y*e.y);
                // Only keep enemies that are FARTHER than safe radius
                return dist > SAFE_RADIUS;
            });
        }

    } else {
        // Welcomes are now handled inside loadGame internally
    }

    // Spawn player's house at exact center
    homeSystem.spawnHouse(world, 0, -4);

    requestAnimationFrame(gameLoop);

    // Initialize Music
    const mainMusic = /** @type {HTMLAudioElement} */ (
        document.getElementById('main-music')
    );
    const battleMusic = /** @type {HTMLAudioElement} */ (
        document.getElementById('battle-music')
    );

    if (mainMusic && battleMusic) {
        mainMusic.volume = musicVolume;
        battleMusic.volume = musicVolume;

        // Start main music (with autoplay handling)
        mainMusic.play().catch((err) => {
            console.log('Autoplay blocked. Music will start on first user interaction.');
            document.addEventListener('click', () => {
                if (mainMusic.paused) mainMusic.play();
            }, { once: true });
        });
    }

    if (mainMusic && battleMusic) {
        // Only play music if NOT in Liminal Space
        if (!liminalSystem.active) {
            mainMusic.play().catch((err) => {});
        }
    }

    // Auto-Save every 30s
    setInterval(saveGame, 30000);

    // Register Service Worker with AUTO-UPDATE Logic
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.protocol === 'http:')) {
        navigator.serviceWorker.register('./sw.js').then(registration => {
            registration.update();
            registration.onupdatefound = () => {
                const newWorker = registration.installing;
                newWorker.onstatechange = () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showDialog("Update found! Reloading...", 2000);
                        setTimeout(() => window.location.reload(), 2000);
                    }
                };
            };
        }).catch(err => console.error('SW Registration Failed', err));
        navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
    }

    // --- ITEM RESPAWN TIMER ---
    setInterval(() => {
        if (world && player) {
            // Respawn items slightly further away so they don't clutter the safe house
            let rx = player.x + (Math.random() > 0.5 ? 25 : -25) + (Math.random() * 10);
            let ry = player.y + (Math.random() > 0.5 ? 25 : -25) + (Math.random() * 10);
            world.respawnItem(rx, ry);
            world.respawnItem(rx, ry);
            world.respawnItem(rx, ry);
        }
    }, 120000);
};

// Save System
function saveGame() {
    const data = {
        player: {
            x: player.x,
            y: player.y,
            money: player.money, // Saved Money
            stats: {
                level: player.pLevel,
                steps: player.steps
            },
            team: player.team,
            bag: player.bag,
            storage: player.storage,
            seen: player.seen,
            seenShiny: player.seenShiny,
            lastLogin: Date.now(),
            combo: (typeof catchCombo !== 'undefined') ? catchCombo : null,
        },
        world: {
            seed: world.rng.seed,
            items: world.items,
            npcs: world.npcs.map((npc) => ({
                x: npc.x,
                y: npc.y,
                name: npc.name,
                type: npc.type,
                dialog: npc.dialog
            })),
            buildings: world.buildings
        },
        // Save Systems Data (With safety checks)
        arena: (typeof arenaSystem !== 'undefined') ? arenaSystem.getSaveData() : null,
        rival: (typeof rivalSystem !== 'undefined') ? rivalSystem.getSaveData() : null,
        home: (typeof homeSystem !== 'undefined') ? homeSystem.getSaveData() : null,
        merge: (typeof mergeSystem !== 'undefined') ? mergeSystem.getSaveData() : null,
        store: { hasSpawned: storeSystem.hasSpawned, location: storeSystem.location },
        defense: { lastRaidDay: defenseSystem.lastRaidDay },
        liminal: (typeof liminalSystem !== 'undefined') ? liminalSystem.getSaveData() : null,

        // --- NEW RPG & GUARDIAN DATA ---
        rpg: (typeof rpgSystem !== 'undefined') ? rpgSystem.getSaveData() : null,
        guardian: (typeof guardianSystem !== 'undefined') ? guardianSystem.getSaveData() : null,
        resources: (typeof resourceSystem !== 'undefined') ? resourceSystem.getSaveData() : null, // Added Comma!
        // -------------------------------

        time: clock.elapsedTime + (Date.now() - clock.startTime),
        gameDays: clock.gameDays,
        quest: questSystem.activeQuest
    };

    localStorage.setItem('poke_save', JSON.stringify(data));
    console.log('Game Saved');
}

function loadGame() {
    const raw = localStorage.getItem('poke_save');
    if (!raw) return false;

    try {
        const data = JSON.parse(raw);

        // 1. Restore Player
        player.x = data.player.x;
        player.y = data.player.y;
        player.money = (typeof data.player.money !== 'undefined') ? data.player.money : 0;
        player.pLevel = data.player.stats.level;
        player.steps = data.player.stats.steps;
        player.team = data.player.team;
        player.bag = data.player.bag;

        // Restore Defense System
        if (data.defense) {
            defenseSystem.lastRaidDay = data.defense.lastRaidDay;
        }

        // Restore Storage & Pokedex
        player.storage = data.player.storage || Array(100).fill().map(() => Array(25).fill(null));
        player.seen = data.player.seen || [];
        player.seenShiny = data.player.seenShiny || [];

        // Fix missing stats (Legacy Save Support)
        player.team.forEach((p) => {
            if (!p.stats) {
                p.stats = generatePokemonStats();
                p.maxHp = p.level * 5 + p.stats.hp;
                if (p.hp > p.maxHp) p.hp = p.maxHp;
            }
        });

        // Update Meta Level UI
        const metaLevel = document.getElementById('meta-level');
        if (metaLevel) metaLevel.innerText = player.pLevel.toString();

        // 2. Restore World
        if (data.world.seed) {
            world.rng = new SeededRandom(data.world.seed);
        }
        world.items = data.world.items;

        if (data.world.npcs) {
            world.npcs = data.world.npcs.map(
                (npcData) => new NPC(npcData.x, npcData.y, npcData.name, npcData.type, npcData.dialog)
            );
        }

        if (data.world.buildings) {
            world.buildings = data.world.buildings;
        }

        if (data.player.combo) {
            // Restore the global variable
            catchCombo = data.player.combo;
        }

        // Restore Store System
        if (data.store) {
            storeSystem.hasSpawned = data.store.hasSpawned;
            storeSystem.location = data.store.location;

            // Ensure it's in world.buildings if it was spawned
            if (storeSystem.hasSpawned && storeSystem.location) {
                const hasStore = world.buildings.some(b => b.type === 'store');
                if (!hasStore) {
                    world.buildings.push({
                        type: 'store',
                        x: storeSystem.location.x,
                        y: storeSystem.location.y
                    });
                }
            }
        }

        // 3. Restore Arena System
        if (data.arena && typeof arenaSystem !== 'undefined') {
            arenaSystem.loadSaveData(data.arena);
            if (arenaSystem.pyramidLocation && arenaSystem.hasSpawned) {
                const hasArena = world.buildings.some(b => b.type === 'arena');
                if (!hasArena) {
                    world.buildings.push({
                        type: 'arena',
                        x: arenaSystem.pyramidLocation.x,
                        y: arenaSystem.pyramidLocation.y
                    });
                }
            }
        }

        // 4. Restore Rival System
        if (data.rival && typeof rivalSystem !== 'undefined') {
            rivalSystem.loadSaveData(data.rival);
        }

        // 5. Restore Home System
        if (data.home && typeof homeSystem !== 'undefined') {
            homeSystem.loadSaveData(data.home);
            if (homeSystem.houseLocation && homeSystem.hasSpawned) {
                const hasHome = world.buildings.some(b => b.type === 'home');
                if (!hasHome) {
                    world.buildings.push({
                        type: 'home',
                        x: homeSystem.houseLocation.x,
                        y: homeSystem.houseLocation.y
                    });
                }
            }
        }

        // 6. Restore Merge System
        if (data.merge && typeof mergeSystem !== 'undefined') {
            mergeSystem.loadSaveData(data.merge);
        }

        // 7. Restore Liminal System
        if (data.liminal && typeof liminalSystem !== 'undefined') {
            liminalSystem.loadSaveData(data.liminal);
        }

        // --- 8. RESTORE RPG & GUARDIAN & RESOURCES ---
        if (data.rpg && typeof rpgSystem !== 'undefined') {
            rpgSystem.loadSaveData(data.rpg);
            rpgSystem.updateHUD();
        }
        if (data.guardian && typeof guardianSystem !== 'undefined') {
            guardianSystem.loadSaveData(data.guardian);
        }
        if (data.resources && typeof resourceSystem !== 'undefined') {
            resourceSystem.loadSaveData(data.resources);
        }
        // ---------------------------------------------

        // 9. Restore Time
        if (typeof data.gameDays !== 'undefined') {
            clock.elapsedTime = data.time;
            clock.gameDays = data.gameDays;
        } else {
            clock.gameDays = data.time;
            clock.elapsedTime = clock.gameDays * 3600000;
        }

        // 10. Restore Quest
        if (data.quest) {
            questSystem.activeQuest = data.quest;
            questSystem.updateUI();
        } else {
            questSystem.generate();
        }

        // 11. Validate Positions & UI
        world.validatePositions();

        // Safe spawn check
        if (world.isBlocked(Math.round(player.x), Math.round(player.y))) {
            console.log("Player stuck in wall/water! Teleporting to safety...");
            if (homeSystem.houseLocation) {
                player.x = homeSystem.houseLocation.x;
                player.y = homeSystem.houseLocation.y + 4;
            } else {
                let safe = world.findSafeNear(player.x, player.y);
                player.x = safe.x;
                player.y = safe.y;
            }
        }

        updateHUD();

        // --- OFFLINE PROGRESS CALCULATION ---
        if (data.player.lastLogin) {
            const now = Date.now();
            const diffMs = now - data.player.lastLogin;
            const diffMinutes = Math.floor(diffMs / 60000); // Convert to minutes

            // 1. Cap time at 12 hours (720 minutes) to encourage daily logins
            const effectiveMinutes = Math.min(diffMinutes, 720);

            if (effectiveMinutes > 10) { // Only trigger if gone for > 10 mins

                // 2. Count Pokemon in Storage (The Workforce)
                let workerCount = 0;
                player.storage.forEach(box => {
                    box.forEach(p => {
                        if (p) workerCount++;
                    });
                });

                // 3. Calculate Rewards
                // Base: $1 per minute. Bonus: +$1 per minute for every 5 workers.
                const moneyRate = 1 + Math.floor(workerCount / 5);
                const earnings = effectiveMinutes * moneyRate;

                // 4. Give Reward
                player.money += earnings;

                // 5. XP Reward for Party (Passive Training) & Level Up Loop
                const xpGain = Math.floor(effectiveMinutes * 5);
                let leveledUpCount = 0;

                player.team.forEach(p => {
                    if (p.hp > 0) {
                        p.exp += xpGain;
                        // Level Up Loop
                        while (p.exp >= p.level * 100) {
                            p.exp -= p.level * 100;
                            p.level++;
                            leveledUpCount++; // Track total level ups

                            // Boost Stats
                            if (p.stats) {
                                p.maxHp = p.level * 5 + p.stats.hp;
                                p.hp = p.maxHp;
                            }
                        }
                    }
                });

                // 6. Resource Scavenging (New)
                let resourceMsg = "";
                if (workerCount > 0) {
                    const resourceRolls = Math.floor(effectiveMinutes / 30) + Math.floor(workerCount / 2);
                    const resources = {};

                    for (let i = 0; i < resourceRolls; i++) {
                        const rand = Math.random();
                        let type = 'Wood';
                        if (rand > 0.95) type = 'Gold Ore';
                        else if (rand > 0.85) type = 'Iron Ore';
                        else if (rand > 0.60) type = 'Stone';

                        if (!resources[type]) resources[type] = 0;
                        resources[type]++;

                        if (!player.bag[type]) player.bag[type] = 0;
                        player.bag[type]++;
                    }

                    // Format Resource Message: "Wood x5, Stone x2"
                    if (Object.keys(resources).length > 0) {
                        const resList = Object.entries(resources).map(([k, v]) => `${k} x${v}`).join(', ');
                        resourceMsg = `, ${resList}`;
                    } else {
                        resourceMsg = "";
                    }
                }

                // 7. Show "Welcome Back" Screen (Sweet and Simple Format)
                setTimeout(() => {
                    const hours = Math.floor(effectiveMinutes / 60);
                    const minutes = effectiveMinutes % 60;

                    showDialog(
                        `OFFLINE REWARDS: ${hours}h ${minutes}m\n($${earnings}, +${xpGain} XP${resourceMsg})\n${leveledUpCount > 0 ? `PARTY GREW ${leveledUpCount} LEVELS!` : ''}`,
                        8000
                    );
                    updateHUD();
                }, 2000); // Delay slightly so the game renders first
            } else {
                // < 10 mins offline, just show generic welcome
                showDialog('Welcome back!', 2000);
            }
        } else {
            // First time loading with this version (or no previous login time)
            showDialog('Welcome back!', 2000);
        }

        return true;
    } catch (e) {
        console.error('Save file corrupted', e);
        return false;
    }
}

// Variables to track last known values
let lastMoney = -1;
let lastXP = -1;

function updateHUD() {
    // 1. Money - Only update if changed
    if (DOM.hudMoney && player.money !== lastMoney) {
        DOM.hudMoney.innerText = `$${player.money}`;
        lastMoney = player.money;
    }

    // 2. XP - Only update if changed
    if (player.team.length > 0) {
        let p = player.team[0];
        if (p && typeof p.exp !== 'undefined' && typeof p.level !== 'undefined') {
            // Check if XP actually changed to avoid layout thrashing
            if (p.exp !== lastXP) {
                let maxExp = p.level * 100;
                let pct = (p.exp / maxExp) * 100;

                if (DOM.hudXpText) DOM.hudXpText.innerText = `XP: ${p.exp} / ${maxExp}`;
                if (DOM.hudXpFill) DOM.hudXpFill.style.width = `${pct}%`;
                
                lastXP = p.exp;
            }
        }
    }

    // 3. Sidebars & Resources
    // These functions now handle their own optimization check internally
    if (typeof updatePartySidebar === 'function') updatePartySidebar();
    if (typeof updateResourceDisplay === 'function') updateResourceDisplay();
}

// --- Main Menu System ---
// isPaused and gameSpeed are now declared at the top of the file
let currentBox = 0;

function toggleMainMenu() {
    if (typeof liminalSystem !== 'undefined' && liminalSystem.active) {
        showDialog("MENU DISABLED. SYSTEM ERROR.", 1000);
        return;
    }
    const menu = document.getElementById('main-menu-modal');
    const sidebar = document.getElementById('party-sidebar');

    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        if (sidebar) sidebar.classList.add('hidden'); // Hide sidebar
        isPaused = true;
    } else {
        menu.classList.add('hidden');
        if (sidebar && !battleSystem.isActive) sidebar.classList.remove('hidden'); // Show sidebar if not in battle
        isPaused = false;
    }
}

function openOptions() {
    document.getElementById('main-menu-modal').classList.add('hidden');
    document.getElementById('options-modal').classList.remove('hidden');
}

function closeOptions() {
    document.getElementById('options-modal').classList.add('hidden');
    document.getElementById('main-menu-modal').classList.remove('hidden');
}

function setGameSpeed(speed) {
    gameSpeed = speed;
    document.getElementById('speed-1').classList.toggle('active', speed === 1);
    document.getElementById('speed-2').classList.toggle('active', speed === 2);
}

function setVolume(val) {
    musicVolume = val / 100; // Convert 0-100 to 0-1

    const mainMusic = /** @type {HTMLAudioElement} */ (
        document.getElementById('main-music')
    );
    const battleMusic = /** @type {HTMLAudioElement} */ (
        document.getElementById('battle-music')
    );

    if (mainMusic) mainMusic.volume = musicVolume;
    if (battleMusic) battleMusic.volume = musicVolume;

    // Set SFX volume
    const sfxElements = [
        'sfx-pickup',
        'sfx-attack1',
        'sfx-attack2',
        'sfx-attack3'
    ];
    sfxElements.forEach((id) => {
        const sfx = /** @type {HTMLAudioElement} */ (
            document.getElementById(id)
        );
        if (sfx) sfx.volume = musicVolume;
    });
}

// Helper function to play sound effects
function playSFX(sfxId) {
    const sfx = /** @type {HTMLAudioElement} */ (
        document.getElementById(sfxId)
    );
    if (sfx) {
        sfx.volume = musicVolume;
        // Clone node to allow overlapping sounds
        // const clone = sfx.cloneNode();
        // clone.play();

        // Simple single channel for now
        sfx.pause(); // Pause if already playing
        sfx.currentTime = 0; // Reset to start
        sfx.play().catch((err) => console.log(`SFX ${sfxId} play failed`));
    }
}

// --- Pokedex System ---
let currentPokedexTab = 'normal';

async function openPokedex() {
    document.getElementById('main-menu-modal').classList.add('hidden');
    document.getElementById('pokedex-modal').classList.remove('hidden');
    currentPokedexTab = 'normal';
    showPokedexTab('normal');
}

function showPokedexTab(tab) {
    currentPokedexTab = tab;

    // Update tab buttons
    document
        .getElementById('pokedex-tab-normal')
        .classList.toggle('active', tab === 'normal');
    document
        .getElementById('pokedex-tab-shiny')
        .classList.toggle('active', tab === 'shiny');

    const grid = document.getElementById('pokedex-grid');
    grid.innerHTML = '';

    let seenList = tab === 'shiny' ? player.seenShiny : player.seen;
    let seenCount = seenList.length;

    // 151 Pokemon
    for (let i = 1; i <= 151; i++) {
        let div = document.createElement('div');
        div.className = 'dex-entry';

        if (seenList.includes(i)) {
            // Choose sprite based on tab
            let spriteUrl =
                tab === 'shiny'
                    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${i}.png`
                    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${i}.png`;

            div.innerHTML = `
                <div class="dex-num">#${i}</div>
                <img src="${spriteUrl}" loading="lazy">
                <div class="dex-name">...</div>
            `;

            div.style.cursor = 'pointer';

            // Fetch name async and make clickable
            fetch(`https://pokeapi.co/api/v2/pokemon/${i}`)
                .then((res) => res.json())
                .then((data) => {
                    const pokemonName = data.name.toUpperCase();
                    const dexName = /** @type {HTMLElement} */ (
                        div.querySelector('.dex-name')
                    );
                    dexName.innerText = pokemonName;

                    // Add click handler to show owned Pokemon of this species
                    div.onclick = () => showOwnedPokemon(pokemonName, i);
                });
        } else {
            div.className += ' unknown';
            let spriteUrl =
                tab === 'shiny'
                    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${i}.png`
                    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${i}.png`;

            div.innerHTML = `
                <div class="dex-num">#${i}</div>
                <img src="${spriteUrl}" style="filter: brightness(0);">
                <div class="dex-name">???</div>
            `;
        }
        grid.appendChild(div);
    }

    let tabLabel = tab === 'shiny' ? 'Shiny Seen' : 'Seen';
    document.getElementById('pokedex-count').innerText =
        `${tabLabel}: ${seenCount}/151`;
}

// Show all owned Pokemon of a specific species
function showOwnedPokemon(pokemonName, pokemonId) {
    const modal = document.getElementById('pokemon-list-modal');
    const title = document.getElementById('pokemon-list-title');
    const content = document.getElementById('pokemon-list-content');

    title.innerText = `${pokemonName} (Owned)`;
    content.innerHTML = '';

    // Collect all Pokemon of this species from team and PC storage
    const ownedPokemon = [];

    // Check team
    player.team.forEach((p, index) => {
        if (p.name === pokemonName) {
            ownedPokemon.push({
                pokemon: p,
                location: `Team Slot ${index + 1}`
            });
        }
    });

    // Check PC storage
    player.storage.forEach((box, boxIndex) => {
        box.forEach((p, slotIndex) => {
            if (p && p.name === pokemonName) {
                ownedPokemon.push({
                    pokemon: p,
                    location: `Box ${boxIndex + 1}, Slot ${slotIndex + 1}`
                });
            }
        });
    });

    if (ownedPokemon.length === 0) {
        content.innerHTML =
            '<p style="text-align:center; color: #999; padding: 20px;">You don\'t own any of these Pokemon yet!</p>';
    } else {
        ownedPokemon.forEach(({ pokemon, location }) => {
            const div = document.createElement('div');
            div.className = 'menu-item';
            div.style.cursor = 'pointer';
            div.style.padding = '15px';
            div.style.marginBottom = '10px';

            const stats = pokemon.stats || {
                strength: 0,
                defense: 0,
                speed: 0,
                hp: 0,
                special: 0
            };
            const scoreRating =
                stats.strength +
                stats.defense +
                stats.speed +
                stats.hp +
                stats.special;
            const isFainted = pokemon.hp <= 0;

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 16px; color: #ffd700;"><strong>${pokemon.name}</strong> Lv.${pokemon.level}</div>
                        <div style="font-size: 12px; color: #aaa;">${location}</div>
                        <div style="font-size: 11px; color: ${isFainted ? '#e74c3c' : '#2ecc71'}; margin-top: 3px;">
                            ${isFainted ? 'FAINTED' : `HP: ${pokemon.hp}/${pokemon.maxHp}`}
                        </div>
                        <div style="font-size: 12px; color: #2ecc71; margin-top: 3px; font-weight: bold;">
                            SR: ${scoreRating}
                        </div>
                    </div>
                    <div style="text-align: right; font-size: 10px; color: #888;">
                        <div>STR:${stats.strength} DEF:${stats.defense}</div>
                        <div>SPD:${stats.speed} SPC:${stats.special}</div>
                    </div>
                </div>
            `;

            div.onclick = () => {
                closePokemonList();
                showPokemonStats(pokemon);
            };

            content.appendChild(div);
        });
    }

    modal.classList.remove('hidden');
}

function closePokedex() {
    document.getElementById('pokedex-modal').classList.add('hidden');
    document.getElementById('main-menu-modal').classList.remove('hidden');
}

// --- PC Storage System ---
function openPC() {
    document.getElementById('main-menu-modal').classList.add('hidden');
    document.getElementById('pc-modal').classList.remove('hidden');
    renderPC();
}

function closePC() {
    document.getElementById('pc-modal').classList.add('hidden');
    document.getElementById('main-menu-modal').classList.remove('hidden');
}

// --- NEW SACRIFICE FUNCTION ---
function sacrificePokemon() {
    if (!selectedSlot) return;

    // Safety: Don't allow sacrificing the last party member
    if (selectedSlot.type === 'party' && player.team.length <= 1) {
        showDialog("You cannot sacrifice your last Pokemon!", 2000);
        return;
    }

    let pokemon;
    if (selectedSlot.type === 'party') pokemon = player.team[selectedSlot.index];
    else pokemon = player.storage[currentBox][selectedSlot.index];

    // Clean name for candy (Remove stars if merged)
    // We split by space and take the first part to avoid "Pikachu ✨ Candy"
    let speciesName = pokemon.name.split(' ')[0];
    let candyName = `${speciesName} Candy`;

    // 1. Give Candies
    if (!player.bag[candyName]) player.bag[candyName] = 0;
    player.bag[candyName] += 1;

    // 2. Delete Pokemon
    if (selectedSlot.type === 'party') {
        player.team.splice(selectedSlot.index, 1);
    } else {
        player.storage[currentBox][selectedSlot.index] = null;
    }

    // 3. Feedback
    playSFX('sfx-attack1'); // Crunch sound effect
    showDialog(`Sacrificed ${pokemon.name}... Obtained 1 ${candyName}!`, 3000);

    selectedSlot = null;
    renderPC();
    updateHUD();
}

// --- UPDATED RENDER PC ---
function renderPC() {
    // 1. Render Party
    const partyList = document.getElementById('pc-party-list');
    partyList.innerHTML = '';

    player.team.forEach((p, index) => {
        let div = document.createElement('div');
        div.className = 'pc-slot';
        div.innerHTML = `
            <img src="${p.backSprite}">
            <div class="pc-info">
                <div class="pc-lv">Lv.${p.level}</div>
                <div class="pc-name">${p.name}</div>
            </div>
        `;
        div.onclick = () => {
            selectedSlot = { type: 'party', index: index };
            renderPC();
        };
        if (selectedSlot && selectedSlot.type === 'party' && selectedSlot.index === index) {
            div.classList.add('selected');
        }
        partyList.appendChild(div);
    });

    // 2. Render Box
    const boxGrid = document.getElementById('pc-box-grid');
    boxGrid.innerHTML = '';

    // Sort Button Header
    const header = document.querySelector('.box-header');
    if (header && !document.getElementById('pc-sort-btn')) {
        let btn = document.createElement('button');
        btn.id = 'pc-sort-btn';
        btn.innerText = 'SORT';
        btn.style.fontSize = '8px';
        btn.style.marginLeft = '10px';
        btn.onclick = () => {
            toggleSortMode('pc');
            // Apply sort to current box immediately
            player.storage[currentBox] = getSortedPokemonList(player.storage[currentBox]);
            renderPC();
        };
        header.appendChild(btn);
    }

    document.getElementById('box-label').innerText = `BOX ${currentBox + 1} [${currentSortMode.toUpperCase()}]`;

    player.storage[currentBox].forEach((p, index) => {
        let div = document.createElement('div');
        div.className = 'pc-slot';
        if (p) {
            div.innerHTML = `
                <img src="${p.backSprite}">
                <div class="pc-info">
                    <div class="pc-lv">Lv.${p.level}</div>
                    <div class="pc-name">${p.name}</div>
                </div>
            `;
        }

        div.onclick = () => {
            if (p) {
                selectedSlot = { type: 'box', index: index };
                renderPC();
            }
        };

        if (selectedSlot && selectedSlot.type === 'box' && selectedSlot.index === index) {
            div.classList.add('selected');
        }
        boxGrid.appendChild(div);
    });

    // 3. Render Merge Slots (Visual Update)
    mergeSystem.slots.forEach((slot, i) => {
        const el = document.getElementById(`ms-${i}`);
        if (slot) {
            el.innerHTML = `<img src="${slot.data.backSprite}"> ${slot.data.name}`;
            el.style.color = 'white';
        } else {
            el.innerHTML = `${i + 1}. Empty`;
            el.style.color = '#888';
        }
    });

    // 4. Update Actions Buttons
    const actionsDiv = document.getElementById('pc-actions');

    // Ensure the Merge Button exists
    if (!document.getElementById('pc-merge-btn')) {
        const mergeBtn = document.createElement('button');
        mergeBtn.id = 'pc-merge-btn';
        mergeBtn.innerText = 'ADD TO MERGE';
        mergeBtn.className = 'hidden';
        mergeBtn.onclick = addToMerge;
        actionsDiv.appendChild(mergeBtn);
    }

    // NEW: Ensure the Sacrifice Button exists
    if (!document.getElementById('pc-sacrifice-btn')) {
        const sacBtn = document.createElement('button');
        sacBtn.id = 'pc-sacrifice-btn';
        sacBtn.innerText = 'SACRIFICE 💀';
        sacBtn.className = 'hidden';
        sacBtn.onclick = sacrificePokemon;
        actionsDiv.appendChild(sacBtn);
    }

    const addToPartyBtn = document.getElementById('pc-add-to-party');
    const moveToPCBtn = document.getElementById('pc-move-to-pc');
    const mergeActionBtn = document.getElementById('pc-merge-btn');
    const sacActionBtn = document.getElementById('pc-sacrifice-btn');

    if (selectedSlot) {
        actionsDiv.classList.remove('hidden');
        mergeActionBtn.classList.remove('hidden');
        sacActionBtn.classList.remove('hidden'); // Show Sacrifice

        if (selectedSlot.type === 'party') {
            addToPartyBtn.classList.add('hidden');
            moveToPCBtn.classList.remove('hidden');
        } else {
            addToPartyBtn.classList.remove('hidden');
            moveToPCBtn.classList.add('hidden');
        }
    } else {
        actionsDiv.classList.add('hidden');
    }
}

// Helper function for the button
function addToMerge() {
    if (!selectedSlot) return;

    let pokemon;
    if (selectedSlot.type === 'party')
        pokemon = player.team[selectedSlot.index];
    else pokemon = player.storage[currentBox][selectedSlot.index];

    // Attempt add
    if (mergeSystem.addToSlot(pokemon, selectedSlot.index, selectedSlot.type)) {
        selectedSlot = null; // Deselect on success
        renderPC();
    }
}

let selectedSlot = null;

function prevBox() {
    if (currentBox > 0) {
        currentBox--;
        selectedSlot = null;
        renderPC();
    }
}

function nextBox() {
    if (currentBox < 99) {
        currentBox++;
        selectedSlot = null;
        renderPC();
    }
}

function addToParty() {
    if (!selectedSlot || selectedSlot.type !== 'box') return;

    if (player.team.length >= 6) {
        showDialog('Party is full! (Max 6 Pokemon)', 2000);
        return;
    }

    let pokemon = player.storage[currentBox][selectedSlot.index];
    if (pokemon) {
        player.team.push(pokemon);
        player.storage[currentBox][selectedSlot.index] = null;
        selectedSlot = null;
        showDialog(`Moved ${pokemon.name} to Party!`, 2000);
        renderPC();
    }
}

function moveToPC() {
    if (!selectedSlot || selectedSlot.type !== 'party') return;

    if (player.team.length <= 1) {
        showDialog('You must have at least 1 Pokemon in your party!', 2000);
        return;
    }

    let pokemon = player.team[selectedSlot.index];

    // Find first empty slot in current box
    let placed = false;
    for (let i = 0; i < 25; i++) {
        if (player.storage[currentBox][i] === null) {
            player.storage[currentBox][i] = pokemon;
            player.team.splice(selectedSlot.index, 1);
            selectedSlot = null;
            showDialog(`Moved ${pokemon.name} to Box ${currentBox + 1}!`, 2000);
            renderPC();
            placed = true;
            break;
        }
    }

    if (!placed) {
        showDialog(`Box ${currentBox + 1} is full!`, 2000);
    }
}

function cancelPCSelection() {
    selectedSlot = null;
    renderPC();
}

function updatePartySidebar() {
    const sb = document.getElementById('party-sidebar');

    // Safety check: hide sidebar during battle
    if (!sb || battleSystem.isActive) {
        if (sb) sb.classList.add('hidden');
        return;
    }

    sb.classList.remove('hidden');
    sb.innerHTML = '';

    // 1. Create Toggle Button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'party-toggle-btn';
    toggleBtn.innerHTML = isPartyOpen ? '▼ TEAM' : '▶ TEAM';

    // Define toggle logic separately
    const handleToggle = (e) => {
        // Stop the event from reaching the map
        e.preventDefault();
        e.stopPropagation();

        // Toggle state
        isPartyOpen = !isPartyOpen;

        // Re-render
        updatePartySidebar();
    };

    // Attach both events for responsiveness
    // FIXED: Use pointerdown for both desktop/mobile support
    toggleBtn.onpointerdown = handleToggle;

    sb.appendChild(toggleBtn);

    // If closed, stop here
    if (!isPartyOpen) return;

    // 2. Create Container for Pokemon
    const listContainer = document.createElement('div');
    listContainer.id = 'party-list-container';

    player.team.forEach((p, index) => {
        const item = document.createElement('div');
        item.className = 'party-sidebar-item';
        if (index === 0) item.classList.add('active-lead');

        // Stats Logic
        const hpPct = (p.hp / p.maxHp) * 100;
        let hpClass = '';
        if (hpPct < 20) hpClass = 'low';
        else if (hpPct < 50) hpClass = 'mid';

        const xpNeeded = p.level * 100;
        const xpPct = Math.min(100, (p.exp / xpNeeded) * 100);
        let iconUrl = p.sprite || 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';

        item.innerHTML = `
            <img src="${iconUrl}" class="sidebar-icon">
            <div class="sidebar-info">
                <div class="sidebar-header">
                    <span class="sidebar-name">${p.name}</span>
                    <span class="sidebar-lvl">Lv.${p.level}</span>
                </div>
                <div class="sidebar-bar-container">
                    <div class="sidebar-hp-bar"><div class="sidebar-hp-fill ${hpClass}" style="width: ${hpPct}%"></div></div>
                    <div class="sidebar-xp-bar"><div class="sidebar-xp-fill" style="width: ${xpPct}%"></div></div>
                </div>
            </div>
        `;

        const handleSwap = (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (index === 0) {
                showDialog(`${p.name} is already the lead!`, 1000);
                return;
            }

            const temp = player.team[0];
            player.team[0] = player.team[index];
            player.team[index] = temp;

            showDialog(`Switched to ${player.team[0].name}!`, 1500);
            updatePartySidebar();
            updateHUD();
        };

        // FIXED: Use pointerdown for reliable interaction
        item.onpointerdown = handleSwap;

        listContainer.appendChild(item);
    });

    sb.appendChild(listContainer);
}

// --- OPTIMIZED RESOURCE HUD ---
// 1. Define list OUTSIDE the function so it's created only once
const RESOURCE_TRACK_LIST = {
    'Wood': '🌲', 'Stone': '🪨', 'Coal': '⚫', 
    'Iron Ore': '🔩', 'Gold Ore': '🧈', 'Obsidian': '🔮', 
    'Bone': '🦴', 'Shadow Essence': '👻', 'Berry': '🍒'
};

let lastResourceHTML = ""; // Memory of what we drew last time

function updateResourceDisplay() {
    const resContainer = document.getElementById('rpg-resources');
    if (!resContainer) return;

    // 2. Hide if in Battle
    if (typeof battleSystem !== 'undefined' && battleSystem.isActive) {
        if (resContainer.style.display !== 'none') resContainer.style.display = 'none';
        return;
    }

    // 3. Build HTML String
    let html = '';
    let hasResources = false;

    for (let [item, icon] of Object.entries(RESOURCE_TRACK_LIST)) {
        const count = player.bag[item] || 0;
        if (count > 0) {
            html += `<span>${icon} ${count}</span>`;
            hasResources = true;
        }
    }

    // 4. THE LAG FIX: Only touch the DOM if the text is different!
    if (html !== lastResourceHTML) {
        resContainer.innerHTML = html;
        lastResourceHTML = html;
        
        // Handle Visibility
        if (hasResources) {
            if (resContainer.style.display !== 'flex') resContainer.style.display = 'flex';
        } else {
            if (resContainer.style.display !== 'none') resContainer.style.display = 'none';
        }
    }
}

function teleportToLiminal() {
    if (homeSystem && homeSystem.houseLocation) {
        player.x = homeSystem.houseLocation.x;
        player.y = homeSystem.houseLocation.y + 666;

        closeOptions();
        toggleMainMenu(); // Close pause menu
        showDialog("... Signal Detected ...", 2000);
    } else {
        showDialog("No House Found!", 1000);
    }
}
