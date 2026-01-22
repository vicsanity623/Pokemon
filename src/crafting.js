class CraftingSystem {
    constructor(player) {
        this.player = player;
        this.workbenchLocation = null;
        this.hasSpawned = false;

        this.RECIPES = [
            // WEAPONS
            { name: 'Wooden Sword', type: 'weapon', damage: 5, cost: { 'Wood': 5 }, color: '#fff' },
            { name: 'Stone Sword', type: 'weapon', damage: 10, cost: { 'Wood': 2, 'Stone': 10 }, color: '#2ecc71' },
            { name: 'Iron Sword', type: 'weapon', damage: 20, cost: { 'Wood': 5, 'Iron Ore': 5 }, color: '#3498db' },
            { name: 'Obsidian Blade', type: 'weapon', damage: 45, cost: { 'Obsidian': 10, 'Shadow Essence': 5 }, color: '#9b59b6' },
            { name: 'Master Sword', type: 'weapon', damage: 100, cost: { 'Gold Ore': 50, 'Obsidian': 50, 'Bone': 100 }, color: '#f1c40f' },

            // ARMOR
            { name: 'Leather Vest', type: 'armor', defense: 10, cost: { 'Wood': 10, 'Bone': 5 }, color: '#2ecc71' },
            { name: 'Iron Plate', type: 'armor', defense: 30, cost: { 'Iron Ore': 20 }, color: '#3498db' },
            { name: 'Shadow Armor', type: 'armor', defense: 60, cost: { 'Obsidian': 20, 'Shadow Essence': 10 }, color: '#9b59b6' },

            // TECH / TOOLS
            { name: 'Night Vision Goggles', type: 'accessory', effect: 'vision', cost: { 'Iron Ore': 5, 'Gold Ore': 2, 'Shadow Essence': 5 }, color: '#3498db' }
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

        // Spawn next to house
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
        // Create Modal HTML
        const modal = document.createElement('div');
        modal.id = 'crafting-ui';
        modal.className = 'battle-sub-menu'; // Reuse style
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="menu-header">WORKBENCH</div>
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <button class="tab-btn active" onclick="craftingSystem.showTab('craft')">CRAFT</button>
                <button class="tab-btn" onclick="craftingSystem.showTab('guardian')">GUARDIAN</button>
            </div>
            <div id="crafting-content" style="flex:1; overflow-y:auto;"></div>
            <button class="back-btn" onclick="craftingSystem.closeMenu()">CLOSE</button>
        `;
        document.body.appendChild(modal);
        this.showTab('craft');
    }

    closeMenu() {
        const el = document.getElementById('crafting-ui');
        if (el) el.remove();
    }

    showTab(tab) {
        const container = document.getElementById('crafting-content');
        container.innerHTML = '';

        if (tab === 'craft') {
            this.RECIPES.forEach(item => {
                const div = document.createElement('div');
                div.className = 'menu-item';
                div.style.borderColor = item.color;
                
                // Build Cost String
                let costStr = Object.entries(item.cost).map(([k, v]) => `${k} x${v}`).join(', ');
                
                // Check Affordability
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
                if (!canCraft) btn.style.opacity = 0.5;
                
                btn.onclick = () => this.craftItem(item);

                div.appendChild(btn);
                container.appendChild(div);
            });
        } 
        else if (tab === 'guardian') {
            if (!guardianSystem.activeGuardian) {
                container.innerHTML = "<p>You have no Guardian active.</p>";
                return;
            }

            this.GUARDIAN_UPGRADES.forEach(upg => {
                const div = document.createElement('div');
                div.className = 'menu-item';
                
                let costStr = Object.entries(upg.cost).map(([k, v]) => `${k} x${v}`).join(', ');

                // Check Logic
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

        // Equip Automatically
        if (typeof rpgSystem !== 'undefined') {
            rpgSystem.equip(item, item.type);
        }

        playSFX('sfx-pickup'); // Success sound
        this.showTab('craft'); // Refresh UI
    }

    upgradeGuardian(upg) {
        // Deduct
        for (let [res, qty] of Object.entries(upg.cost)) {
            this.player.bag[res] -= qty;
            if (this.player.bag[res] <= 0) delete this.player.bag[res];
        }

        // Apply
        if (upg.id === 'heal') guardianSystem.skills.heal.level++;
        if (upg.id === 'fireball') guardianSystem.skills.fireball.unlocked = true;
        if (upg.id === 'asteroid') guardianSystem.skills.asteroid.unlocked = true;

        showDialog("Guardian Upgraded!", 1500);
        this.showTab('guardian');
    }
    
    getSaveData() { return { hasSpawned: this.hasSpawned, loc: this.workbenchLocation }; }
    loadSaveData(data) { this.hasSpawned = data.hasSpawned; this.workbenchLocation = data.loc; }
}
