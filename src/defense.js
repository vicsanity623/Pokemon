
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
        // House is roughly 1 tile, let's place them in a 3x3 perimeter approx
        this.turretOffsets = [
            { x: -2, y: -2 }, { x: 0, y: -2 }, { x: 2, y: -2 },
            { x: -2, y: 0 }, { x: 2, y: 0 },
            { x: -2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 2 }
        ];

        this.waveTimer = 0;
        this.waveInterval = 200; // Frames between spawns (decreases over time)
        this.lastRaidDay = -1;
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

    endRaid(win) {
        this.active = false;
        document.getElementById('raid-hud').classList.add('hidden');
        document.getElementById('flash-overlay').classList.remove('blood-moon');

        if (win) {
            showDialog("You survived the Blood Moon!", 4000);
            this.player.money += 5000; // Reward
            // Maybe restore some base barriers or something?
        } else {
            showDialog("Your home was overrun... You blacked out.", 4000);
            // Penalty?
        }
    }

    autoFillDefenders() {
        // Clear fainted defenders first
        for (let i = 0; i < 8; i++) {
            if (this.defenders[i] && this.defenders[i].hp <= 0) {
                this.defenders[i] = null;
            }
        }

        // Loop through storage to find defenders
        // We look for non-fainted Pokemon not already in a turret
        let storageFlat = this.player.storage.flat().filter(p => p !== null && p.hp > 0);

        for (let i = 0; i < 8; i++) {
            if (this.defenders[i] === null) {
                // Find a pokemon
                if (storageFlat.length > 0) {
                    let poke = storageFlat.shift();
                    // Ensure we don't pick one already assigned (though flat list shift handles this mostly if unique refs)
                    if (!this.defenders.includes(poke)) {
                        this.defenders[i] = poke;
                        console.log(`Assigned ${poke.name} to turret ${i}`);
                    }
                }
            }
        }
    }

    update(dt) {
        if (!this.active) return;

        // 1. Timer Logic
        this.raidTimer -= dt;
        if (this.raidTimer <= 0) {
            this.endRaid(true);
            return;
        }

        // Update UI
        const mins = Math.floor(this.raidTimer / 60);
        const secs = Math.floor(this.raidTimer % 60).toString().padStart(2, '0');
        document.getElementById('raid-timer').innerText = `${mins}:${secs}`;

        const hpPercent = (this.baseHealth / this.maxBaseHealth) * 100;
        document.getElementById('raid-base-hp-fill').style.width = `${hpPercent}%`;

        // 2. Enemy Spawning
        this.waveTimer++;
        if (this.waveTimer > this.waveInterval) {
            this.spawnEnemy();
            this.waveTimer = 0;
            // Ramp up difficulty
            if (this.waveInterval > 50) this.waveInterval -= 2;
        }

        // 3. Enemy Logic (Move & Attack)
        if (!homeSystem.houseLocation) return; // Safety

        const homeX = homeSystem.houseLocation.x;
        const homeY = homeSystem.houseLocation.y;

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            let enemy = this.enemies[i];

            // Move towards house
            let dx = homeX - enemy.x;
            let dy = homeY - enemy.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0.5) {
                enemy.x += (dx / dist) * enemy.speed * dt;
                enemy.y += (dy / dist) * enemy.speed * dt;
            }

            // Damage House Logic
            if (dist < 1.0) {
                this.baseHealth -= 5; // Damage per frame/tick near house
                // Flash house red?
                if (this.baseHealth <= 0) {
                    this.endRaid(false);
                    return;
                }
            }

            // Damage Turret Logic (Collision)
            for (let t = 0; t < 8; t++) {
                if (this.defenders[t]) {
                    let tx = homeX + this.turretOffsets[t].x;
                    let ty = homeY + this.turretOffsets[t].y;
                    let tDist = Math.sqrt(Math.pow(enemy.x - tx, 2) + Math.pow(enemy.y - ty, 2));

                    if (tDist < 0.8) {
                        // Enemy touches turret
                        this.defenders[t].hp -= 1; // Turret takes damage
                        if (this.defenders[t].hp <= 0) {
                            this.defenders[t] = null; // Fainted
                            this.autoFillDefenders(); // Try to replace
                        }
                    }
                }
            }
        }

        // 4. Turret Logic (Fire)
        for (let t = 0; t < 8; t++) {
            let defender = this.defenders[t];
            if (!defender) continue;

            // Cooldown logic attached to the pokemon object directly for simplicity (runtime prop)
            if (!defender.fireCooldown) defender.fireCooldown = 0;
            if (defender.fireCooldown > 0) defender.fireCooldown -= dt;

            if (defender.fireCooldown <= 0) {
                // Find target
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
                    // Fire!
                    this.projectiles.push({
                        x: tx, y: ty,
                        tx: closest.x, ty: closest.y, // Target pos (simple linear)
                        vx: (closest.x - tx) / closestDist * 10,
                        vy: (closest.y - ty) / closestDist * 10,
                        damage: Math.floor(defender.level * 2 + (defender.stats.strength)),
                        color: this.getTypeColor(defender.type)
                    });

                    // Reset Cooldown (based on Speed stat: higher speed = lower cooldown)
                    // Base 2.0s - (speed * 0.01)
                    defender.fireCooldown = Math.max(0.5, 2.0 - (defender.stats.speed * 0.015));
                }
            }
        }

        // 5. Projectile Logic
        for (let p = this.projectiles.length - 1; p >= 0; p--) {
            let proj = this.projectiles[p];
            proj.x += proj.vx * dt;
            proj.y += proj.vy * dt;

            // Remove if out of bounds (simple distance check from home)
            if (Math.abs(proj.x - homeX) > 15 || Math.abs(proj.y - homeY) > 15) {
                this.projectiles.splice(p, 1);
                continue;
            }

            // Hit Enemy
            for (let e = this.enemies.length - 1; e >= 0; e--) {
                let enemy = this.enemies[e];
                let dist = Math.sqrt(Math.pow(proj.x - enemy.x, 2) + Math.pow(proj.y - enemy.y, 2));

                if (dist < 0.5) {
                    // Hit!
                    enemy.hp -= proj.damage;
                    this.projectiles.splice(p, 1); // Remove projectile

                    if (enemy.hp <= 0) {
                        this.enemies.splice(e, 1); // Remove enemy
                        // Maybe particle effect?
                    }
                    break;
                }
            }
        }
    }

    spawnEnemy() {
        if (!homeSystem.houseLocation) return;

        // Spawn at random edge relative to home (radius 12)
        let angle = Math.random() * Math.PI * 2;
        let r = 12;
        let ex = homeSystem.houseLocation.x + Math.cos(angle) * r;
        let ey = homeSystem.houseLocation.y + Math.sin(angle) * r;

        // Select random stronger pokemon based on game progress?
        // Simple for now:
        const enemies = ['Rattata', 'Zubat', 'Geodude', 'Ekans', 'Meowth', 'Gastly', 'Houndour', 'Murkrow'];
        let name = enemies[Math.floor(Math.random() * enemies.length)];

        let level = this.player.pLevel * 5 + Math.floor(Math.random() * 5);

        this.enemies.push({
            x: ex,
            y: ey,
            name: name,
            hp: level * 10,
            maxHp: level * 10,
            speed: 1.5 + (Math.random() * 1.5) // Variable speed
        });
    }

    getTypeColor(type) {
        // Quick lookup for projectile color
        const colors = {
            'Fire': '#e74c3c', 'Water': '#3498db', 'Grass': '#2ecc71',
            'Electric': '#f1c40f', 'Psychic': '#9b59b6', 'Normal': '#95a5a6'
        };
        return colors[type] || '#fff';
    }
}
