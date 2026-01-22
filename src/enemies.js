class EnemySystem {
    constructor(player, world) {
        this.player = player;
        this.world = world;
        this.enemies = []; // Array of active enemy objects
        this.projectiles = []; // Enemy projectiles (Shadow Balls)
        
        // Configuration
        this.maxEnemies = 10;
        this.spawnTimer = 0;
        this.spawnInterval = 300; // 5 seconds (60fps)
    }

    update(dt) {
        // 1. Spawning Logic
        this.spawnTimer += dt * 60; 
        if (this.spawnTimer > this.spawnInterval) {
            this.spawnRandomEnemy();
            this.spawnTimer = 0;
        }

        // 2. Update Enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            let e = this.enemies[i];
            
            // Movement AI (Chase Player)
            const dx = this.player.x - e.x;
            const dy = this.player.y - e.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < 10) { 
                if (dist > 0.8) { 
                    e.vx = (dx / dist) * e.speed; // Store velocity for prediction
                    e.vy = (dy / dist) * e.speed;
                    e.x += e.vx * dt;
                    e.y += e.vy * dt;
                } else {
                    e.vx = 0; e.vy = 0;
                    if (e.attackCooldown <= 0) {
                        this.attackPlayer(e);
                        e.attackCooldown = 2.0; 
                    }
                }
            } else {
                e.vx = 0; e.vy = 0;
            }

            // Cooldowns
            if (e.attackCooldown > 0) e.attackCooldown -= dt;

            // Shadow Pokemon Ranged Attack
            if (e.type === 'shadow' && dist < 6 && e.attackCooldown <= 0) {
                this.shootProjectile(e, 'enemy'); // Pass type
                e.attackCooldown = 3.0;
            }
        }

        // 3. Update Projectiles (Collision Logic)
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let p = this.projectiles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;

            // CHECK: Enemy Projectile vs Player
            if (p.source === 'enemy') {
                const dist = Math.sqrt(Math.pow(this.player.x - p.x, 2) + Math.pow(this.player.y - p.y, 2));
                if (dist < 0.5) {
                    if (typeof rpgSystem !== 'undefined') {
                        rpgSystem.hp -= 10;
                        rpgSystem.updateHUD();
                        showDialog("Hit by Shadow Ball!", 1000);
                    }
                    this.projectiles.splice(i, 1);
                    continue;
                }
            }
            // CHECK: Guardian Projectile vs Enemies
            else if (p.source === 'guardian') {
                for (let j = this.enemies.length - 1; j >= 0; j--) {
                    let e = this.enemies[j];
                    const dist = Math.sqrt(Math.pow(e.x - p.x, 2) + Math.pow(e.y - p.y, 2));
                    
                    // Hit Enemy!
                    if (dist < 0.8) {
                        e.hp -= p.damage;
                        // Visual knockback
                        e.x += p.vx * 0.1; 
                        e.y += p.vy * 0.1;
                        
                        // Particle effect would go here
                        if (e.hp <= 0) this.killEnemy(j);
                        
                        this.projectiles.splice(i, 1); // Remove bullet
                        break; // Stop checking enemies for this bullet
                    }
                }
                if (this.projectiles[i] === undefined) continue; // Bullet removed
            }

            if (p.life <= 0) this.projectiles.splice(i, 1);
        }
    }

    spawnRandomEnemy() {
        if (this.enemies.length >= this.maxEnemies) return;

        // Spawn 15-20 tiles away
        const angle = Math.random() * Math.PI * 2;
        const dist = 15 + Math.random() * 5;
        const x = this.player.x + Math.cos(angle) * dist;
        const y = this.player.y + Math.sin(angle) * dist;

        if (this.world.isBlocked(Math.round(x), Math.round(y))) return;

        // Determine Type
        const isNight = true; // Simplified: Assume always dangerous for now, or check Clock
        const type = Math.random() < 0.7 ? 'skeleton' : 'shadow';

        this.enemies.push({
            x: x, 
            y: y,
            type: type,
            hp: type === 'skeleton' ? 30 : 50,
            maxHp: type === 'skeleton' ? 30 : 50,
            speed: type === 'skeleton' ? 1.5 : 2.0,
            attackCooldown: 0,
            name: type === 'skeleton' ? 'Skeleton Warrior' : 'Shadow Lugia'
        });
    }

    attackPlayer(enemy) {
        if (typeof rpgSystem !== 'undefined') {
            rpgSystem.hp -= 5;
            rpgSystem.updateHUD();
            showDialog("Ouch! Taken 5 damage!", 500);
            playSFX('sfx-attack2');
        }
    }

    shootProjectile(enemy, source) {
        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        this.projectiles.push({
            x: enemy.x,
            y: enemy.y,
            vx: (dx/dist) * 4.0,
            vy: (dy/dist) * 4.0,
            life: 3.0,
            source: source // 'enemy'
        });
    }

    // Called when Player swings sword
    checkHit(x, y, damage) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            let e = this.enemies[i];
            const dist = Math.sqrt(Math.pow(x - e.x, 2) + Math.pow(y - e.y, 2));
            
            if (dist < 1.0) { // Hit!
                e.hp -= damage;
                showDialog(`Hit ${e.name}!`, 500);
                
                // Knockback
                const pushAngle = Math.atan2(e.y - this.player.y, e.x - this.player.x);
                e.x += Math.cos(pushAngle) * 1.0;
                e.y += Math.sin(pushAngle) * 1.0;

                if (e.hp <= 0) {
                    this.killEnemy(i);
                }
                return true;
            }
        }
        return false;
    }

    killEnemy(index) {
        const e = this.enemies[index];
        
        // Loot Drop
        if (e.type === 'skeleton') {
            if (!this.player.bag['Bone']) this.player.bag['Bone'] = 0;
            this.player.bag['Bone']++;
            showDialog("Skeleton crumbled! Got 1 Bone.", 1500);
        } else {
            if (!this.player.bag['Shadow Essence']) this.player.bag['Shadow Essence'] = 0;
            this.player.bag['Shadow Essence']++;
            showDialog("Shadow purged! Got Essence.", 1500);
        }

        // XP
        if (typeof rpgSystem !== 'undefined') rpgSystem.gainXP(20);

        this.enemies.splice(index, 1);
    }

    // Save/Load (Optional, enemies usually despawn)
    getSaveData() { return null; }
    loadSaveData(data) {} 
}
