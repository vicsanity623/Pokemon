class LiminalSystem {
    constructor(player, world) {
        this.player = player;
        this.world = world;
        this.active = false;
        this.sanityTimer = 0;
        
        // The Trigger Location (Relative to House)
        this.triggerOffset = { x: 0, y: 666 }; 

        // Mirror Entity State
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

        // --- MIRROR ENTITY LOGIC ---
        if (this.entity.active) {
            // It mimics player movement but INVERTED on X axis relative to start
            const startX = 50000;
            const diffX = this.player.x - startX;
            
            // Target is mirror position
            const targetX = startX - diffX + 10; // +10 offset so it starts away
            const targetY = this.player.y;

            // Smoothly slide entity to mirror position
            this.entity.x += (targetX - this.entity.x) * 0.1;
            this.entity.y += (targetY - this.entity.y) * 0.1;
        }

        // Random Creepy Events
        if (Math.random() < 0.001) { 
            const msgs = ["It mimics you.", "Don't touch it.", "NULL", "0xFFFFFF"];
            showDialog(msgs[Math.floor(Math.random() * msgs.length)], 3000);
        }
    }

    // --- IMPROVED MAZE GENERATION ---
    getLiminalTile(x, y) {
        let ix = Math.floor(x);
        let iy = Math.floor(y);

        // 1. Create "Rooms" and "Hallways" using Modulo
        // Rooms every 10 tiles, Hallways connecting them
        let roomX = Math.abs(ix) % 10;
        let roomY = Math.abs(iy) % 10;

        // If we are at the border of a 10x10 block, it's a wall...
        // UNLESS it's the middle (Doorway)
        if (roomX === 0 && roomY !== 5) return 'liminal_wall';
        if (roomY === 0 && roomX !== 5) return 'liminal_wall';

        // 2. Pillars in the middle of rooms
        if (roomX === 5 && roomY === 5) return 'liminal_wall';

        return 'liminal_floor';
    }

    getColor(tile) {
        if (tile === 'liminal_wall') return '#d4c572'; // Wall
        if (tile === 'liminal_floor') return '#bfb48f'; // Floor
        return '#000';
    }

    // Call this from Renderer to draw the Entity
    drawEntity(ctx, canvas, tileSize) {
        if (!this.active || !this.entity.active) return;

        let drawX = (this.entity.x - this.player.x) * tileSize + canvas.width / 2 - tileSize / 2;
        let drawY = (this.entity.y - this.player.y) * tileSize + canvas.height / 2 - tileSize / 2;

        // Draw Shadowy Figure
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.beginPath();
        ctx.arc(drawX + tileSize/2, drawY + tileSize/2, tileSize/2, 0, Math.PI * 2);
        ctx.fill();

        // Glowing White Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(drawX + tileSize/3, drawY + tileSize/3, 5, 2);
        ctx.fillRect(drawX + tileSize/1.5, drawY + tileSize/3, 5, 2);
    }
}
