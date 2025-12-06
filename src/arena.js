/**
 * Arena System - Endless Boss Battle Mode
 * Features:
 * - Spawns pyramid building on Day 2
 * - Fully-evolved Pokemon bosses with massive scaling
 * - Legendary Pokemon unlocked after Stage 10
 * - Persistent save/load of arena progression
 * - Catch defeated bosses with arena stats
 */

class ArenaSystem {
    constructor(player) {
        this.player = player;
        this.stage = 1;
        this.pyramidLocation = null; // {x, y}
        this.hasSpawned = false; // Track if pyramid has been placed

        // Fully Evolved Pokemon IDs for Bosses
        this.bossPool = [
            3, 6, 9, 12, 15, 18, 26, 31, 34, 36, 40, 45, 62, 65, 68, 71, 76,
            80, 82, 85, 87, 89, 91, 94, 97, 99, 101, 103, 105, 106, 107, 108,
            110, 112, 115, 117, 119, 121, 122, 127, 130, 131, 134, 135, 136,
            139, 141, 142, 143, 148, 149
        ];

        // Legendary IDs (Unlock after Stage 10)
        this.legendaries = [144, 145, 146, 150, 151];

        // Shuffle the pool on initialization
        this.shuffledPool = this.shuffleArray([...this.bossPool]);
        this.poolIndex = 0;
    }

    /**
     * Shuffle array using Fisher-Yates algorithm
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Get next boss ID in rotation
     */
    getNextBossId() {
        let pool = [...this.bossPool];

        // Add legendaries after stage 10
        if (this.stage > 10) {
            pool = pool.concat(this.legendaries);
        }

        // Use pool index to ensure all bosses are used before repeating
        if (this.poolIndex >= this.shuffledPool.length) {
            // Reshuffle and restart
            this.shuffledPool = this.shuffleArray([...pool]);
            this.poolIndex = 0;
        }

        const bossId = this.shuffledPool[this.poolIndex];
        this.poolIndex++;
        return bossId;
    }

    /**
     * Called in game loop to check if pyramid should spawn
     */
    checkSpawn(world, gameDays) {
        // Only spawn once, on Day 2 or later
        if (gameDays >= 2 && !this.hasSpawned && !this.pyramidLocation) {
            this.spawnPyramid(world);
        }
    }

    /**
     * Spawn the pyramid building near the player
     */
    spawnPyramid(world) {
        // Calculate position within 10-20 tiles from player
        const distance = 10 + Math.floor(Math.random() * 10); // 10-20 tiles
        const angle = Math.random() * Math.PI * 2; // Random direction

        let x = Math.round(this.player.x + Math.cos(angle) * distance);
        let y = Math.round(this.player.y + Math.sin(angle) * distance);

        // Find valid land (not water)
        let attempts = 0;
        while (attempts < 50) {
            if (world.getTile(x, y) !== 'water') {
                this.pyramidLocation = { x: x, y: y };
                this.hasSpawned = true;

                // Add to world buildings
                world.buildings.push({
                    type: 'arena',
                    x: x,
                    y: y
                });

                showDialog(
                    '⚠️ A mysterious Pyramid appeared nearby!',
                    4000
                );
                return;
            }

            // Try new random location
            x = Math.round(
                this.player.x + Math.cos(Math.random() * Math.PI * 2) * distance
            );
            y = Math.round(
                this.player.y + Math.sin(Math.random() * Math.PI * 2) * distance
            );
            attempts++;
        }

        console.warn('Could not find valid spawn location for pyramid');
    }

    /**
     * Player enters the arena
     */
    enter() {
        // Check if player has any Pokemon
        if (this.player.team.length === 0) {
            showDialog('You need Pokemon to enter the Arena!', 3000);
            return;
        }

        // Show confirmation
        setTimeout(() => {
            if (
                confirm(
                    `Enter Arena Stage ${this.stage}?\n\nFace a powerful boss and earn rewards!`
                )
            ) {
                this.startBossBattle();
            }
        }, 100);
    }

    /**
     * Start the boss battle
     */
    async startBossBattle() {
        // 1. Determine Boss ID
        const bossId = this.getNextBossId();

        // 2. Calculate Boss Level & Stats
        // Level increases by 5 every stage, starting at 20
        const bossLevel = 20 + this.stage * 5;

        // 3. Trigger Battle with Boss Flag
        // We pass arena boss configuration
        battleSystem.startBattle(false, 0, true, {
            id: bossId,
            level: bossLevel,
            stage: this.stage
        });
    }

    /**
     * Called when player wins a stage
     */
    winStage() {
        // 1. Calculate Rewards
        const moneyReward = 1000 + this.stage * 500;
        this.player.money += moneyReward;

        // 2. Item Rewards (random)
        const items = [
            'Ultra Ball',
            'Hyper Potion',
            'Rare Candy',
            'Full Restore'
        ];
        const wonItem = items[Math.floor(Math.random() * items.length)];
        if (!this.player.bag[wonItem]) this.player.bag[wonItem] = 0;
        this.player.bag[wonItem] += 2;

        showDialog(
            `🏆 VICTORY! Stage ${this.stage} Complete!\n💰 Earned $${moneyReward}\n🎁 Received 2x ${wonItem}`,
            5000
        );

        // 3. Progress to next stage
        this.stage++;

        // 4. Heal Player slightly (not full, to maintain challenge)
        this.player.team.forEach((p) => {
            if (p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + 50);
        });

        // Update HUD
        if (typeof updateHUD === 'function') {
            updateHUD();
        }

        // 5. Ask if player wants to continue or leave
        setTimeout(() => {
            const continueArena = confirm(
                `Continue to Stage ${this.stage}?\n\n(Cancel to return to world)`
            );
            if (continueArena) {
                // Wait a moment, then start next battle
                setTimeout(() => {
                    this.startBossBattle();
                }, 500);
            } else {
                showDialog('Returning to the world...', 2000);
            }
        }, 1000);
    }

    /**
     * Serialize arena data for saving
     */
    getSaveData() {
        return {
            stage: this.stage,
            pyramidLocation: this.pyramidLocation,
            hasSpawned: this.hasSpawned,
            poolIndex: this.poolIndex,
            shuffledPool: this.shuffledPool
        };
    }

    /**
     * Load arena data from save
     */
    loadSaveData(data) {
        this.stage = data.stage || 1;
        this.pyramidLocation = data.pyramidLocation || null;
        this.hasSpawned = data.hasSpawned || false;
        this.poolIndex = data.poolIndex || 0;
        this.shuffledPool = data.shuffledPool || this.shuffleArray([
            ...this.bossPool
        ]);
    }
}
