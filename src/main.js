// Global Instances
const VERSION = 'v4.4';
const player = new Player();
const world = new World(Date.now());
const canvas = document.getElementById('gameCanvas');
const renderer = new Renderer(canvas, world, player);
const battleSystem = new BattleSystem(player);
const questSystem = new QuestSystem(player);
const clock = new GameClock();
const mergeSystem = new CombineSystem(player);

// Music System
const mainMusic = document.getElementById('main-music');
const battleMusic = document.getElementById('battle-music');
let musicVolume = 0.5; // 50% default volume

// Generate random stats for Pokemon (12-100 range)
function generatePokemonStats() {
    return {
        strength: Math.floor(Math.random() * 89) + 12, // 12-100
        defense: Math.floor(Math.random() * 89) + 12, // 12-100
        speed: Math.floor(Math.random() * 89) + 12, // 12-100
        hp: Math.floor(Math.random() * 89) + 12, // 12-100
        special: Math.floor(Math.random() * 89) + 12 // 12-100
    };
}

// Safe Spawn Logic
function findSafeSpawn() {
    let attempts = 0;
    while (attempts < 100) {
        attempts++;
        // Spiral check (simplified to random attempts for speed)
        // If current tile is water, move randomly
        let x = Math.floor(Math.random() * 20) - 10;
        let y = Math.floor(Math.random() * 20) - 10;

        let tile = world.getTile(x, y);
        if (tile !== 'water') {
            // Check neighbors to ensure not isolated
            let neighbors = 0;
            if (world.getTile(x + 1, y) !== 'water') neighbors++;
            if (world.getTile(x - 1, y) !== 'water') neighbors++;
            if (world.getTile(x, y + 1) !== 'water') neighbors++;
            if (world.getTile(x, y - 1) !== 'water') neighbors++;

            if (neighbors >= 2) {
                player.x = x;
                player.y = y;
                break;
            }
        }
    }
}
findSafeSpawn();

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W')
        input.press('up');
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S')
        input.press('down');
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A')
        input.press('left');
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')
        input.press('right');
    if (e.key === 'z' || e.key === 'Z') input.press('a');
    if (e.key === 'x' || e.key === 'X') input.press('b');
    if (e.key === 'Enter') input.press('start');
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W')
        input.release('up');
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S')
        input.release('down');
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A')
        input.release('left');
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')
        input.release('right');
    if (e.key === 'z' || e.key === 'Z') input.release('a');
    if (e.key === 'x' || e.key === 'X') input.release('b');
    if (e.key === 'Enter') input.release('start');
});

// Intro Story
const introText = [
    'Year 20XX...',
    'The world has fallen.',
    'You wake up alone.',
    'Take your Pokeballs.',
    'Survive.'
];
let introIndex = 0;

function runIntro() {
    if (introIndex < introText.length) {
        showDialog(introText[introIndex], 0);
        introIndex++;
        setTimeout(runIntro, 2500);
    } else {
        hideDialog();
        showDialog('Use D-Pad to move. Tap A to interact.', 3000);
        questSystem.generate();
    }
}

// Main Loop
let lastTime = 0;
function gameLoop(timestamp) {
    if (isPaused) {
        lastTime = timestamp; // Prevent dt spike when resuming
        requestAnimationFrame(gameLoop);
        return;
    }

    if (!battleSystem.isActive) {
        // Smooth Movement Logic
        let dt = ((timestamp - lastTime) / 1000) * gameSpeed;
        lastTime = timestamp;
        if (dt > 0.1) dt = 0.1; // Cap dt for lag spikes

        let dx = 0;
        let dy = 0;

        // Analog Input Priority
        if (
            input.active &&
            (input.joystickVector.x !== 0 || input.joystickVector.y !== 0)
        ) {
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
            let targetTile = world.getTile(
                Math.round(nextX),
                Math.round(nextY)
            );

            if (targetTile !== 'water') {
                player.x = nextX;
                player.y = nextY;
                player.steps += moveSpeed; // Approximate steps
                player.moving = true;

                // Item Pickup
                let item = world.getItem(
                    Math.round(player.x),
                    Math.round(player.y)
                );
                if (item) {
                    world.removeItem(
                        Math.round(player.x),
                        Math.round(player.y)
                    );
                    playSFX('sfx-pickup'); // Play pickup sound
                    if (item === 'Herb') {
                        if (player.inventory['Herb'])
                            player.inventory['Herb']++;
                        else player.inventory['Herb'] = 1;
                        showDialog(
                            `Gathered a Herb! (Total: ${player.inventory['Herb']})`,
                            2000
                        );
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
                if (Math.floor(player.steps) % 10 === 0)
                    questSystem.update('walk');

                // Encounter Check (Randomly based on distance moved)
                // Chance per tile moved approx - increased for more encounters
                if (
                    targetTile === 'grass_tall' &&
                    Math.random() < 0.08 * moveSpeed
                ) {
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
        let nearbyNPC = world.npcs.find((npc) => {
            let dist = Math.sqrt(
                Math.pow(npc.x - player.x, 2) + Math.pow(npc.y - player.y, 2)
            );
            return dist < 1;
        });

        if (nearbyNPC && !battleSystem.isActive) {
            document.getElementById('npc-prompt').classList.remove('hidden');
        } else {
            document.getElementById('npc-prompt').classList.add('hidden');
        }

        // Check Poke Center proximity
        let nearbyPokeCenter = world.buildings.find((building) => {
            let dist = Math.sqrt(
                Math.pow(building.x - player.x, 2) +
                Math.pow(building.y - player.y, 2)
            );
            return dist < 1.5 && building.type === 'pokecenter';
        });

        if (nearbyPokeCenter && !battleSystem.isActive) {
            // Show different prompt for Poke Center
            let prompt = document.getElementById('npc-prompt');
            prompt.innerText = 'Press A to heal';
            prompt.classList.remove('hidden');
        }

        // Poke Center Spawning (every 300 steps)
        if (
            Math.floor(player.steps) % 300 === 0 &&
            player.steps > player.lastPokeCenterStep + 250
        ) {
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

                    // --- SPRITE RESTORATION FIX ---
                    // Restore the sprite we saved when the egg was created
                    if (p.storedSprite) {
                        p.backSprite = p.storedSprite;
                    } else {
                        // Fallback if data is missing (old saves)
                        p.backSprite = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';
                    }

                    // Stat Logic
                    if (!p.stats) {
                        p.stats = generatePokemonStats();
                    }

                    p.maxHp = p.level * 5 + p.stats.hp;
                    p.hp = p.maxHp;

                    showDialog(`Oh? The Egg hatched into ${p.name}!`, 4000);

                    // Force UI refresh immediately
                    updateHUD();
                }
            }
        });
    }
    requestAnimationFrame(gameLoop);
}

// Interaction Handler (A Button)
input.press = (key) => {
    input.keys[key] = true;
    if (key === 'Enter') {
        // 'A' button mapped to Enter
        // Check for nearby Poke Center first
        let nearbyPokeCenter = world.buildings.find((building) => {
            let dist = Math.sqrt(
                Math.pow(building.x - player.x, 2) +
                Math.pow(building.y - player.y, 2)
            );
            return dist < 1.5 && building.type === 'pokecenter';
        });

        if (nearbyPokeCenter) {
            handlePokeCenterInteraction();
            return;
        }

        // Check for nearby NPC
        let nearbyNPC = world.npcs.find(
            (npc) =>
                Math.abs(npc.x - player.x) < 1.5 &&
                Math.abs(npc.y - player.y) < 1.5
        );
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
// B Button - Open Player Bag
input.keys['b'] = false; // Initialize B key
// Removed duplicate listener. 'b' key is handled by global input system now.

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
    document
        .getElementById('tab-pokemon')
        .classList.toggle('active', tab === 'pokemon');
    document
        .getElementById('tab-items')
        .classList.toggle('active', tab === 'items');

    const content = document.getElementById('bag-content');
    content.innerHTML = '';

    if (tab === 'pokemon') {
        // Show Pokemon Team
        if (player.team.length === 0) {
            content.innerHTML =
                '<p style="text-align:center; color: #999;">No Pokemon</p>';
            return;
        }

        player.team.forEach((p, index) => {
            let div = document.createElement('div');
            div.className = 'pokemon-item' + (p.hp <= 0 ? ' fainted' : '');
            div.style.cursor = 'pointer';

            let isFainted = p.hp <= 0 || (p.hp === undefined && !p.isEgg);
            let status = p.isEgg
                ? 'EGG'
                : isFainted
                    ? 'FAINTED'
                    : `HP: ${p.hp}/${p.maxHp}`;

            // Get stats safely
            const stats = p.stats || {
                strength: 0,
                defense: 0,
                speed: 0,
                hp: 0,
                special: 0
            };
            const scoreRating =
                stats.strength +
                stats.defense +
                stats.speed +
                stats.hp +
                stats.special;

            div.innerHTML = `
                <div class="pokemon-info">
                    <div><strong>${p.name}</strong> Lv.${p.level}</div>
                    <div style="font-size: 10px; color: ${isFainted ? '#e74c3c' : '#2ecc71'};">${status}</div>
                    ${!p.isEgg
                    ? `
                        <div style="font-size: 9px; color: #aaa; margin-top: 3px;">
                            STR:${stats.strength} DEF:${stats.defense} SPD:${stats.speed} SPC:${stats.special}
                        </div>
                        <div style="font-size: 11px; color: #2ecc71; margin-top: 2px; font-weight: bold;">
                            SR: ${scoreRating}
                        </div>
                    `
                    : ''
                }
                </div>
                <div class="pokemon-actions">
                    ${index > 0 ? `<button onclick="event.stopPropagation(); swapPokemon(${index}, ${index - 1})">↑</button>` : ''}
                    ${index < player.team.length - 1 ? `<button onclick="event.stopPropagation(); swapPokemon(${index}, ${index + 1})">↓</button>` : ''}
                </div>
            `;

            // Click to view detailed stats
            div.onclick = () => {
                if (!p.isEgg) {
                    showPokemonStats(p);
                }
            };

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
            content.innerHTML =
                '<p style="text-align:center; color: #999;">No Items</p>';
        }
    }
}

function swapPokemon(index1, index2) {
    let temp = player.team[index1];
    player.team[index1] = player.team[index2];
    player.team[index2] = temp;
    showBagTab('pokemon'); // Refresh
}

// Show detailed Pokemon stats modal
async function showPokemonStats(pokemon) {
    const modal = document.getElementById('pokemon-stats-modal');
    const display = document.getElementById('pokemon-stats-display');

    const stats = pokemon.stats || {
        strength: 0,
        defense: 0,
        speed: 0,
        hp: 0,
        special: 0
    };

    // Get animated sprite if possible
    let sprite =
        pokemon.animatedSprite || pokemon.sprite || pokemon.backSprite || '';

    // If no animated sprite, try to fetch it
    if (!pokemon.animatedSprite && pokemon.id) {
        try {
            const res = await fetch(
                `https://pokeapi.co/api/v2/pokemon/${pokemon.id}`
            );
            const data = await res.json();
            sprite =
                data.sprites.versions['generation-v']['black-white'][
                'animated'
                ]['front_default'] || data.sprites.front_default;
        } catch (e) {
            console.log('Could not fetch animated sprite');
        }
    }

    const isFainted = pokemon.hp <= 0;
    const hpPercent = (pokemon.hp / pokemon.maxHp) * 100;
    const scoreRating =
        stats.strength + stats.defense + stats.speed + stats.hp + stats.special;

    display.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <img src="${sprite}" style="width: 128px; height: 128px; image-rendering: pixelated; margin-bottom: 15px;">
            <h2 style="margin: 10px 0; color: #ffd700;">${pokemon.name}</h2>
            <div style="font-size: 16px; color: #aaa; margin-bottom: 10px;">
                Level ${pokemon.level} | Type: ${pokemon.type || 'Unknown'}
            </div>
            <div style="font-size: 24px; color: #2ecc71; font-weight: bold; margin-bottom: 15px;">
                SR: ${scoreRating}
            </div>
            
            <div style="text-align: left; display: inline-block; width: 80%; max-width: 350px;">
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: #e74c3c;"><strong>HP:</strong></span>
                        <span>${pokemon.hp}/${pokemon.maxHp}</span>
                    </div>
                    <div style="background: #333; height: 20px; border-radius: 10px; overflow: hidden;">
                        <div style="background: ${isFainted ? '#e74c3c' : '#2ecc71'}; height: 100%; width: ${hpPercent}%; transition: width 0.3s;"></div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px;">
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
                        <div style="color: #f39c12;"><strong>⚔️ Strength</strong></div>
                        <div style="font-size: 20px; color: #fff;">${stats.strength}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
                        <div style="color: #3498db;"><strong>🛡️ Defense</strong></div>
                        <div style="font-size: 20px; color: #fff;">${stats.defense}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
                        <div style="color: #9b59b6;"><strong>⚡ Speed</strong></div>
                        <div style="font-size: 20px; color: #fff;">${stats.speed}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
                        <div style="color: #e91e63;"><strong>✨ Special</strong></div>
                        <div style="font-size: 20px; color: #fff;">${stats.special}</div>
                    </div>
                </div>
                
                ${pokemon.exp !== undefined
            ? `
                    <div style="margin-top: 15px; font-size: 12px; color: #aaa;">
                        EXP: ${pokemon.exp} / ${pokemon.level * 100}
                    </div>
                `
            : ''
        }
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
}

function closePokemonStats() {
    document.getElementById('pokemon-stats-modal').classList.add('hidden');
}

function closePokemonList() {
    document.getElementById('pokemon-list-modal').classList.add('hidden');
}

function useBagItem(itemName) {
    if (!player.bag[itemName] || player.bag[itemName] <= 0) return;

    const itemData = ITEMS[itemName];
    if (!itemData) return;

    if (battleSystem.isActive) {
        // Battle Mode Usage
        if (itemData.type === 'potion') {
            battleSystem.useItem(itemName);
            togglePlayerBag(); // Close bag
        } else if (itemData.type === 'ball') {
            battleSystem.throwPokeball(itemName);
            togglePlayerBag(); // Close bag
        } else {
            showDialog("Can't use that here!");
        }
    } else {
        // World Mode Usage
        if (itemData.type === 'potion') {
            // Heal first pokemon
            let p = player.team[0];
            if (p.hp < p.maxHp) {
                let healAmount = itemData.val;
                p.hp = Math.min(p.maxHp, p.hp + healAmount);
                player.bag[itemName]--;
                if (player.bag[itemName] === 0) delete player.bag[itemName];
                showDialog(`Healed ${p.name} for ${healAmount} HP!`);
                updateHUD();
                showBagTab('items'); // Refresh list
            } else {
                showDialog("It's already full HP!");
            }
        } else {
            showDialog("Can't use that now.");
        }
    }
}

function handleNPCInteraction(npc) {
    if (npc.type === 'talk') {
        showDialog(`${npc.name}: "${npc.dialog}"`, 3000);
    } else if (npc.type === 'quest') {
        if (npc.questCompleted) {
            showDialog('Herbalist: Thanks again for the herbs!', 3000);
        } else if (npc.questGiven && player.inventory['Herb'] >= 10) {
            player.inventory['Herb'] -= 10;
            
            // --- NEW DYNAMIC REWARD ---
            // Base $500 + ($100 for every Player Level)
            // Level 5 = $1000, Level 10 = $1500, etc.
            let rewardMoney = 500 + (player.pLevel * 100);
            
            player.money += rewardMoney;
            player.team[0].exp += 200;
            
            npc.questCompleted = true;
            npc.color = '#2ecc71'; // Green when complete
            
            showDialog(
                `Herbalist: Perfect! Here is $${rewardMoney} and XP. Quest complete!`,
                3000
            );
            updateHUD(); // Force Money UI to update immediately
            
        } else if (npc.questGiven) {
            let remaining = 10 - (player.inventory['Herb'] || 0);
            showDialog(`Herbalist: Still need ${remaining} more Herbs!`, 3000);
        } else {
            npc.questGiven = true;
            npc.color = '#e74c3c'; // Red when quest active
            showDialog('Herbalist: Bring me 10 Herbs for a reward!', 3000);
        }
    } else if (npc.type === 'daycare') {
        // 1. Check Party Size
        if (player.team.length < 2) {
            showDialog("Daycare: Come back with at least 2 Pokemon.", 3000);
            return;
        }

        let p1 = player.team[0];
        let p2 = player.team[1];

        // 2. Check if Eggs
        if (p1.isEgg || p2.isEgg) {
            showDialog("Daycare: Eggs cannot breed!", 3000);
            return;
        }

        // 3. SAFETY CHECK: Ensure Game Days exists, default to 0 if broken
        let currentDay = (clock && typeof clock.gameDays === 'number') ? clock.gameDays : 0;

        // Default to -100 if never bred
        let lastBredP1 = (typeof p1.lastBredDay === 'number') ? p1.lastBredDay : -100;
        let lastBredP2 = (typeof p2.lastBredDay === 'number') ? p2.lastBredDay : -100;

        console.log(`Breeding Debug: Day ${currentDay} | P1 Last: ${lastBredP1} | P2 Last: ${lastBredP2}`);

        // 4. COOLDOWN CHECK (30 Days)
        if ((currentDay - lastBredP1 < 30) || (currentDay - lastBredP2 < 30)) {
            let waitTime = 30 - (currentDay - Math.max(lastBredP1, lastBredP2));
            showDialog(`Daycare: They are tired. Wait ${Math.floor(waitTime)} days.`, 3000);
            return;
        }

        // 5. Type Match Check
        if (p1.type === p2.type) {
            if (player.team.length >= 6) {
                showDialog("Daycare: Your party is full.", 3000);
            } else {
                showDialog("Daycare: They get along great! Here is an Egg!", 3000);

                // MARK THEM AS BRED
                p1.lastBredDay = currentDay;
                p2.lastBredDay = currentDay;

                // STAT INHERITANCE
                if (!p1.stats) p1.stats = generatePokemonStats();
                if (!p2.stats) p2.stats = generatePokemonStats();

                const inheritedStats = {
                    strength: Math.max(p1.stats.strength, p2.stats.strength),
                    defense: Math.max(p1.stats.defense, p2.stats.defense),
                    speed: Math.max(p1.stats.speed, p2.stats.speed),
                    hp: Math.max(p1.stats.hp, p2.stats.hp),
                    special: Math.max(p1.stats.special, p2.stats.special)
                };

                // ADD EGG
                player.team.push({
                    name: 'EGG',
                    species: p1.name,
                    level: 1,
                    maxHp: 15,
                    hp: 15,
                    exp: 0,
                    type: p1.type,
                    // Specific Egg Sprite
                    backSprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dream-world/egg.png',
                    // Save Parent Sprite for Hatching
                    storedSprite: p1.backSprite,
                    isEgg: true,
                    eggSteps: 500,
                    stats: inheritedStats
                });
            }
        } else {
            showDialog("Daycare: They don't seem to like each other...", 3000);
        }
    }
}

// Init
window.onload = async () => {
    // 1. UPDATE VERSION TEXT IN MENU
    const verEl = document.getElementById('game-version');
    if (verEl) verEl.innerText = `Version: ${VERSION}`;

    // Start Loading Assets
    await assetLoader.loadAll();

    if (!loadGame()) {
        // Give starter items if new game
        const starterStats = generatePokemonStats();
        const starterMaxHp = 5 * 5 + starterStats.hp;

        // Pikachu 1
        player.team.push({
            name: 'PIKACHU',
            level: 5,
            maxHp: starterMaxHp,
            hp: starterMaxHp,
            exp: 0,
            type: 'electric',
            backSprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/25.png',
            stats: starterStats
        });

        // Pikachu 2 (Different Stats for breeding test)
        const p2Stats = generatePokemonStats();
        const p2MaxHp = 5 * 5 + p2Stats.hp;
        player.team.push({
            name: 'PIKACHU',
            level: 5,
            maxHp: p2MaxHp,
            hp: p2MaxHp,
            exp: 0,
            type: 'electric',
            backSprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/25.png',
            stats: p2Stats
        });

        runIntro();
    } else {
        showDialog('Welcome back!', 2000);
    }

    requestAnimationFrame(gameLoop);

    // Initialize Music
    const mainMusic = /** @type {HTMLAudioElement} */ (
        document.getElementById('main-music')
    );
    const battleMusic = /** @type {HTMLAudioElement} */ (
        document.getElementById('battle-music')
    );

    if (mainMusic && battleMusic) {
        mainMusic.volume = musicVolume;
        battleMusic.volume = musicVolume;

        // Start main music (with autoplay handling)
        mainMusic.play().catch((err) => {
            console.log(
                'Autoplay blocked. Music will start on first user interaction.'
            );
            // Add one-time click listener to start music
            document.addEventListener(
                'click',
                () => {
                    if (mainMusic.paused) mainMusic.play();
                },
                { once: true }
            );
        });
    }

    // Auto-Save every 30s
    setInterval(saveGame, 30000);

    // Register Service Worker with AUTO-UPDATE Logic
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(registration => {
            console.log('Service Worker Registered');

            // 1. Check for updates immediately
            registration.update();

            // 2. Detect if a new version is being installed
            registration.onupdatefound = () => {
                const newWorker = registration.installing;
                newWorker.onstatechange = () => {
                    if (newWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            // New update found! Notify user and reload
                            showDialog("Update found! Reloading...", 2000);
                            setTimeout(() => {
                                window.location.reload();
                            }, 2000);
                        }
                    }
                };
            };
        }).catch(err => console.error('SW Registration Failed', err));

        // 3. Force reload if the controller changes (ensures you get the new version)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
    }
};

// Save System
function saveGame() {
    const data = {
        player: {
            x: player.x,
            y: player.y,
            // --- NEW: Save Money ---
            money: player.money, 
            stats: {
                level: player.pLevel,
                steps: player.steps
            },
            team: player.team,
            bag: player.bag,
            storage: player.storage,
            seen: player.seen,
            seenShiny: player.seenShiny
        },
        world: {
            seed: world.rng.seed,
            items: world.items,
            npcs: world.npcs.map((npc) => ({
                x: npc.x,
                y: npc.y,
                name: npc.name,
                type: npc.type,
                dialog: npc.dialog
            })),
            buildings: world.buildings
        },
        time: clock.elapsedTime + (Date.now() - clock.startTime),
        gameDays: clock.gameDays,
        quest: questSystem.activeQuest
    };
    localStorage.setItem('poke_save', JSON.stringify(data));
    console.log('Game Saved');
}

function loadGame() {
    const raw = localStorage.getItem('poke_save');
    if (!raw) return false;

    try {
        const data = JSON.parse(raw);

        // Restore Player
        player.x = data.player.x;
        player.y = data.player.y;
        
        // --- NEW: Restore Money (Default to 0 if missing in old save) ---
        player.money = (typeof data.player.money !== 'undefined') ? data.player.money : 0;
        
        player.pLevel = data.player.stats.level;
        player.steps = data.player.stats.steps;
        player.team = data.player.team;
        player.bag = data.player.bag;

        // Restore Storage & Pokedex (with fallback for legacy saves)
        player.storage =
            data.player.storage ||
            Array(100)
                .fill()
                .map(() => Array(25).fill(null));
        player.seen = data.player.seen || [];
        player.seenShiny = data.player.seenShiny || [];

        // Add stats to Pokemon that don't have them (backward compatibility)
        player.team.forEach((p) => {
            if (!p.stats) {
                p.stats = generatePokemonStats();
                // Recalculate maxHp based on stats
                p.maxHp = p.level * 5 + p.stats.hp;
                if (p.hp > p.maxHp) p.hp = p.maxHp;
            }
        });

        const metaLevel = /** @type {HTMLElement} */ (
            document.getElementById('meta-level')
        );
        metaLevel.innerText = player.pLevel.toString();

        // Restore World
        if (data.world.seed) {
            world.rng = new SeededRandom(data.world.seed);
        }
        world.items = data.world.items;

        // Restore NPCs (with fallback for old saves)
        if (data.world.npcs && data.world.npcs.length > 0) {
            world.npcs = data.world.npcs.map(
                (npcData) =>
                    new NPC(
                        npcData.x,
                        npcData.y,
                        npcData.name,
                        npcData.type,
                        npcData.dialog
                    )
            );
        }

        // Restore Buildings (with fallback for old saves)
        if (data.world.buildings) {
            world.buildings = data.world.buildings;
        }

        // Restore Time
        if (typeof data.gameDays !== 'undefined') {
            clock.elapsedTime = data.time;
            clock.gameDays = data.gameDays;
        } else {
            // Legacy Save Support
            clock.gameDays = data.time;
            clock.elapsedTime = clock.gameDays * 3600000; 
        }

        // Restore Quest
        if (data.quest) {
            questSystem.activeQuest = data.quest;
            questSystem.updateUI();
        } else {
            questSystem.generate();
        }

        // Validate Positions
        world.validatePositions();

        // Validate Player Position
        if (
            world.getTile(Math.round(player.x), Math.round(player.y)) ===
            'water'
        ) {
            let safe = world.findSafeNear(player.x, player.y);
            player.x = safe.x;
            player.y = safe.y;
            console.log('Player moved to safe ground:', player.x, player.y);
        }

        // Force UI Update immediately
        updateHUD();

        return true;
    } catch (e) {
        console.error('Save file corrupted', e);
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

    document.getElementById('hud-xp-text').innerText =
        `XP: ${p.exp} / ${maxExp}`;
    document.getElementById('hud-xp-fill').style.width = `${pct}%`;
}

// --- Main Menu System ---
let isPaused = false;
let gameSpeed = 1.0;
let currentBox = 0;

function toggleMainMenu() {
    const menu = document.getElementById('main-menu-modal');
    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        isPaused = true;
    } else {
        menu.classList.add('hidden');
        isPaused = false;
    }
}

function openOptions() {
    document.getElementById('main-menu-modal').classList.add('hidden');
    document.getElementById('options-modal').classList.remove('hidden');
}

function closeOptions() {
    document.getElementById('options-modal').classList.add('hidden');
    document.getElementById('main-menu-modal').classList.remove('hidden');
}

function setGameSpeed(speed) {
    gameSpeed = speed;
    document.getElementById('speed-1').classList.toggle('active', speed === 1);
    document.getElementById('speed-2').classList.toggle('active', speed === 2);
}

function setVolume(val) {
    musicVolume = val / 100; // Convert 0-100 to 0-1

    const mainMusic = /** @type {HTMLAudioElement} */ (
        document.getElementById('main-music')
    );
    const battleMusic = /** @type {HTMLAudioElement} */ (
        document.getElementById('battle-music')
    );

    if (mainMusic) mainMusic.volume = musicVolume;
    if (battleMusic) battleMusic.volume = musicVolume;

    // Set SFX volume
    const sfxElements = [
        'sfx-pickup',
        'sfx-attack1',
        'sfx-attack2',
        'sfx-attack3'
    ];
    sfxElements.forEach((id) => {
        const sfx = /** @type {HTMLAudioElement} */ (
            document.getElementById(id)
        );
        if (sfx) sfx.volume = musicVolume;
    });
}

// Helper function to play sound effects
function playSFX(sfxId) {
    const sfx = /** @type {HTMLAudioElement} */ (
        document.getElementById(sfxId)
    );
    if (sfx) {
        sfx.volume = musicVolume;
        // Clone node to allow overlapping sounds
        // const clone = sfx.cloneNode();
        // clone.play();

        // Simple single channel for now
        sfx.pause(); // Pause if already playing
        sfx.currentTime = 0; // Reset to start
        sfx.play().catch((err) => console.log(`SFX ${sfxId} play failed`));
    }
}

// --- Pokedex System ---
let currentPokedexTab = 'normal';

async function openPokedex() {
    document.getElementById('main-menu-modal').classList.add('hidden');
    document.getElementById('pokedex-modal').classList.remove('hidden');
    currentPokedexTab = 'normal';
    showPokedexTab('normal');
}

function showPokedexTab(tab) {
    currentPokedexTab = tab;

    // Update tab buttons
    document
        .getElementById('pokedex-tab-normal')
        .classList.toggle('active', tab === 'normal');
    document
        .getElementById('pokedex-tab-shiny')
        .classList.toggle('active', tab === 'shiny');

    const grid = document.getElementById('pokedex-grid');
    grid.innerHTML = '';

    let seenList = tab === 'shiny' ? player.seenShiny : player.seen;
    let seenCount = seenList.length;

    // 151 Pokemon
    for (let i = 1; i <= 151; i++) {
        let div = document.createElement('div');
        div.className = 'dex-entry';

        if (seenList.includes(i)) {
            // Choose sprite based on tab
            let spriteUrl =
                tab === 'shiny'
                    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${i}.png`
                    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${i}.png`;

            div.innerHTML = `
                <div class="dex-num">#${i}</div>
                <img src="${spriteUrl}" loading="lazy">
                <div class="dex-name">...</div>
            `;

            div.style.cursor = 'pointer';

            // Fetch name async and make clickable
            fetch(`https://pokeapi.co/api/v2/pokemon/${i}`)
                .then((res) => res.json())
                .then((data) => {
                    const pokemonName = data.name.toUpperCase();
                    const dexName = /** @type {HTMLElement} */ (
                        div.querySelector('.dex-name')
                    );
                    dexName.innerText = pokemonName;

                    // Add click handler to show owned Pokemon of this species
                    div.onclick = () => showOwnedPokemon(pokemonName, i);
                });
        } else {
            div.className += ' unknown';
            let spriteUrl =
                tab === 'shiny'
                    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${i}.png`
                    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${i}.png`;

            div.innerHTML = `
                <div class="dex-num">#${i}</div>
                <img src="${spriteUrl}" style="filter: brightness(0);">
                <div class="dex-name">???</div>
            `;
        }
        grid.appendChild(div);
    }

    let tabLabel = tab === 'shiny' ? 'Shiny Seen' : 'Seen';
    document.getElementById('pokedex-count').innerText =
        `${tabLabel}: ${seenCount}/151`;
}

// Show all owned Pokemon of a specific species
function showOwnedPokemon(pokemonName, pokemonId) {
    const modal = document.getElementById('pokemon-list-modal');
    const title = document.getElementById('pokemon-list-title');
    const content = document.getElementById('pokemon-list-content');

    title.innerText = `${pokemonName} (Owned)`;
    content.innerHTML = '';

    // Collect all Pokemon of this species from team and PC storage
    const ownedPokemon = [];

    // Check team
    player.team.forEach((p, index) => {
        if (p.name === pokemonName) {
            ownedPokemon.push({
                pokemon: p,
                location: `Team Slot ${index + 1}`
            });
        }
    });

    // Check PC storage
    player.storage.forEach((box, boxIndex) => {
        box.forEach((p, slotIndex) => {
            if (p && p.name === pokemonName) {
                ownedPokemon.push({
                    pokemon: p,
                    location: `Box ${boxIndex + 1}, Slot ${slotIndex + 1}`
                });
            }
        });
    });

    if (ownedPokemon.length === 0) {
        content.innerHTML =
            '<p style="text-align:center; color: #999; padding: 20px;">You don\'t own any of these Pokemon yet!</p>';
    } else {
        ownedPokemon.forEach(({ pokemon, location }) => {
            const div = document.createElement('div');
            div.className = 'menu-item';
            div.style.cursor = 'pointer';
            div.style.padding = '15px';
            div.style.marginBottom = '10px';

            const stats = pokemon.stats || {
                strength: 0,
                defense: 0,
                speed: 0,
                hp: 0,
                special: 0
            };
            const scoreRating =
                stats.strength +
                stats.defense +
                stats.speed +
                stats.hp +
                stats.special;
            const isFainted = pokemon.hp <= 0;

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 16px; color: #ffd700;"><strong>${pokemon.name}</strong> Lv.${pokemon.level}</div>
                        <div style="font-size: 12px; color: #aaa;">${location}</div>
                        <div style="font-size: 11px; color: ${isFainted ? '#e74c3c' : '#2ecc71'}; margin-top: 3px;">
                            ${isFainted ? 'FAINTED' : `HP: ${pokemon.hp}/${pokemon.maxHp}`}
                        </div>
                        <div style="font-size: 12px; color: #2ecc71; margin-top: 3px; font-weight: bold;">
                            SR: ${scoreRating}
                        </div>
                    </div>
                    <div style="text-align: right; font-size: 10px; color: #888;">
                        <div>STR:${stats.strength} DEF:${stats.defense}</div>
                        <div>SPD:${stats.speed} SPC:${stats.special}</div>
                    </div>
                </div>
            `;

            div.onclick = () => {
                closePokemonList();
                showPokemonStats(pokemon);
            };

            content.appendChild(div);
        });
    }

    modal.classList.remove('hidden');
}

function closePokedex() {
    document.getElementById('pokedex-modal').classList.add('hidden');
    document.getElementById('main-menu-modal').classList.remove('hidden');
}

// --- PC Storage System ---
function openPC() {
    document.getElementById('main-menu-modal').classList.add('hidden');
    document.getElementById('pc-modal').classList.remove('hidden');
    renderPC();
}

function closePC() {
    document.getElementById('pc-modal').classList.add('hidden');
    document.getElementById('main-menu-modal').classList.remove('hidden');
}

function renderPC() {
    // 1. Render Party
    const partyList = document.getElementById('pc-party-list');
    partyList.innerHTML = '';

    player.team.forEach((p, index) => {
        let div = document.createElement('div');
        div.className = 'pc-slot';
        div.innerHTML = `<img src="${p.backSprite}">`;
        div.onclick = () => {
            selectedSlot = { type: 'party', index: index };
            renderPC();
        };
        if (
            selectedSlot &&
            selectedSlot.type === 'party' &&
            selectedSlot.index === index
        ) {
            div.classList.add('selected');
        }
        partyList.appendChild(div);
    });

    // 2. Render Box
    const boxGrid = document.getElementById('pc-box-grid');
    boxGrid.innerHTML = '';
    document.getElementById('box-label').innerText = `BOX ${currentBox + 1}`;

    player.storage[currentBox].forEach((p, index) => {
        let div = document.createElement('div');
        div.className = 'pc-slot';
        if (p) {
            div.innerHTML = `<img src="${p.backSprite}">`;
        }

        div.onclick = () => {
            if (p) {
                selectedSlot = { type: 'box', index: index };
                renderPC();
            }
        };

        if (
            selectedSlot &&
            selectedSlot.type === 'box' &&
            selectedSlot.index === index
        ) {
            div.classList.add('selected');
        }
        boxGrid.appendChild(div);
    });

    // 3. Render Merge Slots (Visual Update)
    mergeSystem.slots.forEach((slot, i) => {
        const el = document.getElementById(`ms-${i}`);
        if (slot) {
            el.innerHTML = `<img src="${slot.data.backSprite}"> ${slot.data.name}`;
            el.style.color = 'white';
        } else {
            el.innerHTML = `${i + 1}. Empty`;
            el.style.color = '#888';
        }
    });

    // 4. Update Actions Buttons
    const actionsDiv = document.getElementById('pc-actions');
    // Ensure the Merge Button exists in DOM or create it dynamically
    if (!document.getElementById('pc-merge-btn')) {
        const mergeBtn = document.createElement('button');
        mergeBtn.id = 'pc-merge-btn';
        mergeBtn.innerText = 'ADD TO MERGE';
        mergeBtn.className = 'hidden';
        mergeBtn.onclick = addToMerge;
        actionsDiv.appendChild(mergeBtn);
    }

    const addToPartyBtn = document.getElementById('pc-add-to-party');
    const moveToPCBtn = document.getElementById('pc-move-to-pc');
    const mergeActionBtn = document.getElementById('pc-merge-btn');

    if (selectedSlot) {
        actionsDiv.classList.remove('hidden');
        mergeActionBtn.classList.remove('hidden'); // Show Merge Option

        if (selectedSlot.type === 'party') {
            addToPartyBtn.classList.add('hidden');
            moveToPCBtn.classList.remove('hidden');
        } else {
            addToPartyBtn.classList.remove('hidden');
            moveToPCBtn.classList.add('hidden');
        }
    } else {
        actionsDiv.classList.add('hidden');
    }
}

// Helper function for the button
function addToMerge() {
    if (!selectedSlot) return;

    let pokemon;
    if (selectedSlot.type === 'party')
        pokemon = player.team[selectedSlot.index];
    else pokemon = player.storage[currentBox][selectedSlot.index];

    // Attempt add
    if (mergeSystem.addToSlot(pokemon, selectedSlot.index, selectedSlot.type)) {
        selectedSlot = null; // Deselect on success
        renderPC();
    }
}

let selectedSlot = null;

function prevBox() {
    if (currentBox > 0) {
        currentBox--;
        selectedSlot = null;
        renderPC();
    }
}

function nextBox() {
    if (currentBox < 99) {
        currentBox++;
        selectedSlot = null;
        renderPC();
    }
}

function addToParty() {
    if (!selectedSlot || selectedSlot.type !== 'box') return;

    if (player.team.length >= 6) {
        showDialog('Party is full! (Max 6 Pokemon)', 2000);
        return;
    }

    let pokemon = player.storage[currentBox][selectedSlot.index];
    if (pokemon) {
        player.team.push(pokemon);
        player.storage[currentBox][selectedSlot.index] = null;
        selectedSlot = null;
        showDialog(`Moved ${pokemon.name} to Party!`, 2000);
        renderPC();
    }
}

function moveToPC() {
    if (!selectedSlot || selectedSlot.type !== 'party') return;

    if (player.team.length <= 1) {
        showDialog('You must have at least 1 Pokemon in your party!', 2000);
        return;
    }

    let pokemon = player.team[selectedSlot.index];

    // Find first empty slot in current box
    let placed = false;
    for (let i = 0; i < 25; i++) {
        if (player.storage[currentBox][i] === null) {
            player.storage[currentBox][i] = pokemon;
            player.team.splice(selectedSlot.index, 1);
            selectedSlot = null;
            showDialog(`Moved ${pokemon.name} to Box ${currentBox + 1}!`, 2000);
            renderPC();
            placed = true;
            break;
        }
    }

    if (!placed) {
        showDialog(`Box ${currentBox + 1} is full!`, 2000);
    }
}

function cancelPCSelection() {
    selectedSlot = null;
    renderPC();
}
