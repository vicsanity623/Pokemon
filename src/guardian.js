class GuardianSystem {
    constructor(player) {
        this.player = player;
        this.activeGuardian = null; // The Pokemon Data
        this.entity = { x: 0, y: 0 }; // World Position
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

        // --- SKILL LOGIC (Auto-Heal) ---
        if (Math.random() < 0.001) { 
            if (typeof rpgSystem !== 'undefined' && rpgSystem.hp < rpgSystem.maxHp) {
                rpgSystem.hp = Math.min(rpgSystem.maxHp, rpgSystem.hp + 5);
                showDialog(`${this.activeGuardian.name} cast Heal Pulse!`, 1000);
            }
        }

        // --- COMBAT LOGIC (Auto-Attack with Prediction) ---
        if (typeof enemySystem !== 'undefined' && enemySystem.enemies.length > 0) {
            
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

                    // --- PREDICTIVE AIMING ---
                    // Calculate time for bullet to reach current enemy position
                    const timeToHit = minDist / bulletSpeed;

                    // Predict where enemy will be in that time
                    // We use the vx/vy stored in EnemySystem
                    const predX = closest.x + (closest.vx || 0) * timeToHit;
                    const predY = closest.y + (closest.vy || 0) * timeToHit;

                    // Calculate firing vector towards Predicted Position
                    const dx = predX - this.entity.x;
                    const dy = predY - this.entity.y;
                    const aimDist = Math.sqrt(dx*dx + dy*dy);

                    // Shoot
                    let damage = 10 + Math.floor(this.activeGuardian.level * 0.5);
                    this.attackCooldown = 1.2; 

                    enemySystem.projectiles.push({
                        x: this.entity.x,
                        y: this.entity.y,
                        vx: (dx / aimDist) * bulletSpeed,
                        vy: (dy / aimDist) * bulletSpeed,
                        life: 1.5,
                        color: '#f1c40f',
                        source: 'guardian', // Important for collision
                        damage: damage
                    });
                }
            }
        }
    }

    draw(ctx, tileSize, centerScreenX, centerScreenY) {
        if (!this.activeGuardian) return;

        // Calculate Screen Position
        let drawX = (this.entity.x - this.player.x) * tileSize + centerScreenX - tileSize / 2;
        let drawY = (this.entity.y - this.player.y) * tileSize + centerScreenY - tileSize / 2;

        // Draw "Guardian Aura" (Gold Circle)
        ctx.fillStyle = 'rgba(255, 215, 0, 0.3)'; // Gold transparent
        ctx.beginPath();
        ctx.arc(drawX + tileSize/2, drawY + tileSize/2 + 5, tileSize/2, 0, Math.PI*2);
        ctx.fill();

        // Draw Sprite
        // We use the 'sprite' (Front) property
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
    }

    // Triggered by clicking the Guardian
    openMenu() {
        if (!this.activeGuardian) return;
        
        let info = `
            GUARDIAN: ${this.activeGuardian.name}
            Level: ${this.activeGuardian.level}
            \nSKILLS:
            1. Heal Pulse (Lvl ${this.skills.heal.level})
            2. Fireball (Locked)
            3. Asteroid (Locked)
        `;
        alert(info); // Placeholder for a real UI later
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
