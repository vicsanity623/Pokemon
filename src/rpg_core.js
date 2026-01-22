class RPGSystem {
    constructor(player) {
        this.player = player;
        
        // Survivor Stats
        this.hp = 100;
        this.maxHp = 100;
        this.stamina = 100;
        this.maxStamina = 100;
        this.xp = 0;
        this.level = 1;
        
        // Combat State
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.weaponRange = 1.5; // Tiles
        
        // Create UI
        this.createHUD();
    }

    createHUD() {
        // Player HP Bar Container
        const hud = document.createElement('div');
        hud.id = 'rpg-hud';
        hud.style.position = 'absolute';
        hud.style.top = '10px';
        hud.style.left = '10px'; // Top Left (Moves existing stats down if needed)
        hud.style.width = '200px';
        hud.style.zIndex = '500';
        hud.style.fontFamily = 'monospace';
        hud.style.pointerEvents = 'none';

        hud.innerHTML = `
            <div style="margin-bottom:5px; color:white; text-shadow:1px 1px 0 #000;">
                <span id="rpg-name">SURVIVOR</span> Lv.<span id="rpg-level">1</span>
            </div>
            <!-- HP -->
            <div style="width:100%; height:15px; background:#333; border:2px solid #000; margin-bottom:2px;">
                <div id="rpg-hp-bar" style="width:100%; height:100%; background:#e74c3c; transition:width 0.2s;"></div>
            </div>
            <!-- STAMINA -->
            <div style="width:100%; height:8px; background:#333; border:2px solid #000;">
                <div id="rpg-stamina-bar" style="width:100%; height:100%; background:#f1c40f; transition:width 0.2s;"></div>
            </div>
        `;
        document.body.appendChild(hud);

        // Attack Button (Mobile/Desktop)
        const btn = document.createElement('div');
        btn.id = 'btn-attack';
        btn.className = 'action-btn'; // Re-use existing style
        btn.style.bottom = '120px';
        btn.style.right = '20px';
        btn.style.backgroundColor = '#7f8c8d'; // Grey/Steel color
        btn.innerText = '⚔️';
        btn.onpointerdown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.triggerAttack();
        };
        document.getElementById('action-btns').appendChild(btn);
    }

    update(dt) {
        // Stamina Regen
        if (this.stamina < this.maxStamina) {
            this.stamina += dt * 5; // 5 per second
        }

        // Attack Cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        } else {
            this.isAttacking = false;
        }

        this.updateHUD();
    }

    triggerAttack() {
        if (this.attackCooldown > 0 || this.stamina < 10) return;

        this.isAttacking = true;
        this.stamina -= 10;
        this.attackCooldown = 0.4; 

        // Visual Feedback
        const canvas = document.getElementById('gameCanvas');
        canvas.style.transform = `translate(${Math.random()*4-2}px, ${Math.random()*4-2}px)`;
        setTimeout(() => canvas.style.transform = 'none', 100);

        if (typeof playSFX === 'function') playSFX('sfx-attack1');

        // --- WIDE SWEEP HIT DETECTION (3 Tiles) ---
        const targets = [];
        const px = Math.round(this.player.x);
        const py = Math.round(this.player.y);

        // Add tiles based on facing direction
        if (this.player.dir === 'left') {
            targets.push({x: px-1, y: py}, {x: px-1, y: py-1}, {x: px-1, y: py+1});
        } else if (this.player.dir === 'right') {
            targets.push({x: px+1, y: py}, {x: px+1, y: py-1}, {x: px+1, y: py+1});
        } else if (this.player.dir === 'up') {
            targets.push({x: px, y: py-1}, {x: px-1, y: py-1}, {x: px+1, y: py-1});
        } else if (this.player.dir === 'down') {
            targets.push({x: px, y: py+1}, {x: px-1, y: py+1}, {x: px+1, y: py+1});
        }

        // 1. Check Resources
        if (typeof resourceSystem !== 'undefined') {
            for (let t of targets) {
                const hit = resourceSystem.checkHit(t.x, t.y, 1);
                if (hit) return; // Stop if we hit a resource (don't hit enemy through tree)
            }
        }

        // 2. Check Enemies (Phase 4 Fix)
        if (typeof enemySystem !== 'undefined') {
            for (let t of targets) {
                // Pass the target tile to checkHit
                const hitEnemy = enemySystem.checkHit(t.x, t.y, 10); // 10 Damage
                if (hitEnemy) return; 
            }
        }
    }

    updateHUD() {
        const hpPct = Math.max(0, (this.hp / this.maxHp) * 100);
        const stamPct = Math.max(0, (this.stamina / this.maxStamina) * 100);

        document.getElementById('rpg-hp-bar').style.width = `${hpPct}%`;
        document.getElementById('rpg-stamina-bar').style.width = `${stamPct}%`;
        document.getElementById('rpg-level').innerText = this.level;
    }

    gainXP(amount) {
        this.xp += amount;
        if (this.xp >= this.level * 100) {
            this.level++;
            this.xp = 0;
            this.maxHp += 10;
            this.hp = this.maxHp;
            showDialog(`Survivor Level Up! (Lv.${this.level})`, 2000);
        }
    }

    // Save/Load
    getSaveData() {
        return {
            hp: this.hp,
            maxHp: this.maxHp,
            xp: this.xp,
            level: this.level
        };
    }

    loadSaveData(data) {
        this.hp = data.hp || 100;
        this.maxHp = data.maxHp || 100;
        this.xp = data.xp || 0;
        this.level = data.level || 1;
    }
}
