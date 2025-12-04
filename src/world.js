const TILE_SIZE = 80; // Scaled up for mobile visibility
const VIEW_W = 11; // Tiles wide
const VIEW_H = 15; // Tiles high

class World {
    constructor(seed) {
        this.rng = new SeededRandom(seed);
        this.items = {}; // Store items by "x,y" key
        this.npcs = [];
        this.buildings = []; // Poke Centers and other buildings
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
        // Biome Noise (Low Frequency)
        // Scale coordinates down for larger features
        let biomeVal = this.rng.noise(x * 0.05, y * 0.05);

        // Grass Noise (Very Low Frequency for Large Clusters)
        // We want clusters of 40+ tiles, so very smooth noise
        let grassVal = this.rng.noise(x * 0.1, y * 0.1);

        // Structures
        if (
            Math.abs(Math.floor(x)) % 50 === 0 &&
            Math.abs(Math.floor(y)) % 50 === 0
        )
            return 'center';
        if (
            Math.abs(Math.floor(x)) % 53 === 0 &&
            Math.abs(Math.floor(y)) % 53 === 0
        )
            return 'store';

        // Biomes based on smooth noise
        if (biomeVal < 0.3) return 'water';

        // Grass logic: Large clusters
        if (grassVal > 0.6) return 'grass_tall';

        if (biomeVal > 0.8) return 'flowers'; // Rare flower fields

        return 'grass';
    }

    getColor(type) {
        switch (type) {
            case 'water':
                return '#3498db';
            case 'grass_tall':
                return '#27ae60';
            case 'grass':
                return '#2ecc71';
            case 'flowers':
                return '#e74c3c';
            case 'center':
                return '#c0392b';
            case 'store':
                return '#2980b9'; // Blue roof
            default:
                return '#000';
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
}

class NPC {
    constructor(x, y, name, type, dialog) {
        this.x = x;
        this.y = y;
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
                if (world.getTile(this.x + dx, this.y + dy) !== 'water') {
                    this.x += dx;
                    this.y += dy;
                }
            }
            this.lastMove = Date.now();
        }
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
        this.inventory = { Herb: 0 };

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
        metaLevel.innerText = this.pLevel.toString();
    }

    addPokemon(pokeData) {
        if (this.team.length < 6) {
            this.team.push(pokeData);
        } else {
            // Find first empty slot in storage
            let placed = false;
            for (let b = 0; b < 100; b++) {
                for (let s = 0; s < 25; s++) {
                    if (this.storage[b][s] === null) {
                        this.storage[b][s] = pokeData;
                        showDialog(`Team full! Sent to PC Box ${b + 1}.`);
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }
            if (!placed) showDialog('PC is full! Released Pokemon.');
        }
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

                this.ctx.fillStyle = this.world.getColor(tile);
                this.ctx.fillRect(
                    Math.floor(drawX),
                    Math.floor(drawY),
                    TILE_SIZE + 1,
                    TILE_SIZE + 1
                ); // +1 to fix gaps

                // Texture detail
                if (tile === 'grass_tall') {
                    this.ctx.fillStyle = 'rgba(0,0,0,0.1)';
                    this.ctx.fillRect(
                        Math.floor(drawX) + 5,
                        Math.floor(drawY) + 5,
                        TILE_SIZE - 10,
                        TILE_SIZE - 10
                    );
                }

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

        // Draw Poke Centers (Buildings)
        this.world.buildings.forEach((building) => {
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
            }
        });

        // Draw NPCs
        this.world.npcs.forEach((npc) => {
            let drawX =
                (npc.x - this.player.x) * TILE_SIZE +
                this.canvas.width / 2 -
                TILE_SIZE / 2;
            let drawY =
                (npc.y - this.player.y) * TILE_SIZE +
                this.canvas.height / 2 -
                TILE_SIZE / 2;

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

            // Name
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                npc.name,
                Math.floor(drawX) + TILE_SIZE / 2,
                Math.floor(drawY) - 10
            );
        });

        // Draw Player (Always Center)
        const px = this.canvas.width / 2 - TILE_SIZE / 2;
        const py = this.canvas.height / 2 - TILE_SIZE / 2;

        // Atmospheric Effects (Fog/Clouds)
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        for (let i = 0; i < 5; i++) {
            let cloudX = (Date.now() / 1000 + i * 200) % this.canvas.width;
            let cloudY = i * 100;
            this.ctx.beginPath();
            this.ctx.arc(cloudX, cloudY, 80, 0, Math.PI * 2);
            this.ctx.fill();
        }

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
        this.drawParticles(0, 0);

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
}
