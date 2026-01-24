class CraftingSystem {
    constructor(player) {
        this.player = player;
        this.workbenchLocation = null;
        this.hasSpawned = false;

        this.RECIPES = [
            // WEAPONS
            { id: 'sword_wood', name: 'Wooden Sword', uiName: 'Craft Weapon (Wood)', type: 'weapon', damage: 5, cost: { 'Wood': 5 }, color: '#fff' },
            { id: 'sword_stone', name: 'Stone Sword', uiName: 'Craft Weapon (Stone)', type: 'weapon', damage: 10, cost: { 'Wood': 2, 'Stone': 10 }, color: '#2ecc71' },
            { id: 'sword_iron', name: 'Iron Sword', uiName: 'Craft Weapon (Iron)', type: 'weapon', damage: 20, cost: { 'Wood': 5, 'Iron Ore': 5 }, color: '#3498db' },
            { id: 'sword_obsidian', name: 'Obsidian Blade', uiName: 'Craft Weapon (Obsidian)', type: 'weapon', damage: 45, cost: { 'Obsidian': 10, 'Shadow Essence': 5 }, color: '#9b59b6' },
            { id: 'sword_master', name: 'Master Sword', uiName: 'Craft Weapon (Master)', type: 'weapon', damage: 100, cost: { 'Gold Ore': 50, 'Obsidian': 50, 'Bone': 100 }, color: '#f1c40f' },

            // ARMOR
            { id: 'armor_leather', name: 'Leather Vest', uiName: 'Craft Armor (Leather)', type: 'armor', defense: 10, cost: { 'Wood': 10, 'Bone': 5 }, color: '#2ecc71' },
            { id: 'armor_iron', name: 'Iron Plate', uiName: 'Craft Armor (Iron)', type: 'armor', defense: 30, cost: { 'Iron Ore': 20 }, color: '#3498db' },
            { id: 'armor_shadow', name: 'Shadow Armor', uiName: 'Craft Armor (Shadow)', type: 'armor', defense: 60, cost: { 'Obsidian': 20, 'Shadow Essence': 10 }, color: '#9b59b6' },

            // ACCESSORY
            { id: 'acc_goggles', name: 'Night Vision Goggles', uiName: 'Craft Goggles', type: 'accessory', effect: 'vision', cost: { 'Iron Ore': 5, 'Gold Ore': 2, 'Shadow Essence': 5 }, color: '#3498db' }
        ];

        this.GUARDIAN_UPGRADES = [
            { id: 'heal', name: 'Heal Pulse Level', cost: { 'Gold Ore': 5 }, desc: "Increases heal amount" },
            { id: 'fireball', name: 'Unlock Fireball', cost: { 'Shadow Essence': 5, 'Bone': 10 }, desc: "Unlocks ranged attack" },
            { id: 'asteroid', name: 'Unlock Asteroids', cost: { 'Obsidian': 10, 'Gold Ore': 10 }, desc: "Orbiting rocks shield" }
        ];
    }

    spawnWorkbench(world) {
        if (this.hasSpawned) return;
        if (!homeSystem.houseLocation) return;
        
        // --- CHANGED: Moved 10 tiles right ---
        let wx = homeSystem.houseLocation.x + 10; 
        // -------------------------------------
        
        let wy = homeSystem.houseLocation.y;
        
        this.workbenchLocation = { x: wx, y: wy };
        this.hasSpawned = true;
        
        // Important: Push to buildings so it draws and has collision
        world.buildings.push({ type: 'workbench', x: wx, y: wy });
    }

    interact() {
        this.openMenu();
    }

    // Helper to force Dialog Z-Index
    forceDialogTop(text) {
        const box = document.getElementById('dialog-box');
        if (box) box.style.zIndex = "10001"; // NUCLEAR OPTION: Above everything
        showDialog(text, 2000);
    }

    triggerFlash(color) {
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100%';
        flash.style.height = '100%';
        flash.style.backgroundColor = color;
        flash.style.zIndex = '20000';
        flash.style.pointerEvents = 'none';
        flash.style.animation = 'flash-white 0.5s'; // reusing the keyframes
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 500);
    }

    openMenu() {
        const modal = document.createElement('div');
        modal.id = 'crafting-ui';
        modal.className = 'battle-sub-menu';

        // --- VISUAL FIXES ---
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';
        modal.style.zIndex = '9000'; // Set Menu lower than the dialog
        // --------------------

        modal.innerHTML = `
            <div class="menu-header">WORKBENCH</div>
            
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <button class="tab-btn active" id="btn-tab-craft" onpointerdown="event.stopPropagation(); craftingSystem.showTab('craft')">CRAFT</button>
                <button class="tab-btn" id="btn-tab-guardian" onpointerdown="event.stopPropagation(); craftingSystem.showTab('guardian')">GUARDIAN</button>
            </div>

            <div id="crafting-content" style="flex:1; overflow-y:auto; border-bottom: 2px solid #555; margin-bottom:10px;"></div>

            <!-- SPLIT VIEW: STATS & EQUIPMENT | INVENTORY -->
            <div style="height: 200px; display: flex; gap: 10px;">
                
                <!-- LEFT: STATS & EQUIPMENT -->
                <div style="flex: 1; background: #222; border: 1px solid #444; padding: 5px; display: flex; flex-direction: column;">
                    
                    <!-- NEW: STATS PANEL -->
                    <div id="player-stats-panel" style="background:#111; padding:5px; margin-bottom:5px; font-size:10px; color:#ddd; display:grid; grid-template-columns: 1fr 1fr; gap:2px;">
                        <div>HP: <span id="stat-hp" style="color:#e74c3c">100</span></div>
                        <div>STAM: <span id="stat-stam" style="color:#f1c40f">100</span></div>
                        <div>DMG: <span id="stat-dmg" style="color:#e74c3c">5</span></div>
                        <div>DEF: <span id="stat-def" style="color:#3498db">0%</span></div>
                    </div>

                    <div style="text-align: center; color: gold; font-size: 10px; margin-bottom: 5px; border-top:1px solid #444; paddingTop:5px;">EQUIPPED</div>
                    
                    <div id="slot-weapon" class="equip-slot" style="border: 1px dashed #555; padding: 5px; text-align: center; font-size: 10px; color: #888; margin-bottom:2px;">Weapon: Empty</div>
                    <div id="slot-armor" class="equip-slot" style="border: 1px dashed #555; padding: 5px; text-align: center; font-size: 10px; color: #888; margin-bottom:2px;">Armor: Empty</div>
                    <div id="slot-accessory" class="equip-slot" style="border: 1px dashed #555; padding: 5px; text-align: center; font-size: 10px; color: #888;">Accessory: Empty</div>
                </div>

                <!-- RIGHT: INVENTORY -->
                <div style="flex: 1; background: #222; border: 1px solid #444; padding: 5px; overflow-y: auto;">
                    <div style="text-align: center; color: gold; font-size: 10px; margin-bottom: 5px;">INVENTORY</div>
                    <div id="craft-inventory-list"></div>
                </div>
            </div>

            <button class="back-btn" onpointerdown="event.stopPropagation(); craftingSystem.closeMenu()">CLOSE</button>
        `;
        document.body.appendChild(modal);
        this.showTab('craft');
        this.updateEquipmentUI();
    }

    closeMenu() {
        const el = document.getElementById('crafting-ui');
        if (el) el.remove();
    }

    updateEquipmentUI() {
        if (typeof rpgSystem === 'undefined') return;

        const eq = rpgSystem.equipment;

        // --- UPDATE STATS ---
        document.getElementById('stat-hp').innerText = String(rpgSystem.maxHp);
        document.getElementById('stat-stam').innerText = String(rpgSystem.maxStamina);
        document.getElementById('stat-dmg').innerText = String(rpgSystem.getDamage());
        document.getElementById('stat-def').innerText = rpgSystem.getDefense() + '%';

        // --- UPDATE SLOTS ---
        const wSlot = document.getElementById('slot-weapon');
        if (eq.weapon) {
            wSlot.innerHTML = `<span style="color:${eq.weapon.color}">${eq.weapon.name}</span> <button onpointerdown="event.stopPropagation(); rpgSystem.unequip('weapon'); craftingSystem.updateEquipmentUI();" style="font-size:8px; float:right; background:#c0392b; color:white; border:none;">X</button>`;
            wSlot.style.borderColor = eq.weapon.color;
        } else {
            wSlot.innerHTML = "Weapon: Empty";
            wSlot.style.borderColor = "#555";
        }

        const aSlot = document.getElementById('slot-armor');
        if (eq.armor) {
            aSlot.innerHTML = `<span style="color:${eq.armor.color}">${eq.armor.name}</span> <button onpointerdown="event.stopPropagation(); rpgSystem.unequip('armor'); craftingSystem.updateEquipmentUI();" style="font-size:8px; float:right; background:#c0392b; color:white; border:none;">X</button>`;
            aSlot.style.borderColor = eq.armor.color;
        } else {
            aSlot.innerHTML = "Armor: Empty";
            aSlot.style.borderColor = "#555";
        }

        const acSlot = document.getElementById('slot-accessory');
        if (eq.accessory) {
            acSlot.innerHTML = `<span style="color:${eq.accessory.color}">${eq.accessory.name}</span> <button onpointerdown="event.stopPropagation(); rpgSystem.unequip('accessory'); craftingSystem.updateEquipmentUI();" style="font-size:8px; float:right; background:#c0392b; color:white; border:none;">X</button>`;
            acSlot.style.borderColor = eq.accessory.color;
        } else {
            acSlot.innerHTML = "Accessory: Empty";
            acSlot.style.borderColor = "#555";
        }

        // --- UPDATE INVENTORY ---
        const invList = document.getElementById('craft-inventory-list');
        invList.innerHTML = '';

        this.RECIPES.forEach(recipe => {
            // Check for Base, Rare, and Legendary versions in bag
            const variants = [
                { id: recipe.id, name: recipe.name, color: recipe.color },
                { id: recipe.id + '_rare', name: `Rare ${recipe.name}`, color: '#3498db' },
                { id: recipe.id + '_legendary', name: `LEGENDARY ${recipe.name}`, color: '#f1c40f' }
            ];

            variants.forEach(variant => {
                if (this.player.bag[variant.id]) {
                    const count = this.player.bag[variant.id];
                    const div = document.createElement('div');
                    div.style.borderBottom = '1px solid #333';
                    div.style.padding = '5px';
                    div.style.fontSize = '10px';
                    div.innerHTML = `
                        <span style="color:${variant.color}">${variant.name}</span> x${count}
                        <button style="float:right; font-size:8px;" onpointerdown="event.stopPropagation(); rpgSystem.equipById('${variant.id}'); craftingSystem.updateEquipmentUI();">EQUIP</button>
                    `;
                    invList.appendChild(div);
                }
            });
        });
    }

    showTab(tab) {
        const container = document.getElementById('crafting-content');
        container.innerHTML = '';

        document.getElementById('btn-tab-craft').classList.toggle('active', tab === 'craft');
        document.getElementById('btn-tab-guardian').classList.toggle('active', tab === 'guardian');

        if (tab === 'craft') {
            this.RECIPES.forEach(item => {
                const div = document.createElement('div');
                div.className = 'menu-item';
                div.style.borderColor = item.color;

                let costStr = Object.entries(item.cost).map(([k, v]) => `${k} x${v}`).join(', ');
                let canCraft = true;
                for (let [res, qty] of Object.entries(item.cost)) {
                    if ((this.player.bag[res] || 0) < qty) canCraft = false;
                }

                div.innerHTML = `
                    <div style="color:${item.color}; font-weight:bold;">${item.name}</div>
                    <div style="font-size:10px; color:#aaa;">${costStr}</div>
                    <div style="font-size:10px; margin-top:2px;">
                        ${item.type === 'weapon' ? `DMG: ${item.damage}` : ''}
                        ${item.type === 'armor' ? `DEF: ${item.defense}%` : ''}
                    </div>
                `;

                const btn = document.createElement('button');
                btn.innerText = 'CRAFT';
                btn.style.float = 'right';
                btn.style.marginTop = '-30px';
                btn.disabled = !canCraft;

                btn.onpointerdown = (e) => {
                    e.stopPropagation();
                    this.craftItem(item);
                };

                div.appendChild(btn);
                container.appendChild(div);
            });
        }
        else if (tab === 'guardian') {
            if (!guardianSystem.activeGuardian) {
                container.innerHTML = "<p style='padding:20px; text-align:center;'>You have no Guardian active.</p>";
                return;
            }
            this.GUARDIAN_UPGRADES.forEach(upg => {
                const div = document.createElement('div');
                div.className = 'menu-item';

                // --- DYNAMIC TEXT LOGIC ---
                let displayName = upg.name;
                let displayDesc = upg.desc;

                if (upg.id === 'fireball' && guardianSystem.skills.fireball.unlocked) {
                    displayName = `Fireball (Lvl ${guardianSystem.skills.fireball.level})`;
                    displayDesc = "Increases damage/range (Coming Soon)";
                }
                if (upg.id === 'asteroid' && guardianSystem.skills.asteroid.unlocked) {
                    displayName = `Asteroid (Lvl ${guardianSystem.skills.asteroid.level})`;
                    displayDesc = "Increases rotation speed (Coming Soon)";
                }

                let costStr = Object.entries(upg.cost).map(([k, v]) => `${k} x${v}`).join(', ');
                let canBuy = true;
                for (let [res, qty] of Object.entries(upg.cost)) {
                    if ((this.player.bag[res] || 0) < qty) canBuy = false;
                }

                div.innerHTML = `
                    <div style="color:gold;">${displayName}</div>
                    <div style="font-size:10px;">${displayDesc}</div>
                    <div style="font-size:10px; color:#aaa;">Cost: ${costStr}</div>
                `;

                const btn = document.createElement('button');
                btn.innerText = 'UPGRADE';
                btn.style.float = 'right';
                btn.disabled = !canBuy;

                btn.onpointerdown = (e) => {
                    e.stopPropagation();
                    this.upgradeGuardian(upg);
                };

                div.appendChild(btn);
                container.appendChild(div);
            });
        }
    }

    craftItem(item) {
        // 1. CHECK AFFORDABILITY FIRST
        for (let [res, qty] of Object.entries(item.cost)) {
            if ((this.player.bag[res] || 0) < qty) {
                // HARD CODE FIX: Force Dialog above everything
                this.forceDialogTop(`Not enough ${res}! Need ${qty}.`);
                return;
            }
        }

        // 2. DEDUCT RESOURCES
        for (let [res, qty] of Object.entries(item.cost)) {
            this.player.bag[res] -= qty;
            if (this.player.bag[res] <= 0) delete this.player.bag[res];
        }

        // 3. RNG ROLL (Loot Beams)
        const roll = Math.random();
        let craftedId = item.id;
        let qualityName = item.name;
        let qualityColor = item.color;

        if (roll > 0.90) {
            // 10% Legendary
            craftedId += '_legendary';
            qualityName = `LEGENDARY ${item.name}`;
            qualityColor = '#f1c40f'; // Gold
            this.forceDialogTop(`Creating... LEGENDARY ITEM!!!`);
            this.triggerFlash('gold');
            playSFX('sfx-legendary'); // Assuming this exists or falls back
        } else if (roll > 0.60) {
            // 30% Rare
            craftedId += '_rare';
            qualityName = `Rare ${item.name}`;
            qualityColor = '#3498db'; // Blue
            this.forceDialogTop(`Creating... Rare Item!`);
            this.triggerFlash('#3498db');
        }

        // 4. GRANT ITEM
        if (!this.player.bag[craftedId]) this.player.bag[craftedId] = 0;
        this.player.bag[craftedId]++;

        playSFX('sfx-pickup');

        // visual delay for "beam" effect
        setTimeout(() => {
            this.forceDialogTop(`Crafted ${qualityName}!`);
            this.showTab('craft');
            this.updateEquipmentUI();
        }, 800);
    }

    upgradeGuardian(upg) {
        // 1. CHECK AFFORDABILITY FIRST
        for (let [res, qty] of Object.entries(upg.cost)) {
            if ((this.player.bag[res] || 0) < qty) {
                this.forceDialogTop(`Not enough ${res}! Need ${qty}.`);
                return;
            }
        }

        // 2. DEDUCT RESOURCES
        // We do this immediately now, because we are allowing the upgrade to proceed
        for (let [res, qty] of Object.entries(upg.cost)) {
            this.player.bag[res] -= qty;
            if (this.player.bag[res] <= 0) delete this.player.bag[res];
        }

        // 3. APPLY UPGRADE (Unlock OR Level Up)

        // --- HEAL PULSE ---
        if (upg.id === 'heal') {
            guardianSystem.skills.heal.level++;
            this.forceDialogTop(`Heal Pulse upgraded to Level ${guardianSystem.skills.heal.level}!`);
        }

        // --- FIREBALL ---
        if (upg.id === 'fireball') {
            if (!guardianSystem.skills.fireball.unlocked) {
                // Not unlocked yet? Unlock it.
                guardianSystem.skills.fireball.unlocked = true;
                guardianSystem.skills.fireball.level = 1;
                this.forceDialogTop("Fireball Unlocked!");
            } else {
                // Already unlocked? Level it up!
                guardianSystem.skills.fireball.level++;
                this.forceDialogTop(`Fireball upgraded to Lvl ${guardianSystem.skills.fireball.level}!`);
            }
        }

        // --- ASTEROID ---
        if (upg.id === 'asteroid') {
            if (!guardianSystem.skills.asteroid.unlocked) {
                // Not unlocked yet? Unlock it.
                guardianSystem.skills.asteroid.unlocked = true;
                guardianSystem.skills.asteroid.level = 1;
                this.forceDialogTop("Asteroids Unlocked!");
            } else {
                // Already unlocked? Level it up!
                guardianSystem.skills.asteroid.level++;
                this.forceDialogTop(`Asteroids upgraded to Lvl ${guardianSystem.skills.asteroid.level}!`);
            }
        }

        // 4. REFRESH UI
        this.showTab('guardian');
    }

    getSaveData() { return { hasSpawned: this.hasSpawned, loc: this.workbenchLocation }; }
    loadSaveData(data) { this.hasSpawned = data.hasSpawned; this.workbenchLocation = data.loc; }
}