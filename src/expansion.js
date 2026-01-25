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
            { type: 'kill', label: 'Hunt', target: 5 + Math.floor(level/2), reward: 'Money' },
            { type: 'collect', label: 'Supply', target: 10 + level, item: 'Wood', reward: 'Item' },
            { type: 'rare', label: 'Elite', target: 1, reward: 'Rare' }
        ];

        for(let i=0; i<3; i++) {
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
                const res = ['Wood', 'Stone', 'Iron Ore'][Math.floor(Math.random()*3)];
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

    updateProgress(type, amount=1) {
        this.tasks.forEach(t => {
            if (!t.completed && t.type === type) {
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
                                <div class="bar" style="width:${(t.current/t.target)*100}%"></div>
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

        playSFX('sfx-pickup');
        document.getElementById('bounty-ui').remove();
        this.openUI(); // Refresh
        updateHUD();
        saveGame();
    }

    getSaveData() { return { tasks: this.tasks, lastGenerated: this.lastGenerated }; }
    loadSaveData(data) { this.tasks = data.tasks || []; this.lastGenerated = data.lastGenerated || 0; }
}

class DungeonSystem {
    constructor(player) {
        this.player = player;
        this.isActive = false;
        this.dungeonLevel = 1; // Roman Numerals I, II, III...
        
        // State
        this.playerX = 0; // Linear distance
        this.wave = 1;
        this.maxWaves = 10;
        this.enemies = []; // {x, type, hp...}
        this.chests = [];  // {x, opened}
        this.exitDoorX = 200; // Far right
        
        this.entranceLocation = null;
    }

    spawnEntrance(world, houseX, houseY) {
        // Opposite of Arena (Left side? Arena is Right/Down)
        // Let's put it Left/Up relative to house
        let ex = houseX - 15;
        let ey = houseY - 5;
        this.entranceLocation = { x: ex, y: ey };
        world.buildings.push({ type: 'dungeon_entrance', x: ex, y: ey });
    }

    enter() {
        this.isActive = true;
        this.playerX = 10; // Start slightly in
        this.wave = 1;
        this.enemies = [];
        this.chests = [];
        this.exitDoorX = 300; // Long road
        
        // Generate Level Content
        for(let i=0; i<15; i++) {
            // Random Chests along the path
            this.chests.push({ x: 30 + (i * 20) + Math.random()*10, opened: false });
        }
        
        // Initial Wave
        this.spawnWave();
        
        showDialog(`Entered Cave ${this.toRoman(this.dungeonLevel)}`, 3000);
        
        // Music Switch
        const mainMusic = document.getElementById('main-music');
        if(mainMusic) mainMusic.pause();
    }

    exit(completed) {
        this.isActive = false;
        if (completed) {
            this.dungeonLevel++;
            showDialog("Dungeon Cleared! Level Increased.", 3000);
        } else {
            showDialog("Escaped the dungeon...", 2000);
        }
        
        // Resume Music
        const mainMusic = document.getElementById('main-music');
        if(mainMusic && !liminalSystem.active) mainMusic.play().catch(e=>{});
        
        // Teleport back to entrance
        this.player.x = this.entranceLocation.x;
        this.player.y = this.entranceLocation.y + 2;
        saveGame();
    }

    spawnWave() {
        if (this.wave > 10) return;
        
        const count = 2 + Math.floor(this.dungeonLevel / 2);
        for(let i=0; i<count; i++) {
            this.enemies.push({
                x: this.playerX + 20 + (i*5), // Spawn ahead
                hp: 50 * this.dungeonLevel,
                maxHp: 50 * this.dungeonLevel,
                type: 'shadow_beast',
                attackTimer: 0
            });
        }
        showDialog(`Wave ${this.wave}/10 Incoming!`, 2000);
    }

    update(dt) {
        if (!this.isActive) return;

        // 1. Controls (Side Scroller - Only Right/Left)
        if (input.isDown('ArrowRight') || input.isDown('d')) {
            this.playerX += 5 * dt;
        }
        if (input.isDown('ArrowLeft') || input.isDown('a')) {
            this.playerX -= 5 * dt;
        }
        if (this.playerX < 0) this.playerX = 0; // Wall

        // 2. Camera Follow (Simplified)
        // Player is visually centered, world moves around them in draw()

        // 3. Enemy Logic
        // They move left towards player
        let enemiesAlive = false;
        for(let i = this.enemies.length-1; i>=0; i--) {
            let e = this.enemies[i];
            if (e.hp <= 0) {
                this.enemies.splice(i, 1);
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
        if (!enemiesAlive && this.enemies.length === 0 && this.wave <= 10) {
            this.wave++;
            if (this.wave <= 10) {
                setTimeout(() => this.spawnWave(), 2000);
            } else {
                showDialog("The Exit revealed itself!", 3000);
            }
        }

        // 4. Exit Door
        if (this.wave > 10 && Math.abs(this.playerX - this.exitDoorX) < 2) {
            this.exit(true);
        }
    }

    // Handle Tap Interactions inside Dungeon
    handleTap(screenX, canvasWidth) {
        if (!this.isActive) return;
        
        // Convert screen X to dungeon X
        // In draw(), player is at center. 
        // drawX = (objX - playerX) * 48 + centerX
        // So: clickX = (objX - playerX) * 48 + centerX
        // objX = ((clickX - centerX) / 48) + playerX
        
        const centerX = canvasWidth / 2;
        const TILE = 64; // Scale used in draw
        const worldClickX = ((screenX - centerX) / TILE) + this.playerX;

        // Check Chests
        for(let c of this.chests) {
            if (!c.opened && Math.abs(worldClickX - c.x) < 1.0) {
                this.openChest(c);
                return;
            }
        }

        // Attack Enemies (Tap to hit)
        for(let i=0; i<this.enemies.length; i++) {
            let e = this.enemies[i];
            if (Math.abs(worldClickX - e.x) < 1.5) {
                let dmg = (typeof rpgSystem !== 'undefined') ? rpgSystem.getDamage() : 10;
                e.hp -= dmg;
                playSFX('sfx-attack1');
                
                // Visual feedback
                // (Simplified)
                return;
            }
        }
    }

    openChest(c) {
        c.opened = true;
        playSFX('sfx-pickup');
        
        // RNG Loot
        const rand = Math.random();
        let msg = "";
        
        if (rand < 0.3) {
            const gold = Math.floor(Math.random() * 2700) + 300;
            this.player.money += gold;
            msg = `Found $${gold}!`;
        } else if (rand < 0.7) {
            const resType = ['Obsidian', 'Gold Ore', 'Iron Ore'][Math.floor(Math.random()*3)];
            const qty = Math.floor(Math.random() * 80) + 20;
            if (!this.player.bag[resType]) this.player.bag[resType] = 0;
            this.player.bag[resType] += qty;
            msg = `Found ${qty} ${resType}!`;
        } else {
            // Rare
            if (!this.player.bag['Rare Candy']) this.player.bag['Rare Candy'] = 0;
            this.player.bag['Rare Candy'] += 1;
            msg = `Found a Rare Candy!`;
        }
        
        showDialog(msg, 1500);
        updateHUD();
    }

    draw(ctx, canvas) {
        // Clear Black
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const TILE = 64;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Helper to get screen X
        const getX = (wx) => (wx - this.playerX) * TILE + centerX;

        // 1. Draw Floor (Grey Road)
        ctx.fillStyle = '#333';
        ctx.fillRect(0, centerY + 30, canvas.width, 100);

        // 2. Draw Player (Always Center)
        const pImg = new Image();
        // Use active pokemon or player sprite? Let's use active pokemon
        if (this.player.team[0]) {
            pImg.src = this.player.team[0].backSprite; 
            ctx.drawImage(pImg, centerX - 32, centerY - 32, 64, 64);
        } else {
            ctx.fillStyle = 'white';
            ctx.fillRect(centerX - 10, centerY - 10, 20, 20);
        }

        // 3. Draw Chests
        this.chests.forEach(c => {
            let cx = getX(c.x);
            // Only draw if visible on screen
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
                
                // HP Bar
                ctx.fillStyle = 'black';
                ctx.fillRect(ex - 20, centerY - 40, 40, 5);
                ctx.fillStyle = 'red';
                ctx.fillRect(ex - 20, centerY - 40, 40 * (e.hp/e.maxHp), 5);
            }
        });

        // 5. Draw Exit
        if (this.wave > 10) {
            let dx = getX(this.exitDoorX);
            if (dx > -100 && dx < canvas.width + 100) {
                ctx.fillStyle = 'white';
                ctx.fillRect(dx, centerY - 60, 60, 100);
                ctx.fillStyle = 'black';
                ctx.fillText("EXIT", dx + 30, centerY);
            }
        }

        // 6. LIGHTING / FOG (The Secret Sauce)
        // Check for Night Vision Goggles
        const hasGoggles = (typeof rpgSystem !== 'undefined' && rpgSystem.equipment.accessory && rpgSystem.equipment.accessory.id === 'acc_goggles');

        if (hasGoggles) {
            // Night Vision Mode: Green Tint overlay
            ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Scanlines
            ctx.fillStyle = 'rgba(0, 50, 0, 0.2)';
            for(let i=0; i<canvas.height; i+=4) {
                ctx.fillRect(0, i, canvas.width, 1);
            }
            
            ctx.fillStyle = '#0f0';
            ctx.font = "12px monospace";
            ctx.fillText("NVG ACTIVE", 10, 20);

        } else {
            // Darkness Mode: Radial Gradient
            // We draw a black rectangle over everything, but cut a hole in the middle
            
            const grad = ctx.createRadialGradient(centerX, centerY, 50, centerX, centerY, 300);
            grad.addColorStop(0, "rgba(0,0,0,0)"); // Clear center
            grad.addColorStop(0.5, "rgba(0,0,0,0.8)");
            grad.addColorStop(1, "rgba(0,0,0,1)"); // Solid black edges

            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // HUD
        ctx.fillStyle = 'white';
        ctx.font = "20px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`CAVE ${this.toRoman(this.dungeonLevel)} - WAVE ${this.wave}/10`, 20, 50);
    }

    toRoman(num) {
        if (num === 1) return 'I';
        if (num === 2) return 'II';
        if (num === 3) return 'III';
        if (num === 4) return 'IV';
        if (num === 5) return 'V';
        return num.toString();
    }

    getSaveData() { return { level: this.dungeonLevel }; }
    loadSaveData(data) { this.dungeonLevel = data.level || 1; }
}