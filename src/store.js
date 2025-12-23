/**
 * Store System
 * - Spawns a Poke Mart next to the Arena
 * - Allows buying and selling items
 */
class StoreSystem {
    constructor(player) {
        this.player = player;
        this.location = null; // {x, y}
        this.hasSpawned = false;
        this.isOpen = false;
    }

    /**
     * Check if store needs to spawn (requires Arena to exist)
     */
    checkSpawn(world, arenaSystem) {
        if (this.hasSpawned) return;
        if (!arenaSystem.hasSpawned || !arenaSystem.pyramidLocation) return;

        // Spawn 4 tiles to the right of the Arena
        const arenaLoc = arenaSystem.pyramidLocation;
        let x = arenaLoc.x + 4;
        let y = arenaLoc.y;

        // Ensure valid placement
        if (world.getTile(x, y) === 'water') {
            // Try slightly adjusted positions if direct right is water
            if (world.getTile(x, y + 1) !== 'water') y += 1;
            else if (world.getTile(x, y - 1) !== 'water') y -= 1;
            else if (world.getTile(x - 1, y) !== 'water') x -= 1; // Closer
        }

        this.location = { x: x, y: y };
        this.hasSpawned = true;

        world.buildings.push({
            type: 'store',
            x: x,
            y: y
        });
    }

    interact() {
        this.openUI();
    }

    openUI() {
        this.isOpen = true;
        const ui = document.getElementById('store-ui');
        ui.classList.remove('hidden');
        
        // Prevent touches on the Mart from moving the player/map
        ui.onpointerdown = (e) => e.stopPropagation();
        
        this.updateMoneyDisplay();
        this.showBuyTab();
    }

    closeUI() {
        this.isOpen = false;
        document.getElementById('store-ui').classList.add('hidden');
    }

    showBuyTab() {
        document.getElementById('store-buy-tab').classList.add('active');
        document.getElementById('store-sell-tab').classList.remove('active');

        const list = document.getElementById('store-list');
        list.innerHTML = '';

        // Sale Items
        const forSale = [
            'Potion', 'Super Potion', 'Hyper Potion', 'Max Potion',
            'Pokeball', 'Great Ball', 'Ultra Ball', 'Master Ball'
        ];

        forSale.forEach(itemName => {
            const itemData = ITEMS[itemName];
            if (!itemData) return;

            const row = document.createElement('div');
            row.className = 'store-row';

            const info = document.createElement('div');
            info.innerHTML = `<b>${itemName}</b><br><span class="coin">💰</span> ${itemData.price}`;

            const btn = document.createElement('button');
            btn.innerText = 'BUY';
            
            // MOBILE FIX: Use onpointerdown and stopPropagation
            btn.onpointerdown = (e) => {
                e.stopPropagation();
                this.buyItem(itemName);
            };

            row.appendChild(info);
            row.appendChild(btn);
            list.appendChild(row);
        });

        this.updateMoneyDisplay();
    }

    showSellTab() {
        document.getElementById('store-buy-tab').classList.remove('active');
        document.getElementById('store-sell-tab').classList.add('active');

        const list = document.getElementById('store-list');
        list.innerHTML = '';

        // Player Inventory
        for (let [itemName, count] of Object.entries(this.player.bag)) {
            if (count <= 0) continue;

            const itemData = ITEMS[itemName];
            const price = itemData ? Math.floor(itemData.price / 2) : 0;

            const row = document.createElement('div');
            row.className = 'store-row';

            const info = document.createElement('div');
            info.innerHTML = `<b>${itemName}</b> (x${count})<br><span class="coin">💰</span> ${price}`;

            const btn = document.createElement('button');
            btn.innerText = 'SELL';
            
            // MOBILE FIX: Use onpointerdown and stopPropagation
            btn.onpointerdown = (e) => {
                e.stopPropagation();
                this.sellItem(itemName);
            };

            row.appendChild(info);
            row.appendChild(btn);
            list.appendChild(row);
        }

        if (list.children.length === 0) {
            list.innerHTML = '<div style="padding:20px; text-align:center;">Bag is empty</div>';
        }

        this.updateMoneyDisplay();
    }

    buyItem(itemName) {
        const itemData = ITEMS[itemName];
        if (this.player.money >= itemData.price) {
            this.player.money -= itemData.price;
            if (!this.player.bag[itemName]) this.player.bag[itemName] = 0;
            this.player.bag[itemName]++;
            
            // Play sound
            playSFX('sfx-pickup'); 
            
            // Refresh UI
            this.updateMoneyDisplay();
            
            // Optional: feedback
            console.log(`Purchased ${itemName}`);
        } else {
            showDialog("Not enough money!");
        }
    }

    sellItem(itemName) {
        if (this.player.bag[itemName] > 0) {
            const itemData = ITEMS[itemName];
            const price = itemData ? Math.floor(itemData.price / 2) : 0;

            this.player.bag[itemName]--;
            if (this.player.bag[itemName] === 0) delete this.player.bag[itemName];

            this.player.money += price;
            playSFX('sfx-pickup');
            this.showSellTab(); // Refresh list
        }
    }

    updateMoneyDisplay() {
        const moneyEl = document.getElementById('store-money');
        if (moneyEl) {
            moneyEl.innerText = `Money: $${this.player.money}`;
        }
    }
}