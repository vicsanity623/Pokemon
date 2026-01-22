class CraftingSystem {
    constructor(player) {
        this.player = player;
        this.workbenchLocation = null;
        this.hasSpawned = false;

        this.RECIPES = [
            // WEAPONS
            { id: 'sword_wood', name: 'Wooden Sword', type: 'weapon', damage: 5, cost: { 'Wood': 5 }, color: '#fff' },
            { id: 'sword_stone', name: 'Stone Sword', type: 'weapon', damage: 10, cost: { 'Wood': 2, 'Stone': 10 }, color: '#2ecc71' },
            { id: 'sword_iron', name: 'Iron Sword', type: 'weapon', damage: 20, cost: { 'Wood': 5, 'Iron Ore': 5 }, color: '#3498db' },
            { id: 'sword_obsidian', name: 'Obsidian Blade', type: 'weapon', damage: 45, cost: { 'Obsidian': 10, 'Shadow Essence': 5 }, color: '#9b59b6' },
            { id: 'sword_master', name: 'Master Sword', type: 'weapon', damage: 100, cost: { 'Gold Ore': 50, 'Obsidian': 50, 'Bone': 100 }, color: '#f1c40f' },

            // ARMOR
            { id: 'armor_leather', name: 'Leather Vest', type: 'armor', defense: 10, cost: { 'Wood': 10, 'Bone': 5 }, color: '#2ecc71' },
            { id: 'armor_iron', name: 'Iron Plate', type: 'armor', defense: 30, cost: { 'Iron Ore': 20 }, color: '#3498db' },
            { id: 'armor_shadow', name: 'Shadow Armor', type: 'armor', defense: 60, cost: { 'Obsidian': 20, 'Shadow Essence': 10 }, color: '#9b59b6' },

            // ACCESSORY
            { id: 'acc_goggles', name: 'Night Vision Goggles', type: 'accessory', effect: 'vision', cost: { 'Iron Ore': 5, 'Gold Ore': 2, 'Shadow Essence': 5 }, color: '#3498db' }
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
        let wx = homeSystem.houseLocation.x + 2;
        let wy = homeSystem.houseLocation.y;
        this.workbenchLocation = { x: wx, y: wy };
        this.hasSpawned = true;
        world.buildings.push({ type: 'workbench', x: wx, y: wy });
    }

    interact() {
        this.openMenu();
    }

    openMenu() {
        const modal = document.createElement('div');
        modal.id = 'crafting-ui';
        modal.className = 'battle-sub-menu';
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';
        
        // --- LAYOUT ---
        // Top: Tabs & Recipe List
        // Bottom: Split View (Equipment | Inventory)
        
        modal.innerHTML = `
            <div class="menu-header">WORKBENCH</div>
            
            <!-- TABS -->
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <button class="tab-btn active" id="btn-tab-craft" onclick="craftingSystem.showTab('craft')">CRAFT</button>
                <button class="tab-btn" id="btn-tab-guardian" onclick="craftingSystem.showTab('guardian')">GUARDIAN</button>
            </div>

            <!-- RECIPE LIST (Scrollable) -->
            <div id="crafting-content" style="flex:1; overflow-y:auto; border-bottom: 2px solid #555; margin-bottom:10px;"></div>

            <!-- EQUIPMENT & INVENTORY PANEL -->
            <div style="height: 180px; display: flex; gap: 10px;">
                
                <!-- LEFT: EQUIPMENT SLOTS -->
                <div style="flex: 1; background: #222; border: 1px solid #444; padding: 5px; display: flex; flex-direction: column; justify-content: space-around;">
                    <div style="text-align: center; color: gold; font-size: 10px; margin-bottom: 5px;">EQUIPPED</div>
                    
                    <div id="slot-weapon" class="equip-slot" style="border: 1px dashed #555; padding: 5px; text-align: center; font-size: 10px; color: #888;">
                        Weapon: Empty
                    </div>
                    <div id="slot-armor" class="equip-slot" style="border: 1px dashed #555; padding: 5px; text-align: center; font-size: 10px; color: #888;">
                        Armor: Empty
                    </div>
                    <div id="slot-accessory" class="equip-slot" style="border: 1px dashed #555; padding: 5px; text-align: center; font-size: 10px; color: #888;">
                        Accessory: Empty
                    </div>
                </div>

                <!-- RIGHT: CRAFTED INVENTORY -->
                <div style="flex: 1; background: #222; border: 1px solid #444; padding: 5px; overflow-y: auto;">
                    <div style="text-align: center; color: gold; font-size: 10px; margin-bottom: 5px;">INVENTORY</div>
                    <div id="craft-inventory-list"></div>
                </div>
            </div>

            <button class="back-btn" onclick="craftingSystem.closeMenu()">CLOSE</button>
        `;
        document.body.appendChild(modal);
        this.showTab('craft');
        this.updateEquipmentUI();
    }

    closeMenu() {
        const el = document.getElementById('crafting-ui');
        if (el) el.remove();
    }

    // --- REFRESH EQUIPMENT & INVENTORY UI ---
    updateEquipmentUI() {
        if (typeof rpgSystem === 'undefined') return;

        // 1. Update Slots
        const eq = rpgSystem.equipment;
        
        const wSlot = document.getElementById('slot-weapon');
        if (eq.weapon) {
            wSlot.innerHTML = `<span style="color:${eq.weapon.color}">${eq.weapon.name}</span> <button onclick="rpgSystem.unequip('weapon'); craftingSystem.updateEquipmentUI();" style="font-size:8px; float:right;">X</button>`;
            wSlot.style.borderColor = eq.weapon.color;
        } else {
            wSlot.innerHTML = "Weapon: Empty";
            wSlot.style.borderColor = "#555";
        }

        const aSlot = document.getElementById('slot-armor');
        if (eq.armor) {
            aSlot.innerHTML = `<span style="color:${eq.armor.color}">${eq.armor.name}</span> <button onclick="rpgSystem.unequip('armor'); craftingSystem.updateEquipmentUI();" style="font-size:8px; float:right;">X</button>`;
            aSlot.style.borderColor = eq.armor.color;
        } else {
            aSlot.innerHTML = "Armor: Empty";
            aSlot.style.borderColor = "#555";
        }

        const acSlot = document.getElementById('slot-accessory');
        if (eq.accessory) {
            acSlot.innerHTML = `<span style="color:${eq.accessory.color}">${eq.accessory.name}</span> <button onclick="rpgSystem.unequip('accessory'); craftingSystem.updateEquipmentUI();" style="font-size:8px; float:right;">X</button>`;
            acSlot.style.borderColor = eq.accessory.color;
        } else {
            acSlot.innerHTML = "Accessory: Empty";
            acSlot.style.borderColor = "#555";
        }

        // 2. Update Inventory List (Items crafted but not equipped)
        const invList = document.getElementById('craft-inventory-list');
        invList.innerHTML = '';

        // We check player.bag for items that match RECIPE IDs
        this.RECIPES.forEach(recipe => {
            if (this.player.bag[recipe.id]) { // If we own this crafted item
                const count = this.player.bag[recipe.id];
                const div = document.createElement('div');
                div.style.borderBottom = '1px solid #333';
                div.style.padding = '5px';
                div.style.fontSize = '10px';
                div.innerHTML = `
                    <span style="color:${recipe.color}">${recipe.name}</span> x${count}
                    <button style="float:right; font-size:8px;" onclick="rpgSystem.equipById('${recipe.id}'); craftingSystem.updateEquipmentUI();">EQUIP</button>
                `;
                invList.appendChild(div);
            }
        });
    }

    showTab(tab) {
        const container = document.getElementById('crafting-content');
        container.innerHTML = '';
        
        // Toggle Active Class
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
                btn.onclick = () => this.craftItem(item);

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
                let costStr = Object.entries(upg.cost).map(([k, v]) => `${k} x${v}`).join(', ');
                let canBuy = true;
                for (let [res, qty] of Object.entries(upg.cost)) {
                    if ((this.player.bag[res] || 0) < qty) canBuy = false;
                }

                div.innerHTML = `
                    <div style="color:gold;">${upg.name}</div>
                    <div style="font-size:10px;">${upg.desc}</div>
                    <div style="font-size:10px; color:#aaa;">Cost: ${costStr}</div>
                `;

                const btn = document.createElement('button');
                btn.innerText = 'UPGRADE';
                btn.style.float = 'right';
                btn.disabled = !canBuy;
                btn.onclick = () => this.upgradeGuardian(upg);
                
                div.appendChild(btn);
                container.appendChild(div);
            });
        }
    }

    craftItem(item) {
        // Deduct Resources
        for (let [res, qty] of Object.entries(item.cost)) {
            this.player.bag[res] -= qty;
            if (this.player.bag[res] <= 0) delete this.player.bag[res];
        }

        // Add Crafted Item to Inventory (Bag)
        // We use the ID as the key now (e.g. 'sword_wood')
        if (!this.player.bag[item.id]) this.player.bag[item.id] = 0;
        this.player.bag[item.id]++;

        playSFX('sfx-pickup'); 
        showDialog(`Crafted ${item.name}!`, 1000);
        
        this.showTab('craft'); // Refresh list
        this.updateEquipmentUI(); // Refresh inventory panel
    }

    upgradeGuardian(upg) {
        for (let [res, qty] of Object.entries(upg.cost)) {
            this.player.bag[res] -= qty;
            if (this.player.bag[res] <= 0) delete this.player.bag[res];
        }
        if (upg.id === 'heal') guardianSystem.skills.heal.level++;
        if (upg.id === 'fireball') guardianSystem.skills.fireball.unlocked = true;
        if (upg.id === 'asteroid') guardianSystem.skills.asteroid.unlocked = true;
        showDialog("Guardian Upgraded!", 1500);
        this.showTab('guardian');
    }
    
    getSaveData() { return { hasSpawned: this.hasSpawned, loc: this.workbenchLocation }; }
    loadSaveData(data) { this.hasSpawned = data.hasSpawned; this.workbenchLocation = data.loc; }
}
