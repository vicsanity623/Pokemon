class GuardianSystem {
    constructor(player) {
        this.player = player;
        this.activeGuardian = null; // The Pokemon Data
        this.entity = { x: 0, y: 0 }; // World Position
        
        // NEW: Track rotation for asteroids
        this.asteroidAngle = 0; 

        this.skills = {
            heal: { level: 1, unlocked: true },
            fireball: { level: 0, unlocked: false },
            asteroid: { level: 0, unlocked: false }
        };
    }

    // Call this from a UI button to convert a party member
    assignGuardian(partyIndex) {
        if (this.activeGuardian) {
            showDialog("You already have a Guardian! Dismiss it first.", 2000);
            return;
        }

        if (this.player.team.length <= 1) {
            showDialog("You can't leave yourself defenseless!", 2000);
            return;
        }

        const p = this.player.team[partyIndex];
        
        if (confirm(`Pact: Make ${p.name} your Guardian?\nIt will leave your party FOREVER to protect you in real-time.`)) {
            // Remove from Party
            this.activeGuardian = p;
            this.player.team.splice(partyIndex, 1);
            
            // Spawn next to player
            this.entity.x = this.player.x;
            this.entity.y = this.player.y;

            // Reset Skills on new assignment (Optional, keeps it fair)
            this.skills.fireball.unlocked = false;
            this.skills.asteroid.unlocked = false;

            showDialog(`${p.name} is now your Guardian!`, 3000);
            
            // Force save to prevent data loss
            if (typeof saveGame === 'function') saveGame();
            if (typeof updateHUD === 'function') updateHUD();
        }
    }

    update(dt) {
        if (!this.activeGuardian) return;

        // --- FOLLOW LOGIC ---
        // Target: Behind the player slightly
        let targetX = this.player.x;
        let targetY = this.player.y;

        // Basic Lerp (Smooth Follow)
        const dx = targetX - this.entity.x;
        const dy = targetY - this.entity.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist > 1.5) { // Stop if close
            this.entity.x += dx * 2.0 * dt;
            this.entity.y += dy * 2.0 * dt;
        }

        // --- SKILL 1: HEAL PULSE (Auto-Heal) ---
        if (this.skills.heal.unlocked && Math.random() < 0.001) { 
            if (typeof rpgSystem !== 'undefined' && rpgSystem.hp < rpgSystem.maxHp) {
                // Heal amount scales with skill level
                let healAmt = 5 + (this.skills.heal.level * 2);
                rpgSystem.hp = Math.min(rpgSystem.maxHp, rpgSystem.hp + healAmt);
                showDialog(`${this.activeGuardian.name} cast Heal Pulse! (+${healAmt} HP)`, 1000);
            }
        }

        // --- SKILL 2: FIREBALL (Predictive Shooting) ---
        // Only run if Unlocked!
        if (this.skills.fireball.unlocked && typeof enemySystem !== 'undefined' && enemySystem.enemies.length > 0) {
            
            if (typeof this.attackCooldown === 'undefined') this.attackCooldown = 0;
            
            if (this.attackCooldown > 0) {
                this.attackCooldown -= dt;
            } else {
                // Find closest enemy
                let closest = null;
                let minDist = 10.0; // Range

                for(let e of enemySystem.enemies) {
                    let d = Math.sqrt(Math.pow(e.x - this.entity.x, 2) + Math.pow(e.y - this.entity.y, 2));
                    if(d < minDist) { 
                        minDist = d; 
                        closest = e; 
                    }
                }

                if (closest) {
                    const bulletSpeed = 7.0;

                    // Predictive Aiming
                    const timeToHit = minDist / bulletSpeed;
                    const predX = closest.x + (closest.vx || 0) * timeToHit;
                    const predY = closest.y + (closest.vy || 0) * timeToHit;

                    const dx = predX - this.entity.x;
                    const dy = predY - this.entity.y;
                    const aimDist = Math.sqrt(dx*dx + dy*dy);

                    // Damage scales with level
                    let damage = 15 + (this.skills.fireball.level * 5);
                    this.attackCooldown = 1.5; // Fire rate

                    enemySystem.projectiles.push({
                        x: this.entity.x,
                        y: this.entity.y,
                        vx: (dx / aimDist) * bulletSpeed,
                        vy: (dy / aimDist) * bulletSpeed,
                        life: 1.5,
                        color: '#e74c3c', // Red for fireball
                        source: 'guardian', 
                        damage: damage
                    });
                }
            }
        }

        // --- SKILL 3: ASTEROIDS (Orbiting Shield) ---
        if (this.skills.asteroid.unlocked && typeof enemySystem !== 'undefined') {
            
            // 1. Spin the angle
            const rotationSpeed = 2.0; // Speed of orbit
            this.asteroidAngle += rotationSpeed * dt;

            // 2. Determine stats based on level
            const count = 1 + Math.floor(this.skills.asteroid.level / 2); // 1 rock at lvl 1, 2 at lvl 3
            const radius = 2.5; // How far from guardian
            const damage = 5 + (this.skills.asteroid.level * 2);

            // 3. Check collision for EACH asteroid
            for (let i = 0; i < count; i++) {
                // Calculate position relative to Guardian
                const angleOffset = (Math.PI * 2 / count) * i;
                const finalAngle = this.asteroidAngle + angleOffset;
                
                const astX = this.entity.x + Math.cos(finalAngle) * radius;
                const astY = this.entity.y + Math.sin(finalAngle) * radius;

                // Check against ALL enemies
                for (let e of enemySystem.enemies) {
                    const dist = Math.sqrt(Math.pow(e.x - astX, 2) + Math.pow(e.y - astY, 2));
                    
                    // Collision Radius (0.8 tiles)
                    if (dist < 0.8) {
                        // Apply Damage
                        e.hp -= damage * dt * 5; // DPS based (multiplied by DT)
                        
                        // Pushback effect
                        e.x += Math.cos(finalAngle) * 5 * dt;
                        e.y += Math.sin(finalAngle) * 5 * dt;

                        // Visual Particle
                        if (Math.random() < 0.1 && typeof renderer !== 'undefined') {
                            renderer.addParticle(astX, astY, '#8e44ad');
                        }
                    }
                }
            }
        }
    }

    draw(ctx, tileSize, centerScreenX, centerScreenY) {
        if (!this.activeGuardian) return;

        // Calculate Screen Position of Guardian
        let drawX = (this.entity.x - this.player.x) * tileSize + centerScreenX - tileSize / 2;
        let drawY = (this.entity.y - this.player.y) * tileSize + centerScreenY - tileSize / 2;

        // Draw "Guardian Aura" (Gold Circle)
        ctx.fillStyle = 'rgba(255, 215, 0, 0.3)'; // Gold transparent
        ctx.beginPath();
        ctx.arc(drawX + tileSize/2, drawY + tileSize/2 + 5, tileSize/2, 0, Math.PI*2);
        ctx.fill();

        // Draw Sprite
        const img = new Image();
        img.src = this.activeGuardian.sprite || this.activeGuardian.backSprite; 
        
        // Simple bounce animation
        let bounce = Math.abs(Math.sin(Date.now() / 200)) * 5;
        
        ctx.drawImage(img, drawX, drawY - bounce, tileSize, tileSize);

        // Draw Name
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("GUARDIAN", drawX + tileSize/2, drawY - 5);

        // --- DRAW ASTEROIDS ---
        if (this.skills.asteroid.unlocked) {
            const count = 1 + Math.floor(this.skills.asteroid.level / 2);
            const radius = 2.5 * tileSize; // Scale radius to screen pixels

            for (let i = 0; i < count; i++) {
                const angleOffset = (Math.PI * 2 / count) * i;
                const finalAngle = this.asteroidAngle + angleOffset;

                // Center of the Guardian on screen
                const centerX = drawX + tileSize / 2;
                const centerY = drawY + tileSize / 2;

                const rockX = centerX + Math.cos(finalAngle) * radius;
                const rockY = centerY + Math.sin(finalAngle) * radius;

                // Draw Rock
                ctx.fillStyle = '#555'; // Dark Grey
                ctx.beginPath();
                ctx.arc(rockX, rockY, 8, 0, Math.PI * 2); // 8px radius rock
                ctx.fill();
                
                ctx.strokeStyle = '#222';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }

    // Triggered by clicking the Guardian
    openMenu() {
        if (!this.activeGuardian) return;
        
        // Simple alert for now, can be replaced with a UI later
        let info = `GUARDIAN: ${this.activeGuardian.name}\n`;
        info += `Level: ${this.activeGuardian.level}\n\n`;
        info += `SKILLS:\n`;
        info += `1. Heal Pulse: Lvl ${this.skills.heal.level} (${this.skills.heal.unlocked ? 'ACTIVE' : 'LOCKED'})\n`;
        info += `2. Fireball: Lvl ${this.skills.fireball.level} (${this.skills.fireball.unlocked ? 'ACTIVE' : 'LOCKED'})\n`;
        info += `3. Asteroids: Lvl ${this.skills.asteroid.level} (${this.skills.asteroid.unlocked ? 'ACTIVE' : 'LOCKED'})\n`;
        
        alert(info); 
    }

    getSaveData() {
        return {
            activeGuardian: this.activeGuardian,
            skills: this.skills,
            entity: this.entity
        };
    }

    loadSaveData(data) {
        this.activeGuardian = data.activeGuardian || null;
        this.skills = data.skills || this.skills;
        this.entity = data.entity || { x: 0, y: 0 };
    }
}