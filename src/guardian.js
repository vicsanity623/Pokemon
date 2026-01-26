class GuardianSystem {
    constructor(player) {
        this.player = player;
        this.activeGuardian = null; 
        this.entity = { x: 0, y: 0 }; 
        
        // Track rotation for asteroids
        this.asteroidAngle = 0;

        // ✅ NEW: Add a timer for healing
        this.healTimer = 0; 

        this.guardianImage = null;
        this.guardianImageLoaded = false;

        this.skills = {
            heal: { level: 1, unlocked: true },
            fireball: { level: 0, unlocked: false },
            asteroid: { level: 0, unlocked: false }
        };
    }

    preloadGuardianSprite() {
        if (!this.activeGuardian) return;

        const src = this.activeGuardian.sprite || this.activeGuardian.backSprite;
        if (!src) return;

        this.guardianImage = new Image();
        this.guardianImageLoaded = false;

        this.guardianImage.onload = () => {
            this.guardianImageLoaded = true;
        };

        this.guardianImage.src = src;
    }

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
            this.activeGuardian = p;
            this.player.team.splice(partyIndex, 1);
            
            this.entity.x = this.player.x;
            this.entity.y = this.player.y;

            this.skills.fireball.unlocked = false;
            this.skills.asteroid.unlocked = false;

            this.preloadGuardianSprite();

            showDialog(`${p.name} is now your Guardian!`, 3000);
            
            if (typeof saveGame === 'function') saveGame();
            if (typeof updateHUD === 'function') updateHUD();
        }
    }

    update(dt) {
        if (!this.activeGuardian) return;

        // --- FOLLOW LOGIC ---
        let targetX = this.player.x;
        let targetY = this.player.y;

        const dx = targetX - this.entity.x;
        const dy = targetY - this.entity.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 1.5) {
            this.entity.x += dx * 2.0 * dt;
            this.entity.y += dy * 2.0 * dt;
        }

        // --- ✅ FIX: HEAL EVERY 5 SECONDS ---
        if (this.skills.heal.unlocked) { 
            // 1. Add delta time to our timer
            this.healTimer += dt;

            // 2. Check if 5 seconds passed AND player exists AND hp is low
            if (this.healTimer >= 5.0) {
                if (typeof rpgSystem !== 'undefined' && rpgSystem.hp < rpgSystem.maxHp) {
                    let healAmt = 5 + (this.skills.heal.level * 2);
                    rpgSystem.hp = Math.min(rpgSystem.maxHp, rpgSystem.hp + healAmt);
                    showDialog(`${this.activeGuardian.name} cast Heal Pulse! (+${healAmt} HP)`, 1000);
                    
                    // 3. Reset timer ONLY after a successful heal
                    this.healTimer = 0; 
                }
            }
        }

        // --- FIREBALL ---
        if (this.skills.fireball.unlocked && typeof enemySystem !== 'undefined' && enemySystem.enemies.length > 0) {
            if (typeof this.attackCooldown === 'undefined') this.attackCooldown = 0;

            if (this.attackCooldown > 0) {
                this.attackCooldown -= dt;
            } else {
                let closest = null;
                let minDist = 10.0;

                for (let e of enemySystem.enemies) {
                    let d = Math.hypot(e.x - this.entity.x, e.y - this.entity.y);
                    if (d < minDist) {
                        minDist = d;
                        closest = e;
                    }
                }

                if (closest) {
                    const bulletSpeed = 7.0;
                    const timeToHit = minDist / bulletSpeed;

                    const predX = closest.x + (closest.vx || 0) * timeToHit;
                    const predY = closest.y + (closest.vy || 0) * timeToHit;

                    const dx = predX - this.entity.x;
                    const dy = predY - this.entity.y;
                    const aimDist = Math.hypot(dx, dy);

                    let damage = 15 + (this.skills.fireball.level * 5);
                    this.attackCooldown = 1.5;

                    enemySystem.projectiles.push({
                        x: this.entity.x,
                        y: this.entity.y,
                        vx: (dx / aimDist) * bulletSpeed,
                        vy: (dy / aimDist) * bulletSpeed,
                        life: 1.5,
                        color: '#e74c3c',
                        source: 'guardian',
                        damage
                    });
                }
            }
        }

        // --- ASTEROIDS ---
        if (this.skills.asteroid.unlocked && typeof enemySystem !== 'undefined') {
            this.asteroidAngle += 2.0 * dt;

            const count = 1 + Math.floor(this.skills.asteroid.level / 2);
            const radius = 2.5;
            const damage = 5 + (this.skills.asteroid.level * 2);

            for (let i = 0; i < count; i++) {
                const angleOffset = (Math.PI * 2 / count) * i;
                const finalAngle = this.asteroidAngle + angleOffset;

                const astX = this.entity.x + Math.cos(finalAngle) * radius;
                const astY = this.entity.y + Math.sin(finalAngle) * radius;

                for (let e of enemySystem.enemies) {
                    const dist = Math.hypot(e.x - astX, e.y - astY);
                    if (dist < 0.8) {
                        e.hp -= damage * dt * 5;
                        e.x += Math.cos(finalAngle) * 5 * dt;
                        e.y += Math.sin(finalAngle) * 5 * dt;

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

        const drawX = (this.entity.x - this.player.x) * tileSize + centerScreenX - tileSize / 2;
        const drawY = (this.entity.y - this.player.y) * tileSize + centerScreenY - tileSize / 2;

        ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(drawX + tileSize / 2, drawY + tileSize / 2 + 5, tileSize / 2, 0, Math.PI * 2);
        ctx.fill();

        if (this.guardianImage && this.guardianImageLoaded) {
            const bounce = Math.abs(Math.sin(Date.now() / 200)) * 5;
            ctx.drawImage(this.guardianImage, drawX, drawY - bounce, tileSize, tileSize);
        }

        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("GUARDIAN", drawX + tileSize / 2, drawY - 5);

        if (this.skills.asteroid.unlocked) {
            const count = 1 + Math.floor(this.skills.asteroid.level / 2);
            const radius = 2.5 * tileSize;

            for (let i = 0; i < count; i++) {
                const angleOffset = (Math.PI * 2 / count) * i;
                const finalAngle = this.asteroidAngle + angleOffset;

                const centerX = drawX + tileSize / 2;
                const centerY = drawY + tileSize / 2;

                const rockX = centerX + Math.cos(finalAngle) * radius;
                const rockY = centerY + Math.sin(finalAngle) * radius;

                ctx.fillStyle = '#555';
                ctx.beginPath();
                ctx.arc(rockX, rockY, 8, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = '#222';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }

    openMenu() {
        if (!this.activeGuardian) return;

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

        if (this.activeGuardian) {
            this.preloadGuardianSprite();
        }
    }
}
