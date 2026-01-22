/**
 * Arena System - Diablo Tier Progression
 * Features:
 * - Spawns pyramid building on Day 2
 * - Fixed Progression: Stages 1-151 (Venusaur -> Mew)
 * - Tiers: I, II, III... (Resets to Stage 1 but higher level)
 * - Shiny Bosses: 5% normally, 100% for Legends/High Tiers
 */

class ArenaSystem {
    constructor(player) {
        this.player = player;

        // --- PROGRESSION STATE ---
        this.globalStageCount = 1; // Total stages cleared (e.g., 152 = Tier 2, Stage 1)
        this.currentBossData = null; // Stores active boss until defeated

        // --- MAP STATE ---
        this.pyramidLocation = null; // {x, y}
        this.hasSpawned = false; // Track if pyramid has been placed
    }

    // ==========================================
    //      TIER & STAGE CALCULATION
    // ==========================================

    getTier() {
        return Math.floor((this.globalStageCount - 1) / 151) + 1;
    }

    getRelativeStage() {
        return ((this.globalStageCount - 1) % 151) + 1;
    }

    getRomanTier() {
        const tier = this.getTier();
        const romans = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
        return romans[tier] || `T${tier}`;
    }

    getBossID() {
        const dexNum = this.getRelativeStage();

        // 1. Legendaries are strictly slotted
        if (dexNum === 150) return 150; // Mewtwo
        if (dexNum === 151) return 151; // Mew

        // 2. Map Base Forms to Final Evolutions
        const FINAL_EVO_MAP = {
            1: 3, 2: 3, 3: 3, 4: 6, 5: 6, 6: 6, 7: 9, 8: 9, 9: 9,
            10: 12, 11: 12, 12: 12, 13: 15, 14: 15, 15: 15, 16: 18, 17: 18, 18: 18,
            19: 20, 20: 20, 21: 22, 22: 22, 23: 24, 24: 24,
            25: 26, 26: 26, 27: 28, 28: 28, 29: 31, 30: 31, 31: 31,
            32: 34, 33: 34, 34: 34, 35: 36, 36: 36, 37: 38, 38: 38,
            39: 40, 40: 40, 41: 42, 42: 42, 43: 45, 44: 45, 45: 45,
            46: 47, 47: 47, 48: 49, 49: 49, 50: 51, 51: 51,
            52: 53, 53: 53, 54: 55, 55: 55, 56: 57, 57: 57,
            58: 59, 59: 59, 60: 62, 61: 62, 62: 62, 63: 65, 64: 65, 65: 65,
            66: 68, 67: 68, 68: 68, 69: 71, 70: 71, 71: 71, 72: 73, 73: 73,
            74: 76, 75: 76, 76: 76, 77: 78, 78: 78, 79: 80, 80: 80,
            81: 82, 82: 82, 83: 83, 84: 85, 85: 85,
            86: 87, 87: 87, 88: 89, 89: 89, 90: 91, 91: 91,
            92: 94, 93: 94, 94: 94, 95: 95, 96: 97, 97: 97,
            98: 99, 99: 99, 100: 101, 101: 101, 102: 103, 103: 103,
            104: 105, 105: 105, 106: 106, 107: 107,
            108: 108, 109: 110, 110: 110, 111: 112, 112: 112,
            113: 113, 114: 114, 115: 115,
            116: 117, 117: 117, 118: 119, 119: 119, 120: 121, 121: 121,
            122: 122, 123: 123, 124: 124,
            125: 125, 126: 126, 127: 127,
            128: 128, 129: 130, 130: 130, 131: 131,
            132: 132, 133: 134, 134: 134, 135: 135, 136: 136,
            137: 137, 138: 139, 139: 139, 140: 141, 141: 141,
            142: 142, 143: 143, 144: 144, 145: 145, 146: 146,
            147: 149, 148: 149, 149: 149
        };

        // If dexNum corresponds to something in map, return that. Otherwise return dexNum itself.
        return FINAL_EVO_MAP[dexNum] || dexNum;
    }

    // ==========================================
    //      MAP SPAWNING & INTERACTION
    // ==========================================

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
        const distance = 10 + Math.floor(Math.random() * 10);
        const angle = Math.random() * Math.PI * 2;

        let x = Math.round(this.player.x + Math.cos(angle) * distance);
        let y = Math.round(this.player.y + Math.sin(angle) * distance);

        let attempts = 0;
        while (attempts < 50) {
            if (world.getTile(x, y) !== 'water') {
                this.pyramidLocation = { x: x, y: y };
                this.hasSpawned = true;
                world.buildings.push({ type: 'arena', x: x, y: y });

                showDialog('⚠️ A mysterious Pyramid appeared nearby!', 4000);
                return;
            }
            x = Math.round(this.player.x + Math.cos(Math.random() * Math.PI * 2) * distance);
            y = Math.round(this.player.y + Math.sin(Math.random() * Math.PI * 2) * distance);
            attempts++;
        }
        console.warn('Could not find valid spawn location for pyramid');
    }

    /**
     * Player enters the arena (Interaction Trigger)
     */
    enter() {
        if (this.player.team.length === 0) {
            showDialog('You need Pokemon to enter the Arena!', 3000);
            return;
        }

        const tier = this.getTier();
        const stage = this.getRelativeStage();

        setTimeout(() => {
            if (confirm(`Enter Arena Tier ${this.getRomanTier()} - Stage ${stage}?\n\nBoss: #${this.getBossID()} (Evolution Force)`)) {
                this.startBossBattle();
            }
        }, 100);
    }


    // ==========================================
    //      RENDERING
    // ==========================================

    draw(ctx, canvas, player) {
        if (!this.pyramidLocation) return;

        // Calculate screen position
        const TILE_SIZE = 80; // Must match world.js TILE_SIZE
        let drawX = (this.pyramidLocation.x - player.x) * TILE_SIZE + canvas.width / 2 - TILE_SIZE / 2;
        let drawY = (this.pyramidLocation.y - player.y) * TILE_SIZE + canvas.height / 2 - TILE_SIZE / 2;

        // Only draw if roughly on screen (optimization)
        if (drawX < -TILE_SIZE * 3 || drawX > canvas.width + TILE_SIZE * 3 ||
            drawY < -TILE_SIZE * 3 || drawY > canvas.height + TILE_SIZE * 3) {
            return;
        }

        // Draw Pyramid Base (Large Gold Triangle)
        ctx.fillStyle = '#f1c40f'; // Gold

        // Draw larger than a single tile (3x size)
        const size = TILE_SIZE * 3;
        const centerX = drawX + TILE_SIZE / 2;
        const bottomY = drawY + TILE_SIZE * 1.5;

        ctx.beginPath();
        ctx.moveTo(centerX, bottomY - size); // Top
        ctx.lineTo(centerX - size / 2, bottomY); // Bottom Left
        ctx.lineTo(centerX + size / 2, bottomY); // Bottom Right
        ctx.closePath();
        ctx.fill();

        // Border
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#d4ac0d'; // Darker Gold
        ctx.stroke();
        ctx.lineWidth = 1; // Reset

        // Label
        ctx.fillStyle = '#000';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("ARENA", centerX, bottomY + 20);

        // Tier Label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`Tier ${this.getRomanTier()}`, centerX, bottomY - size / 3);
    }

    // ==========================================
    //      BATTLE LOGIC
    // ==========================================

    startBossBattle() {
        // 1. Determine Boss ID
        let bossId;

        // Persistence: If active boss exists for this exact global stage, reuse it
        if (this.currentBossData && this.currentBossData.globalStage === this.globalStageCount) {
            bossId = this.currentBossData.id;
        } else {
            // New Boss
            bossId = this.getBossID();

            // Random Eeveelution check (if ID maps to Vaporeon/Jolteon/Flareon via 133 logic)
            // But getBossID() handles mapping. We just handle the special case if it returns 134 from 133
            // Actually, let's keep it deterministic unless you want randomness. 
            // The mapping sets 133 -> 134. We can randomize 134/135/136 here if we want VARIETY.
            if (bossId === 134) {
                const eevees = [134, 135, 136];
                bossId = eevees[Math.floor(Math.random() * 3)];
            }

            this.currentBossData = {
                id: bossId,
                globalStage: this.globalStageCount
            };
        }

        // 2. Calculate Stats based on Tier
        const tier = this.getTier();
        const relativeStage = this.getRelativeStage();

        // Tier 1 Base = 25. Tier 2 Base = 50. Tier 3 Base = 75.
        const tierBaseLevel = 25 * tier;
        const stageBonus = Math.floor(relativeStage / 3);
        const finalLevel = tierBaseLevel + stageBonus;

        // Shiny Logic
        // 5% default. 100% for Legends (150/151/Birds) or Tier 5+
        const isLegend = (relativeStage >= 144 && relativeStage <= 146) || relativeStage >= 150;
        const isShiny = (tier >= 5 || Math.random() < 0.05);

        // 3. Start Battle
        battleSystem.startBattle(false, 0, true, {
            id: bossId,
            level: finalLevel,
            isShiny: isShiny,
            stage: `${this.getRomanTier()} - ${relativeStage}`
        });
    }

    winStage() {
        const tier = this.getRomanTier();
        const stage = this.getRelativeStage();

        // Rewards
        const moneyReward = 1000 + this.globalStageCount * 50;
        this.player.money += moneyReward;

        // Items
        const items = ['Ultra Ball', 'Hyper Potion', 'Rare Candy', 'Full Restore'];
        const wonItem = items[Math.floor(Math.random() * items.length)];
        this.player.bag[wonItem] = (this.player.bag[wonItem] || 0) + 2;

        showDialog(`🏆 VICTORY! Tier ${tier}-${stage} Cleared!\n💰 +$${moneyReward}\n🎁 +2 ${wonItem}`, 5000);

        // Advance
        this.globalStageCount++;
        this.currentBossData = null; // Clear persistence for next stage

        // Small Heal
        this.player.team.forEach((p) => {
            if (p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + 50);
        });

        if (typeof updateHUD === 'function') updateHUD();

        // Prompt Next
        setTimeout(() => {
            if (confirm(`Challenge next stage immediately?`)) {
                setTimeout(() => this.startBossBattle(), 500);
            } else {
                showDialog('Returning to world...', 2000);
            }
        }, 1500);
    }

    // ==========================================
    //      SAVE SYSTEM
    // ==========================================

    getSaveData() {
        return {
            globalStageCount: this.globalStageCount,
            pyramidLocation: this.pyramidLocation,
            hasSpawned: this.hasSpawned,
            currentBossData: this.currentBossData
        };
    }

    loadSaveData(data) {
        this.globalStageCount = data.globalStageCount || 1;
        this.pyramidLocation = data.pyramidLocation || null;
        this.hasSpawned = data.hasSpawned || false;
        this.currentBossData = data.currentBossData || null;

        // Backwards compatibility for old save files using 'stage'
        if (data.stage && !data.globalStageCount) {
            this.globalStageCount = data.stage;
        }
    }
}
