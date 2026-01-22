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
        canvas.style.transform = `translate(${Math.random() * 4 - 2}px, ${Math.random() * 4 - 2}px)`;
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
        // Remove existing if any (prevents duplicates on reload)
        const existing = document.getElementById('rpg-hud');
        if (existing) existing.remove();

        const hud = document.createElement('div');
        hud.id = 'rpg-hud';
        hud.style.position = 'absolute';

        // --- POSITIONING ---
        hud.style.top = '10px';
        hud.style.left = '50%';
        hud.style.transform = 'translateX(-50%)';
        hud.style.width = '250px';
        hud.style.zIndex = '500';
        hud.style.fontFamily = 'monospace';
        hud.style.pointerEvents = 'none';

        hud.innerHTML = `
            <div style="margin-bottom:5px; color:white; text-shadow:1px 1px 0 #000; text-align:center;">
                <span id="rpg-name">SURVIVOR</span> Lv.<span id="rpg-level">1</span>
            </div>
            
            <!-- HP BAR (Red) -->
            <div style="width:100%; height:12px; background:#333; border:2px solid #000; margin-bottom:2px; position:relative;">
                <div id="rpg-hp-bar" style="width:100%; height:100%; background:#e74c3c; transition:width 0.2s;"></div>
            </div>

            <!-- XP BAR (Blue) -->
            <div style="width:100%; height:6px; background:#333; border:2px solid #000; margin-bottom:2px; position:relative;">
                <div id="rpg-xp-bar" style="width:0%; height:100%; background:#3498db; transition:width 0.2s;"></div>
            </div>

            <!-- STAMINA BAR (Yellow) -->
            <div style="width:100%; height:8px; background:#333; border:2px solid #000;">
                <div id="rpg-stamina-bar" style="width:100%; height:100%; background:#f1c40f; transition:width 0.2s;"></div>
            </div>
            
            <!-- Gear Display -->
            <div id="rpg-gear" style="font-size:10px; color:#aaa; margin-top:5px; text-align:center;">
                Wpn: Fists | Arm: None
            </div>

            <!-- NEW: Resource Row (NOW WITH BACKGROUND) -->
            <div id="rpg-resources" style="margin-top: 4px; border-top: 1px dashed #555; background-color: rgba(0, 0, 0, 0.7); border-radius: 4px; padding: 4px; display: none; justify-content: center; gap: 8px; flex-wrap: wrap; font-size: 9px; color: #fff; text-shadow: 1px 1px 0 #000;"></div>
        `;
        document.body.appendChild(hud);

        // Check if button exists before adding (prevent duplicates)
        if (!document.getElementById('btn-attack')) {
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
        canvas.style.transform = `translate(${Math.random() * 4 - 2}px, ${Math.random() * 4 - 2}px)`;
        setTimeout(() => canvas.style.transform = 'none', 100);
        if (typeof playSFX === 'function') playSFX('sfx-attack1');

        // HIT DETECTION (Wide Sweep)
        const targets = [];
        const px = Math.round(this.player.x);
        const py = Math.round(this.player.y);

        if (this.player.dir === 'left') { targets.push({ x: px - 1, y: py }, { x: px - 1, y: py - 1 }, { x: px - 1, y: py + 1 }); }
        else if (this.player.dir === 'right') { targets.push({ x: px + 1, y: py }, { x: px + 1, y: py - 1 }, { x: px + 1, y: py + 1 }); }
        else if (this.player.dir === 'up') { targets.push({ x: px, y: py - 1 }, { x: px - 1, y: py - 1 }, { x: px + 1, y: py - 1 }); }
        else if (this.player.dir === 'down') { targets.push({ x: px, y: py + 1 }, { x: px - 1, y: py + 1 }, { x: px + 1, y: py + 1 }); }

        const damage = this.getDamage();

        // 1. Resources
        if (typeof resourceSystem !== 'undefined') {
            for (let t of targets) {
                const hit = resourceSystem.checkHit(t.x, t.y, damage);
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

        // --- XP CALCULATION ---
        const xpNeeded = this.level * 100;
        const xpPct = Math.min(100, Math.max(0, (this.xp / xpNeeded) * 100));

        const hpBar = document.getElementById('rpg-hp-bar');
        const xpBar = document.getElementById('rpg-xp-bar');
        const stamBar = document.getElementById('rpg-stamina-bar');
        const lvlText = document.getElementById('rpg-level');
        const gearText = document.getElementById('rpg-gear');

        // Safety check if HUD exists
        if (hpBar) hpBar.style.width = `${hpPct}%`;
        if (xpBar) xpBar.style.width = `${xpPct}%`;
        if (stamBar) stamBar.style.width = `${stamPct}%`;
        if (lvlText) lvlText.innerText = this.level.toString();

        if (gearText) {
            const wName = this.equipment.weapon ? this.equipment.weapon.name : "Fists";
            const aName = this.equipment.armor ? this.equipment.armor.name : "None";

            // We use innerHTML to create a colored background box
            gearText.innerHTML = `
                <div style="background-color: rgba(0, 0, 0, 0.7); padding: 2px 8px; border-radius: 4px; display: inline-block; color: #fff;">
                    Wpn: <span style="color:#e74c3c">${wName}</span> | Arm: <span style="color:#3498db">${aName}</span>
                </div>
            `;
        }
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
        this.updateHUD(); // Ensure bar updates immediately
    }

    // --- EQUIPMENT METHODS ---
    equip(item, type) {
        this.equipment[type] = item;
        showDialog(`Equipped ${item.name}!`, 1000);
        this.updateHUD();
    }

    equipById(itemId) {
        if (typeof craftingSystem === 'undefined') return;

        // --- NEW SUFFIX LOGIC ---
        let baseId = itemId;
        let suffix = null;

        if (itemId.endsWith('_legendary')) {
            baseId = itemId.replace('_legendary', '');
            suffix = 'legendary';
        } else if (itemId.endsWith('_rare')) {
            baseId = itemId.replace('_rare', '');
            suffix = 'rare';
        }

        const itemData = craftingSystem.RECIPES.find(r => r.id === baseId);
        if (!itemData) return;

        // Create a Copy to modify stats without affecting global recipe
        const equippedItem = { ...itemData };
        equippedItem.id = itemId; // Store the full ID (e.g. sword_iron_rare)

        // Apply Boosts
        if (suffix === 'rare') {
            equippedItem.name = `Rare ${itemData.name}`;
            equippedItem.color = '#3498db'; // Rare Blue
            if (equippedItem.damage) equippedItem.damage = Math.floor(equippedItem.damage * 1.25);
            if (equippedItem.defense) equippedItem.defense = Math.floor(equippedItem.defense * 1.25);
        } else if (suffix === 'legendary') {
            equippedItem.name = `Legendary ${itemData.name}`;
            equippedItem.color = '#f1c40f'; // Gold
            if (equippedItem.damage) equippedItem.damage = Math.floor(equippedItem.damage * 2.0);
            if (equippedItem.defense) equippedItem.defense = Math.floor(equippedItem.defense * 2.0);
        }

        if (this.equipment[itemData.type]) {
            this.unequip(itemData.type);
        }

        this.equipment[itemData.type] = equippedItem;

        if (this.player.bag[itemId] > 0) {
            this.player.bag[itemId]--;
            if (this.player.bag[itemId] <= 0) delete this.player.bag[itemId];
        }

        showDialog(`Equipped ${equippedItem.name}!`, 1000);
        this.updateHUD();
    }

    unequip(slotType) {
        const item = this.equipment[slotType];
        if (!item) return;

        if (!this.player.bag[item.id]) this.player.bag[item.id] = 0;
        this.player.bag[item.id]++;

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
