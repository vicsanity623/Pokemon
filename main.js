// Global Instances
const player = new Player();
const world = new World(Date.now());
const canvas = document.getElementById('gameCanvas');
const renderer = new Renderer(canvas, world, player);
const battleSystem = new BattleSystem(player);
const questSystem = new QuestSystem(player);
const clock = new GameClock();

// Safe Spawn Logic
function findSafeSpawn() {
    let radius = 0;
    while (true) {
        // Spiral check (simplified to random attempts for speed)
        // If current tile is water, move randomly
        let tile = world.getTile(Math.round(player.x), Math.round(player.y));
        if (tile !== 'water') break;

        player.x = Math.floor(Math.random() * 20) - 10;
        player.y = Math.floor(Math.random() * 20) - 10;
    }
}
findSafeSpawn();

// Intro Story
const introText = [
    "Year 20XX...",
    "The world has fallen.",
    "You wake up alone.",
    "Take your Pokeballs.",
    "Survive."
];
let introIndex = 0;

function runIntro() {
    if (introIndex < introText.length) {
        showDialog(introText[introIndex], 0);
        introIndex++;
        setTimeout(runIntro, 2500);
    } else {
        hideDialog();
        showDialog("Use D-Pad to move. Tap A to interact.", 3000);
        questSystem.generate();
    }
}

// Main Loop
let lastTime = 0;
function gameLoop(timestamp) {
    if (!battleSystem.isActive) {
        // Smooth Movement Logic
        let dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        if (dt > 0.1) dt = 0.1; // Cap dt for lag spikes

        let dx = 0;
        let dy = 0;

        // Analog Input Priority
        if (input.active && (input.joystickVector.x !== 0 || input.joystickVector.y !== 0)) {
            dx = input.joystickVector.x;
            dy = input.joystickVector.y;
        } else {
            // Keyboard Fallback (8-way)
            if (input.isDown('ArrowUp')) dy -= 1;
            if (input.isDown('ArrowDown')) dy += 1;
            if (input.isDown('ArrowLeft')) dx -= 1;
            if (input.isDown('ArrowRight')) dx += 1;

            // Normalize Keyboard
            if (dx !== 0 || dy !== 0) {
                let len = Math.sqrt(dx * dx + dy * dy);
                dx /= len;
                dy /= len;
            }
        }

        if (dx !== 0 || dy !== 0) {
            // STRICT Normalization to fix diagonal speed bug
            // Ensure vector length is exactly 1
            let length = Math.sqrt(dx * dx + dy * dy);
            if (length > 0) {
                dx /= length;
                dy /= length;
            }

            // Calculate potential new position
            let moveSpeed = player.speed * (dt * 60); // Speed relative to 60fps
            let nextX = player.x + dx * moveSpeed;
            let nextY = player.y + dy * moveSpeed;

            // Collision Check (Center point)
            // We check the tile we are moving INTO
            let targetTile = world.getTile(Math.round(nextX), Math.round(nextY));

            if (targetTile !== 'water') {
                player.x = nextX;
                player.y = nextY;
                player.steps += moveSpeed; // Approximate steps
                player.moving = true;

                // Item Pickup
                let item = world.getItem(Math.round(player.x), Math.round(player.y));
                if (item) {
                    world.removeItem(Math.round(player.x), Math.round(player.y));
                    if (item === 'Herb') {
                        if (player.inventory['Herb']) player.inventory['Herb']++;
                        else player.inventory['Herb'] = 1;
                        showDialog(`Gathered a Herb! (Total: ${player.inventory['Herb']})`, 2000);
                    } else {
                        if (player.bag[item]) player.bag[item]++;
                        else player.bag[item] = 1;
                        showDialog(`Found a ${item}!`, 2000);
                    }
                }

                // Update Direction for sprites (if we had them)
                if (Math.abs(dx) > Math.abs(dy)) {
                    player.dir = dx > 0 ? 'right' : 'left';
                } else {
                    player.dir = dy > 0 ? 'down' : 'up';
                }

                // Quest Update (throttled)
                if (Math.floor(player.steps) % 10 === 0) questSystem.update('walk');

                // Encounter Check (Randomly based on distance moved)
                // Chance per tile moved approx
                if (targetTile === 'grass_tall' && Math.random() < 0.04 * moveSpeed) {
                    battleSystem.startBattle();
                }
            }
        } else {
            player.moving = false;
        }

        clock.update(player);
        world.updateNPCs(); // Update NPC movement
        renderer.draw();
        updateHUD();

        // Check NPC proximity
        let nearbyNPC = world.npcs.find(npc => {
            let dist = Math.sqrt(Math.pow(npc.x - player.x, 2) + Math.pow(npc.y - player.y, 2));
            return dist < 1;
        });

        if (nearbyNPC && !battleSystem.isActive) {
            document.getElementById('npc-prompt').classList.remove('hidden');
        } else {
            document.getElementById('npc-prompt').classList.add('hidden');
        }

        // Check Poke Center proximity
        let nearbyPokeCenter = world.buildings.find(building => {
            let dist = Math.sqrt(Math.pow(building.x - player.x, 2) + Math.pow(building.y - player.y, 2));
            return dist < 1.5 && building.type === 'pokecenter';
        });

        if (nearbyPokeCenter && !battleSystem.isActive) {
            // Show different prompt for Poke Center
            let prompt = document.getElementById('npc-prompt');
            prompt.innerText = 'Press A to heal';
            prompt.classList.remove('hidden');
        }

        // Poke Center Spawning (every 300 steps)
        if (Math.floor(player.steps) % 300 === 0 && player.steps > player.lastPokeCenterStep + 250) {
            let centerX = Math.round(player.x + (Math.random() * 40 - 20));
            let centerY = Math.round(player.y + (Math.random() * 40 - 20));
            world.spawnPokeCenter(centerX, centerY);
            player.lastPokeCenterStep = Math.floor(player.steps);
            showDialog('A Poke Center appeared nearby!', 3000);
        }

        // Egg Hatching Logic
        player.team.forEach(p => {
            if (p.isEgg) {
                p.eggSteps--;
                if (p.eggSteps <= 0) {
                    p.isEgg = false;
                    p.name = p.species; // Hatch!
                    showDialog(`Oh? The Egg hatched into ${p.name}!`, 4000);
                }
            }
        });
    }
    requestAnimationFrame(gameLoop);
}

// Interaction Handler (A Button)
input.press = (key) => {
    input.keys[key] = true;
    if (key === 'Enter') { // 'A' button mapped to Enter
        // Check for nearby Poke Center first
        let nearbyPokeCenter = world.buildings.find(building => {
            let dist = Math.sqrt(Math.pow(building.x - player.x, 2) + Math.pow(building.y - player.y, 2));
            return dist < 1.5 && building.type === 'pokecenter';
        });

        if (nearbyPokeCenter) {
            handlePokeCenterInteraction();
            return;
        }

        // Check for nearby NPC
        let nearbyNPC = world.npcs.find(npc => Math.abs(npc.x - player.x) < 1.5 && Math.abs(npc.y - player.y) < 1.5);
        if (nearbyNPC) {
            handleNPCInteraction(nearbyNPC);
        }
    }
};

function handlePokeCenterInteraction() {
    player.healAllPokemon();
    showDialog('♪ Your Pokemon have been restored to full health! ♪', 3000);
}

// B Button - Open Player Bag
input.keys['b'] = false; // Initialize B key
window.addEventListener('keydown', (e) => {
    if (e.key === 'b' && !battleSystem.isActive) {
        togglePlayerBag();
    }
});

function togglePlayerBag() {
    const bagMenu = document.getElementById('player-bag-menu');
    if (bagMenu.classList.contains('hidden')) {
        bagMenu.classList.remove('hidden');
        showBagTab('pokemon'); // Default tab
    } else {
        bagMenu.classList.add('hidden');
    }
}

function closePlayerBag() {
    document.getElementById('player-bag-menu').classList.add('hidden');
}

function showBagTab(tab) {
    // Update tab buttons
    document.getElementById('tab-pokemon').classList.toggle('active', tab === 'pokemon');
    document.getElementById('tab-items').classList.toggle('active', tab === 'items');

    const content = document.getElementById('bag-content');
    content.innerHTML = '';

    if (tab === 'pokemon') {
        // Show Pokemon Team
        if (player.team.length === 0) {
            content.innerHTML = '<p style="text-align:center; color: #999;">No Pokemon</p>';
            return;
        }

        player.team.forEach((p, index) => {
            let div = document.createElement('div');
            div.className = 'pokemon-item' + (p.hp <= 0 ? ' fainted' : '');

            let isFainted = p.hp <= 0 || (p.hp === undefined && !p.isEgg);
            let status = p.isEgg ? 'EGG' : isFainted ? 'FAINTED' : `HP: ${p.hp}/${p.maxHp}`;

            div.innerHTML = `
                <div class="pokemon-info">
                    <div>${p.name} Lv.${p.level}</div>
                    <div style="font-size: 10px; color: ${isFainted ? '#e74c3c' : '#2ecc71'};">${status}</div>
                </div>
                <div class="pokemon-actions">
                    ${index > 0 ? `<button onclick="swapPokemon(${index}, ${index - 1})">↑</button>` : ''}
                    ${index < player.team.length - 1 ? `<button onclick="swapPokemon(${index}, ${index + 1})">↓</button>` : ''}
                </div>
            `;
            content.appendChild(div);
        });
    } else if (tab === 'items') {
        // Show Items
        let hasItems = false;
        for (let [item, count] of Object.entries(player.bag)) {
            if (count > 0) {
                hasItems = true;
                let div = document.createElement('div');
                div.className = 'menu-item';
                div.innerHTML = `${item} x${count}`;
                div.onclick = () => useBagItem(item);
                content.appendChild(div);
            }
        }

        if (!hasItems) {
            content.innerHTML = '<p style="text-align:center; color: #999;">No Items</p>';
        }
    }
}

function swapPokemon(index1, index2) {
    let temp = player.team[index1];
    player.team[index1] = player.team[index2];
    player.team[index2] = temp;
    showBagTab('pokemon'); // Refresh
}

function useBagItem(item) {
    if (item === 'Potion' || item === 'Super Potion') {
        // Show Pokemon selection
        const content = document.getElementById('bag-content');
        content.innerHTML = '<p style="text-align:center; margin-bottom: 15px;">Select Pokemon:</p>';

        player.team.forEach((p, index) => {
            if (p.isEgg) return; // Can't use items on eggs

            let div = document.createElement('div');
            div.className = 'menu-item';
            div.innerHTML = `${p.name} - HP: ${p.hp}/${p.maxHp}`;
            div.onclick = () => {
                let healAmount = item === 'Potion' ? 20 : 50;
                p.hp = Math.min(p.hp + healAmount, p.maxHp);
                player.bag[item]--;
                showDialog(`Used ${item}! ${p.name} HP restored!`, 2000);
                setTimeout(() => showBagTab('items'), 2000);
            };
            content.appendChild(div);
        });

        // Add back button
        let backDiv = document.createElement('button');
        backDiv.className = 'back-btn';
        backDiv.innerText = 'BACK';
        backDiv.onclick = () => showBagTab('items');
        content.appendChild(backDiv);
    } else {
        showDialog(`Can't use ${item} here!`, 2000);
    }
}

function handleNPCInteraction(npc) {
    if (npc.type === 'talk') {
        showDialog(`${npc.name}: "${npc.dialog}"`, 3000);
    } else if (npc.type === 'quest') {
        if (npc.questCompleted) {
            showDialog("Herbalist: Thanks again for the herbs!", 3000);
        } else if (npc.questGiven && player.inventory['Herb'] >= 10) {
            player.inventory['Herb'] -= 10;
            player.money += 500;
            player.team[0].exp += 200;
            npc.questCompleted = true;
            npc.color = '#2ecc71'; // Green when complete
            showDialog("Herbalist: Perfect! Here is $500 and XP. Quest complete!", 3000);
        } else if (npc.questGiven) {
            let remaining = 10 - (player.inventory['Herb'] || 0);
            showDialog(`Herbalist: Still need ${remaining} more Herbs!`, 3000);
        } else {
            npc.questGiven = true;
            npc.color = '#e74c3c'; // Red when quest active
            showDialog("Herbalist: Bring me 10 Herbs for $500 and XP!", 3000);
        }
    } else if (npc.type === 'daycare') {
        if (player.team.length < 2) {
            showDialog("Daycare: Come back with at least 2 Pokemon.", 3000);
            return;
        }
        // Simplified Breeding: First 2 Pokemon
        let p1 = player.team[0];
        let p2 = player.team[1];

        if (p1.isEgg || p2.isEgg) {
            showDialog("Daycare: Eggs cannot breed!", 3000);
            return;
        }

        // Check Type Match (Very simple: same primary type)
        // Note: In real game, egg groups. Here: Type.
        if (p1.type === p2.type) {
            if (player.team.length >= 6) {
                showDialog("Daycare: Your party is full.", 3000);
            } else {
                showDialog("Daycare: They get along great! Here is an Egg!", 3000);
                player.team.push({
                    name: 'EGG',
                    species: p1.name, // Offspring is mother's species (p1 for simplicity)
                    level: 1,
                    maxHp: 15,
                    hp: 15,
                    exp: 0,
                    type: p1.type,
                    backSprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/egg.png', // Placeholder
                    isEgg: true,
                    eggSteps: 500
                });
            }
        } else {
            showDialog("Daycare: They don't seem to like each other...", 3000);
        }
    }
}

// Init
window.onload = () => {
    if (!loadGame()) {
        // Give starter items if new game
        player.team.push({
            name: 'PIKACHU',
            level: 5,
            maxHp: 40,
            hp: 40,
            exp: 0,
            type: 'electric',
            backSprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/25.png'
        });
        runIntro();
    } else {
        showDialog("Welcome back!", 2000);
    }

    requestAnimationFrame(gameLoop);

    // Auto-Save every 30s
    setInterval(saveGame, 30000);

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Service Worker Registered'))
            .catch(err => console.error('SW Registration Failed', err));
    }
};

// Save System
function saveGame() {
    const data = {
        player: {
            x: player.x,
            y: player.y,
            stats: {
                level: player.pLevel,
                steps: player.steps
            },
            team: player.team,
            bag: player.bag
        },
        world: {
            seed: world.rng.seed,
            items: world.items
        },
        time: clock.gameDays
    };
    localStorage.setItem('poke_save', JSON.stringify(data));
    console.log("Game Saved");
}

function loadGame() {
    const raw = localStorage.getItem('poke_save');
    if (!raw) return false;

    try {
        const data = JSON.parse(raw);

        // Restore Player
        player.x = data.player.x;
        player.y = data.player.y;
        player.pLevel = data.player.stats.level;
        player.steps = data.player.stats.steps;
        player.team = data.player.team;
        player.bag = data.player.bag;
        document.getElementById('meta-level').innerText = player.pLevel;

        // Restore World
        // Note: We don't restore seed here as it's passed in constructor, 
        // but for full correctness we should re-init world if seed changed.
        // For this demo, we assume seed is constant or we'd need to re-new World.
        // We'll just restore items.
        world.items = data.world.items;

        // Restore Time
        clock.gameDays = data.time;

        return true;
    } catch (e) {
        console.error("Save file corrupted", e);
        return false;
    }
}

function updateHUD() {
    // Money
    document.getElementById('hud-money').innerText = `$${player.money}`;

    // XP (Active Pokemon)
    if (player.team.length === 0) return; // No Pokemon

    let p = player.team[0];
    if (!p || typeof p.exp === 'undefined' || typeof p.level === 'undefined') {
        // Pokemon missing required properties
        document.getElementById('hud-xp-text').innerText = 'XP: --';
        document.getElementById('hud-xp-fill').style.width = '0%';
        return;
    }

    let maxExp = p.level * 100;
    let pct = (p.exp / maxExp) * 100;

    document.getElementById('hud-xp-text').innerText = `XP: ${p.exp} / ${maxExp}`;
    document.getElementById('hud-xp-fill').style.width = `${pct}%`;
}