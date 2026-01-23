class LiminalEntity {
    constructor(x, y, isParent) {
        this.x = x;
        this.y = y;
        this.isParent = isParent;
        
        // Physics
        this.speed = isParent ? 0.040 : 0.055; // Offspring are faster
        this.size = isParent ? 0.4 : 0.25; // Smaller size to fit in hallways
        this.vx = 0;
        this.vy = 0;

        // "Brain"
        this.viewDistance = 15;
        this.stuckTimer = 0;
        this.wanderAngle = Math.random() * Math.PI * 2;
    }

    update(dt, player, system, state) {
        let desiredX = 0;
        let desiredY = 0;

        // --- 1. BRAIN: DECIDE TARGET ---
        if (state === 'HUNT') {
            // Target Player
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist > 0) {
                desiredX = dx / dist;
                desiredY = dy / dist;
            }
        } else {
            // PROWL (Wander)
            // Change direction slowly
            this.wanderAngle += (Math.random() - 0.5) * 0.5;
            desiredX = Math.cos(this.wanderAngle);
            desiredY = Math.sin(this.wanderAngle);
        }

        // --- 2. COLLISION AVOIDANCE (The "Smart" Part) ---
        // Look ahead. If wall, apply strong force away from it.
        const lookAhead = 0.5;
        const feelers = [
            {x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1},
            {x: 0.7, y: 0.7}, {x: -0.7, y: -0.7}, {x: 0.7, y: -0.7}, {x: -0.7, y: 0.7}
        ];

        let avoidX = 0;
        let avoidY = 0;

        for (let f of feelers) {
            // Check grid at feeler position
            const checkX = this.x + f.x * lookAhead;
            const checkY = this.y + f.y * lookAhead;
            
            // If that spot is a wall...
            if (system.getLiminalTile(checkX, checkY) === 'liminal_wall') {
                // Push AWAY from that wall
                avoidX -= f.x * 2.5; // Strong repulsion
                avoidY -= f.y * 2.5;
            }
        }

        // Combine Desire + Avoidance
        this.vx += (desiredX + avoidX);
        this.vy += (desiredY + avoidY);

        // Normalize speed
        const speedLen = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
        if (speedLen > 0) {
            this.vx = (this.vx / speedLen) * this.speed;
            this.vy = (this.vy / speedLen) * this.speed;
        }

        // --- 3. APPLY MOVEMENT WITH HARD COLLISION CHECK ---
        const nextX = this.x + this.vx;
        const nextY = this.y + this.vy;

        // Check if the new spot is valid (Corner checks for size)
        if (!this.checkWallCollision(nextX, this.y, system)) {
            this.x = nextX;
        } else {
            // Hit wall X, slight bounce/slide
            this.vx *= -0.5;
        }

        if (!this.checkWallCollision(this.x, nextY, system)) {
            this.y = nextY;
        } else {
            // Hit wall Y
            this.vy *= -0.5;
        }

        // --- 4. PLAYER INTERACTION ---
        const distToPlayer = Math.sqrt((player.x - this.x)**2 + (player.y - this.y)**2);
        if (distToPlayer < 0.6 && !system.isHidden) {
            system.corruptSaveFile("CONSUMED");
        }
    }

    // Returns true if entity body hits a wall
    checkWallCollision(x, y, system) {
        // Check 4 corners of the entity based on its size
        const points = [
            {cx: x - this.size/2, cy: y - this.size/2},
            {cx: x + this.size/2, cy: y - this.size/2},
            {cx: x - this.size/2, cy: y + this.size/2},
            {cx: x + this.size/2, cy: y + this.size/2}
        ];

        for (let p of points) {
            if (system.getLiminalTile(p.cx, p.cy) === 'liminal_wall') return true;
        }
        return false;
    }
}

class LiminalSystem {
    constructor(player, world) {
        this.player = player;
        this.world = world;
        this.active = false;
        
        // --- CYCLE MECHANICS ---
        this.state = 'PROWL'; // PROWL (60s) <-> HUNT (60s)
        this.cycleTimer = 0;
        this.CYCLE_DURATION = 60 * 60; // 60 seconds (in frames approx)

        // Tracking
        this.visitedTiles = new Set();
        this.uniqueStepCount = 0;
        this.hasEscaped = false;
        this.isHidden = false;

        // Entities
        this.mainEntity = null;
        this.offspring = []; // Array of 10 small ones
    }

    enter() {
        if (this.active || this.hasEscaped) return;
        this.active = true;
        
        const mainMusic = document.getElementById('main-music');
        if (mainMusic) { mainMusic.pause(); mainMusic.currentTime = 0; }

        this.player.x = 50002; 
        this.player.y = 50002;
        this.visitedTiles.clear();
        this.uniqueStepCount = 0;

        // Spawn Main Entity
        this.mainEntity = new LiminalEntity(50002 + 8, 50002 + 8, true);
        
        // Spawn 10 Offspring randomly around
        this.offspring = [];
        for(let i=0; i<10; i++) {
            let ox = 50002 + (Math.random() * 20 - 10);
            let oy = 50002 + (Math.random() * 20 - 10);
            this.offspring.push(new LiminalEntity(ox, oy, false));
        }

        this.state = 'PROWL';
        this.cycleTimer = 0;

        document.getElementById('bottom-hud').classList.add('hidden');
        document.getElementById('quest-tracker').classList.add('hidden');
        document.getElementById('hamburger-btn').classList.add('hidden');
        document.body.style.backgroundColor = '#1a1a00'; 

        showDialog("... CONNECTION LOST ...", 4000);
    }

    update(dt) {
        if (!this.active) return;

        // 1. UNIQUE STEP TRACKING
        if (this.player.moving && !this.isHidden) {
            const key = `${Math.round(this.player.x)},${Math.round(this.player.y)}`;
            if (!this.visitedTiles.has(key)) {
                this.visitedTiles.add(key);
                this.uniqueStepCount++;
                if (this.uniqueStepCount % 1000 === 0) showDialog(`Data integrity: ${this.uniqueStepCount / 100}%`, 2000);
                if (this.uniqueStepCount === 10000) showDialog("THE EXIT HAS OPENED.", 5000);
            }
        }

        // 2. CYCLE STATE MACHINE
        this.cycleTimer += dt;
        if (this.cycleTimer > 60) { // Every 60 seconds switch
            this.cycleTimer = 0;
            if (this.state === 'PROWL') {
                this.state = 'HUNT';
                showDialog("THE SWARM IS HUNTING.", 3000);
            } else {
                this.state = 'PROWL';
                showDialog("The swarm is quiet...", 3000);
            }
        }

        // 3. UPDATE ENTITIES
        // Main Entity
        if (this.mainEntity) this.mainEntity.update(dt, this.player, this, this.state);
        
        // Offspring
        this.offspring.forEach(child => {
            child.update(dt, this.player, this, this.state);
        });
    }

    // --- INTERACTION ---
    tryInteract() {
        if (!this.active) return false;

        // Exit Logic
        if (this.uniqueStepCount >= 10000) {
            let tile = this.getLiminalTile(this.player.x, this.player.y);
            if (tile === 'liminal_exit') {
                this.escape();
                return true;
            }
        }

        // Locker Logic
        let tile = this.getLiminalTile(this.player.x, this.player.y);
        if (tile === 'liminal_locker') {
            this.toggleHide();
            return true;
        }
        
        return false;
    }

    toggleHide() {
        this.isHidden = !this.isHidden;
        this.player.moving = false; 
        
        if (this.isHidden) {
            showDialog("Hiding in locker...", 1000);
        } else {
            showDialog("Stepped out.", 1000);
        }
    }

    escape() {
        this.active = false;
        this.hasEscaped = true; 
        this.player.x = 0;
        this.player.y = -300; 

        document.getElementById('bottom-hud').classList.remove('hidden');
        document.getElementById('quest-tracker').classList.remove('hidden');
        document.getElementById('hamburger-btn').classList.remove('hidden');
        document.body.style.backgroundColor = 'black'; 

        if (typeof saveGame === 'function') saveGame();

        showDialog("You escaped. The phone is gone.", 5000);
        const mainMusic = document.getElementById('main-music');
        if (mainMusic) mainMusic.play().catch(e=>{});
    }

    corruptSaveFile(reason) {
        this.active = false;
        const canvas = document.getElementById('gameCanvas');
        canvas.style.opacity = '0';
        document.body.style.backgroundColor = 'black';
        document.getElementById('ui-layer').innerHTML = '';
        localStorage.setItem('poke_save', JSON.stringify({
            status: "CORRUPTED",
            reason: reason,
            timestamp: Date.now()
        }));
        alert("FATAL ERROR: SIGNAL LOST.\n\nCAUSE: " + reason);
        window.location.reload();
    }

    // --- GENERATION ---
    getLiminalTile(x, y) {
        let ix = Math.floor(x);
        let iy = Math.floor(y);

        if (this.uniqueStepCount >= 10000) {
             if (Math.abs(ix % 50) === 25 && Math.abs(iy % 50) === 25) return 'liminal_exit';
        }

        // Locker every 20 tiles
        if (Math.abs(ix % 20) === 5 && Math.abs(iy % 20) === 5) {
            return 'liminal_locker';
        }

        // Walls (10x10 Grid)
        let roomX = Math.abs(ix) % 10;
        let roomY = Math.abs(iy) % 10;
        if (roomX === 0 && roomY !== 5) return 'liminal_wall';
        if (roomY === 0 && roomX !== 5) return 'liminal_wall';
        if (roomX === 5 && roomY === 5) return 'liminal_wall'; 

        return 'liminal_floor';
    }

    getColor(tile) {
        if (tile === 'liminal_wall') return '#d4c572'; 
        if (tile === 'liminal_floor') return '#bfb48f'; 
        if (tile === 'liminal_locker') return '#555'; 
        if (tile === 'liminal_exit') return '#fff'; 
        return '#000';
    }

    drawEntity(ctx, canvas, tileSize) {
        if (!this.active) return;

        // Helper to draw one entity
        const drawOne = (ent) => {
            let drawX = (ent.x - this.player.x) * tileSize + canvas.width / 2 - tileSize / 2;
            let drawY = (ent.y - this.player.y) * tileSize + canvas.height / 2 - tileSize / 2;

            // Don't draw if off screen
            if (drawX < -50 || drawX > canvas.width + 50 || drawY < -50 || drawY > canvas.height + 50) return;

            let color = ent.isParent ? 'rgba(0,0,0,0.95)' : 'rgba(50,0,0,0.8)'; // Main is Black, Kids are Dark Red
            let eyeColor = '#fff';

            if (this.state === 'HUNT') { 
                color = ent.isParent ? '#000' : '#500';
                eyeColor = '#ff0000'; 
            }

            // Size scaling
            const size = ent.size * tileSize;

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(drawX + tileSize/2, drawY + tileSize/2, size, 0, Math.PI * 2);
            ctx.fill();

            // Eyes
            ctx.fillStyle = eyeColor;
            ctx.shadowBlur = 10;
            ctx.shadowColor = eyeColor;
            // Adjust eyes based on size
            const eyeSize = ent.isParent ? 5 : 3;
            const eyeOffset = ent.isParent ? tileSize/4 : tileSize/6;
            
            ctx.fillRect(drawX + tileSize/2 - eyeOffset, drawY + tileSize/2 - eyeOffset/2, eyeSize, eyeSize);
            ctx.fillRect(drawX + tileSize/2 + eyeOffset - eyeSize, drawY + tileSize/2 - eyeOffset/2, eyeSize, eyeSize);
            ctx.shadowBlur = 0;
        };

        // Draw Main
        if (this.mainEntity) drawOne(this.mainEntity);

        // Draw Offspring
        this.offspring.forEach(child => drawOne(child));
    }

    getSaveData() {
        return {
            active: this.active,
            hasEscaped: this.hasEscaped,
            uniqueStepCount: this.uniqueStepCount,
            visitedTiles: Array.from(this.visitedTiles),
            state: this.state,
            cycleTimer: this.cycleTimer
            // We don't save entity positions perfectly to keep file small, 
            // they will respawn around start or player on load
        };
    }

    loadSaveData(data) {
        this.active = data.active || false;
        this.hasEscaped = data.hasEscaped || false;
        this.uniqueStepCount = data.uniqueStepCount || 0;
        this.visitedTiles = new Set(data.visitedTiles || []);
        this.state = data.state || 'PROWL';
        this.cycleTimer = data.cycleTimer || 0;

        if (this.active) {
            document.getElementById('bottom-hud').classList.add('hidden');
            document.getElementById('quest-tracker').classList.add('hidden');
            document.getElementById('hamburger-btn').classList.add('hidden');
            document.body.style.backgroundColor = '#1a1a00';
            
            // Respawn entities near player to resume hunt
            this.mainEntity = new LiminalEntity(50002, 50002, true);
            this.offspring = [];
            for(let i=0; i<10; i++) this.offspring.push(new LiminalEntity(50002, 50002, false));

            const mainMusic = document.getElementById('main-music');
            if (mainMusic) mainMusic.pause();
        }
    }
}
