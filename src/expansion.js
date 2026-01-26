class BountySystem {
    constructor(player) {
        this.player = player;
        this.tasks = [];
        this.lastGenerated = 0;
        this.boardLocation = null;

        // Generate initial tasks if empty
        this.checkDailyRefresh();
    }

    spawnBoard(world, houseX, houseY) {
        // Spawn 5 tiles LEFT of the house
        this.boardLocation = { x: houseX - 5, y: houseY };
        // Add to world so it has collision
        world.buildings.push({ type: 'bounty_board', x: this.boardLocation.x, y: this.boardLocation.y });
    }

    checkDailyRefresh() {
        const now = Date.now();
        // Refresh if 24 hours passed or no tasks exist
        if (this.tasks.length === 0 || now - this.lastGenerated > 86400000) {
            this.generateTasks();
        }
    }

    generateTasks() {
        this.tasks = [];
        this.lastGenerated = Date.now();
        const level = this.player.pLevel || 1;

        // Task Types
        const types = [
            { type: 'kill', label: 'Hunt', target: 5 + Math.floor(level / 2), reward: 'Money' },
            { type: 'collect', label: 'Supply', target: 10 + level, item: 'Wood', reward: 'Item' },
            { type: 'rare', label: 'Elite', target: 1, reward: 'Rare' }
        ];

        for (let i = 0; i < 3; i++) {
            let t = types[i];
            let task = {
                id: Date.now() + i,
                type: t.type,
                desc: "",
                current: 0,
                target: t.target,
                completed: false,
                claimed: false,
                reward: {}
            };

            // Custom Logic per type
            if (t.type === 'kill') {
                task.desc = `Defeat ${task.target} Wild Pokemon`;
                task.reward = { money: 500 * level };
            } else if (t.type === 'collect') {
                const res = ['Wood', 'Stone', 'Iron Ore'][Math.floor(Math.random() * 3)];
                task.reqItem = res;
                task.desc = `Collect ${task.target} ${res}`;
                task.reward = { money: 200 * level, item: 'Great Ball', qty: 5 };
            } else {
                task.desc = "Catch or Defeat a Shiny or Boss";
                task.reward = { item: 'Rare Candy', qty: 2 };
            }
            this.tasks.push(task);
        }
    }

    updateProgress(type, amount = 1, itemName = null) {
        this.tasks.forEach(t => {
            if (!t.completed && t.type === type) {
                // For collect tasks, match the item name
                if (type === 'collect' && t.reqItem !== itemName) return;

                t.current += amount;
                if (t.current >= t.target) {
                    t.current = t.target;
                    t.completed = true;
                    showDialog(`BOUNTY COMPLETE: ${t.desc}! Check Board.`, 3000);
                }
            }
        });
    }

    interact() {
        this.checkDailyRefresh();
        this.openUI();
    }

    openUI() {
        const modal = document.createElement('div');
        modal.id = 'bounty-ui';
        modal.className = 'full-screen-modal';
        modal.innerHTML = `
            <div class="bounty-board-frame">
                <div class="bounty-header">⚡ DAILY OPS ⚡</div>
                <div class="bounty-grid">
                    ${this.tasks.map((t, i) => `
                        <div class="bounty-card ${t.completed ? 'done' : ''} ${t.claimed ? 'claimed' : ''}">
                            <div class="bounty-title">${t.desc}</div>
                            <div class="bounty-progress">
                                <div class="bar" style="width:${(t.current / t.target) * 100}%"></div>
                            </div>
                            <div class="bounty-status">${t.current} / ${t.target}</div>
                            <button onclick="bountySystem.claim(${i})" ${t.completed && !t.claimed ? '' : 'disabled'}>
                                ${t.claimed ? 'CLAIMED' : (t.completed ? 'COLLECT REWARD' : 'IN PROGRESS')}
                            </button>
                        </div>
                    `).join('')}
                </div>
                <button class="back-btn" onclick="document.getElementById('bounty-ui').remove()">LEAVE</button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    claim(index) {
        const t = this.tasks[index];
        if (!t.completed || t.claimed) return;

        t.claimed = true;

        // Give Rewards
        if (t.reward.money) this.player.money += t.reward.money;
        if (t.reward.item) {
            if (!this.player.bag[t.reward.item]) this.player.bag[t.reward.item] = 0;
            this.player.bag[t.reward.item] += t.reward.qty;
        }

        let msg = `Claimed: ${t.desc}!`;
        if (t.reward.money) msg += ` +$${t.reward.money}`;
        if (t.reward.item) msg += ` +${t.reward.qty} ${t.reward.item}`;
        showDialog(msg, 3000);

        playSFX('sfx-pickup');
        document.getElementById('bounty-ui').remove();
        this.openUI(); // Refresh
        updateHUD();
        saveGame();
    }

    getSaveData() { return { tasks: this.tasks, lastGenerated: this.lastGenerated }; }
    loadSaveData(data) { this.tasks = data.tasks || []; this.lastGenerated = data.lastGenerated || 0; }
}

/**
 * @typedef {Object} DungeonEnemy
 * @property {number} x
 * @property {number} hp
 * @property {number} maxHp
 * @property {string} type
 * @property {number} attackTimer
 */

class DungeonSystem {
    constructor(player) {
        this.player = player;
        this.isActive = false;
        this.dungeonLevel = 1; // Roman Numerals I, II, III...
        this.imageRepo = {}; // Cache for pokemon sprites
        this.playerX = 10; // Linear distance

        // State
        this.wave = 1;
        this.savedWave = 1; // Used to resume progress
        this.maxWaves = 1000; // UPDATED: 1000 Waves
        
        /** @type {DungeonEnemy[]} */
        this.enemies = []; 
        this.chests = [];  
        this.exitDoorX = 200; 

        this.entranceLocation = null;
        this.playerAttackTimer = 0; 

        this.sessionXP = 0;
        this.sessionMoney = 0;
        this.isLevelCleared = false;
        this.isSpawningWave = false;
    }

    spawnEntrance(world, houseX, houseY) {
        let ex = houseX - 15;
        let ey = houseY - 5;
        this.entranceLocation = { x: ex, y: ey };
        world.buildings.push({ type: 'dungeon_entrance', x: ex, y: ey });
    }

    enter() {
        this.isActive = true;
        this.playerX = 10; 
        
        // RESUME PROGRESS
        this.wave = this.savedWave; 
        
        this.enemies = [];
        this.chests = [];
        this.exitDoorX = 300; 

        this.sessionXP = 0;
        this.sessionMoney = 0;
        this.isLevelCleared = false;
        this.isSpawningWave = false;

        // Generate Level Content
        for (let i = 0; i < 15; i++) {
            this.chests.push({ x: 30 + (i * 20) + Math.random() * 10, opened: false });
        }

        // Initial Wave
        this.spawnWave();

        showDialog(`Entered Cave ${this.toRoman(this.dungeonLevel)} - Wave ${this.wave}`, 3000);

        const mainMusic = document.getElementById('main-music');
        if (mainMusic) mainMusic.pause();
    }

    exit(completed) {
        this.isActive = false;
        
        // SAVE PROGRESS on Exit
        // If completed (finished wave 1000), reset to 1 for next level
        // If retreated, save current wave to resume later
        if (completed) {
            this.savedWave = 1;
            if (!this.isLevelCleared) this.dungeonLevel++;
            showDialog(`Dungeon Cleared! Level Increased.\nResult: +${this.sessionXP} XP, +$${this.sessionMoney}`, 5000);
        } else {
            this.savedWave = this.wave; // Save progress
            const isDead = (typeof rpgSystem !== 'undefined' && rpgSystem.hp <= 0);
            const status = isDead ? "KNOCKED OUT!" : "Escaped the dungeon...";
            showDialog(`${status}\nProgress Saved (Wave ${this.savedWave})\nResult: +${this.sessionXP} XP, +$${this.sessionMoney}`, 4000);
        }

        const mainMusic = document.getElementById('main-music');
        if (mainMusic && !liminalSystem.active) mainMusic.play().catch(e => { });

        this.player.x = this.entranceLocation.x;
        this.player.y = this.entranceLocation.y + 2;
        saveGame();
    }

    spawnWave() {
        if (this.wave > this.maxWaves) return;
        this.isSpawningWave = false;

        // --- UPDATED LOGIC ---
        
        // 1. Enemy Count: Starts at 2. Adds 1 enemy every 3 waves.
        const baseCount = 2;
        const extraEnemies = Math.floor(this.wave / 3);
        const totalCount = baseCount + extraEnemies;

        // 2. Difficulty: Doubles every wave.
        // Formula: BaseHP * (2 ^ (wave-1))
        // NOTE: We cap the power at 30 to prevent 'Infinity' crashing the game, 
        // because 2^1000 is a number larger than the universe. 
        // 2^30 is approx 1 Billion multiplier.
        const safeExponent = Math.min(this.wave - 1, 30); 
        const difficultyMult = Math.pow(2, safeExponent); 
        
        const enemyHP = (50 * this.dungeonLevel) * difficultyMult;

        for (let i = 0; i < totalCount; i++) {
            this.enemies.push({
                x: this.playerX + 20 + (i * 5),
                hp: enemyHP,
                maxHp: enemyHP,
                type: 'shadow_beast',
                attackTimer: 0
            });
        }
        showDialog(`Wave ${this.wave}/${this.maxWaves} Incoming!`, 2000);
    }

    spawnLevelClear() {
        this.isLevelCleared = true;
        // UPDATED TEXT
        showDialog("You can exit whenever you want.", 3000);
    }

    update(dt) {
        if (!this.isActive) return;

        // 1. Check Player Health
        if (typeof rpgSystem !== 'undefined' && rpgSystem.hp <= 0) {
            this.exit(false); // Die = Exit but save wave progress? Or reset? Usually die = reset, but let's keep progress for now.
            return;
        }

        // 1. Controls
        if (input.isDown('ArrowLeft') || input.isDown('a')) {
            this.playerX -= 5 * dt;
        }

        // --- AUTO BATTLE / AUTO MOVE ---
        let nearestEnemy = null;
        let minDist = Infinity;
        this.enemies.forEach(e => {
            let d = e.x - this.playerX;
            if (d > 0 && d < minDist) {
                minDist = d;
                nearestEnemy = e;
            }
        });

        // 1. Auto Attack
        if (nearestEnemy && minDist < 2.0) {
            this.playerAttackTimer += dt;
            if (this.playerAttackTimer > 0.5) {
                let dmg = (typeof rpgSystem !== 'undefined') ? rpgSystem.getDamage() : 10;
                nearestEnemy.hp -= dmg;
                playSFX('sfx-attack1');
                this.playerAttackTimer = 0;
            }
        }

        // 2. Auto Move Forward
        const shouldMove = (!nearestEnemy || minDist > 1.5) && (this.wave <= this.maxWaves || this.playerX < this.exitDoorX);

        if (shouldMove) {
            this.playerX += 4 * dt; 
        }

        if (this.playerX < 0) this.playerX = 0; 

        // 3. Enemy Logic
        let enemiesAlive = false;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            let e = this.enemies[i];
            if (e.hp <= 0) {
                this.enemies.splice(i, 1);

                // Rewards
                const xpGain = 100 * this.dungeonLevel;
                const goldGain = 50 * this.dungeonLevel;

                this.sessionXP += xpGain;
                this.sessionMoney += goldGain;

                if (typeof rpgSystem !== 'undefined') {
                    rpgSystem.gainXP(xpGain);
                    this.player.money += goldGain;
                }

                continue;
            }
            enemiesAlive = true;

            // Move left
            if (e.x > this.playerX + 1) {
                e.x -= 3 * dt;
            }

            // Attack Player
            if (Math.abs(e.x - this.playerX) < 1.5) {
                e.attackTimer += dt;
                if (e.attackTimer > 1.0) {
                    if (typeof rpgSystem !== 'undefined') rpgSystem.takeDamage(10 * this.dungeonLevel);
                    e.attackTimer = 0;
                    playSFX('sfx-attack2');
                }
            }
        }

        // Wave Logic
        if (!enemiesAlive && this.enemies.length === 0 && this.wave <= this.maxWaves && !this.isLevelCleared && !this.isSpawningWave) {
            this.isSpawningWave = true;
            if (this.wave < this.maxWaves) {
                this.wave++;
                setTimeout(() => this.spawnWave(), 2000);
            } else {
                this.spawnLevelClear();
            }
        }

        // 4. Exit Door
        if (this.isLevelCleared && Math.abs(this.playerX - this.exitDoorX) < 2) {
            this.exit(true);
        }
    }

    handleTap(screenX, screenY, canvasWidth, canvasHeight) {
        if (!this.isActive) return;

        // --- CHECK EXIT BUTTON ---
        if (this.exitBtnRect) {
            if (screenX >= this.exitBtnRect.x && screenX <= this.exitBtnRect.x + this.exitBtnRect.w &&
                screenY >= this.exitBtnRect.y && screenY <= this.exitBtnRect.y + this.exitBtnRect.h) {
                this.exit(false); // Manual exit saves progress
                return;
            }
        }

        const centerX = canvasWidth / 2;
        const TILE = 64; 
        const worldClickX = ((screenX - centerX) / TILE) + this.playerX;

        for (let c of this.chests) {
            if (!c.opened && Math.abs(worldClickX - c.x) < 1.0) {
                this.openChest(c);
                return;
            }
        }

        for (let i = 0; i < this.enemies.length; i++) {
            let e = this.enemies[i];
            if (Math.abs(worldClickX - e.x) < 1.5) {
                let dmg = (typeof rpgSystem !== 'undefined') ? rpgSystem.getDamage() : 10;
                e.hp -= dmg;
                playSFX('sfx-attack1');
                return;
            }
        }
    }

    openChest(c) {
        c.opened = true;
        playSFX('sfx-pickup');

        const rand = Math.random();
        let msg = "";

        if (rand < 0.3) {
            const gold = Math.floor(Math.random() * 2700) + 300;
            this.player.money += gold;
            this.sessionMoney += gold;
            msg = `Found $${gold}!`;
        } else if (rand < 0.7) {
            const resType = ['Obsidian', 'Gold Ore', 'Iron Ore'][Math.floor(Math.random() * 3)];
            const qty = Math.floor(Math.random() * 80) + 20;
            if (!this.player.bag[resType]) this.player.bag[resType] = 0;
            this.player.bag[resType] += qty;
            msg = `Found ${qty} ${resType}!`;
        } else {
            if (!this.player.bag['Rare Candy']) this.player.bag['Rare Candy'] = 0;
            this.player.bag['Rare Candy'] += 1;
            msg = `Found a Rare Candy!`;
        }

        showDialog(msg, 1500);
        updateHUD();
    }

    draw(ctx, canvas) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const TILE = 64;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        const getX = (wx) => (wx - this.playerX) * TILE + centerX;

        // 1. Draw Floor
        ctx.fillStyle = '#333';
        ctx.fillRect(0, centerY + 30, canvas.width, 100);

        // 2. Draw Player
        if (this.player.team[0]) {
            const src = this.player.team[0].backSprite;
            if (!this.imageRepo[src]) {
                this.imageRepo[src] = new Image();
                this.imageRepo[src].src = src;
            }
            ctx.drawImage(this.imageRepo[src], centerX - 32, centerY - 32, 64, 64);
        } else {
            ctx.fillStyle = 'white';
            ctx.fillRect(centerX - 10, centerY - 10, 20, 20);
        }

        // 3. Draw Chests
        this.chests.forEach(c => {
            let cx = getX(c.x);
            if (cx > -50 && cx < canvas.width + 50) {
                ctx.font = "30px Arial";
                ctx.textAlign = "center";
                ctx.fillText(c.opened ? "📭" : "🎁", cx, centerY + 20);
            }
        });

        // 4. Draw Enemies
        this.enemies.forEach(e => {
            let ex = getX(e.x);
            if (ex > -50 && ex < canvas.width + 50) {
                ctx.fillStyle = 'red';
                ctx.font = "30px Arial";
                ctx.fillText("👾", ex, centerY);
                ctx.fillStyle = 'black';
                ctx.fillRect(ex - 20, centerY - 40, 40, 5);
                ctx.fillStyle = 'red';
                ctx.fillRect(ex - 20, centerY - 40, 40 * (e.hp / e.maxHp), 5);
            }
        });

        // 5. Draw Exit
        if (this.isLevelCleared) {
            let dx = getX(this.exitDoorX);
            if (dx > -100 && dx < canvas.width + 100) {
                ctx.fillStyle = 'white';
                ctx.fillRect(dx, centerY - 60, 60, 100);
                ctx.fillStyle = 'black';
                ctx.fillText("EXIT", dx + 30, centerY);
            }
        }

        // 6. Lighting/HUD
        const hasGoggles = (typeof rpgSystem !== 'undefined' && rpgSystem.equipment.accessory && rpgSystem.equipment.accessory.id === 'acc_goggles');

        if (hasGoggles) {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(0, 50, 0, 0.2)';
            for (let i = 0; i < canvas.height; i += 4) {
                ctx.fillRect(0, i, canvas.width, 1);
            }
            ctx.fillStyle = '#0f0';
            ctx.font = "12px monospace";
            ctx.fillText("NVG ACTIVE", 10, 20);
        } else {
            const grad = ctx.createRadialGradient(centerX, centerY, 50, centerX, centerY, 300);
            grad.addColorStop(0, "rgba(0,0,0,0)");
            grad.addColorStop(0.5, "rgba(0,0,0,0.8)");
            grad.addColorStop(1, "rgba(0,0,0,1)");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.fillStyle = 'white';
        ctx.font = "20px monospace";
        ctx.textAlign = "left";
        const displayWave = Math.min(this.wave, this.maxWaves);
        ctx.fillText(`CAVE ${this.toRoman(this.dungeonLevel)} - WAVE ${displayWave}/${this.maxWaves}`, 20, 50);

        // EXIT BUTTON
        const btnW = 100;
        const btnH = 40;
        const btnX = 20;
        const btnY = canvas.height - 60;

        ctx.fillStyle = 'rgba(231, 76, 60, 0.8)';
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.strokeStyle = 'white';
        ctx.strokeRect(btnX, btnY, btnW, btnH);

        ctx.fillStyle = 'white';
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("EXIT CAVE", btnX + btnW / 2, btnY + btnH / 1.5);

        this.exitBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };
    }

    toRoman(num) {
        if (num === 1) return 'I';
        if (num === 2) return 'II';
        if (num === 3) return 'III';
        if (num === 4) return 'IV';
        if (num === 5) return 'V';
        return num.toString();
    }

    getSaveData() { 
        // Save both the Level AND the exact wave you are on
        return { 
            level: this.dungeonLevel, 
            wave: this.savedWave 
        }; 
    }
    
    loadSaveData(data) { 
        this.dungeonLevel = data.level || 1; 
        this.savedWave = data.wave || 1;
    }
}