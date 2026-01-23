class LiminalSystem {
    constructor(player, world) {
        this.player = player;
        this.world = world;
        this.active = false;
        
        // --- DOOM MECHANICS ---
        this.state = 'MIRROR'; // MIRROR, HUNT, SEARCH
        this.stateTimer = 0;
        
        // Tracking
        this.visitedTiles = new Set();
        this.uniqueStepCount = 0;
        this.hasEscaped = false;

        // Hiding
        this.isHidden = false;
        this.hiddenX = 0;
        this.hiddenY = 0;

        // The Entity
        this.entity = { x: 0, y: 0, active: false };
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

        this.entity.x = 50002 + 10;
        this.entity.y = 50002;
        this.entity.active = true;
        this.state = 'MIRROR';
        this.stateTimer = 0;

        document.getElementById('bottom-hud').classList.add('hidden');
        document.getElementById('quest-tracker').classList.add('hidden');
        document.getElementById('hamburger-btn').classList.add('hidden');
        document.body.style.backgroundColor = '#1a1a00'; 

        showDialog("... CONNECTION LOST ...", 4000);
    }

    update(dt) {
        if (!this.active) return;

        // 1. TRACK UNIQUE STEPS
        if (this.player.moving && !this.isHidden) {
            const key = `${Math.round(this.player.x)},${Math.round(this.player.y)}`;
            if (!this.visitedTiles.has(key)) {
                this.visitedTiles.add(key);
                this.uniqueStepCount++;
                if (this.uniqueStepCount % 1000 === 0) showDialog(`Data recovered: ${this.uniqueStepCount / 100}%`, 2000);
                if (this.uniqueStepCount === 10000) showDialog("A TEAR IN REALITY HAS OPENED.", 5000);
            }
        }

        // 2. AI STATE MACHINE
        this.stateTimer += dt;
        let targetX = this.entity.x;
        let targetY = this.entity.y;
        let speed = 0;

        if (this.state === 'MIRROR') {
            const startX = 50000;
            const diffX = this.player.x - startX;
            targetX = startX - diffX + 10;
            targetY = this.player.y;
            speed = 0.08; // Slower mirror

            if (this.stateTimer > 30) {
                this.state = 'HUNT';
                this.stateTimer = 0;
                showDialog("IT SEES YOU.", 3000);
            }
        } 
        else if (this.state === 'HUNT') {
            if (!this.isHidden) {
                targetX = this.player.x;
                targetY = this.player.y;
                speed = 0.042; // Slightly faster than player (0.04)

                const dist = Math.sqrt((this.player.x - this.entity.x)**2 + (this.player.y - this.entity.y)**2);
                if (dist < 0.8) this.corruptSaveFile("CAUGHT");
            } else {
                this.state = 'SEARCH';
                this.stateTimer = 0;
                showDialog("It is searching...", 2000);
            }
        }
        else if (this.state === 'SEARCH') {
            // Wobbly movement
            targetX = this.player.x + (Math.random() - 0.5) * 5;
            targetY = this.player.y + (Math.random() - 0.5) * 5;
            speed = 0.02;

            if (this.stateTimer > 40) {
                this.state = 'MIRROR';
                this.stateTimer = 0;
                showDialog("It lost interest... for now.", 3000);
            }
        }

        // --- ENTITY MOVEMENT WITH COLLISION ---
        if (this.entity.active) {
            const dx = targetX - this.entity.x;
            const dy = targetY - this.entity.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist > 0.1) {
                // Potential new position
                const nextX = this.entity.x + (dx / dist) * speed;
                const nextY = this.entity.y + (dy / dist) * speed;
                
                // Check Wall Collision
                const tile = this.getLiminalTile(nextX, nextY);
                if (tile !== 'liminal_wall') {
                    this.entity.x = nextX;
                    this.entity.y = nextY;
                }
            }
        }
    }

    tryInteract() {
        if (!this.active) return false;

        if (this.uniqueStepCount >= 10000) {
            let tile = this.getLiminalTile(this.player.x, this.player.y);
            if (tile === 'liminal_exit') {
                this.escape();
                return true;
            }
        }

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
            if (this.state === 'SEARCH') {
                this.state = 'HUNT';
                showDialog("YOU REVEALED YOURSELF!", 2000);
            } else {
                showDialog("Stepped out.", 1000);
            }
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

        showDialog("You escaped the void... The phone is gone.", 5000);
        
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
        alert("FATAL ERROR: ENTITY INTERACTION DETECTED.\nSYSTEM HALTED.");
        window.location.reload();
    }

    getLiminalTile(x, y) {
        let ix = Math.floor(x);
        let iy = Math.floor(y);

        if (this.uniqueStepCount >= 10000) {
             if (Math.abs(ix % 50) === 25 && Math.abs(iy % 50) === 25) return 'liminal_exit';
        }

        let roomX = Math.abs(ix) % 10;
        let roomY = Math.abs(iy) % 10;

        if (Math.abs(ix % 20) === 5 && Math.abs(iy % 20) === 5) {
            return 'liminal_locker';
        }

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
        if (!this.active || !this.entity.active) return;

        let drawX = (this.entity.x - this.player.x) * tileSize + canvas.width / 2 - tileSize / 2;
        let drawY = (this.entity.y - this.player.y) * tileSize + canvas.height / 2 - tileSize / 2;

        if (this.state === 'HUNT') {
            drawX += (Math.random() * 4 - 2);
            drawY += (Math.random() * 4 - 2);
        }

        let color = 'rgba(0,0,0,0.9)';
        let eyeColor = '#fff';

        if (this.state === 'HUNT') { color = '#330000'; eyeColor = '#ff0000'; }
        if (this.state === 'SEARCH') { color = '#331a00'; eyeColor = '#ffa500'; }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(drawX + tileSize/2, drawY + tileSize/2, tileSize/2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = eyeColor;
        ctx.shadowBlur = 10;
        ctx.shadowColor = eyeColor;
        ctx.fillRect(drawX + tileSize/3, drawY + tileSize/3, 5, 5);
        ctx.fillRect(drawX + tileSize/1.5, drawY + tileSize/3, 5, 5);
        ctx.shadowBlur = 0;
    }

    getSaveData() {
        return {
            active: this.active,
            hasEscaped: this.hasEscaped,
            uniqueStepCount: this.uniqueStepCount,
            visitedTiles: Array.from(this.visitedTiles),
            state: this.state,
            stateTimer: this.stateTimer,
            entity: this.entity
        };
    }

    loadSaveData(data) {
        this.active = data.active || false;
        this.hasEscaped = data.hasEscaped || false;
        this.uniqueStepCount = data.uniqueStepCount || 0;
        this.visitedTiles = new Set(data.visitedTiles || []);
        this.state = data.state || 'MIRROR';
        this.stateTimer = data.stateTimer || 0;
        this.entity = data.entity || { x: 0, y: 0, active: false };

        if (this.active) {
            document.getElementById('bottom-hud').classList.add('hidden');
            document.getElementById('quest-tracker').classList.add('hidden');
            document.getElementById('hamburger-btn').classList.add('hidden');
            document.body.style.backgroundColor = '#1a1a00';
            const mainMusic = document.getElementById('main-music');
            if (mainMusic) mainMusic.pause();
        }
    }
}
