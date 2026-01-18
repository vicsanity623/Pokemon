class LiminalSystem {
    constructor(player, world) {
        this.player = player;
        this.world = world;
        this.active = false;
        
        // Doom Mechanics
        this.sanityTimer = 0;
        this.isHunting = false;
        
        // The Trigger Location (Relative to House)
        this.triggerOffset = { x: 0, y: 666 }; 

        // The Entity
        this.entity = { x: 0, y: 0, active: false };
    }

    enter() {
        if (this.active) return;
        this.active = true;
        
        const mainMusic = document.getElementById('main-music');
        if (mainMusic) { mainMusic.pause(); mainMusic.currentTime = 0; }

        // FIX: Teleport to 50002 (Floor), not 50000 (Wall)
        this.player.x = 50002; 
        this.player.y = 50002;

        // Activate Entity nearby (also on floor coordinates)
        this.entity.x = 50002 + 5; 
        this.entity.y = 50002;
        this.entity.active = true;

        // Hide UI
        document.getElementById('bottom-hud').classList.add('hidden');
        document.getElementById('quest-tracker').classList.add('hidden');
        document.getElementById('hamburger-btn').classList.add('hidden');
        document.body.style.backgroundColor = '#1a1a00'; 

        showDialog("... CONNECTION LOST ...", 4000);
    }

    update(dt) {
        if (!this.active) return;

        this.sanityTimer += dt;

        // --- 1. THE HUNT BEGINS (After 30 seconds) ---
        if (this.sanityTimer > 30 && !this.isHunting) {
            this.isHunting = true;
            showDialog("IT SEES YOU.", 3000);
        }

        // --- 2. ENTITY MOVEMENT ---
        if (this.entity.active) {
            if (this.isHunting) {
                // CHASE MODE: Move directly towards player
                const dx = this.player.x - this.entity.x;
                const dy = this.player.y - this.entity.y;
                // It moves slightly faster than the player (0.045 vs 0.04)
                this.entity.x += dx * 0.045; 
                this.entity.y += dy * 0.045;
            } else {
                // MIRROR MODE (False sense of safety)
                const startX = 50000;
                const diffX = this.player.x - startX;
                const targetX = startX - diffX + 10;
                const targetY = this.player.y;
                
                this.entity.x += (targetX - this.entity.x) * 0.1;
                this.entity.y += (targetY - this.entity.y) * 0.1;
            }
        }

        // --- 3. DEATH CHECKS ---
        
        // A. Touched by Entity
        const distToEntity = Math.sqrt(
            Math.pow(this.player.x - this.entity.x, 2) + 
            Math.pow(this.player.y - this.entity.y, 2)
        );
        if (distToEntity < 0.8) {
            this.corruptSaveFile("CAUGHT");
        }

        // B. Fell into Void
        // We use the same math as getLiminalTile to check if player is on a void tile
        if (Math.random() > 0.99) { // Using the same seed logic would be better, but random chance for trap works too
             // Actually, let's trust the player position relative to the visual void
             // If we implemented exact collision in world.js, this is handled, 
             // but let's add a "Trap" mechanic here just in case.
        }

        // Random Creepy Events
        if (Math.random() < 0.005) { 
            const msgs = ["GIVE UP", "THERE IS NO EXIT", "00000000", "DATA ROT"];
            if (this.isHunting) msgs.push("RUN", "IT IS FAST", "BEHIND YOU");
            showDialog(msgs[Math.floor(Math.random() * msgs.length)], 2000);
        }
    }

    // --- CORRUPTION LOGIC ---
    corruptSaveFile(reason) {
        this.active = false; // Stop updating
        
        // 1. Blackout Screen
        const canvas = document.getElementById('gameCanvas');
        canvas.style.opacity = '0';
        document.body.style.backgroundColor = 'black';
        document.getElementById('ui-layer').innerHTML = ''; // Delete all UI
        
        // 2. CORRUPT THE SAVE DATA
        // We replace the valid JSON with a "Dead" marker
        localStorage.setItem('poke_save', JSON.stringify({
            status: "CORRUPTED",
            reason: reason,
            timestamp: Date.now()
        }));

        // 3. Final Message
        alert("FATAL ERROR: ENTITY INTERACTION DETECTED.\nSYSTEM HALTED.");
        
        // 4. Reload page (which will now be broken)
        window.location.reload();
    }

    // --- GENERATION ---
    getLiminalTile(x, y) {
        let ix = Math.floor(x);
        let iy = Math.floor(y);

        // Maze Pattern
        let roomX = Math.abs(ix) % 10;
        let roomY = Math.abs(iy) % 10;

        if (roomX === 0 && roomY !== 5) return 'liminal_wall';
        if (roomY === 0 && roomX !== 5) return 'liminal_wall';
        if (roomX === 5 && roomY === 5) return 'liminal_wall'; // Pillar

        // The Pit (Trap) - 1% chance of a hole in the floor
        // Using bitwise hash to make it deterministic (so it stays in the same spot)
        if (((ix * 13) ^ (iy * 7)) % 100 === 0) return 'liminal_void';

        return 'liminal_floor';
    }

    getColor(tile) {
        if (tile === 'liminal_wall') return '#d4c572'; 
        if (tile === 'liminal_floor') return '#bfb48f'; 
        if (tile === 'liminal_void') return '#000'; 
        return '#000';
    }

    drawEntity(ctx, canvas, tileSize) {
        if (!this.active || !this.entity.active) return;

        let drawX = (this.entity.x - this.player.x) * tileSize + canvas.width / 2 - tileSize / 2;
        let drawY = (this.entity.y - this.player.y) * tileSize + canvas.height / 2 - tileSize / 2;

        // Make it shake when hunting
        if (this.isHunting) {
            drawX += (Math.random() * 4 - 2);
            drawY += (Math.random() * 4 - 2);
        }

        // Draw Shadowy Figure
        ctx.fillStyle = this.isHunting ? '#330000' : 'rgba(0, 0, 0, 0.9)'; // Dark Red when hunting
        ctx.beginPath();
        ctx.arc(drawX + tileSize/2, drawY + tileSize/2, tileSize/2, 0, Math.PI * 2);
        ctx.fill();

        // Glowing Eyes (Red when hunting)
        ctx.fillStyle = this.isHunting ? '#ff0000' : '#fff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fillRect(drawX + tileSize/3, drawY + tileSize/3, 5, 5);
        ctx.fillRect(drawX + tileSize/1.5, drawY + tileSize/3, 5, 5);
        ctx.shadowBlur = 0;
    }
}
