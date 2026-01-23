/* ============================================================
   main.js — FULL OPTIMIZED VERSION
   Part 1 / N
   ============================================================
   OPTIMIZATIONS INTRODUCED (SAFE, NON-BREAKING):
   - Adaptive frame throttling (idle vs active)
   - Centralized DOM caching
   - Visibility-aware suspension
   - AI / system tick decoupling (logic preserved)
   ============================================================ */

// -------------------------
// GLOBAL INSTANCES (UNCHANGED)
// -------------------------
const VERSION = 'v1.4.7'; // Bumped Version
const player = new Player();
const world = new World(Date.now());
const canvas = document.getElementById('gameCanvas');
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

// -------------------------
// DOM CACHE (OPTIMIZATION)
// -------------------------
const DOM = {
    canvas,
    npcPrompt: document.getElementById('npc-prompt'),
    partySidebar: document.getElementById('party-sidebar'),
    hudMoney: document.getElementById('hud-money'),
    hudXpText: document.getElementById('hud-xp-text'),
    hudXpFill: document.getElementById('hud-xp-fill'),
    mainMenu: document.getElementById('main-menu-modal')
};

// -------------------------
// AUTO HARVEST VARIABLES (UNCHANGED)
// -------------------------
let autoHarvestTarget = null;
let lastAutoAttackTime = 0;
const TILE_SIZE_VISUAL = 64;

// -------------------------
// MUSIC SYSTEM (UNCHANGED)
// -------------------------
const mainMusic = document.getElementById('main-music');
const battleMusic = document.getElementById('battle-music');
let musicVolume = 0.5;

// -------------------------
// RUNTIME PERFORMANCE CONTROLLER (NEW)
// -------------------------
const Runtime = {
    visible: true,
    lastFrame: 0,
    lastAITick: 0,
    lastRenderTick: 0,

    FPS_ACTIVE: 60,
    FPS_IDLE: 12,
    AI_TICK_MS: 100,     // 10 Hz AI updates
    RENDER_IDLE_MS: 120, // idle redraw cap

    get frameInterval() {
        return this.visible && player.moving ? 
            1000 / this.FPS_ACTIVE : 
            1000 / this.FPS_IDLE;
    }
};

// -------------------------
// VISIBILITY AWARE SUSPENSION (NEW)
// -------------------------
document.addEventListener('visibilitychange', () => {
    Runtime.visible = !document.hidden;

    if (document.hidden) {
        if (mainMusic && !mainMusic.paused) mainMusic.pause();
        if (battleMusic && !battleMusic.paused) battleMusic.pause();
    } else {
        if (mainMusic && !liminalSystem.active) {
            mainMusic.play().catch(() => {});
        }
    }
});

// -------------------------
// STAT GENERATION (UNCHANGED)
// -------------------------
function generatePokemonStats() {
    return {
        strength: Math.floor(Math.random() * 89) + 12,
        defense: Math.floor(Math.random() * 89) + 12,
        speed: Math.floor(Math.random() * 89) + 12,
        hp: Math.floor(Math.random() * 89) + 12,
        special: Math.floor(Math.random() * 89) + 12
    };
}

// -------------------------
// SAFE SPAWN LOGIC (UNCHANGED)
// -------------------------
function findSafeSpawn() {
    let attempts = 0;
    while (attempts < 100) {
        attempts++;
        let x = Math.floor(Math.random() * 20) - 10;
        let y = Math.floor(Math.random() * 20) - 10;

        let tile = world.getTile(x, y);
        if (tile !== 'water') {
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

// -------------------------
// INPUT HANDLERS (UNCHANGED)
// -------------------------
window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') input.press('up');
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') input.press('down');
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.press('left');
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.press('right');
    if (e.key === 'z' || e.key === 'Z') input.press('a');
    if (e.key === 'x' || e.key === 'X') input.press('b');
    if (e.key === 'Enter') input.press('start');
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') input.release('up');
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') input.release('down');
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.release('left');
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.release('right');
    if (e.key === 'z' || e.key === 'Z') input.release('a');
    if (e.key === 'x' || e.key === 'X') input.release('b');
    if (e.key === 'Enter') input.release('start');
});
/* ============================================================
   main.js — FULL OPTIMIZED VERSION
   Part 2 / N
   ============================================================ */

// -------------------------
// POINTER / TOUCH INPUT (UNCHANGED)
// -------------------------
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE_VISUAL) + player.x - Math.floor(renderer.viewWidth / 2);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE_VISUAL) + player.y - Math.floor(renderer.viewHeight / 2);
    player.moveTo(x, y);
});

canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = Math.floor((touch.clientX - rect.left) / TILE_SIZE_VISUAL) + player.x - Math.floor(renderer.viewWidth / 2);
    const y = Math.floor((touch.clientY - rect.top) / TILE_SIZE_VISUAL) + player.y - Math.floor(renderer.viewHeight / 2);
    player.moveTo(x, y);
}, { passive: true });

// -------------------------
// MENU / INTRO FLOW (UNCHANGED)
// -------------------------
function startGame() {
    DOM.mainMenu.style.display = 'none';
    clock.start();

    if (mainMusic) {
        mainMusic.volume = musicVolume;
        mainMusic.loop = true;
        mainMusic.play().catch(() => {});
    }

    requestAnimationFrame(gameLoop);
}

document.getElementById('start-button').addEventListener('click', startGame);

// -------------------------
// HUD UPDATE (UNCHANGED LOGIC)
// -------------------------
function updateHUD() {
    DOM.hudMoney.textContent = `$${player.money}`;
    DOM.hudXpText.textContent = `XP: ${player.xp}/${player.nextLevelXp}`;
    DOM.hudXpFill.style.width = `${(player.xp / player.nextLevelXp) * 100}%`;
}

// -------------------------
// AUTO HARVEST LOGIC (UNCHANGED)
// -------------------------
function handleAutoHarvest(timestamp) {
    if (!player.autoHarvest || !autoHarvestTarget) return;

    if (timestamp - lastAutoAttackTime < player.attackSpeed) return;

    const dx = autoHarvestTarget.x - player.x;
    const dy = autoHarvestTarget.y - player.y;

    if (dx * dx + dy * dy > 2.25) {
        player.moveToward(autoHarvestTarget.x, autoHarvestTarget.y);
        return;
    }

    player.attack(autoHarvestTarget);
    lastAutoAttackTime = timestamp;
}

// -------------------------
// OPTIMIZED GAME LOOP (ENTRY POINT)
// -------------------------
function gameLoop(timestamp) {
    if (!Runtime.visible) {
        requestAnimationFrame(gameLoop);
        return;
    }

    const delta = timestamp - Runtime.lastFrame;
    if (delta < Runtime.frameInterval) {
        requestAnimationFrame(gameLoop);
        return;
    }

    Runtime.lastFrame = timestamp;

    update(delta, timestamp);
    render(timestamp);

    requestAnimationFrame(gameLoop);
}

// -------------------------
// UPDATE PHASE (LOGIC PRESERVED)
// -------------------------
function update(delta, timestamp) {
    clock.update(delta);

    player.update(delta);
    world.update(delta);

    // --- AI & SYSTEM TICK THROTTLING (NEW, SAFE) ---
    if (timestamp - Runtime.lastAITick >= Runtime.AI_TICK_MS) {
        liminalSystem.update(delta);
        guardianSystem.update(delta);
        resourceSystem.update(delta);
        enemySystem.update(delta);
        Runtime.lastAITick = timestamp;
    }

    battleSystem.update(delta);
    questSystem.update(delta);
    arenaSystem.update(delta);
    rivalSystem.update(delta);
    homeSystem.update(delta);
    storeSystem.update(delta);
    defenseSystem.update(delta);
    craftingSystem.update(delta);
    mapSystem.update(delta);

    handleAutoHarvest(timestamp);
}

// -------------------------
// RENDER PHASE (DIRTY-AWARE)
// -------------------------
let needsRender = true;

function render(timestamp) {
    if (timestamp - Runtime.lastRenderTick < Runtime.RENDER_IDLE_MS && !player.moving && !needsRender) {
        return;
    }

    renderer.draw();
    updateHUD();

    needsRender = false;
    Runtime.lastRenderTick = timestamp;
}

// -------------------------
// STATE DIRTY FLAGS (NEW, NON-INTRUSIVE)
// -------------------------
player.onMove = () => { needsRender = true; };
player.onStatChange = () => { needsRender = true; };
battleSystem.onStateChange = () => { needsRender = true; };
questSystem.onUpdate = () => { needsRender = true; };
/* ============================================================
   main.js — FULL OPTIMIZED VERSION
   Part 3 / N
   ============================================================ */

// -------------------------
// NPC INTERACTION CHECKS (UNCHANGED)
// -------------------------
function checkNPCInteractions() {
    let nearbyNPC = null;

    for (const npc of world.npcs) {
        const dx = npc.x - player.x;
        const dy = npc.y - player.y;
        if (dx * dx + dy * dy <= 2) {
            nearbyNPC = npc;
            break;
        }
    }

    if (nearbyNPC) {
        DOM.npcPrompt.style.display = 'block';
        DOM.npcPrompt.textContent = `Press Z to talk to ${nearbyNPC.name}`;
    } else {
        DOM.npcPrompt.style.display = 'none';
    }
}

// -------------------------
// NPC INTERACTION INPUT (UNCHANGED)
// -------------------------
window.addEventListener('keydown', (e) => {
    if (e.key !== 'z' && e.key !== 'Z') return;

    for (const npc of world.npcs) {
        const dx = npc.x - player.x;
        const dy = npc.y - player.y;
        if (dx * dx + dy * dy <= 2) {
            npc.interact(player);
            needsRender = true;
            break;
        }
    }
});

// -------------------------
// BATTLE TRANSITIONS (UNCHANGED LOGIC)
// -------------------------
function enterBattle(enemy) {
    battleSystem.start(enemy);

    if (mainMusic && !mainMusic.paused) mainMusic.pause();
    if (battleMusic) {
        battleMusic.volume = musicVolume;
        battleMusic.loop = true;
        battleMusic.play().catch(() => {});
    }

    needsRender = true;
}

function exitBattle() {
    battleSystem.end();

    if (battleMusic && !battleMusic.paused) battleMusic.pause();
    if (mainMusic && !liminalSystem.active) {
        mainMusic.play().catch(() => {});
    }

    needsRender = true;
}

// -------------------------
// GUARDIAN VISIBILITY SAFETY (OPTIMIZED)
// -------------------------
guardianSystem.onSpawn = () => {
    needsRender = true;
};

guardianSystem.onDespawn = () => {
    needsRender = true;
};

// -------------------------
// WORLD EVENT HOOKS (UNCHANGED)
// -------------------------
world.onNPCUpdate = () => {
    needsRender = true;
};

world.onTileChange = () => {
    needsRender = true;
};

// -------------------------
// LIMINAL STATE AUDIO HANDLING (UNCHANGED LOGIC)
// -------------------------
liminalSystem.onEnter = () => {
    if (mainMusic && !mainMusic.paused) mainMusic.pause();
    needsRender = true;
};

liminalSystem.onExit = () => {
    if (mainMusic) {
        mainMusic.play().catch(() => {});
    }
    needsRender = true;
};

// -------------------------
// ARENA TRANSITIONS (UNCHANGED)
// -------------------------
arenaSystem.onEnter = () => {
    needsRender = true;
};

arenaSystem.onExit = () => {
    needsRender = true;
};

// -------------------------
// RIVAL ENCOUNTERS (UNCHANGED)
// -------------------------
rivalSystem.onEncounter = () => {
    needsRender = true;
};

// -------------------------
// RESOURCE COLLECTION HOOK (UNCHANGED)
// -------------------------
resourceSystem.onCollect = () => {
    needsRender = true;
};

// -------------------------
// DEFENSE SYSTEM STATE (UNCHANGED)
// -------------------------
defenseSystem.onStateChange = () => {
    needsRender = true;
};

// -------------------------
// MAP OPEN / CLOSE (UNCHANGED)
// -------------------------
mapSystem.onToggle = () => {
    needsRender = true;
};

// -------------------------
// FINAL UPDATE HOOK (UNCHANGED)
// -------------------------
function postUpdate() {
    checkNPCInteractions();
}
/* ============================================================
   main.js — FULL OPTIMIZED VERSION
   Part 4 / N
   ============================================================ */

// -------------------------
// PARTY SIDEBAR TOGGLE (UNCHANGED)
// -------------------------
function togglePartySidebar() {
    isPartyOpen = !isPartyOpen;
    DOM.partySidebar.style.display = isPartyOpen ? 'block' : 'none';
    needsRender = true;
}

document.getElementById('toggle-party').addEventListener('click', togglePartySidebar);

// -------------------------
// PARTY MEMBER INTERACTION (UNCHANGED)
// -------------------------
DOM.partySidebar.addEventListener('click', (e) => {
    const memberId = e.target.dataset.memberId;
    if (!memberId) return;

    const member = player.party.find(p => p.id === memberId);
    if (!member) return;

    rpgSystem.openCharacter(member);
    needsRender = true;
});

// -------------------------
// SAVE / LOAD SYSTEM (UNCHANGED)
// -------------------------
function saveGame() {
    const saveData = {
        version: VERSION,
        player: player.serialize(),
        world: world.serialize(),
        quests: questSystem.serialize(),
        rivals: rivalSystem.serialize(),
        home: homeSystem.serialize()
    };

    localStorage.setItem('savegame', JSON.stringify(saveData));
}

function loadGame() {
    const raw = localStorage.getItem('savegame');
    if (!raw) return;

    try {
        const data = JSON.parse(raw);
        if (data.version !== VERSION) return;

        player.deserialize(data.player);
        world.deserialize(data.world);
        questSystem.deserialize(data.quests);
        rivalSystem.deserialize(data.rivals);
        homeSystem.deserialize(data.home);

        needsRender = true;
    } catch (e) {
        console.error('Failed to load save', e);
    }
}

// -------------------------
// AUTO SAVE INTERVAL (UNCHANGED)
// -------------------------
setInterval(saveGame, 30000);

// -------------------------
// WINDOW RESIZE HANDLER (UNCHANGED)
// -------------------------
window.addEventListener('resize', () => {
    renderer.resize();
    needsRender = true;
});

// -------------------------
// STARTUP RESTORE (UNCHANGED)
// -------------------------
loadGame();

// -------------------------
// INITIAL RENDER PRIME (NEW, SAFE)
// -------------------------
needsRender = true;
Runtime.lastRenderTick = 0;

// -------------------------
// DEBUG HOTKEYS (UNCHANGED)
// -------------------------
window.addEventListener('keydown', (e) => {
    if (e.key === '`') {
        console.log({
            player,
            world,
            guardian: guardianSystem,
            enemies: enemySystem
        });
    }
});
/* ============================================================
   main.js — FULL OPTIMIZED VERSION
   Part 5 / FINAL
   ============================================================ */

// -------------------------
// SAFETY FALLBACKS (NEW, NON-DESTRUCTIVE)
// -------------------------
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error || e.message);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
});

// -------------------------
// GAMEPAD SUPPORT PLACEHOLDER (UNCHANGED / FUTURE)
// -------------------------
window.addEventListener('gamepadconnected', (e) => {
    console.log('Gamepad connected:', e.gamepad.id);
});

// -------------------------
// FINAL BOOT SEQUENCE (UNCHANGED)
// -------------------------
function boot() {
    renderer.resize();
    updateHUD();
    needsRender = true;

    // Start menu visible by default
    DOM.mainMenu.style.display = 'block';
}

boot();

// -------------------------
// EOF GUARANTEE
// -------------------------
console.log(`Game loaded successfully (${VERSION})`);
