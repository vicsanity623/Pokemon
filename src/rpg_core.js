class RPGSystem {
    constructor(player) {
        this.player = player;
        
        // Stats
        this.hp = 100;
        this.maxHp = 100;
        this.stamina = 100;
        this.maxStamina = 100;
        this.xp = 0;
        this.level = 1;
        
        // Combat
        this.isAttacking = false;
        this.attackCooldown = 0;
        
        // Equipment Slots
        this.equipment = {
            weapon: null, // { name, damage, id }
            armor: null,  // { name, defense, id }
            accessory: null // { name, effect, id }
        };

        this.createHUD();
    }

    // Calculate total damage
    getDamage() {
        let base = 1; // Fists
        if (this.equipment.weapon) base = this.equipment.weapon.damage;
        // Level scaling: +10% per level
        return Math.floor(base * (1 + (this.level * 0.1)));
    }

    // Calculate total defense (Percentage reduction)
    getDefense() {
        let def = 0;
        if (this.equipment.armor) def = this.equipment.armor.defense;
        return def; // e.g., 20 means 20% damage reduction
    }

    takeDamage(amount) {
        const defense = this.getDefense();
        const reduced = Math.max(1, Math.floor(amount * (1 - (defense / 100))));
        
        this.hp -= reduced;
        this.updateHUD();
        
        // Visual Shake
        const canvas = document.getElementById('gameCanvas');
        canvas.style.transform = `translate(${Math.random()*4-2}px, ${Math.random()*4-2}px)`;
        setTimeout(() => canvas.style.transform = 'none', 100);

        if (this.hp <= 0) {
            this.respawn();
        }
    }

    respawn() {
        showDialog("YOU DIED. Respawning at home...", 3000);
        this.hp = this.maxHp;
        this.stamina = this.maxStamina;
        if (typeof homeSystem !== 'undefined' && homeSystem.houseLocation) {
            homeSystem.teleportHome();
        } else {
            this.player.x = 0; this.player.y = 0;
        }
        this.updateHUD();
    }

    createHUD() {
        // ... (Keep existing HUD code) ...
        const hud = document.createElement('div');
        hud.id = 'rpg-hud';
        hud.style.position = 'absolute';
        hud.style.top = '10px';
        hud.style.left = '10px';
        hud.style.width = '200px';
        hud.style.zIndex = '500';
        hud.style.fontFamily = 'monospace';
        hud.style.pointerEvents = 'none';

        hud.innerHTML = `
            <div style="margin-bottom:5px; color:white; text-shadow:1px 1px 0 #000;">
                <span id="rpg-name">SURVIVOR</span> Lv.<span id="rpg-level">1</span>
            </div>
            <div style="width:100%; height:15px; background:#333; border:2px solid #000; margin-bottom:2px;">
                <div id="rpg-hp-bar" style="width:100%; height:100%; background:#e74c3c; transition:width 0.2s;"></div>
            </div>
            <div style="width:100%; height:8px; background:#333; border:2px solid #000;">
                <div id="rpg-stamina-bar" style="width:100%; height:100%; background:#f1c40f; transition:width 0.2s;"></div>
            </div>
            <!-- Gear Display -->
            <div id="rpg-gear" style="font-size:10px; color:#aaa; margin-top:5px;">
                Wpn: Fists | Arm: None
            </div>
        `;
        document.body.appendChild(hud);

        const btn = document.createElement('div');
        btn.id = 'btn-attack';
        btn.className = 'action-btn';
        btn.style.bottom = '120px';
        btn.style.right = '20px';
        btn.style.backgroundColor = '#7f8c8d';
        btn.innerText = '⚔️';
        btn.onpointerdown = (e) => {
            e.preventDefault(); e.stopPropagation();
            this.triggerAttack();
        };
        document.getElementById('action-btns').appendChild(btn);
    }

    update(dt) {
        if (this.stamina < this.maxStamina) this.stamina += dt * 5;
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        else this.isAttacking = false;
        this.updateHUD();
    }

    triggerAttack() {
        if (this.attackCooldown > 0 || this.stamina < 10) return;

        this.isAttacking = true;
        this.stamina -= 10;
        this.attackCooldown = 0.4; 

        // Visual
        const canvas = document.getElementById('gameCanvas');
        canvas.style.transform = `translate(${Math.random()*4-2}px, ${Math.random()*4-2}px)`;
        setTimeout(() => canvas.style.transform = 'none', 100);
        if (typeof playSFX === 'function') playSFX('sfx-attack1');

        // HIT DETECTION
        const targets = [];
        const px = Math.round(this.player.x);
        const py = Math.round(this.player.y);

        if (this.player.dir === 'left') { targets.push({x: px-1, y: py}, {x: px-1, y: py-1}, {x: px-1, y: py+1}); } 
        else if (this.player.dir === 'right') { targets.push({x: px+1, y: py}, {x: px+1, y: py-1}, {x: px+1, y: py+1}); } 
        else if (this.player.dir === 'up') { targets.push({x: px, y: py-1}, {x: px-1, y: py-1}, {x: px+1, y: py-1}); } 
        else if (this.player.dir === 'down') { targets.push({x: px, y: py+1}, {x: px-1, y: py+1}, {x: px+1, y: py+1}); }

        const damage = this.getDamage(); // Dynamic damage based on gear

        // 1. Resources
        if (typeof resourceSystem !== 'undefined') {
            for (let t of targets) {
                // Determine tool bonus (e.g. Pickaxe does more to rocks)
                let bonus = 1;
                // Simple check: if weapon name contains "Pickaxe" vs Rock, etc.
                const hit = resourceSystem.checkHit(t.x, t.y, damage * bonus);
                if (hit) return; 
            }
        }

        // 2. Enemies
        if (typeof enemySystem !== 'undefined') {
            for (let t of targets) {
                const hitEnemy = enemySystem.checkHit(t.x, t.y, damage);
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
        
        // Update Gear Text
        const wName = this.equipment.weapon ? this.equipment.weapon.name : "Fists";
        const aName = this.equipment.armor ? this.equipment.armor.name : "None";
        const gearEl = document.getElementById('rpg-gear');
        if(gearEl) gearEl.innerText = `Wpn: ${wName} | Arm: ${aName}`;
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

    // --- EQUIPMENT METHODS ---
    equip(item, type) {
        this.equipment[type] = item;
        showDialog(`Equipped ${item.name}!`, 1000);
        this.updateHUD();
    }

    // Equip by Item ID string (e.g., 'sword_iron')
    equipById(itemId) {
        // Find item data from CraftingSystem recipes
        // We need access to craftingSystem instance or static data
        if (typeof craftingSystem === 'undefined') return;
        
        const itemData = craftingSystem.RECIPES.find(r => r.id === itemId);
        if (!itemData) return;

        // 1. If slot is full, unequip current first
        if (this.equipment[itemData.type]) {
            this.unequip(itemData.type);
        }

        // 2. Equip new item
        this.equipment[itemData.type] = itemData;

        // 3. Remove from Bag
        if (this.player.bag[itemId] > 0) {
            this.player.bag[itemId]--;
            if (this.player.bag[itemId] <= 0) delete this.player.bag[itemId];
        }

        showDialog(`Equipped ${itemData.name}!`, 1000);
        this.updateHUD();
    }

    // Unequip slot ('weapon', 'armor', 'accessory')
    unequip(slotType) {
        const item = this.equipment[slotType];
        if (!item) return;

        // 1. Add back to Bag
        if (!this.player.bag[item.id]) this.player.bag[item.id] = 0;
        this.player.bag[item.id]++;

        // 2. Clear Slot
        this.equipment[slotType] = null;
        
        showDialog(`Unequipped ${item.name}.`, 1000);
        this.updateHUD();
    }

    getSaveData() {
        return { hp: this.hp, maxHp: this.maxHp, xp: this.xp, level: this.level, equipment: this.equipment };
    }

    loadSaveData(data) {
        this.hp = data.hp || 100;
        this.maxHp = data.maxHp || 100;
        this.xp = data.xp || 0;
        this.level = data.level || 1;
        this.equipment = data.equipment || { weapon: null, armor: null, accessory: null };
    }
}
