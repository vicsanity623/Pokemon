class LiminalSystem {
    constructor(player, world) {
        this.player = player;
        this.world = world;
        this.active = false;
        this.sanityTimer = 0;
        
        // The Trigger Location (Relative to House)
        this.triggerOffset = { x: 0, y: 666 }; // 666 steps South
    }

    // Call this when the player touches the "Telephone"
    enter() {
        if (this.active) return;
        this.active = true;
        
        // 1. Cut Audio
        const mainMusic = document.getElementById('main-music');
        if (mainMusic) {
            mainMusic.pause();
            mainMusic.currentTime = 0;
        }

        // 2. Teleport to "The Void" (Far coordinates)
        // We move them far away so the map generation math changes completely
        this.player.x = 50000; 
        this.player.y = 50000;

        // 3. UI Glitch
        document.getElementById('bottom-hud').classList.add('hidden');
        document.getElementById('quest-tracker').classList.add('hidden');
        document.body.style.backgroundColor = '#1a1a00'; // Sickly dark yellow bg

        showDialog("... Connection Lost ...", 4000);
        
        // 4. Play a low hum (Optional: use an existing SFX pitched down or just silence)
    }

    update(dt) {
        if (!this.active) return;

        this.sanityTimer += dt;

        // Random Creepy Events
        if (Math.random() < 0.001) { // Rare tick
            const msgs = [
                "Why are you here?",
                "It's just memory.",
                "Turn it off.",
                "I see you.",
                "NULL_POINTER_EXCEPTION",
                "Don't look behind you."
            ];
            showDialog(msgs[Math.floor(Math.random() * msgs.length)], 3000);
        }

        // Screen Shake Glitch
        if (Math.random() < 0.005) {
            const canvas = document.getElementById('gameCanvas');
            canvas.style.transform = `translate(${Math.random()*10-5}px, ${Math.random()*10-5}px)`;
            setTimeout(() => canvas.style.transform = 'none', 50);
        }
    }

    // --- PROCEDURAL HORROR GENERATION ---
    // Returns special tiles based on Bitwise Math (The "Backrooms" look)
    getLiminalTile(x, y) {
        let ix = Math.floor(x);
        let iy = Math.floor(y);

        // The "Mono-Yellow" Maze Pattern
        // (x XOR y) % 11 creates non-natural, alien corridors
        if ((ix ^ iy) % 11 === 0) return 'liminal_wall';
        
        // Occasional "Void" holes
        if (Math.random() > 0.99) return 'liminal_void';

        return 'liminal_floor'; // Moist Carpet
    }

    getColor(tile) {
        if (tile === 'liminal_wall') return '#d4c572'; // Backrooms Yellow
        if (tile === 'liminal_floor') return '#bfb48f'; // Dull Beige
        if (tile === 'liminal_void') return '#000000'; // Pure Black
        return '#000';
    }
}