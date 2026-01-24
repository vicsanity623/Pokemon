class RPGSystem {
    constructor(player) {
        this.player = player;

        // Stats
        this.level = 1;
        this.maxHp = 100;
        this.hp = 100;
        
        // --- STAMINA SCALING ---
        this.maxStamina = 100 + (this.level * 10);
        this.stamina = this.maxStamina;
        
        this.xp = 0;
        this.comboCount = 0;
        this.comboSpecies = null; 

        this.isAttacking = false;
        this.attackCooldown = 0;
        this.isRespawning = false;

        this.equipment = { weapon: null, armor: null, accessory: null };

        // CACHE DOM ELEMENTS FOR PERFORMANCE
        this.domCache = {};
        
        this.createHUD();
    }

    getDamage() {
        let base = 1; 
        if (this.equipment.weapon) base = this.equipment.weapon.damage;
        return Math.floor(base * (1 + (this.level * 0.1)));
    }

    getDefense() {
        let def = 0;
        if (this.equipment.armor) def = this.equipment.armor.defense;
        return def;
    }

    takeDamage(amount) {
        if (this.isRespawning) return;

        const defense = this.getDefense();
        const reduced = Math.max(1, Math.floor(amount * (1 - (defense / 100))));

        this.hp -= reduced;
        this.updateHUD();

        // --- OPTIMIZATION: REMOVED CSS SHAKE (Caused Lag) ---
        // Just play sound
        // if (typeof playSFX === 'function') playSFX('sfx-hit'); 

        if (this.hp <= 0) {
            this.hp = 0;
            this.respawn();
        }
    }

    respawn() {
        if (this.isRespawning) return;
        this.isRespawning = true;

        showDialog("Passed out! Teleported home.", 3000);

        if (typeof homeSystem !== 'undefined' && homeSystem.houseLocation) {
            this.player.x = homeSystem.houseLocation.x;
            this.player.y = homeSystem.houseLocation.y + 4;
        } else {
            this.player.x = 0;
            this.player.y = 0;
        }

        this.hp = this.maxHp;
        this.maxStamina = 100 + (this.level * 10);
        this.stamina = this.maxStamina;
        this.player.moving = false;

        if (this.player.team && this.player.team.length > 0) {
            this.player.team.forEach(p => { p.hp = p.maxHp; });
        }

        this.updateHUD();

        setTimeout(() => { this.isRespawning = false; }, 1000);
    }

    createHUD() {
        const existing = document.getElementById('rpg-hud');
        if (existing) existing.remove();

        const hud = document.createElement('div');
        hud.id = 'rpg-hud';
        hud.style.position = 'absolute';
        hud.style.top = '10px';
        hud.style.left = '50%';
        hud.style.transform = 'translateX(-50%)';
        hud.style.width = '250px';
        hud.style.zIndex = '500';
        hud.style.fontFamily = 'monospace';
        hud.style.pointerEvents = 'none';

        hud.innerHTML = `
            <div style="margin-bottom:5px; color:white; text-shadow:1px 1px 0 #000; text-align:center;">
                <span id="rpg-name">Player</span> Lv.<span id="rpg-level">1</span>
            </div>
            <div style="width:100%; height:12px; background:#333; border:2px solid #000; margin-bottom:2px; position:relative;">
                <div id="rpg-hp-bar" style="width:100%; height:100%; background:#e74c3c; transition:width 0.2s;"></div>
            </div>
            <div style="width:100%; height:6px; background:#333; border:2px solid #000; margin-bottom:2px; position:relative;">
                <div id="rpg-xp-bar" style="width:0%; height:100%; background:#3498db; transition:width 0.2s;"></div>
            </div>
            <div style="width:100%; height:8px; background:#333; border:2px solid #000;">
                <div id="rpg-stamina-bar" style="width:100%; height:100%; background:#f1c40f; transition:width 0.2s;"></div>
            </div>
            <div id="rpg-gear" style="font-size:10px; color:#aaa; margin-top:5px; text-align:center;">
                Wpn: Fists | Arm: None
            </div>
            <div id="rpg-resources" style="margin-top: 4px; border-top: 1px dashed #555; background-color: rgba(0, 0, 0, 0.7); border-radius: 4px; padding: 4px; display: none; justify-content: center; gap: 8px; flex-wrap: wrap; font-size: 9px; color: #fff; text-shadow: 1px 1px 0 #000;"></div>
        `;
        document.body.appendChild(hud);

        // Cache Elements immediately
        this.domCache = {
            hp: document.getElementById('rpg-hp-bar'),
            xp: document.getElementById('rpg-xp-bar'),
            stam: document.getElementById('rpg-stamina-bar'),
            lvl: document.getElementById('rpg-level'),
            gear: document.getElementById('rpg-gear')
        };

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
        const regenRate = 28 + (this.level * 2);
        
        if (this.stamina < this.maxStamina) this.stamina += dt * regenRate;
        if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;

        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        else this.isAttacking = false;

        if (this.hp <= 0 && !this.isRespawning) {
            console.log("0 HP detected. Respawning...");
            this.respawn();
        }

        this.updateHUD();
    }

    triggerAttack() {
        if (this.attackCooldown > 0 || this.stamina < 10) return;

        this.isAttacking = true;
        this.stamina -= 10;
        this.attackCooldown = 0.4;

        // --- OPTIMIZATION: REMOVED CSS SHAKE ---
        if (typeof playSFX === 'function') playSFX('sfx-attack1');

        const targets = [];
        const px = Math.round(this.player.x);
        const py = Math.round(this.player.y);

        // Sweeping Hitbox
        if (this.player.dir === 'left') { targets.push({ x: px - 1, y: py }, { x: px - 1, y: py - 1 }, { x: px - 1, y: py + 1 }); }
        else if (this.player.dir === 'right') { targets.push({ x: px + 1, y: py }, { x: px + 1, y: py - 1 }, { x: px + 1, y: py + 1 }); }
        else if (this.player.dir === 'up') { targets.push({ x: px, y: py - 1 }, { x: px - 1, y: py - 1 }, { x: px + 1, y: py - 1 }); }
        else if (this.player.dir === 'down') { targets.push({ x: px, y: py + 1 }, { x: px - 1, y: py + 1 }, { x: px + 1, y: py + 1 }); }

        const damage = this.getDamage();

        if (typeof resourceSystem !== 'undefined') {
            for (let t of targets) {
                const hit = resourceSystem.checkHit(t.x, t.y, damage);
                if (hit) return;
            }
        }

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
        const xpNeeded = this.level * 100;
        const xpPct = Math.min(100, Math.max(0, (this.xp / xpNeeded) * 100));

        // Use Cached DOM Elements (Massive FPS boost)
        if (this.domCache.hp) this.domCache.hp.style.width = `${hpPct}%`;
        if (this.domCache.xp) this.domCache.xp.style.width = `${xpPct}%`;
        if (this.domCache.stam) this.domCache.stam.style.width = `${stamPct}%`;

        if (this.domCache.lvl) {
            if (this.comboCount > 0) {
                this.domCache.lvl.innerHTML = `${this.level} <span style="color:#f1c40f; margin-left:5px;">Combo🔥${this.comboCount}</span>`;
            } else {
                this.domCache.lvl.innerText = this.level.toString();
            }
        }

        if (this.domCache.gear) {
            const wName = this.equipment.weapon ? this.equipment.weapon.name : "Fists";
            const aName = this.equipment.armor ? this.equipment.armor.name : "None";
            this.domCache.gear.innerHTML = `
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
            this.maxStamina = 100 + (this.level * 10);
            this.hp = this.maxHp;
            this.stamina = this.maxStamina;
            showDialog(`Player Level Up! (Lv.${this.level})`, 2000);
        }
        this.updateHUD();
    }

    equip(item, type) {
        this.equipment[type] = item;
        showDialog(`Equipped ${item.name}!`, 1000);
        this.updateHUD();
    }

    equipById(itemId) {
        if (typeof craftingSystem === 'undefined') return;

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

        const equippedItem = { ...itemData };
        equippedItem.id = itemId; 

        if (suffix === 'rare') {
            equippedItem.name = `Rare ${itemData.name}`;
            equippedItem.color = '#3498db'; 
            if (equippedItem.damage) equippedItem.damage = Math.floor(equippedItem.damage * 1.25);
            if (equippedItem.defense) equippedItem.defense = Math.floor(equippedItem.defense * 1.25);
        } else if (suffix === 'legendary') {
            equippedItem.name = `Legendary ${itemData.name}`;
            equippedItem.color = '#f1c40f'; 
            if (equippedItem.damage) equippedItem.damage = Math.floor(equippedItem.damage * 2.0);
            if (equippedItem.defense) equippedItem.defense = Math.floor(equippedItem.defense * 2.0);
        }

        if (this.equipment[itemData.type]) this.unequip(itemData.type);
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
        return {
            hp: this.hp,
            maxHp: this.maxHp,
            xp: this.xp,
            level: this.level,
            equipment: this.equipment,
            comboCount: this.comboCount,
            comboSpecies: this.comboSpecies
        };
    }

    loadSaveData(data) {
        this.hp = data.hp || 100;
        this.maxHp = data.maxHp || 100;
        this.xp = data.xp || 0;
        this.level = data.level || 1;
        this.maxStamina = 100 + (this.level * 10);
        this.stamina = this.maxStamina;
        this.equipment = data.equipment || { weapon: null, armor: null, accessory: null };
        this.comboCount = data.comboCount || 0;
        this.comboSpecies = data.comboSpecies || null;
    }
}