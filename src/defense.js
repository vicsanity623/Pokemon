class DefenseSystem {
    constructor(player, world) {
        this.player = player;
        this.world = world;
        this.active = false;
        this.raidTimer = 300; // 5 minutes
        this.baseHealth = 1000;
        this.maxBaseHealth = 1000;

        this.defenders = Array(8).fill(null); // 8 Turret slots
        this.enemies = [];
        this.projectiles = [];

        // Turret Offsets (relative to house center)
        this.turretOffsets = [
            { x: -2, y: -2 }, { x: 0, y: -2 }, { x: 2, y: -2 },
            { x: -2, y: 0 }, { x: 2, y: 0 },
            { x: -2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 2 }
        ];

        this.waveTimer = 0;
        this.waveInterval = 200; 
        this.lastRaidDay = -1; // This is the key to preventing duplicate raids
    }

    startRaid() {
        if (this.active) return;

        console.log("BLOOD MOON RISES!");
        this.active = true;
        this.raidTimer = 300;
        this.baseHealth = 1000;
        this.enemies = [];
        this.projectiles = [];
        this.waveInterval = 200;

        // Auto-fill turrets
        this.autoFillDefenders();

        // Teleport player home immediately to defend
        if (typeof homeSystem !== 'undefined') {
            homeSystem.teleportHome();
        }

        // Show UI
        document.getElementById('raid-hud').classList.remove('hidden');
        document.getElementById('flash-overlay').classList.add('blood-moon');
        showDialog("THE BLOOD MOON IS RISING! DEFEND YOUR HOME!", 4000);
    }

    async endRaid(win) {
        this.active = false;
        document.getElementById('raid-hud').classList.add('hidden');
        document.getElementById('flash-overlay').classList.remove('blood-moon');

        if (win) {
            // --- HEFTY REWARDS ---
            const goldReward = 10000;
            const xpReward = 2000;
            
            this.player.money += goldReward;

            // Give Item Supply Drop
            const items = { 'Pokeball': 50, 'Great Ball': 25, 'Ultra Ball': 10 };
            for (let [item, count] of Object.entries(items)) {
                this.player.bag[item] = (this.player.bag[item] || 0) + count;
            }

            // Give XP to entire main team
            this.player.team.forEach(p => {
                if (!p.isEgg) p.exp += xpReward;
            });

            showDialog(`VICTORY! Obtained $${goldReward}, 2000 XP, and a massive supply of Pokéballs!`, 5000);
            playSFX('sfx-pickup');

        } else {
            showDialog("Your home was overrun... You blacked out.", 4000);
        }

        // --- FULL HEAL LOGIC ---
        // Heal main team
        this.player.team.forEach(p => { if(p) p.hp = p.maxHp; });
        
        // Heal everyone in PC Storage
        this.player.storage.flat().forEach(p => { if(p) p.hp = p.maxHp; });

        // Heal turrets (already handled by storage flat, but let's be safe)
        this.defenders.forEach(p => { if(p) p.hp = p.maxHp; });

        if (typeof updateHUD === 'function') updateHUD();
    }

    autoFillDefenders() {
        for (let i = 0; i < 8; i++) {
            if (this.defenders[i] && this.defenders[i].hp <= 0) {
                this.defenders[i] = null;
            }
        }

        let storageFlat = this.player.storage.flat().filter(p => p !== null && p.hp > 0);

        for (let i = 0; i < 8; i++) {
            if (this.defenders[i] === null) {
                if (storageFlat.length > 0) {
                    let poke = storageFlat.shift();
                    if (!this.defenders.includes(poke)) {
                        this.defenders[i] = poke;
                    }
                }
            }
        }
    }

    update(dt) {
        if (!this.active) return;

        this.raidTimer -= dt;
        if (this.raidTimer <= 0) {
            this.endRaid(true);
            return;
        }

        const mins = Math.floor(this.raidTimer / 60);
        const secs = Math.floor(this.raidTimer % 60).toString().padStart(2, '0');
        const timerEl = document.getElementById('raid-timer');
        if (timerEl) timerEl.innerText = `${mins}:${secs}`;

        const hpPercent = (this.baseHealth / this.maxBaseHealth) * 100;
        const hpFillEl = document.getElementById('raid-base-hp-fill');
        if (hpFillEl) hpFillEl.style.width = `${hpPercent}%`;

        this.waveTimer++;
        if (this.waveTimer > this.waveInterval) {
            this.spawnEnemy();
            this.waveTimer = 0;
            if (this.waveInterval > 50) this.waveInterval -= 2;
        }

        if (!homeSystem.houseLocation) return; 

        const homeX = homeSystem.houseLocation.x;
        const homeY = homeSystem.houseLocation.y;

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            let enemy = this.enemies[i];
            let dx = homeX - enemy.x;
            let dy = homeY - enemy.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0.5) {
                enemy.x += (dx / dist) * enemy.speed * dt;
                enemy.y += (dy / dist) * enemy.speed * dt;
            }

            if (dist < 1.0) {
                this.baseHealth -= 1; 
                if (this.baseHealth <= 0) {
                    this.endRaid(false);
                    return;
                }
            }

            for (let t = 0; t < 8; t++) {
                if (this.defenders[t]) {
                    let tx = homeX + this.turretOffsets[t].x;
                    let ty = homeY + this.turretOffsets[t].y;
                    let tDist = Math.sqrt(Math.pow(enemy.x - tx, 2) + Math.pow(enemy.y - ty, 2));

                    if (tDist < 0.8) {
                        this.defenders[t].hp -= 0.5;
                        if (this.defenders[t].hp <= 0) {
                            this.defenders[t] = null;
                            this.autoFillDefenders();
                        }
                    }
                }
            }
        }

        for (let t = 0; t < 8; t++) {
            let defender = this.defenders[t];
            if (!defender) continue;

            if (!defender.fireCooldown) defender.fireCooldown = 0;
            if (defender.fireCooldown > 0) defender.fireCooldown -= dt;

            if (defender.fireCooldown <= 0) {
                let tx = homeX + this.turretOffsets[t].x;
                let ty = homeY + this.turretOffsets[t].y;
                let range = 5;
                let closest = null;
                let closestDist = range;

                for (let e of this.enemies) {
                    let d = Math.sqrt(Math.pow(e.x - tx, 2) + Math.pow(e.y - ty, 2));
                    if (d < closestDist) {
                        closestDist = d;
                        closest = e;
                    }
                }

                if (closest) {
                    this.projectiles.push({
                        x: tx, y: ty,
                        tx: closest.x, ty: closest.y,
                        vx: (closest.x - tx) / closestDist * 10,
                        vy: (closest.y - ty) / closestDist * 10,
                        damage: Math.floor(defender.level * 2 + (defender.stats ? defender.stats.strength : 10)),
                        color: this.getTypeColor(defender.type)
                    });
                    defender.fireCooldown = Math.max(0.5, 2.0 - ((defender.stats ? defender.stats.speed : 10) * 0.015));
                }
            }
        }

        for (let p = this.projectiles.length - 1; p >= 0; p--) {
            let proj = this.projectiles[p];
            proj.x += proj.vx * dt;
            proj.y += proj.vy * dt;

            if (Math.abs(proj.x - homeX) > 15 || Math.abs(proj.y - homeY) > 15) {
                this.projectiles.splice(p, 1);
                continue;
            }

            for (let e = this.enemies.length - 1; e >= 0; e--) {
                let enemy = this.enemies[e];
                let dist = Math.sqrt(Math.pow(proj.x - enemy.x, 2) + Math.pow(proj.y - enemy.y, 2));
                if (dist < 0.5) {
                    enemy.hp -= proj.damage;
                    this.projectiles.splice(p, 1);
                    if (enemy.hp <= 0) this.enemies.splice(e, 1);
                    break;
                }
            }
        }
    }

    spawnEnemy() {
        if (!homeSystem.houseLocation) return;
        let angle = Math.random() * Math.PI * 2;
        let r = 12;
        let ex = homeSystem.houseLocation.x + Math.cos(angle) * r;
        let ey = homeSystem.houseLocation.y + Math.sin(angle) * r;

        const enemies = ['Rattata', 'Zubat', 'Geodude', 'Ekans', 'Meowth', 'Gastly', 'Houndour', 'Murkrow'];
        let name = enemies[Math.floor(Math.random() * enemies.length)];
        let level = this.player.pLevel * 5 + Math.floor(Math.random() * 5);

        this.enemies.push({
            x: ex, y: ey, name: name,
            hp: level * 10, maxHp: level * 10,
            speed: 1.5 + (Math.random() * 1.5)
        });
    }

    getTypeColor(type) {
        const colors = {
            'fire': '#e74c3c', 'water': '#3498db', 'grass': '#2ecc71',
            'electric': '#f1c40f', 'psychic': '#9b59b6', 'normal': '#95a5a6'
        };
        return colors[type] || '#fff';
    }
}