class ResourceSystem {
    constructor(player, world) {
        this.player = player;
        this.world = world;
        
        // Storage format: "x,y" => { type, hp, maxHp, state }
        this.nodes = {}; 
        this.crops = {}; 
        
        // NEW: Stores nodes waiting to respawn
        this.respawnQueue = []; 

        this.TYPES = {
            'tree': { hp: 3, loot: 'Wood', color: '#2ecc71', icon: '🌲', xp: 5 },
            'rock': { hp: 5, loot: 'Stone', color: '#95a5a6', icon: '🪨', xp: 5 },
            'ore_coal': { hp: 8, loot: 'Coal', color: '#2c3e50', icon: '⚫', xp: 10 },
            'ore_iron': { hp: 12, loot: 'Iron Ore', color: '#e67e22', icon: '🔩', xp: 15 },
            'ore_gold': { hp: 20, loot: 'Gold Ore', color: '#f1c40f', icon: '🧈', xp: 25 },
            'ore_obsidian': { hp: 30, loot: 'Obsidian', color: '#8e44ad', icon: '🔮', xp: 50 }
        };
    }

    // Called once on new game to populate world
    generate() {
        console.log("Generating Resources...");
        let count = 0;
        
        // UPDATED: Increased from 200 to 2000 for 10x Density
        for(let i=0; i<2000; i++) {
            let x = Math.floor(Math.random() * 200) - 100;
            let y = Math.floor(Math.random() * 200) - 100;
            const key = `${x},${y}`;

            // Don't spawn on top of existing stuff
            if (this.nodes[key] || this.world.isBlocked(x, y)) continue;

            const tile = this.world.getTile(x, y);
            let type = null;

            // Biome Specific Spawning
            if (tile === 'grass' || tile === 'grass_tall') {
                if (Math.random() < 0.7) type = 'tree';
                else type = 'rock';
            } 
            else if (tile === 'sand') {
                if (Math.random() < 0.5) type = 'rock';
                else type = 'ore_coal'; // Coal in desert
            }
            else if (tile === 'snow') {
                if (Math.random() < 0.6) type = 'tree'; // Snowy trees
                else type = 'ore_iron'; // Iron in snow
            }

            // Rare Ores (Anywhere)
            if (Math.random() < 0.05) type = 'ore_gold';
            if (Math.random() < 0.01) type = 'ore_obsidian';

            if (type) {
                this.nodes[key] = {
                    type: type,
                    hp: this.TYPES[type].hp,
                    maxHp: this.TYPES[type].hp
                };
                count++;
            }
        }
        console.log(`Spawned ${count} resources.`);
    }

    // Called by RPGSystem when player attacks
    checkHit(x, y, damage) {
        const key = `${Math.round(x)},${Math.round(y)}`;
        const node = this.nodes[key];

        if (node) {
            // Damage the node
            node.hp -= damage;
            
            // Visual feedback
            if (typeof renderer !== 'undefined') {
                renderer.addParticle(x, y); 
            }
            playSFX('sfx-attack2'); // Hit sound

            // Check destruction
            if (node.hp <= 0) {
                this.harvest(key, node);
            }
            return true; // Hit successful
        }
        return false;
    }

    harvest(key, node) {
        const data = this.TYPES[node.type];
        
        // Give Loot
        if (!this.player.bag[data.loot]) this.player.bag[data.loot] = 0;
        this.player.bag[data.loot]++;

        // Give XP (RPG System)
        if (typeof rpgSystem !== 'undefined') {
            rpgSystem.gainXP(data.xp);
        }

        showDialog(`Harvested 1 ${data.loot}! (+${data.xp} XP)`, 1000);
        
        // UPDATED: Respawn Logic
        // 1. Add to respawn queue
        this.respawnQueue.push({
            key: key,
            type: node.type,
            timer: 30.0 // 30 Seconds
        });

        // 2. Remove Node from map (so it disappears)
        delete this.nodes[key];
    }

    // Farming & Respawn Logic
    update(dt) {
        // 1. Grow Crops
        for (let key in this.crops) {
            let crop = this.crops[key];
            if (!crop.ready) {
                crop.timer += dt;
                if (crop.timer >= crop.growthTime) {
                    crop.ready = true;
                }
            }
        }

        // 2. UPDATED: Handle Respawning Nodes
        // Iterate backwards so we can remove items safely
        for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
            let item = this.respawnQueue[i];
            item.timer -= dt;

            // If timer is up, respawn it
            if (item.timer <= 0) {
                // Restore the node to the map
                this.nodes[item.key] = {
                    type: item.type,
                    hp: this.TYPES[item.type].hp,
                    maxHp: this.TYPES[item.type].hp
                };
                
                // Remove from queue
                this.respawnQueue.splice(i, 1);
                
                // Optional: Play a sound or effect when it pops back?
                // playSFX('sfx-pop'); 
            }
        }
    }

    plant(x, y, seedType) {
        const key = `${x},${y}`;
        if (this.nodes[key] || this.crops[key]) {
            showDialog("Something is already here!", 1000);
            return;
        }

        // Logic for planting (Basic Berry for now)
        this.crops[key] = {
            type: 'Berry',
            timer: 0,
            growthTime: 60, // 60 Seconds to grow
            ready: false
        };
        showDialog("Planted a Berry Seed!", 2000);
    }

    harvestCrop(x, y) {
        const key = `${x},${y}`;
        const crop = this.crops[key];
        
        if (crop && crop.ready) {
            if (!this.player.bag['Berry']) this.player.bag['Berry'] = 0;
            this.player.bag['Berry'] += 3; // Yield 3
            
            delete this.crops[key];
            showDialog("Harvested 3 Berries!", 2000);
            return true;
        }
        return false;
    }

    // Save/Load
    getSaveData() {
        return { 
            nodes: this.nodes, 
            crops: this.crops,
            respawnQueue: this.respawnQueue // Save the queue so timers don't reset on reload
        };
    }

    loadSaveData(data) {
        this.nodes = data.nodes || {};
        this.crops = data.crops || {};
        this.respawnQueue = data.respawnQueue || [];

        // --- AUTO-FIX FOR OLD SAVES ---
        // Check how many nodes exist. If it's low (like the old 200 limit),
        // we run generate() again to "top up" the world to the new 2000 limit.
        const currentCount = Object.keys(this.nodes).length;
        
        if (currentCount < 500) { 
            console.log("Old save detected (Low Density). Injecting more resources...");
            this.generate(); // This attempts to add 2000 more nodes, filling empty spots
            
            // Show a message so you know it worked
            setTimeout(() => {
                if (typeof showDialog === 'function') {
                    showDialog("World Resources Replenished!", 3000);
                }
            }, 1000);
        }
    }
}