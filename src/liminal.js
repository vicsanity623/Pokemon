class LiminalSystem {
    constructor(player, world) {
        this.player = player;
        this.world = world;
        this.active = false;
        this.sanityTimer = 0;
        
        // Eerie messages from the "AI" or the Game itself
        this.messages = [
            "Are you lost?",
            "There is no code here.",
            "Why are you still walking?",
            "I can see you.",
            "Do not turn off the device.",
            "It's just empty memory.",
            "DATA_CORRUPTION_DETECTED",
            "You are not supposed to be here."
        ];
    }

    // Trigger this when player steps on a "Glitch Tile" or uses a "Corrupted Item"
    enter() {
        this.active = true;
        
        // 1. Kill Music
        const mainMusic = document.getElementById('main-music');
        if (mainMusic) mainMusic.pause();

        // 2. Teleport to "The Void" coordinates (Far away from normal map)
        this.player.x = 10000; 
        this.player.y = 10000;

        // 3. Hide HUD
        document.getElementById('bottom-hud').classList.add('hidden');
        document.getElementById('mobile-controls').style.opacity = '0.3'; // Fade controls

        showDialog("... Connection Lost ...", 3000);
    }

    update(dt) {
        if (!this.active) return;

        // 1. "The Hum" - Random Sanity Events
        this.sanityTimer += dt;
        
        // Every 15-30 seconds, say something creepy
        if (Math.random() < 0.002) { 
            const msg = this.messages[Math.floor(Math.random() * this.messages.length)];
            showDialog(msg, 4000);
        }

        // 2. Glitch Effect - Randomly shake screen
        if (Math.random() < 0.01) {
            document.getElementById('gameCanvas').style.transform = `translate(${Math.random()*4-2}px, ${Math.random()*4-2}px)`;
            setTimeout(() => {
                document.getElementById('gameCanvas').style.transform = 'none';
            }, 100);
        }
    }

    // --- PROCEDURAL HORROR GENERATION ---
    // This replaces the natural world generation with "Backrooms" logic
    getLiminalTile(x, y) {
        // Use Bitwise XOR logic to create unnatural, infinite mazes
        // This creates rigid, non-natural repeating patterns
        
        // 1. The "Mono-Yellow" Walls
        // If (x XOR y) modulo 7 is 0, place a wall.
        // This creates distinct "Alien" architecture.
        if ((Math.floor(x) ^ Math.floor(y)) % 11 === 0) return 'glitch_wall';
        
        // 2. Rare "Corrupted" spots
        if (Math.random() > 0.995) return 'glitch_void';

        return 'glitch_carpet';
    }

    // Custom Colors for the Liminal Space
    getColor(tile) {
        if (tile === 'glitch_wall') return '#d4c572'; // Sickly Yellow (Backrooms Wall)
        if (tile === 'glitch_carpet') return '#bfb48f'; // Dull Beige (Moist Carpet)
        if (tile === 'glitch_void') return '#000'; // Pure Black Hole
        return '#000';
    }
}