// A simple Q-Learning Brain
class QBrain {
    constructor() {
        this.qTable = {}; 
        this.learningRate = 0.1;
        this.discountFactor = 0.9;
        this.explorationRate = 0.2; 
    }

    getStateKey(inputs) {
        return inputs.join(',');
    }

    getAction(state) {
        const key = this.getStateKey(state);
        if (!this.qTable[key]) {
            this.qTable[key] = [0, 0, 0, 0]; 
        }

        if (Math.random() < this.explorationRate) {
            return Math.floor(Math.random() * 4);
        } else {
            return this.qTable[key].indexOf(Math.max(...this.qTable[key]));
        }
    }

    reward(state, action, reward, nextState) {
        const key = this.getStateKey(state);
        const nextKey = this.getStateKey(nextState);

        if (!this.qTable[key]) this.qTable[key] = [0, 0, 0, 0];
        if (!this.qTable[nextKey]) this.qTable[nextKey] = [0, 0, 0, 0];

        const oldVal = this.qTable[key][action];
        const nextMax = Math.max(...this.qTable[nextKey]);

        const newVal = oldVal + this.learningRate * (reward + this.discountFactor * nextMax - oldVal);
        this.qTable[key][action] = newVal;
    }
}

class LiminalEntity {
    constructor(x, y, isParent) {
        this.x = x;
        this.y = y;
        this.isParent = isParent;
        
        this.speed = isParent ? 0.040 : 0.060; 
        this.size = isParent ? 0.4 : 0.25; 

        // THE BRAIN
        this.brain = new QBrain();
        this.lastState = null;
        this.lastAction = null;
        this.stuckTimer = 0;
    }

    update(dt, player, system, state) {
        // 1. OBSERVE ENVIRONMENT
        const wallN = system.getLiminalTile(this.x, this.y - 1) === 'liminal_wall' ? 1 : 0;
        const wallS = system.getLiminalTile(this.x, this.y + 1) === 'liminal_wall' ? 1 : 0;
        const wallW = system.getLiminalTile(this.x - 1, this.y) === 'liminal_wall' ? 1 : 0;
        const wallE = system.getLiminalTile(this.x + 1, this.y) === 'liminal_wall' ? 1 : 0;

        let dx = player.x - this.x;
        let dy = player.y - this.y;
        
        let quadrant = 0;
        if (dx >= 0 && dy < 0) quadrant = 1;
        if (dx < 0 && dy >= 0) quadrant = 2;
        if (dx >= 0 && dy >= 0) quadrant = 3;

        if (state !== 'HUNT') quadrant = Math.floor(Math.random() * 4);

        const currentState = [wallN, wallS, wallW, wallE, quadrant];

        // 2. DECIDE ACTION
        const action = this.brain.getAction(currentState);

        // 3. EXECUTE ACTION
        let vx = 0, vy = 0;
        if (action === 0) vy = -this.speed;
        if (action === 1) vy = this.speed;
        if (action === 2) vx = -this.speed;
        if (action === 3) vx = this.speed;

        const nextX = this.x + vx;
        const nextY = this.y + vy;
        let reward = -0.1; 

        // 4. CHECK COLLISION & CALCULATE REWARD
        let hitWall = false;
        if (this.checkWallCollision(nextX, nextY, system)) {
            hitWall = true;
            reward = -10; 
            this.x -= vx * 2;
            this.y -= vy * 2;
        } else {
            this.x = nextX;
            this.y = nextY;
            
            const newDist = Math.sqrt((player.x - this.x)**2 + (player.y - this.y)**2);
            const oldDist = Math.sqrt((player.x - (this.x-vx))**2 + (player.y - (this.y-vy))**2);
            
            if (newDist < oldDist) reward += 2; 
            else reward -= 1; 
        }

        // 5. LEARN
        if (this.lastState) {
            this.brain.reward(this.lastState, this.lastAction, reward, currentState);
        }

        this.lastState = currentState;
        this.lastAction = action;

        // --- DEATH CHECK ---
        const distToPlayer = Math.sqrt((player.x - this.x)**2 + (player.y - this.y)**2);
        if (distToPlayer < 0.6 && !system.isHidden) {
            system.corruptSaveFile("CONSUMED");
        }
    }

    checkWallCollision(x, y, system) {
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
        
        this.state = 'MIRROR';
        this.stateTimer = 0;
        
        this.visitedTiles = new Set();
        this.uniqueStepCount = 0;
        this.hasEscaped = false;

        this.isHidden = false;
        this.hiddenX = 0;
        this.hiddenY = 0;

        this.mainEntity = null;
        this.offspring = []; 
    }

    // --- NEW HELPER: FIND SAFE SPAWN ---
    findSafeSpawn(centerX, centerY) {
        // Try 20 times to find a floor tile
        for (let i = 0; i < 20; i++) {
            let rx = centerX + (Math.random() * 20 - 10);
            let ry = centerY + (Math.random() * 20 - 10);
            
            // Check tile type (Must not be wall or locker)
            let tile = this.getLiminalTile(rx, ry);
            if (tile !== 'liminal_wall' && tile !== 'liminal_locker') {
                return { x: rx, y: ry };
            }
        }
        // Fallback: Just return center (hopefully safe-ish)
        return { x: centerX, y: centerY };
    }

    enter() {
        if (this.active || this.hasEscaped) return;
        this.active = true;
        
        const mainMusic = document.getElementById('main-music');
        if (mainMusic) { mainMusic.pause(); mainMusic.currentTime = 0; }

        // 50002 is safe (floor)
        this.player.x = 50002; 
        this.player.y = 50002;
        this.visitedTiles.clear();
        this.uniqueStepCount = 0;

        // Spawn Main Entity (Safe Spot)
        let mainPos = this.findSafeSpawn(50002, 50002);
        this.mainEntity = new LiminalEntity(mainPos.x, mainPos.y, true);
        
        // Spawn 10 Offspring (Safe Spots)
        this.offspring = [];
        for(let i=0; i<10; i++) {
            let kidPos = this.findSafeSpawn(50002, 50002);
            this.offspring.push(new LiminalEntity(kidPos.x, kidPos.y, false));
        }

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

        // 1. UNIQUE STEP TRACKING
        if (this.player.moving && !this.isHidden) {
            const key = `${Math.round(this.player.x)},${Math.round(this.player.y)}`;
            if (!this.visitedTiles.has(key)) {
                this.visitedTiles.add(key);
                this.uniqueStepCount++;
                if (this.uniqueStepCount % 1000 === 0) showDialog(`Data integrity: ${this.uniqueStepCount / 100}%`, 2000);
                if (this.uniqueStepCount === 10000) showDialog("A TEAR IN REALITY HAS OPENED.", 5000);
            }
        }

        // 2. AI STATE MACHINE
        this.stateTimer += dt;

        if (this.state === 'MIRROR') {
            if (this.stateTimer > 30) {
                this.state = 'HUNT';
                this.stateTimer = 0;
                showDialog("IT SEES YOU.", 3000);
            }
        } 
        else if (this.state === 'HUNT') {
            if (this.isHidden) {
                this.state = 'SEARCH';
                this.stateTimer = 0;
                showDialog("It is searching...", 2000);
            }
        }
        else if (this.state === 'SEARCH') {
            if (this.stateTimer > 40) {
                this.state = 'MIRROR';
                this.stateTimer = 0;
                showDialog("It lost interest... for now.", 3000);
            }
        }

        // 3. UPDATE ENTITIES
        if (this.mainEntity) this.mainEntity.update(dt, this.player, this, this.state);
        
        this.offspring.forEach(child => {
            child.update(dt, this.player, this, this.state);
        });
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
        window.location.replace(window.location.href);
    }

    getLiminalTile(x, y) {
        let ix = Math.floor(x);
        let iy = Math.floor(y);

        // --- HARDCODED SAFE LOCKER (Right of Spawn) ---
        if (ix === 50005 && iy === 50002) return 'liminal_locker';
        // ----------------------------------------------

        if (this.uniqueStepCount >= 10000) {
             if (Math.abs(ix % 50) === 25 && Math.abs(iy % 50) === 25) return 'liminal_exit';
        }

        // Standard Locker every 20 tiles
        if (Math.abs(ix % 20) === 5 && Math.abs(iy % 20) === 5) {
            return 'liminal_locker';
        }
        
        // ... rest of wall logic ...
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

        const drawOne = (ent) => {
            let drawX = (ent.x - this.player.x) * tileSize + canvas.width / 2 - tileSize / 2;
            let drawY = (ent.y - this.player.y) * tileSize + canvas.height / 2 - tileSize / 2;

            if (drawX < -50 || drawX > canvas.width + 50 || drawY < -50 || drawY > canvas.height + 50) return;

            let color = ent.isParent ? 'rgba(0,0,0,0.95)' : 'rgba(50,0,0,0.8)';
            let eyeColor = '#fff';

            if (this.state === 'HUNT') { 
                color = ent.isParent ? '#000' : '#500';
                eyeColor = '#ff0000'; 
            }

            const size = ent.size * tileSize;

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(drawX + tileSize/2, drawY + tileSize/2, size, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = eyeColor;
            ctx.shadowBlur = 10;
            ctx.shadowColor = eyeColor;
            const eyeSize = ent.isParent ? 5 : 3;
            const eyeOffset = ent.isParent ? tileSize/4 : tileSize/6;
            
            ctx.fillRect(drawX + tileSize/2 - eyeOffset, drawY + tileSize/2 - eyeOffset/2, eyeSize, eyeSize);
            ctx.fillRect(drawX + tileSize/2 + eyeOffset - eyeSize, drawY + tileSize/2 - eyeOffset/2, eyeSize, eyeSize);
            ctx.shadowBlur = 0;
        };

        if (this.mainEntity) drawOne(this.mainEntity);
        this.offspring.forEach(child => drawOne(child));
    }

    getSaveData() {
        return {
            active: this.active,
            hasEscaped: this.hasEscaped,
            uniqueStepCount: this.uniqueStepCount,
            visitedTiles: Array.from(this.visitedTiles),
            state: this.state,
            stateTimer: this.stateTimer
            // Brains reset on load to prevent save bloat
        };
    }

    loadSaveData(data) {
        this.active = data.active || false;
        this.hasEscaped = data.hasEscaped || false;
        this.uniqueStepCount = data.uniqueStepCount || 0;
        this.visitedTiles = new Set(data.visitedTiles || []);
        this.state = data.state || 'MIRROR';
        this.stateTimer = data.stateTimer || 0;

        if (this.active) {
            document.getElementById('bottom-hud').classList.add('hidden');
            document.getElementById('quest-tracker').classList.add('hidden');
            document.getElementById('hamburger-btn').classList.add('hidden');
            document.body.style.backgroundColor = '#1a1a00';
            
            // Respawn Safely on Load
            let mainPos = this.findSafeSpawn(50002, 50002);
            this.mainEntity = new LiminalEntity(mainPos.x, mainPos.y, true);
            
            this.offspring = [];
            for(let i=0; i<10; i++) {
                let kidPos = this.findSafeSpawn(50002, 50002);
                this.offspring.push(new LiminalEntity(kidPos.x, kidPos.y, false));
            }

            const mainMusic = document.getElementById('main-music');
            if (mainMusic) mainMusic.pause();
        }
    }
}
