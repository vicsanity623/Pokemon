class ResourceSystem {
    constructor(player, world) {
        this.player = player;
        this.world = world;
        
        // Storage format: "x,y" => { type, hp, maxHp, state }
        this.nodes = {}; 
        this.crops = {}; 
        this.respawnQueue = []; 

        // NEW: Tracks which areas we have already populated
        this.generatedChunks = new Set(); 
        this.CHUNK_SIZE = 16; // 16x16 tiles per chunk

        this.TYPES = {
            'tree': { hp: 3, loot: 'Wood', color: '#2ecc71', icon: '🌲', xp: 5 },
            'rock': { hp: 5, loot: 'Stone', color: '#95a5a6', icon: '🪨', xp: 5 },
            'ore_coal': { hp: 8, loot: 'Coal', color: '#2c3e50', icon: '⚫', xp: 10 },
            'ore_iron': { hp: 12, loot: 'Iron Ore', color: '#e67e22', icon: '🔩', xp: 15 },
            'ore_gold': { hp: 20, loot: 'Gold Ore', color: '#f1c40f', icon: '🧈', xp: 25 },
            'ore_obsidian': { hp: 30, loot: 'Obsidian', color: '#8e44ad', icon: '🔮', xp: 50 }
        };
    }

    // This is now handled by updateChunks(), but we keep it empty/legacy to prevent crashes
    generate() {
        this.updateChunks();
    }

    // Called every frame
    update(dt) {
        // 1. Farming Logic
        for (let key in this.crops) {
            let crop = this.crops[key];
            if (!crop.ready) {
                crop.timer += dt;
                if (crop.timer >= crop.growthTime) crop.ready = true;
            }
        }

        // 2. Respawn Logic (30s Timer)
        for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
            let item = this.respawnQueue[i];
            item.timer -= dt;
            if (item.timer <= 0) {
                this.nodes[item.key] = {
                    type: item.type,
                    hp: this.TYPES[item.type].hp,
                    maxHp: this.TYPES[item.type].hp
                };
                this.respawnQueue.splice(i, 1);
            }
        }

        // 3. NEW: Infinite World Generation
        this.updateChunks();
    }

    // Checks player position and generates resources nearby
    updateChunks() {
        if (!this.player) return;

        // Calculate which chunk the player is in
        const cx = Math.floor(this.player.x / this.CHUNK_SIZE);
        const cy = Math.floor(this.player.y / this.CHUNK_SIZE);

        // Check a 3x3 grid of chunks around the player
        // This ensures resources appear BEFORE you walk onto the screen
        for (let x = cx - 1; x <= cx + 1; x++) {
            for (let y = cy - 1; y <= cy + 1; y++) {
                this.generateChunk(x, y);
            }
        }
    }

    generateChunk(cx, cy) {
        const chunkKey = `${cx},${cy}`;
        
        // If we already generated this chunk, skip it
        if (this.generatedChunks.has(chunkKey)) return;

        // Loop through every tile in this 16x16 chunk
        for (let i = 0; i < this.CHUNK_SIZE; i++) {
            for (let j = 0; j < this.CHUNK_SIZE; j++) {
                // Calculate actual World Coordinates
                let wx = cx * this.CHUNK_SIZE + i;
                let wy = cy * this.CHUNK_SIZE + j;
                const key = `${wx},${wy}`;

                // Safety: Don't spawn if something is already there
                if (this.nodes[key] || this.world.isBlocked(wx, wy)) continue;

                // DENSITY CHECK: 15% Chance per tile to have a resource
                if (Math.random() > 0.15) continue;

                const tile = this.world.getTile(wx, wy);
                let type = null;
                const rand = Math.random();

                // --- BIOME SPECIFIC LOGIC ---
                
                if (tile === 'snow' || tile === 'snow_tall') {
                    // SNOW BIOME: High Iron, Low Stone
                    if (rand < 0.60) type = 'ore_iron';  // 60% Iron
                    else if (rand < 0.90) type = 'tree'; // 30% Trees (Snowy)
                    else type = 'rock';                  // 10% Stone
                } 
                else if (tile === 'sand' || tile === 'sand_tall') {
                    // DESERT BIOME: High Obsidian, Coal, Stone
                    if (rand < 0.10) type = 'ore_obsidian'; // 10% Obsidian (High!)
                    else if (rand < 0.50) type = 'ore_coal'; // 40% Coal
                    else type = 'rock';                      // 50% Stone
                } 
                else {
                    // GRASS / DEFAULT
                    if (rand < 0.60) type = 'tree';
                    else type = 'rock';
                }

                // Global Rare Spawn (Overwrites the above)
                // 1% Chance for Gold anywhere (except water)
                if (Math.random() < 0.01) type = 'ore_gold';

                if (type) {
                    this.nodes[key] = {
                        type: type,
                        hp: this.TYPES[type].hp,
                        maxHp: this.TYPES[type].hp
                    };
                }
            }
        }

        // Mark chunk as done so we don't re-calculate it
        this.generatedChunks.add(chunkKey);
    }

    checkHit(x, y, damage) {
        const key = `${Math.round(x)},${Math.round(y)}`;
        const node = this.nodes[key];
        if (node) {
            node.hp -= damage;
            if (typeof renderer !== 'undefined') renderer.addParticle(x, y); 
            playSFX('sfx-attack2'); 
            if (node.hp <= 0) this.harvest(key, node);
            return true; 
        }
        return false;
    }

    harvest(key, node) {
        const data = this.TYPES[node.type];
        if (!this.player.bag[data.loot]) this.player.bag[data.loot] = 0;
        this.player.bag[data.loot]++;
        if (typeof rpgSystem !== 'undefined') rpgSystem.gainXP(data.xp);
        
        showDialog(`Harvested 1 ${data.loot}! (+${data.xp} XP)`, 1000);
        
        // Add to respawn queue (30s)
        this.respawnQueue.push({ key: key, type: node.type, timer: 30.0 });
        delete this.nodes[key];
    }

    plant(x, y, seedType) {
        const key = `${x},${y}`;
        if (this.nodes[key] || this.crops[key]) {
            showDialog("Something is already here!", 1000);
            return;
        }
        this.crops[key] = { type: 'Berry', timer: 0, growthTime: 60, ready: false };
        showDialog("Planted a Berry Seed!", 2000);
    }

    harvestCrop(x, y) {
        const key = `${x},${y}`;
        const crop = this.crops[key];
        if (crop && crop.ready) {
            if (!this.player.bag['Berry']) this.player.bag['Berry'] = 0;
            this.player.bag['Berry'] += 3; 
            delete this.crops[key];
            showDialog("Harvested 3 Berries!", 2000);
            return true;
        }
        return false;
    }

    getSaveData() {
        return { 
            nodes: this.nodes, 
            crops: this.crops, 
            respawnQueue: this.respawnQueue,
            // Convert Set to Array for JSON saving
            generatedChunks: Array.from(this.generatedChunks) 
        };
    }

    loadSaveData(data) {
        this.nodes = data.nodes || {};
        this.crops = data.crops || {};
        this.respawnQueue = data.respawnQueue || [];
        
        // Load generated chunks list to prevent re-spawning in old areas
        if (data.generatedChunks) {
            this.generatedChunks = new Set(data.generatedChunks);
        } else {
            // BACKWARDS COMPATIBILITY:
            // If loading an old save without chunk data, we assume
            // nothing is "officially" generated, which lets the
            // updateChunks() function run and fill in the world
            // around the player immediately.
            this.generatedChunks = new Set();
        }
    }
}