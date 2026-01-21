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
        // Moves 5% of the distance per frame
        const dx = targetX - this.entity.x;
        const dy = targetY - this.entity.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist > 1.5) { // Stop if close
            this.entity.x += dx * 2.0 * dt;
            this.entity.y += dy * 2.0 * dt;
        }

        // --- SKILL LOGIC (Auto-Heal) ---
        // Simple example: Heal player every 10 seconds
        if (Math.random() < 0.001) { // Random tick
            if (typeof rpgSystem !== 'undefined' && rpgSystem.hp < rpgSystem.maxHp) {
                rpgSystem.hp = Math.min(rpgSystem.maxHp, rpgSystem.hp + 5);
                showDialog(`${this.activeGuardian.name} cast Heal Pulse!`, 1000);
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