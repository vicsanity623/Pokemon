const TILE_SIZE = 80; // Scaled up for mobile visibility
const VIEW_W = 11; // Tiles wide
const VIEW_H = 15; // Tiles high

class World {
    constructor(seed) {
        this.rng = new SeededRandom(seed);
        this.items = {}; 
        this.npcs = [];
        this.buildings = []; 
        // We do NOT call initItems/initNPCs here anymore to prevent crash
    }

    // Call this manually after all systems are loaded
    init() {
        this.initItems();
        this.initNPCs();
    }

    initNPCs() {
        // Herbalist
        this.npcs.push(
            new NPC(5, 5, 'Herbalist', 'quest', 'Bring me 10 Herbs for $500!')
        );

        // Daycare Man
        this.npcs.push(
            new NPC(
                -5,
                -5,
                'Daycare Man',
                'daycare',
                'I can raise your Pokemon.'
            )
        );

        // Wandering Villager
        this.npcs.push(
            new NPC(2, -2, 'Villager', 'talk', 'Nice weather today!')
        );
    }

    updateNPCs() {
        this.npcs.forEach((npc) => npc.update(this));
    }

    initItems() {
        // Randomly scatter items
        let masterBallsSpawned = 0;

        for (let i = 0; i < 60; i++) {
            let x, y, tile;
            let attempts = 0;
            do {
                x = Math.floor(Math.random() * 200) - 100;
                y = Math.floor(Math.random() * 200) - 100;
                tile = this.getTile(x, y);

                // Strict check
                if (tile !== 'water') {
                    if (this.getTile(x + 1, y) === 'water') tile = 'water';
                    else if (this.getTile(x - 1, y) === 'water') tile = 'water';
                    else if (this.getTile(x, y + 1) === 'water') tile = 'water';
                    else if (this.getTile(x, y - 1) === 'water') tile = 'water';
                }

                attempts++;
            } while (tile === 'water' && attempts < 20);

            if (tile === 'water') continue; // Skip if failed

            let r = Math.random();
            let type = 'Potion';

            // Item Rarity Logic
            if (r > 0.98 && masterBallsSpawned < 3) {
                type = 'Master Ball';
                masterBallsSpawned++;
            } else if (r > 0.95) type = 'Ultra Ball';
            else if (r > 0.9) type = 'Max Potion';
            else if (r > 0.85) type = 'Hyper Potion';
            else if (r > 0.8) type = 'Great Ball';
            else if (r > 0.7) type = 'Super Potion';
            else if (r > 0.5) type = 'Pokeball';
            else if (r > 0.4) type = 'Herb';

            this.items[`${x},${y}`] = type;
        }
    }

    getItem(x, y) {
        return this.items[`${x},${y}`];
    }

    removeItem(x, y) {
        delete this.items[`${x},${y}`];
    }

    // Poke Center Building System
    spawnPokeCenter(x, y) {
        // Ensure not on water
        // Ensure not on water
        if (this.getTile(x, y) === 'water') {
            let safe = this.findSafeNear(x, y);
            x = safe.x;
            y = safe.y;
        }

        this.buildings.push({
            type: 'pokecenter',
            x: x,
            y: y
        });
    }

    getBuildingAt(x, y) {
        return this.buildings.find(
            (b) => Math.round(b.x) === x && Math.round(b.y) === y
        );
    }

    getTile(x, y) {
        if (typeof liminalSystem !== 'undefined' && liminalSystem.active) {
            return liminalSystem.getLiminalTile(x, y);
        }
        // 1. Temperature & Biome Noise
        let tempNoise = this.rng.noise(x * 0.02, y * 0.02);
        let temperature = (y / 200) + (tempNoise * 0.5); // Negative Y = North (Cold)
        let moisture = this.rng.noise(x * 0.05, y * 0.05);
        let detail = this.rng.noise(x * 0.1, y * 0.1);

        // WATER
        if (detail < 0.25) return 'water';

        // --- POLAR BIOME (North / Negative Y) ---
        if (temperature < -0.4) {
            if (detail < 0.3) return 'ice';
            if (detail > 0.65) return 'snow_tall'; // <--- NEW: Snow Grass
            return 'snow';
        }

        // --- DESERT BIOME (East / Positive X) ---
        // Changed to 50 so it's easier to find
        if (x > 50 && moisture < 0.4) {
            if (detail > 0.65) return 'sand_tall'; // <--- NEW: Sand Dunes
            return 'sand';
        }

        // --- STANDARD BIOME (South/West) ---
        if (detail > 0.65) return 'grass_tall';
        if (moisture > 0.7 && detail > 0.5) return 'flowers';

        return 'grass';
    }

    getColor(type) {
        if (type.startsWith('liminal_')) {
            return liminalSystem.getColor(type);
        }
        switch (type) {
            case 'water': return '#4FA4F4';
            case 'ice': return '#A5E3F9';
            case 'grass_tall': return '#388E3C';
            case 'grass': return '#66BB6A';
            case 'flowers': return '#E57373';

            // Desert Colors
            case 'sand': return '#FDD835';
            case 'sand_tall': return '#FBC02D'; // Darker sand (Encounter)

            // Snow Colors
            case 'snow': return '#ECEFF1';
            case 'snow_tall': return '#CFD8DC'; // Darker snow (Encounter)

            case 'center': return '#c0392b';
            case 'store': return '#2980b9';
            default: return '#222';
        }
    }

    getItemIcon(type) {
        const icons = {
            Herb: '🌿',
            Potion: '🍷',
            'Super Potion': '🍷',
            'Hyper Potion': '🏺',
            'Max Potion': '💖',
            Pokeball: '🔴',
            'Great Ball': '🔵',
            'Ultra Ball': '🟡',
            'Master Ball': '🟣'
        };
        return icons[type] || '❓';
    }

    // Safety Check
    validatePositions() {
        // Check NPCs
        this.npcs.forEach((npc) => {
            if (
                this.getTile(Math.round(npc.x), Math.round(npc.y)) === 'water'
            ) {
                let safe = this.findSafeNear(npc.x, npc.y);
                npc.x = safe.x;
                npc.y = safe.y;
                npc.startX = safe.x;
                npc.startY = safe.y;
            }
        });

        // Check Buildings
        this.buildings.forEach((b) => {
            if (this.getTile(Math.round(b.x), Math.round(b.y)) === 'water') {
                let safe = this.findSafeNear(b.x, b.y);
                b.x = safe.x;
                b.y = safe.y;
            }
        });
    }

    findSafeNear(x, y) {
        let radius = 1;
        while (radius < 50) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    let tx = Math.round(x + dx);
                    let ty = Math.round(y + dy);
                    if (this.getTile(tx, ty) !== 'water') {
                        // Strict check: Ensure neighbors are also not water (buffer)
                        let neighborsSafe = true;
                        if (this.getTile(tx + 1, ty) === 'water')
                            neighborsSafe = false;
                        if (this.getTile(tx - 1, ty) === 'water')
                            neighborsSafe = false;
                        if (this.getTile(tx, ty + 1) === 'water')
                            neighborsSafe = false;
                        if (this.getTile(tx, ty - 1) === 'water')
                            neighborsSafe = false;

                        if (neighborsSafe) return { x: tx, y: ty };
                    }
                }
            }
            radius++;
        }
        return { x: x, y: y }; // Fallback
    }
    respawnItem(playerX, playerY) {
        // 1. Cap the total items to prevent lag (Max 60 items)
        if (Object.keys(this.items).length >= 60) return;

        // 2. Try 10 times to find a valid spot near the player
        for (let i = 0; i < 10; i++) {
            // Pick a random spot within 25 tiles of the player
            let range = 25;
            let rx = Math.floor(playerX + (Math.random() * range * 2) - range);
            let ry = Math.floor(playerY + (Math.random() * range * 2) - range);

            let tile = this.getTile(rx, ry);
            let key = `${rx},${ry}`;

            // Check against existing items
            if (this.items[key]) continue;

            // Check against buildings
            let hasBuilding = this.buildings.some(b => Math.round(b.x) === rx && Math.round(b.y) === ry);
            if (hasBuilding) continue;

            // Strict terrain check (Must be grass, not water/structures)
            if (tile === 'grass' || tile === 'grass_tall' || tile === 'flowers') {

                // 3. Determine Item Type (Weighted Rarity)
                let r = Math.random();
                let type = 'Potion';

                if (r > 0.99) type = 'Ultra Ball';      // Very Rare
                else if (r > 0.96) type = 'Max Potion';
                else if (r > 0.92) type = 'Great Ball';
                else if (r > 0.85) type = 'Super Potion';
                else if (r > 0.75) type = 'Pokeball';
                else if (r > 0.60) type = 'Herb';
                else type = 'Potion'; // Common (40% chance)

                // Place the item
                this.items[key] = type;
                // console.log(`Respawned ${type} at ${rx},${ry}`);
                break; // Stop loop, item placed
            }
        }
    }

    isBlocked(x, y) {
        if (typeof liminalSystem !== 'undefined' && liminalSystem.active) {
            // Check if this tile is a wall or void
            const tile = liminalSystem.getLiminalTile(x, y);
            if (tile === 'liminal_wall' || tile === 'liminal_void') return true;
            
            // Allow walking on floor
            return false;
        }
        // 1. Water Check
        if (this.getTile(x, y) === 'water') return true;

        // RESOURCE COLLISION
        if (typeof resourceSystem !== 'undefined' && resourceSystem.nodes[`${x},${y}`]) {
            return true;
        }
        
        // 2. Building Collision
        for (let b of this.buildings) {
            if (b.type === 'home') {
                // House 3x3 Collision (Center +/- 1)
                if (Math.abs(x - b.x) <= 1 && Math.abs(y - b.y) <= 1) return true;
            } else {
                // Standard 1x1 Collision
                if (Math.round(b.x) === x && Math.round(b.y) === y) return true;
            }
        }
        return false;
    }
}

class NPC {
    constructor(x, y, name, type, dialog) {
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;
        this.moveStartTime = 0;
        this.startX = x;
        this.startY = y;
        this.name = name;
        this.type = type; // 'quest', 'daycare', 'talk'
        this.dialog = dialog;
        this.color = '#f1c40f'; // Yellow
        this.lastMove = Date.now();

        // Quest tracking
        this.questGiven = false;
        this.questCompleted = false;
        this.questRequirement = type === 'quest' ? { herb: 10 } : null;
    }

    update(world) {
        // Wander randomly every 2-5 seconds
        if (Date.now() - this.lastMove > 2000 + Math.random() * 3000) {
            let dx = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
            let dy = Math.floor(Math.random() * 3) - 1;

            // Keep within radius of 5 from start
            if (
                Math.abs(this.x + dx - this.startX) < 5 &&
                Math.abs(this.y + dy - this.startY) < 5
            ) {
                // Check collision
                if (!world.isBlocked(this.x + dx, this.y + dy)) {
                    this.prevX = this.x;
                    this.prevY = this.y;
                    this.moveStartTime = Date.now();
                    this.x += dx;
                    this.y += dy;
                }
            }
            this.lastMove = Date.now();
        }
    }

    // --- FIX: Add Save/Load Data for NPCs so Quest Status persists ---
    getSaveData() {
        return {
            x: this.x,
            y: this.y,
            name: this.name,
            questGiven: this.questGiven,
            questCompleted: this.questCompleted
        };
    }

    loadSaveData(data) {
        this.x = data.x;
        this.y = data.y;
        this.questGiven = data.questGiven || false;
        this.questCompleted = data.questCompleted || false;
    }
}

class Player {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.speed = 0.04; // Fixed slow speed (was 0.08)
        this.money = 0;
        this.steps = 0;
        this.moving = false;
        this.dir = 'down'; // down, up, left, right

        // Stats
        this.pLevel = 1; // Survival Level
        this.team = []; // Pokemon objects
        this.bag = { Potion: 5, Pokeball: 10 };
        // FIX: Remove separate inventory, use Bag
        // this.inventory = { Herb: 0 }; 

        // Track last Poke Center spawn for interval
        this.lastPokeCenterStep = -500; // Spawn first one soon

        // PC Storage: 100 Boxes of 25 slots
        this.storage = Array(100)
            .fill()
            .map(() => Array(25).fill(null));

        // Pokedex: Set of seen IDs
        this.seen = [];
        this.seenShiny = [];
    }

    healAllPokemon() {
        this.team.forEach((p) => {
            if (!p.isEgg) {
                p.hp = p.maxHp;
                p.status = null; // Clear status effects (poison, burn, etc.)
            }
        });
    }

    surviveLevelUp() {
        this.pLevel++;
        showDialog(
            `You survived another day. Survivor Level: ${this.pLevel}`,
            4000
        );
        /** @type {HTMLElement} */
        const metaLevel = document.getElementById('meta-level');
        if (metaLevel) metaLevel.innerText = this.pLevel.toString();
    }

    addPokemon(pokeData) {
        // Safety check for legacy saves
        if (!this.storage || !Array.isArray(this.storage)) {
            this.storage = Array(100).fill().map(() => Array(25).fill(null));
        }

        if (this.team.length < 6) {
            this.team.push(pokeData);
        } else {
            let placed = false;
            for (let b = 0; b < 100; b++) {
                if (!Array.isArray(this.storage[b])) this.storage[b] = Array(25).fill(null);
                for (let s = 0; s < 25; s++) {
                    if (this.storage[b][s] === null) {
                        this.storage[b][s] = pokeData;
                        showDialog(`Team full! Sent to PC Box ${b + 1}.`, 3000); // 3s Timer
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }
            if (!placed) showDialog('PC is full! Released Pokemon.', 3000); // 3s Timer
        }
        // Force the sidebar/HUD to refresh so the UI doesn't break
        if (typeof updateHUD === 'function') updateHUD();
    }
}

class Renderer {
    constructor(canvas, world, player) {
        this.ctx = canvas.getContext('2d');
        this.canvas = canvas;
        this.world = world;
        this.player = player;
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Load Player Sprite (Ash style)
        this.sprite = new Image();
        this.sprite.src =
            'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iv/heartgold-soulsilver/25.png';

        // Load House Sprite
        this.houseImg = new Image();
        this.houseImg.src = '290pxhouse.png';

        // Load Daycare Sprite
        this.daycareImg = new Image();
        this.daycareImg.src = 'daycare.png';

        // Load Villager Sprite
        this.villagerImg = new Image();
        this.villagerImg.src = 'villager.png';

        // Load Herbalist Sprite
        this.herbalistImg = new Image();
        this.herbalistImg.src = 'herbalist.png';

        this.particles = [];
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx.imageSmoothingEnabled = false;
    }

    addParticle(x, y) {
        this.particles.push({
            x: x,
            y: y,
            life: 0.8, // Shorter life
            vx: (Math.random() - 0.5) * 0.2, // Much slower spread
            vy: (Math.random() - 0.5) * 0.2
        });
    }

    drawParticles(offsetX, offsetY) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.life -= 0.02; // Fade slower
            p.x += p.vx;
            p.y += p.vy;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            let drawX =
                (p.x - this.player.x) * TILE_SIZE +
                this.canvas.width / 2 +
                offsetX;
            let drawY =
                (p.y - this.player.y) * TILE_SIZE +
                this.canvas.height / 2 +
                offsetY;

            this.ctx.fillStyle = `rgba(200, 200, 200, ${p.life})`;
            this.ctx.fillRect(drawX, drawY, 3, 3); // Smaller particles
        }
    }

    draw() {
        const cx = Math.ceil(this.canvas.width / TILE_SIZE);
        const cy = Math.ceil(this.canvas.height / TILE_SIZE);
        const startX = this.player.x - Math.floor(cx / 2);
        const startY = this.player.y - Math.floor(cy / 2);

        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Map
        // We need to render enough tiles to cover the screen based on fractional position
        const startTileX = Math.floor(this.player.x) - Math.floor(cx / 2) - 1;
        const startTileY = Math.floor(this.player.y) - Math.floor(cy / 2) - 1;

        // Offset for smooth scrolling
        const offsetX = (this.player.x - Math.floor(this.player.x)) * TILE_SIZE;
        const offsetY = (this.player.y - Math.floor(this.player.y)) * TILE_SIZE;

        // Draw a bit more to cover edges
        for (let y = 0; y < cy + 2; y++) {
            for (let x = 0; x < cx + 2; x++) {
                let worldX = startTileX + x;
                let worldY = startTileY + y;
                let tile = this.world.getTile(worldX, worldY);

                // Calculate screen position relative to center
                // We want player to be exactly in center
                // ScreenX = (worldX - playerX) * TILE_SIZE + CanvasCenter

                let drawX =
                    (worldX - this.player.x) * TILE_SIZE +
                    this.canvas.width / 2 -
                    TILE_SIZE / 2;
                let drawY =
                    (worldY - this.player.y) * TILE_SIZE +
                    this.canvas.height / 2 -
                    TILE_SIZE / 2;

                // --- MODIFIED TILE RENDERING START ---

                // 1. Draw Base Tile with Overlap (Fixes Grid Lines)
                this.ctx.fillStyle = this.world.getColor(tile);
                this.ctx.fillRect(
                    Math.floor(drawX) - 1,
                    Math.floor(drawY) - 1,
                    TILE_SIZE + 2,
                    TILE_SIZE + 2
                );

                // 2. Procedural Texture (The "Juice")
                // Generate a consistent random seed based on coordinates
                const seed = Math.abs((worldX * 73856093) ^ (worldY * 19349663));

                if (tile === 'grass' || tile === 'grass_tall') {
                    // Draw grass blades
                    this.ctx.fillStyle = (tile === 'grass_tall') ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)';
                    // Draw 3 blades per tile
                    for (let i = 0; i < 3; i++) {
                        let ox = (seed + i * 10) % TILE_SIZE;
                        let oy = (seed + i * 20) % TILE_SIZE;
                        this.ctx.fillRect(Math.floor(drawX) + ox, Math.floor(drawY) + oy, 4, 4);
                    }
                    // Extra shade for tall grass to differentiate it
                    if (tile === 'grass_tall') {
                        this.ctx.fillRect(
                            Math.floor(drawX) + 5,
                            Math.floor(drawY) + 5,
                            TILE_SIZE - 10,
                            TILE_SIZE - 10
                        );
                    }
                } else if (tile === 'water') {
                    // Draw animated waves
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    let waveOffset = (Date.now() / 500) % TILE_SIZE; // Animated!
                    let ox = (seed) % TILE_SIZE;
                    let oy = (seed * 2) % TILE_SIZE;
                    // Draw a little wave line
                    this.ctx.fillRect(Math.floor(drawX) + ox, Math.floor(drawY) + oy, 10, 2);
                } else if (tile === 'sand') {
                    // Draw sandy dots
                    this.ctx.fillStyle = '#FBC02D'; // Darker sand accent
                    for (let i = 0; i < 5; i++) {
                        let ox = (seed + i * 13) % TILE_SIZE;
                        let oy = (seed * i * 7) % TILE_SIZE;
                        this.ctx.fillRect(Math.floor(drawX) + ox, Math.floor(drawY) + oy, 3, 3);
                    }
                } else if (tile === 'snow') {
                    // Draw white fluff/texture
                    this.ctx.fillStyle = '#FFFFFF';
                    let ox = (seed) % TILE_SIZE;
                    let oy = (seed * 3) % TILE_SIZE;
                    this.ctx.fillRect(Math.floor(drawX) + ox, Math.floor(drawY) + oy, TILE_SIZE / 2, TILE_SIZE / 4);
                }

                // --- MODIFIED TILE RENDERING END ---

                // Draw Item
                let item = this.world.getItem(worldX, worldY);
                if (item) {
                    this.ctx.font = '24px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    let icon = this.world.getItemIcon(item);
                    this.ctx.fillText(
                        icon,
                        Math.floor(drawX) + TILE_SIZE / 2,
                        Math.floor(drawY) + TILE_SIZE / 2
                    );
                }
            }
        }

        this.ctx.save();
        // Camera translation removed (using relative coords)

        /**
         * RENDER LIST SYSTEM
         * We collect all entities into a list, sort by Y coordinate, and draw in order.
         * This ensures correct z-indexing (stuff lower on screen covers stuff higher).
         */
        let renderList = [];

        // 1. Add Buildings
        this.world.buildings.forEach(b => {
            renderList.push({ type: 'building', y: b.y, data: b });
        });

        // 2. Add NPCs
        this.world.npcs.forEach(npc => {
            renderList.push({ type: 'npc', y: npc.y, data: npc });
        });

        // 3. Add Player
        renderList.push({ type: 'player', y: this.player.y, data: this.player });

        // 4. Add Rival
        if (typeof rivalSystem !== 'undefined' && rivalSystem.isChasing) {
            renderList.push({ type: 'rival', y: rivalSystem.y, data: rivalSystem });
        }
        
        // 5. Add Guardian
        if (typeof guardianSystem !== 'undefined' && guardianSystem.activeGuardian) {
            renderList.push({ type: 'guardian', y: guardianSystem.entity.y, data: guardianSystem });
        }
        
        // 6. Add Resources
        if (typeof resourceSystem !== 'undefined') {
            for (let key in resourceSystem.nodes) {
                const node = resourceSystem.nodes[key];
                const [nx, ny] = key.split(',').map(Number);
                if (Math.abs(nx - this.player.x) < VIEW_W && Math.abs(ny - this.player.y) < VIEW_H) {
                    renderList.push({ type: 'resource', y: ny, data: { ...node, x: nx, y: ny } });
                }
            }
            // Add Crops
            for (let key in resourceSystem.crops) {
                const crop = resourceSystem.crops[key];
                const [cx, cy] = key.split(',').map(Number);
                renderList.push({ type: 'crop', y: cy, data: { ...crop, x: cx, y: cy } });
            }
        }
        
        // 7. Add Enemies (PHASE 4)
        if (typeof enemySystem !== 'undefined') {
            enemySystem.enemies.forEach(e => {
                renderList.push({ type: 'enemy', y: e.y, data: e });
            });
        }

        // Sort by Y
        renderList.sort((a, b) => a.y - b.y);

        // Draw Sorted Entities
        renderList.forEach(item => {
            if (item.type === 'building') this.drawBuilding(item.data);
            else if (item.type === 'npc') this.drawNPC(item.data);
            else if (item.type === 'player') this.drawPlayer(item.data);
            else if (item.type === 'rival') item.data.draw(this.ctx, this.canvas, this.world, this.player);
            else if (item.type === 'guardian') item.data.draw(this.ctx, TILE_SIZE, this.canvas.width/2, this.canvas.height/2);
            
            else if (item.type === 'resource') this.drawResource(item.data);
            else if (item.type === 'crop') this.drawCrop(item.data);
            
            // --- NEW: DRAW ENEMY ---
            else if (item.type === 'enemy') this.drawEnemy(item.data);
        });

        this.drawOverlays();

        this.ctx.restore();
    }
    
    drawResource(node) {
        let drawX = (node.x - this.player.x) * TILE_SIZE + this.canvas.width / 2 - TILE_SIZE / 2;
        let drawY = (node.y - this.player.y) * TILE_SIZE + this.canvas.height / 2 - TILE_SIZE / 2;

        // Draw Base
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        this.ctx.beginPath();
        this.ctx.ellipse(drawX + TILE_SIZE/2, drawY + TILE_SIZE - 5, 20, 8, 0, 0, Math.PI*2);
        this.ctx.fill();

        // Draw Emoji Icon as Sprite
        this.ctx.font = '50px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(resourceSystem.TYPES[node.type].icon, drawX + TILE_SIZE/2, drawY + TILE_SIZE/1.5);

        // Draw Health Bar (ALWAYS DRAW FOR DEBUGGING IF NEEDED)
        // Only draw if < max to avoid clutter, or always if you want to see stats
        if (node.hp < node.maxHp) {
            let hpPct = node.hp / node.maxHp;
            this.ctx.fillStyle = 'red';
            this.ctx.fillRect(drawX + 10, drawY, TILE_SIZE - 20, 5);
            this.ctx.fillStyle = '#2ecc71';
            this.ctx.fillRect(drawX + 10, drawY, (TILE_SIZE - 20) * hpPct, 5);
        }
    }

    drawCrop(crop) {
        let drawX = (crop.x - this.player.x) * TILE_SIZE + this.canvas.width / 2 - TILE_SIZE / 2;
        let drawY = (crop.y - this.player.y) * TILE_SIZE + this.canvas.height / 2 - TILE_SIZE / 2;

        this.ctx.fillStyle = '#795548'; // Brown Dirt
        this.ctx.fillRect(drawX + 10, drawY + 10, TILE_SIZE - 20, TILE_SIZE - 20);

        this.ctx.font = '40px Arial';
        this.ctx.textAlign = 'center';
        if (crop.ready) {
            this.ctx.fillText('🍓', drawX + TILE_SIZE/2, drawY + TILE_SIZE/1.5);
        } else {
            this.ctx.fillText('🌱', drawX + TILE_SIZE/2, drawY + TILE_SIZE/1.5);
        }
    }

    drawEnemy(e) {
        let drawX = (e.x - this.player.x) * TILE_SIZE + this.canvas.width / 2 - TILE_SIZE / 2;
        let drawY = (e.y - this.player.y) * TILE_SIZE + this.canvas.height / 2 - TILE_SIZE / 2;

        // Shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(drawX + TILE_SIZE/2, drawY + TILE_SIZE - 5, 15, 5, 0, 0, Math.PI*2);
        this.ctx.fill();

        // Sprite
        if (e.type === 'skeleton') {
            this.ctx.font = '40px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('💀', drawX + TILE_SIZE/2, drawY + TILE_SIZE/1.5);
        } else {
            // Shadow Pokemon
            this.ctx.fillStyle = 'rgba(75, 0, 130, 0.8)';
            this.ctx.beginPath();
            this.ctx.arc(drawX + TILE_SIZE/2, drawY + TILE_SIZE/2, 20, 0, Math.PI*2);
            this.ctx.fill();
            this.ctx.fillStyle = '#fff'; 
            this.ctx.fillRect(drawX + TILE_SIZE/2 - 10, drawY + TILE_SIZE/2 - 5, 5, 2);
            this.ctx.fillRect(drawX + TILE_SIZE/2 + 5, drawY + TILE_SIZE/2 - 5, 5, 2);
        }

        // HP Bar
        let hpPct = Math.max(0, e.hp / e.maxHp);
        this.ctx.fillStyle = 'red';
        this.ctx.fillRect(drawX + 10, drawY - 10, TILE_SIZE - 20, 5);
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.fillRect(drawX + 10, drawY - 10, (TILE_SIZE - 20) * hpPct, 5);
    }

    drawBuilding(building) {
        // Draw Poke Center
        if (building.type === 'pokecenter') {
            let drawX =
                (building.x - this.player.x) * TILE_SIZE +
                this.canvas.width / 2 -
                TILE_SIZE / 2;
            let drawY =
                (building.y - this.player.y) * TILE_SIZE +
                this.canvas.height / 2 -
                TILE_SIZE / 2;

            // Draw building platform/base
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.fillRect(
                Math.floor(drawX) - 10,
                Math.floor(drawY) - 10,
                TILE_SIZE + 20,
                TILE_SIZE + 20
            );

            // Glow effect
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = '#3498db';

            // Hospital emoji
            this.ctx.font = '50px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(
                '🏥',
                Math.floor(drawX) + TILE_SIZE / 2,
                Math.floor(drawY) + TILE_SIZE / 2
            );

            // Reset shadow
            this.ctx.shadowBlur = 0;
        } else if (building.type === 'arena') {
            // FIX: Check if arenaSystem AND its draw method exist
            if (typeof arenaSystem !== 'undefined' && typeof arenaSystem.draw === 'function') {
                arenaSystem.draw(this.ctx, this.canvas, this.player);
                return;
            }
            
            // Fallback Renderer (In case arena.js is outdated/missing the draw function)
            // This ensures the game doesn't crash and you still see where the arena is
            let drawX = (building.x - this.player.x) * TILE_SIZE + this.canvas.width / 2 - TILE_SIZE / 2;
            let drawY = (building.y - this.player.y) * TILE_SIZE + this.canvas.height / 2 - TILE_SIZE / 2;

            // Draw large base
            this.ctx.fillStyle = '#f1c40f'; // Gold
            this.ctx.fillRect(Math.floor(drawX) - TILE_SIZE / 2, Math.floor(drawY) - TILE_SIZE / 2, TILE_SIZE * 2, TILE_SIZE * 2);
            
            // Label
            this.ctx.fillStyle = '#000';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText("ARENA", Math.floor(drawX) + TILE_SIZE/2, Math.floor(drawY));
        } else if (building.type === 'home') {
            // Draw Player's Home Image
            let drawX =
                (building.x - this.player.x) * TILE_SIZE +
                this.canvas.width / 2 -
                TILE_SIZE / 2;
            let drawY =
                (building.y - this.player.y) * TILE_SIZE +
                this.canvas.height / 2 -
                TILE_SIZE / 2;

            // Draw the house image
            // Much Larger: 4x Tile Size (approx 320px)
            // Centered: Subtract 1.5 tiles from center
            this.ctx.drawImage(
                this.houseImg,
                Math.floor(drawX) - TILE_SIZE * 1.5,
                Math.floor(drawY) - TILE_SIZE * 2,
                TILE_SIZE * 4,
                TILE_SIZE * 4
            );
        }
            else if (building.type === 'workbench') {
            let drawX = (building.x - this.player.x) * TILE_SIZE + this.canvas.width / 2 - TILE_SIZE / 2;
            let drawY = (building.y - this.player.y) * TILE_SIZE + this.canvas.height / 2 - TILE_SIZE / 2;

            // Draw Table
            this.ctx.fillStyle = '#8e44ad'; // Purple table
            this.ctx.fillRect(Math.floor(drawX), Math.floor(drawY) + 20, TILE_SIZE, TILE_SIZE - 20);
            
            // Draw Hammer Icon
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '30px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('⚒️', Math.floor(drawX) + TILE_SIZE/2, Math.floor(drawY) + 20);
            
            // Label
            this.ctx.font = '10px Arial';
            this.ctx.fillText('CRAFT', Math.floor(drawX) + TILE_SIZE/2, Math.floor(drawY) + 50);
        }
        else if (building.type === 'store') {
            let drawX = (building.x - this.player.x) * TILE_SIZE + this.canvas.width / 2 - TILE_SIZE / 2;
            let drawY = (building.y - this.player.y) * TILE_SIZE + this.canvas.height / 2 - TILE_SIZE / 2;

            // Draw Building Base (Blue walls for Poke Mart)
            this.ctx.fillStyle = '#2980b9';
            this.ctx.fillRect(Math.floor(drawX), Math.floor(drawY) + 20, TILE_SIZE, TILE_SIZE - 20);

            // Draw Roof (Red distinctive Poke Mart roof)
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.fillRect(Math.floor(drawX) - 5, Math.floor(drawY), TILE_SIZE + 10, 25);

            // MART Text Sign
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('MART', Math.floor(drawX) + TILE_SIZE / 2, Math.floor(drawY) + 18);

            // Window and Door
            this.ctx.fillStyle = '#87CEEB'; // Light blue window
            this.ctx.fillRect(Math.floor(drawX) + 10, Math.floor(drawY) + 35, 25, 20);

            this.ctx.fillStyle = '#34495e'; // Dark door
            this.ctx.fillRect(Math.floor(drawX) + TILE_SIZE - 30, Math.floor(drawY) + 45, 20, 35);

            // Glow effect to make it stand out
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#3498db';
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(Math.floor(drawX), Math.floor(drawY) + 20, TILE_SIZE, TILE_SIZE - 20);
            this.ctx.shadowBlur = 0;
        }
    }

    drawNPC(npc) {
        // Interpolate Position
        const MOVE_DURATION = 500; // ms to match movement speed
        let t = (Date.now() - npc.moveStartTime) / MOVE_DURATION;
        t = Math.min(1, Math.max(0, t));

        let currX = npc.prevX + (npc.x - npc.prevX) * t;
        let currY = npc.prevY + (npc.y - npc.prevY) * t;

        // Bounce Animation
        let bounce = 0;
        if (t < 1) {
            bounce = Math.sin(t * Math.PI) * 10;
        }

        let drawX =
            (currX - this.player.x) * TILE_SIZE +
            this.canvas.width / 2 -
            TILE_SIZE / 2;
        let drawY =
            (currY - this.player.y) * TILE_SIZE +
            this.canvas.height / 2 -
            TILE_SIZE / 2 - bounce;

        // Draw Daycare Man or Generic NPC
        if (npc.type === 'daycare') {
            this.ctx.drawImage(this.daycareImg, Math.floor(drawX) - 10, Math.floor(drawY) - 10, TILE_SIZE + 20, TILE_SIZE + 20);
        } else if (npc.type === 'talk' && npc.name === 'Villager') {
            this.ctx.drawImage(this.villagerImg, Math.floor(drawX) - 10, Math.floor(drawY) - 10, TILE_SIZE + 20, TILE_SIZE + 20);
        } else if (npc.type === 'quest') {
            this.ctx.drawImage(this.herbalistImg, Math.floor(drawX) - 10, Math.floor(drawY) - 10, TILE_SIZE + 20, TILE_SIZE + 20);
        } else {
            // Simple NPC Render (Circle with Name)
            this.ctx.fillStyle = npc.color;
            this.ctx.beginPath();
            this.ctx.arc(
                Math.floor(drawX) + TILE_SIZE / 2,
                Math.floor(drawY) + TILE_SIZE / 2,
                15,
                0,
                Math.PI * 2
            );
            this.ctx.fill();
        }

        // Name
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            npc.name,
            Math.floor(drawX) + TILE_SIZE / 2,
            Math.floor(drawY) - 10
        );
    }

    drawPlayer(player) {
        // Draw Player (Always Center relative to map, but offset if camera moves)
        // Actually in this engine player is center of screen.
        const px = this.canvas.width / 2 - TILE_SIZE / 2;
        const py = this.canvas.height / 2 - TILE_SIZE / 2;

        // Shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(
            px + TILE_SIZE / 2,
            py + TILE_SIZE - 5,
            15,
            5,
            0,
            0,
            Math.PI * 2
        );
        this.ctx.fill();

        // Dust Particles (Spawn if moving)
        // We spawn them at player feet in world coordinates
        // Footstep effect: Lower frequency
        if (this.player.moving) {
            if (Math.random() < 0.1) {
                // Reduced from 0.3
                this.addParticle(this.player.x + 0.5, this.player.y + 0.9);
            }
        }

        // Sprite (Flip if facing RIGHT, since raw sprite faces LEFT)
        this.ctx.save();

        // Bounce Animation
        let bounceY = 0;
        if (this.player.moving) {
            bounceY = Math.abs(Math.sin(Date.now() / 100)) * -5; // Bounce up 5px
        }

        if (this.player.dir === 'right') {
            this.ctx.translate(px + TILE_SIZE, py - 10 + bounceY);
            this.ctx.scale(-1, 1);
            this.ctx.drawImage(this.sprite, 0, 0, TILE_SIZE, TILE_SIZE);
        } else {
            this.ctx.drawImage(
                this.sprite,
                px,
                py - 10 + bounceY,
                TILE_SIZE,
                TILE_SIZE
            );
        }
        this.ctx.restore();

        // Tall Grass Overlay (Occlusion)
        let currentTile = this.world.getTile(
            Math.round(this.player.x),
            Math.round(this.player.y)
        );
        if (currentTile === 'grass_tall') {
            this.ctx.fillStyle = 'rgba(39, 174, 96, 0.8)'; // Semi-transparent grass color
            this.ctx.fillRect(px, py + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE / 2);

            // Random grass blades
            this.ctx.fillStyle = '#1e8449';
            this.ctx.fillRect(px + 5, py + TILE_SIZE / 2 + 5, 4, 10);
            this.ctx.fillRect(px + 25, py + TILE_SIZE / 2 + 2, 4, 12);
        }
    }

    drawOverlays() {
        // Particles
        this.drawParticles(0, 0);

        // Simple Atmospheric Effects (Fog/Clouds)
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        for (let i = 0; i < 5; i++) {
            let cloudX = (Date.now() / 1000 + i * 200) % this.canvas.width;
            let cloudY = i * 100;
            this.ctx.beginPath();
            this.ctx.arc(cloudX, cloudY, 80, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // --- LIMINAL TRIGGER (Red Phone) ---
        if (typeof liminalSystem !== 'undefined' && !liminalSystem.active && homeSystem.houseLocation) {
            const hx = homeSystem.houseLocation.x;
            const hy = homeSystem.houseLocation.y;
            
            // Trigger Location: House Y + 666
            const trigX = hx;
            const trigY = hy + 666;
    
            const drawX = (trigX - this.player.x) * TILE_SIZE + this.canvas.width / 2 - TILE_SIZE / 2;
            const drawY = (trigY - this.player.y) * TILE_SIZE + this.canvas.height / 2 - TILE_SIZE / 2;
    
            // Only draw if on screen
            if (drawX > -TILE_SIZE && drawX < this.canvas.width && drawY > -TILE_SIZE && drawY < this.canvas.height) {
                // Draw a Red Telephone Booth / Door
                this.ctx.fillStyle = '#c0392b'; // Dark Red
                this.ctx.fillRect(Math.floor(drawX) + 20, Math.floor(drawY) + 10, 40, 60);
                
                // Glow
                this.ctx.shadowBlur = 20;
                this.ctx.shadowColor = 'red';
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '30px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText("☎️", Math.floor(drawX) + TILE_SIZE/2, Math.floor(drawY) + TILE_SIZE/2);
                this.ctx.shadowBlur = 0;
            }
        }

        // --- DRAW LIMINAL ENTITY (Mirror Self) ---
        if (typeof liminalSystem !== 'undefined' && liminalSystem.active) {
            liminalSystem.drawEntity(this.ctx, this.canvas, TILE_SIZE);
        }
        if (typeof enemySystem !== 'undefined') {
            enemySystem.projectiles.forEach(p => {
                let px = (p.x - this.player.x) * TILE_SIZE + this.canvas.width / 2;
                let py = (p.y - this.player.y) * TILE_SIZE + this.canvas.height / 2;
                
                this.ctx.fillStyle = p.color || '#8e44ad'; // Default Purple
                this.ctx.beginPath();
                this.ctx.arc(px, py, 8, 0, Math.PI*2);
                this.ctx.fill();
                
                // Glow
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = p.color || '#8e44ad';
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
            });
        }
        // --- BLOOD MOON DEFENSE RENDERER (Safe Mode) ---
        if (typeof defenseSystem !== 'undefined' && defenseSystem.active && homeSystem.houseLocation) {
            try {
                const home = homeSystem.houseLocation;
                // Calculate Home Screen Position
                let hx = (home.x - this.player.x) * TILE_SIZE + this.canvas.width / 2 - TILE_SIZE / 2;
                let hy = (home.y - this.player.y) * TILE_SIZE + this.canvas.height / 2 - TILE_SIZE / 2;

                // 1. Draw Base HP Bar
                if (defenseSystem.maxBaseHealth > 0) {
                    this.ctx.fillStyle = '#000';
                    this.ctx.fillRect(Math.floor(hx), Math.floor(hy) - 15, TILE_SIZE, 8);
                    this.ctx.fillStyle = defenseSystem.baseHealth > 250 ? '#2ecc71' : '#e74c3c';
                    let bhp = Math.max(0, (defenseSystem.baseHealth / defenseSystem.maxBaseHealth) * TILE_SIZE);
                    this.ctx.fillRect(Math.floor(hx), Math.floor(hy) - 15, bhp, 8);
                }

                // 2. Draw Turrets
                if (defenseSystem.turretOffsets && Array.isArray(defenseSystem.defenders)) {
                    defenseSystem.turretOffsets.forEach((offset, idx) => {
                        let t = defenseSystem.defenders[idx];
                        let tx = hx + offset.x * TILE_SIZE;
                        let ty = hy + offset.y * TILE_SIZE;

                        // Draw Platform
                        this.ctx.fillStyle = 'rgba(50, 50, 50, 0.7)';
                        this.ctx.beginPath();
                        this.ctx.arc(tx + TILE_SIZE / 2, ty + TILE_SIZE / 2, TILE_SIZE / 2 - 2, 0, Math.PI * 2);
                        this.ctx.fill();
                        this.ctx.strokeStyle = '#fff';
                        this.ctx.lineWidth = 2;
                        this.ctx.stroke();

                        if (t && t.hp > 0) {
                            // Safe Color Check
                            let typeColor = '#fff';
                            if (typeof defenseSystem.getTypeColor === 'function') {
                                // Ensure type is lowercase to match dictionary keys
                                let typeKey = t.type ? t.type.toLowerCase() : 'normal';
                                typeColor = defenseSystem.getTypeColor(typeKey);
                            }

                            this.ctx.fillStyle = typeColor;
                            this.ctx.beginPath();
                            this.ctx.arc(tx + TILE_SIZE / 2, ty + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
                            this.ctx.fill();

                            // Draw Turret HP Bar
                            let max = t.maxHp || 100;
                            let cur = t.hp || 0;
                            let hpPct = cur / max;
                            
                            this.ctx.fillStyle = '#000';
                            this.ctx.fillRect(tx + 5, ty - 12, TILE_SIZE - 10, 6);
                            this.ctx.fillStyle = hpPct > 0.5 ? '#2ecc71' : '#e74c3c';
                            this.ctx.fillRect(tx + 5, ty - 12, (TILE_SIZE - 10) * Math.max(0, hpPct), 6);
                        } else {
                            // Empty/Broken Slot
                            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
                            this.ctx.fill();
                            this.ctx.strokeStyle = 'red';
                            this.ctx.moveTo(tx + 15, ty + 15);
                            this.ctx.lineTo(tx + TILE_SIZE - 15, ty + TILE_SIZE - 15);
                            this.ctx.moveTo(tx + TILE_SIZE - 15, ty + 15);
                            this.ctx.lineTo(tx + 15, ty + TILE_SIZE - 15);
                            this.ctx.stroke();
                        }
                    });
                }

                // 3. Draw Enemies
                if (defenseSystem.enemies) {
                    defenseSystem.enemies.forEach(e => {
                        let ex = (e.x - this.player.x) * TILE_SIZE + this.canvas.width / 2 - TILE_SIZE / 2;
                        let ey = (e.y - this.player.y) * TILE_SIZE + this.canvas.height / 2 - TILE_SIZE / 2;

                        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
                        this.ctx.beginPath();
                        this.ctx.ellipse(ex + TILE_SIZE / 2, ey + TILE_SIZE - 5, 20, 8, 0, 0, Math.PI * 2);
                        this.ctx.fill();

                        this.ctx.fillStyle = '#8e44ad';
                        this.ctx.fillRect(ex + 10, ey + 10, TILE_SIZE - 20, TILE_SIZE - 20);

                        this.ctx.fillStyle = '#fff';
                        this.ctx.font = '10px Arial';
                        this.ctx.fillText(e.name || '???', ex + TILE_SIZE / 2, ey + 5);

                        let ehp = Math.max(0, e.hp / e.maxHp);
                        this.ctx.fillStyle = 'red';
                        this.ctx.fillRect(ex + 10, ey - 5, (TILE_SIZE - 20) * ehp, 4);
                    });
                }

                // 4. Draw Projectiles
                if (defenseSystem.projectiles) {
                    defenseSystem.projectiles.forEach(p => {
                        let px = (p.x - this.player.x) * TILE_SIZE + this.canvas.width / 2;
                        let py = (p.y - this.player.y) * TILE_SIZE + this.canvas.height / 2;

                        this.ctx.fillStyle = p.color || '#fff';
                        this.ctx.beginPath();
                        this.ctx.arc(px, py, 6, 0, Math.PI * 2);
                        this.ctx.fill();
                    });
                }
            } catch (e) {
                // If drawing fails, Log it but DO NOT CRASH the game loop
                console.error("Raid Render Error (Suppressed):", e);
            }
        }
    }
}
