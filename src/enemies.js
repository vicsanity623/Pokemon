class EnemySystem {
    constructor(player, world) {
        this.player = player;
        this.world = world;
        this.enemies = []; // Array of active enemy objects
        this.projectiles = []; // Enemy projectiles (Shadow Balls)

        // Base Configuration
        this.baseMaxEnemies = 10;
        this.baseSpawnInterval = 300; // 5 seconds (60fps)
        this.spawnTimer = 0;

        // Distance-based scaling constants
        this.DANGER_ZONE_START = 10; // Enemies start scaling at 100 tiles
        this.DEATH_ZONE = 400; // Maximum recommended distance
        this.MAX_ENEMY_CAP = 50; // Absolute max enemies at extreme distances
    }

    // Calculate distance from player's home
    getDistanceFromHome() {
        if (typeof homeSystem !== 'undefined' && homeSystem.houseLocation) {
            const dx = this.player.x - homeSystem.houseLocation.x;
            const dy = this.player.y - homeSystem.houseLocation.y;
            return Math.sqrt(dx * dx + dy * dy);
        }
        return 0; // No home yet, treat as safe
    }

    // Get spawn rate multiplier based on distance (higher = more frequent spawns)
    getSpawnRateMultiplier() {
        const dist = this.getDistanceFromHome();

        if (dist < this.DANGER_ZONE_START) {
            return 1.0; // Normal spawn rate near home
        }

        // Linear scaling from 100-400 tiles: 1x to 5x spawn rate
        const progress = Math.min(1, (dist - this.DANGER_ZONE_START) / (this.DEATH_ZONE - this.DANGER_ZONE_START));
        let multiplier = 1 + (progress * 4); // 1x to 5x

        // Beyond 400 tiles: EXTREME danger - 10x spawn rate!
        if (dist > this.DEATH_ZONE) {
            const extraDist = dist - this.DEATH_ZONE;
            multiplier = 5 + Math.min(5, extraDist / 50); // Up to 10x at 650+ tiles
        }

        return multiplier;
    }

    // Get max enemies based on distance from home
    getMaxEnemies() {
        const dist = this.getDistanceFromHome();

        if (dist < this.DANGER_ZONE_START) {
            return this.baseMaxEnemies; // 10 enemies near home
        }

        // Scale from 10 to 30 enemies between 100-400 tiles
        const progress = Math.min(1, (dist - this.DANGER_ZONE_START) / (this.DEATH_ZONE - this.DANGER_ZONE_START));
        let maxEnemies = Math.floor(this.baseMaxEnemies + (progress * 20)); // 10 to 30

        // Beyond 400 tiles: SWARMS!
        if (dist > this.DEATH_ZONE) {
            const extraDist = dist - this.DEATH_ZONE;
            maxEnemies = Math.min(this.MAX_ENEMY_CAP, 30 + Math.floor(extraDist / 10)); // Up to 50
        }

        return maxEnemies;
    }

    // Get enemy stat multiplier based on player level (+2% per level)
    getPlayerLevelMultiplier() {
        if (typeof rpgSystem !== 'undefined') {
            // 2% increase per level: Level 1 = 1.0, Level 10 = 1.18, Level 50 = 1.98
            return 1 + ((rpgSystem.level - 1) * 0.02);
        }
        return 1.0;
    }

    // Get enemy stat multiplier based on distance from home
    getDistanceStatMultiplier() {
        const dist = this.getDistanceFromHome();

        if (dist < this.DANGER_ZONE_START) {
            return 1.0;
        }

        // 50% stronger enemies at 400 tiles
        const progress = Math.min(1, (dist - this.DANGER_ZONE_START) / (this.DEATH_ZONE - this.DANGER_ZONE_START));
        let multiplier = 1 + (progress * 0.5); // 1x to 1.5x

        // Beyond 400: enemies become MUCH stronger
        if (dist > this.DEATH_ZONE) {
            const extraDist = dist - this.DEATH_ZONE;
            multiplier = 1.5 + (extraDist / 100); // +100% every 100 tiles past 400
        }

        return multiplier;
    }

    update(dt) {
        // 1. Spawning Logic (Distance-based interval)
        const spawnMultiplier = this.getSpawnRateMultiplier();
        const adjustedInterval = this.baseSpawnInterval / spawnMultiplier;

        this.spawnTimer += dt * 60;
        if (this.spawnTimer > adjustedInterval) {
            this.spawnRandomEnemy();
            this.spawnTimer = 0;
        }

        // 2. Update Enemies (Optimized)
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            let e = this.enemies[i];

            // Movement AI (Chase Player)
            const dx = this.player.x - e.x;
            const dy = this.player.y - e.y;
            // OPTIMIZATION: Use Squared Distance to avoid Sqrt for simple checks
            const distSq = dx * dx + dy * dy;

            if (distSq < 100) { // 10 * 10 = 100
                // We only do real sqrt if we are actually moving
                const dist = Math.sqrt(distSq);
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

            // Shadow Pokemon Ranged Attack (6 tiles = 36 sq)
            if (e.type === 'shadow' && distSq < 36 && e.attackCooldown <= 0) {
                this.shootProjectile(e, 'enemy'); // Pass type
                e.attackCooldown = 3.0;
            }
        }

        // 3. Update Projectiles (Collision Logic Optimized)
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let p = this.projectiles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;

            // CHECK: Enemy Projectile vs Player
            if (p.source === 'enemy') {
                const dx = this.player.x - p.x;
                const dy = this.player.y - p.y;
                
                // Pre-check with simple math (bounding box) to avoid Sqrt
                if (Math.abs(dx) < 0.8 && Math.abs(dy) < 0.8) {
                     const distSq = dx * dx + dy * dy;
                     if (distSq < 0.25) { // 0.5 * 0.5
                        if (typeof rpgSystem !== 'undefined') {
                            const baseDamage = 10;
                            const scaledDamage = Math.floor(baseDamage * this.getDistanceStatMultiplier() * this.getPlayerLevelMultiplier());
                            rpgSystem.hp -= scaledDamage;
                            rpgSystem.updateHUD();
                            showDialog(`Hit by Shadow Ball! (-${scaledDamage} HP)`, 1000);
                            const canvas = document.getElementById('gameCanvas');
                            if(canvas) {
                                canvas.style.transform = `translate(${Math.random() * 4 - 2}px, ${Math.random() * 4 - 2}px)`;
                                setTimeout(() => canvas.style.transform = 'none', 100);
                            }
                        }
                        this.projectiles.splice(i, 1);
                        continue;
                    }
                }
            }
            // CHECK: Guardian Projectile vs Enemies
            else if (p.source === 'guardian') {
                for (let j = this.enemies.length - 1; j >= 0; j--) {
                    let e = this.enemies[j];
                    const dx = e.x - p.x;
                    const dy = e.y - p.y;

                    // Bounding box pre-check
                    if (Math.abs(dx) < 1.0 && Math.abs(dy) < 1.0) {
                        const distSq = dx * dx + dy * dy;
                        // Hit Enemy! (0.8 * 0.8 = 0.64)
                        if (distSq < 0.64) {
                            e.hp -= p.damage;
                            e.x += p.vx * 0.1;
                            e.y += p.vy * 0.1;

                            if (e.hp <= 0) this.killEnemy(j);

                            this.projectiles.splice(i, 1); // Remove bullet
                            break; // Stop checking enemies for this bullet
                        }
                    }
                }
                if (this.projectiles[i] === undefined) continue; // Bullet removed
            }

            if (p.life <= 0) this.projectiles.splice(i, 1);
        }

        // 4. Distance Warning System
        this.checkDistanceWarning();
    }

    checkDistanceWarning() {
        const dist = this.getDistanceFromHome();

        // Warning at 300 tiles
        if (dist > 300 && dist < 310 && !this._warned300) {
            showDialog("⚠️ WARNING: You are far from home. Danger increases!", 3000);
            this._warned300 = true;
        }

        // Danger at 400 tiles
        if (dist > 400 && dist < 410 && !this._warned400) {
            showDialog("☠️ DANGER ZONE! Enemies are swarming! Turn back!", 4000);
            this._warned400 = true;
        }

        // Critical at 500 tiles
        if (dist > 500 && dist < 510 && !this._warned500) {
            showDialog("💀 DEATH ZONE! You will not survive here!", 5000);
            this._warned500 = true;
        }

        // Reset warnings when returning home
        if (dist < 200) {
            this._warned300 = false;
            this._warned400 = false;
            this._warned500 = false;
        }
    }

    spawnRandomEnemy() {
        const maxEnemies = this.getMaxEnemies();
        if (this.enemies.length >= maxEnemies) return;

        // --- FIX: NO SPAWNS IN LIMINAL SPACE ---
        if (typeof liminalSystem !== 'undefined' && liminalSystem.active) return;
        // ---------------------------------------

        // Spawn distance scales with how far from home (closer spawns when far from home)
        const distFromHome = this.getDistanceFromHome();
        let spawnDist = 15 + Math.random() * 5;

        // Enemies spawn closer when in danger zones
        if (distFromHome > this.DANGER_ZONE_START) {
            spawnDist = 8 + Math.random() * 7; // 8-15 tiles away
        }
        if (distFromHome > this.DEATH_ZONE) {
            spawnDist = 5 + Math.random() * 5; // 5-10 tiles away!
        }

        const angle = Math.random() * Math.PI * 2;
        const x = this.player.x + Math.cos(angle) * spawnDist;
        const y = this.player.y + Math.sin(angle) * spawnDist;

        if (this.world.isBlocked(Math.round(x), Math.round(y))) return;

        // Determine Type - More shadows further out
        let shadowChance = 0.3;
        if (distFromHome > this.DANGER_ZONE_START) {
            const progress = Math.min(1, (distFromHome - this.DANGER_ZONE_START) / this.DEATH_ZONE);
            shadowChance = 0.3 + (progress * 0.4); // 30% to 70% shadows
        }
        const type = Math.random() > shadowChance ? 'skeleton' : 'shadow';

        // Calculate scaled stats
        const levelMult = this.getPlayerLevelMultiplier();
        const distMult = this.getDistanceStatMultiplier();
        const totalMult = levelMult * distMult;

        // Base stats
        const baseHp = type === 'skeleton' ? 30 : 50;
        const baseSpeed = type === 'skeleton' ? 1.5 : 2.0;
        const baseDamage = type === 'skeleton' ? 5 : 10;

        // Scaled stats
        const scaledHp = Math.floor(baseHp * totalMult);
        const scaledSpeed = baseSpeed * (1 + (totalMult - 1) * 0.3); // Speed scales slower
        const scaledDamage = Math.floor(baseDamage * totalMult);

        // Generate enemy name with level indicator
        let threatLevel = '';
        if (totalMult > 2.0) threatLevel = '☠️ ';
        else if (totalMult > 1.5) threatLevel = '💀 ';
        else if (totalMult > 1.2) threatLevel = '⚠️ ';

        const baseName = type === 'skeleton' ? 'Skeleton Warrior' : 'Shadow Lugia';

        this.enemies.push({
            x: x,
            y: y,
            type: type,
            hp: scaledHp,
            maxHp: scaledHp,
            speed: scaledSpeed,
            damage: scaledDamage,
            attackCooldown: 0,
            name: threatLevel + baseName,
            levelMultiplier: totalMult // Store for reference
        });
    }

    attackPlayer(enemy) {
        if (typeof rpgSystem !== 'undefined') {
            // Use enemy's scaled damage
            const damage = enemy.damage || 5;
            rpgSystem.hp -= damage;
            rpgSystem.updateHUD();
            showDialog(`Ouch! Taken ${damage} damage!`, 500);
            playSFX('sfx-attack2');
        }
    }

    shootProjectile(enemy, source) {
        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Projectile speed scales with enemy strength
        const speedMult = enemy.levelMultiplier || 1;
        const projSpeed = 4.0 * (1 + (speedMult - 1) * 0.5);

        this.projectiles.push({
            x: enemy.x,
            y: enemy.y,
            vx: (dx / dist) * projSpeed,
            vy: (dy / dist) * projSpeed,
            life: 3.0,
            source: source, // 'enemy'
            damage: enemy.damage || 10
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

        // 1. CALCULATE BONUS (Based on Level Multiplier)
        // Stronger enemies give more stuff naturally
        const multiplier = e.levelMultiplier || 1;

        // 2. RANDOMIZE ITEM COUNT (1 to 3, plus bonus for high levels)
        // Math.random() gives 0.0-0.99. Multiply by 3 gives 0-2.99. Floor it gives 0-2. Add 1 gives 1-3.
        const baseCount = Math.floor(Math.random() * 3) + 1; 
        const totalItems = Math.floor(baseCount * multiplier);

        // 3. RANDOMIZE MONEY DROP ($5 to $25)
        // Range is 20 (25-5). +5 sets the minimum.
        const moneyDrop = Math.floor((Math.random() * 21) + 5) * Math.floor(multiplier);
        this.player.money += moneyDrop;

        // 4. GIVE LOOT
        let lootName = "";
        if (e.type === 'skeleton') {
            lootName = 'Bone';
            if (!this.player.bag['Bone']) this.player.bag['Bone'] = 0;
            this.player.bag['Bone'] += totalItems;
            
            showDialog(`Skeleton crumbled! Found ${totalItems} Bone(s) & $${moneyDrop}.`, 2000);
        } else {
            lootName = 'Shadow Essence';
            if (!this.player.bag['Shadow Essence']) this.player.bag['Shadow Essence'] = 0;
            this.player.bag['Shadow Essence'] += totalItems;
            
            showDialog(`Shadow purged! Found ${totalItems} Essence(s) & $${moneyDrop}.`, 2000);
        }

        // 5. GIVE XP
        const baseXP = 23;
        const scaledXP = Math.floor(baseXP * multiplier);
        if (typeof rpgSystem !== 'undefined') rpgSystem.gainXP(scaledXP);

        // Remove from list
        this.enemies.splice(index, 1);
    }

    // Save/Load (Optional, enemies usually despawn)
    getSaveData() { return null; }
    loadSaveData(data) { }
}
