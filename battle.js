class BattleSystem {
    constructor(player) {
        this.player = player;
        this.isActive = false;
        this.isAttacking = false; // Prevent spam
        this.enemy = null;
        this.turn = 0; // 0: Player, 1: Enemy
        this.ui = document.getElementById('battle-ui');

        // Create Flash Overlay if not exists
        if (!document.getElementById('flash-overlay')) {
            let f = document.createElement('div');
            f.id = 'flash-overlay';
            document.body.appendChild(f);
        }
    }

    delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    // Comic Book Style Attack Text
    async showAttackText(text) {
        const attackText = document.getElementById('attack-text');
        attackText.innerText = text.toUpperCase();
        attackText.classList.remove('anim-attack-text');

        // Force reflow to restart animation
        void attackText.offsetWidth;

        attackText.classList.add('anim-attack-text');
        await this.delay(1500); // Duration matches animation
        attackText.classList.remove('anim-attack-text');
    }

    // Floating Damage Number
    async showDamageNumber(damage, x, y) {
        const damageText = document.getElementById('damage-text');
        damageText.innerText = `-${damage}`;
        damageText.style.left = `${x}%`;
        damageText.style.top = `${y}%`;
        damageText.classList.remove('anim-damage-float');

        // Force reflow to restart animation
        void damageText.offsetWidth;

        damageText.classList.add('anim-damage-float');
        await this.delay(1800); // Duration matches animation
        damageText.classList.remove('anim-damage-float');
    }

    // Show Effectiveness Text
    async showEffectivenessText(multiplier) {
        const effectText = document.getElementById('effectiveness-text');
        effectText.classList.remove('super', 'weak', 'immune', 'anim-effectiveness');

        if (multiplier >= 2.0) {
            effectText.innerText = 'SUPER EFFECTIVE!';
            effectText.classList.add('super');
        } else if (multiplier === 0) {
            effectText.innerText = 'NO EFFECT...';
            effectText.classList.add('immune');
        } else if (multiplier < 1.0) {
            effectText.innerText = 'Not Very Effective...';
            effectText.classList.add('weak');
        } else {
            return; // No message for neutral
        }

        // Force reflow to restart animation
        void effectText.offsetWidth;

        effectText.classList.add('anim-effectiveness');
        await this.delay(1500);
        effectText.classList.remove('anim-effectiveness');
    }

    async startBattle(isTrainer = false, bossLevelBonus = 0) {
        this.isActive = true;
        this.isAttacking = false;
        this.ui.classList.remove('hidden');
        document.getElementById('mobile-controls').classList.add('hidden');
        document.getElementById('hamburger-btn').classList.add('battle-hidden');

        // Filter lists for balanced spawning
        const LEGENDARY_IDS = [144, 145, 146, 150, 151];
        const EVOLVED_IDS = [2, 3, 5, 6, 8, 9, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 31, 34, 36, 38, 40, 42, 44, 45, 47, 49, 51, 53, 55, 57, 59, 61, 62, 64, 65, 67, 68, 71, 73, 75, 76, 78, 80, 82, 83, 85, 87, 89, 91, 93, 94, 97, 99, 101, 103, 105, 106, 107, 108, 110, 112, 113, 114, 115, 117, 119, 121, 122, 123, 127, 130, 131, 132, 134, 135, 136, 137, 139, 141, 142, 143, 148, 149];

        let id;
        let attempts = 0;

        // Smart Pokemon selection
        do {
            id = Math.floor(Math.random() * 151) + 1;
            attempts++;

            // If player level < 40, avoid evolved and legendary
            if (this.player.pLevel < 40) {
                if (LEGENDARY_IDS.includes(id) || EVOLVED_IDS.includes(id)) {
                    continue; // Try again
                }
            }
            break; // Valid Pokemon found
        } while (attempts < 20);

        // Calculate level based on team average
        let avgLevel = 1;
        if (this.player.team.length > 0) {
            let totalLevel = this.player.team.reduce((sum, p) => sum + (p.level || 1), 0);
            avgLevel = Math.floor(totalLevel / this.player.team.length);
        }

        // Wild level = avg ± 2 random variance
        let level = Math.max(1, avgLevel + Math.floor(Math.random() * 5) - 2 + bossLevelBonus);

        // Shiny Check (1/512 chance - more common than 1/8192 for gameplay)
        let isShiny = Math.random() < (1 / 512);

        // Fetch Data (Simplified fetch)
        try {
            let res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
            let data = await res.json();

            let type = data.types[0].type.name;
            // Assign a move for the enemy
            let tier = Math.floor(level / 20);
            let enemyMove = getMove(type, tier);

            // Get sprites - use shiny if applicable
            let normalSprite = data.sprites.front_default;
            let shinySprite = data.sprites.front_shiny;
            let animatedSprite = data.sprites.versions['generation-v']['black-white']['animated']['front_default'] || normalSprite;
            let animatedShiny = data.sprites.versions['generation-v']['black-white']['animated']['front_shiny'] || shinySprite;

            // Choose sprite based on shiny status
            let battleSprite = isShiny ? shinySprite : normalSprite;
            let catchSprite = isShiny ? animatedShiny : animatedSprite;

            this.enemy = {
                name: data.name.toUpperCase(),
                sprite: battleSprite,
                animatedSprite: catchSprite,
                maxHp: level * 5 + 20,
                hp: level * 5 + 20,
                level: level,
                type: type,
                move: enemyMove,
                isShiny: isShiny,
                id: id // Store ID for Pokedex tracking
            };

            // Render Enemy
            this.updateBattleUI();

            // Track Seen (Normal)
            if (!this.player.seen.includes(id)) {
                this.player.seen.push(id);
            }

            // Track Seen (Shiny)
            if (isShiny && !this.player.seenShiny.includes(id)) {
                this.player.seenShiny.push(id);
                showDialog(`✨ A SHINY ${this.enemy.name} appeared! ✨`, 3000);
            }

            // Set Sprites
            const enemyImg = document.getElementById('enemy-sprite');
            enemyImg.src = this.enemy.sprite;
            enemyImg.classList.remove('hidden');

            // Player Pokemon (First in slot or default)
            if (this.player.team.length === 0) {
                // Give starter if empty
                this.player.team.push({
                    name: 'PIKACHU',
                    level: 5,
                    maxHp: 40,
                    hp: 40,
                    exp: 0,
                    type: 'electric',
                    backSprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/25.png'
                });
            }

            let pPoke = this.player.team[0];

            // CHECK IF FIRST POKEMON IS FAINTED
            if (pPoke.hp <= 0) {
                showDialog(`${pPoke.name} is fainted! Heal or swap Pokemon first!`, 3000);
                this.endBattle();
                return;
            }

            const playerImg = document.getElementById('player-sprite');
            playerImg.src = pPoke.backSprite;
            playerImg.classList.remove('hidden');

            // Clear Canvas (Black Background)
            const ctx = document.getElementById('gameCanvas').getContext('2d');
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

            this.updateBattleUI();
            document.getElementById('battle-dialog').innerText = `A wild ${this.enemy.name} appeared!`;
            document.getElementById('bottom-hud').classList.add('hud-battle'); // Move HUD up

        } catch (e) {
            console.error(e);
            this.endBattle();
        }
    }

    updateBattleUI() {
        // Player Stats
        let p = this.player.team[0];
        document.getElementById('player-name').innerText = p.name;
        document.getElementById('player-level').innerText = `Lv.${p.level}`;
        document.getElementById('player-hp-text').innerText = `${p.hp}/${p.maxHp}`;
        document.getElementById('player-hp-fill').style.width = `${(p.hp / p.maxHp) * 100}%`;

        // XP Bar
        let maxExp = p.level * 100;
        let expPct = (p.exp / maxExp) * 100;
        document.getElementById('player-exp-bar').style.width = `${expPct}%`;

        // Enemy Stats
        document.getElementById('enemy-name').innerText = this.enemy.name;
        document.getElementById('enemy-level').innerText = `Lv.${this.enemy.level}`;
        document.getElementById('enemy-hp-fill').style.width = `${(this.enemy.hp / this.enemy.maxHp) * 100}%`;

        // We DO NOT reset the dialog here anymore, to preserve message history
    }

    attackBtn() {
        if (this.isAttacking) return; // Prevent spam
        if (this.enemy.hp <= 0) return; // Prevent attacking fainted enemy

        document.getElementById('move-selector').classList.remove('hidden');
        let p = this.player.team[0];
        // Generate moves based on level tier
        let tier = Math.floor(p.level / 20);
        let move = getMove(p.type, tier);
        document.getElementById('move-0').innerText = move.name;
    }

    closeMoves() {
        document.getElementById('move-selector').classList.add('hidden');
    }

    closeMenus() {
        document.getElementById('bag-menu').classList.add('hidden');
        document.getElementById('pokemon-menu').classList.add('hidden');
        document.getElementById('confirmation-dialog').classList.add('hidden');
    }

    closeCatchScreen() {
        document.getElementById('new-catch-overlay').classList.add('hidden');
        this.win(true);
    }

    async useMove(slot) {
        if (this.isAttacking) return;
        this.isAttacking = true;

        this.closeMoves();
        let p = this.player.team[0];
        let tier = Math.floor(p.level / 20);
        let move = getMove(p.type, tier);

        showDialog(`${p.name} used ${move.name}!`);
        await this.delay(500);

        // COMIC BOOK STYLE ATTACK TEXT!
        this.showAttackText(move.name);

        // Player Attack Animation
        // We don't have a DOM element for player sprite (it's on canvas), 
        // so we'll just flash the screen or shake the enemy UI
        if (move.category === 'status') {
            // SHINY ANIMATION FOR STATUS MOVES
            document.getElementById('flash-overlay').style.backgroundColor = 'rgba(255, 255, 0, 0.5)'; // Yellow glow
            document.getElementById('flash-overlay').classList.add('anim-flash');
            await this.delay(500);
            document.getElementById('flash-overlay').classList.remove('anim-flash');
            document.getElementById('flash-overlay').style.backgroundColor = ''; // Reset

            showDialog(`${p.name}'s stats rose!`);
            await this.delay(1000);
            this.enemyTurn();
            return; // Skip damage
        }

        document.getElementById('gameCanvas').classList.add('anim-shake'); // Shake screen
        document.getElementById('flash-overlay').classList.add('anim-flash');

        await this.delay(500);
        document.getElementById('gameCanvas').classList.remove('anim-shake');
        document.getElementById('flash-overlay').classList.remove('anim-flash');

        // TYPE EFFECTIVENESS DAMAGE CALC!
        let baseDmg = Math.floor(move.power * (p.level / this.enemy.level));
        let effectiveness = getTypeEffectiveness(move.type, this.enemy.type);
        let dmg = Math.floor(baseDmg * effectiveness);

        this.enemy.hp -= dmg;
        if (this.enemy.hp < 0) this.enemy.hp = 0;
        this.updateBattleUI();

        // Show Effectiveness Message
        this.showEffectivenessText(effectiveness);

        // Enemy Shake (Visual feedback on UI box)
        document.getElementById('enemy-stat-box').classList.add('anim-shake');

        // FLOATING DAMAGE NUMBER! (Position near enemy sprite - top right)
        this.showDamageNumber(dmg, 70, 25);

        await this.delay(500);
        document.getElementById('enemy-stat-box').classList.remove('anim-shake');

        // Detailed Damage Log
        showDialog(`Dealt ${dmg} damage!`);
        await this.delay(1000);

        if (this.enemy.hp <= 0) {
            showDialog(`${this.enemy.name} fainted!`);
            await this.delay(1000);
            this.win(false);
        } else {
            this.enemyTurn();
        }
    }

    async enemyTurn() {
        let p = this.player.team[0];
        let moveName = this.enemy.move ? this.enemy.move.name : 'ATTACK';

        showDialog(`${this.enemy.name} used ${moveName}!`);
        await this.delay(500);

        // COMIC BOOK STYLE ATTACK TEXT for enemy!
        this.showAttackText(moveName);

        // Enemy Attack Animation
        document.getElementById('flash-overlay').classList.add('anim-flash');
        await this.delay(300);
        document.getElementById('flash-overlay').classList.remove('anim-flash');

        let dmg = Math.floor(10 * (this.enemy.level / p.level));
        p.hp -= dmg;
        if (p.hp < 0) p.hp = 0;

        this.updateBattleUI();

        // Player Shake
        document.getElementById('player-stat-box').classList.add('anim-shake');

        // FLOATING DAMAGE NUMBER! (Position near player sprite - bottom left)
        this.showDamageNumber(dmg, 25, 60);

        await this.delay(500);
        document.getElementById('player-stat-box').classList.remove('anim-shake');

        if (p.hp <= 0) {
            await this.delay(1000);

            // Check if any other pokemon are alive
            let hasAlive = this.player.team.some(poke => poke.hp > 0);

            if (hasAlive) {
                showDialog(`${p.name} fainted! Choose another Pokemon!`);
                await this.delay(1000);
                this.isAttacking = false; // Allow menu to open
                this.pokemonBtn(); // Open menu
                // Hide back button to force switch
                document.querySelector('#pokemon-menu .back-btn').classList.add('hidden');
            } else {
                this.lose();
            }
        } else {
            // Reset to player turn prompt
            showDialog("What will you do?");
            this.isAttacking = false; // Unlock input
        }
    }

    bagBtn() {
        if (this.isAttacking) return;
        document.getElementById('bag-menu').classList.remove('hidden');
        const list = document.getElementById('bag-list');
        list.innerHTML = '';

        for (let [item, count] of Object.entries(this.player.bag)) {
            if (count > 0) {
                let div = document.createElement('div');
                div.className = 'menu-item';
                div.innerText = `${item} x${count}`;
                div.onclick = () => this.useItem(item);
                list.appendChild(div);
            }
        }
    }

    async useItem(itemName) {
        if (this.isAttacking) return;

        let itemData = ITEMS[itemName];
        if (!itemData) {
            return;
        }

        // Close bag menu
        document.getElementById('bag-menu').classList.add('hidden');

        if (itemData.type === 'ball') {
            await this.throwPokeball(itemName);
            return;
        }

        // For potions, handle directly
        this.isAttacking = true;

        if (this.player.bag[itemName] > 0) {
            this.player.bag[itemName]--;
            if (this.player.bag[itemName] === 0) delete this.player.bag[itemName];
        } else {
            return;
        }

        let p = this.player.team[0];
        let heal = itemData.val;
        let oldHp = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + heal);
        let healedAmt = p.hp - oldHp;

        this.updateBattleUI();
        showDialog(`Used ${itemName}! Healed ${healedAmt} HP!`);

        await this.delay(1000);
        this.enemyTurn();
    }

    async throwPokeball(ballType) {
        if (this.isAttacking) return;
        this.isAttacking = true;

        // Consume Ball
        if (this.player.bag[ballType] > 0) {
            this.player.bag[ballType]--;
            if (this.player.bag[ballType] === 0) delete this.player.bag[ballType];
        } else {
            this.isAttacking = false;
            return;
        }

        showDialog(`Go! ${ballType}!`);

        // Animation
        const ballAnim = document.getElementById('pokeball-anim');
        ballAnim.classList.remove('hidden');
        ballAnim.classList.add('anim-throw');

        await this.delay(1000);

        // Hide enemy sprite (captured visual)
        document.getElementById('enemy-sprite').classList.add('anim-shrink');

        await this.delay(500);
        ballAnim.classList.remove('anim-throw');
        ballAnim.classList.add('anim-shake');

        // Catch Logic
        let ballData = ITEMS[ballType];
        let catchRate = ballData.val; // 1.0, 1.5, 2.0, 255

        // Master Ball Check
        if (catchRate >= 255) {
            await this.delay(500); // Short suspense
            this.catchSuccess();
            return;
        }

        // Standard Catch Formula (Simplified)
        let hpFactor = (3 * this.enemy.maxHp - 2 * this.enemy.hp) / (3 * this.enemy.maxHp);
        let catchChance = (catchRate * hpFactor) / (this.enemy.tier || 1); // Harder for higher tiers

        // 3 Shakes
        for (let i = 0; i < 3; i++) {
            await this.delay(800);
            if (Math.random() > catchChance * 0.8) { // 80% base chance factor
                // Break free
                ballAnim.classList.remove('anim-shake');
                ballAnim.classList.add('hidden');
                document.getElementById('enemy-sprite').classList.remove('anim-shrink');
                showDialog("Darn! It broke free!");
                await this.delay(1000);
                this.enemyTurn();
                return;
            }
        }

        // Caught!
        this.catchSuccess();
    }

    async catchSuccess() {
        showDialog(`Gotcha! ${this.enemy.name} was caught!`);
        await this.delay(1000);

        // Add to team (IMPORTANT: Initialize exp property!)
        let caughtPokemon = {
            ...this.enemy,
            hp: this.enemy.maxHp,
            exp: 0, // Initialize XP
            backSprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${this.enemy.sprite.match(/\/pokemon\/(\d+)\.png/)[1]}.png`
        };
        this.player.addPokemon(caughtPokemon);
        questSystem.update('hunt');

        // Show Stats
        const stats = document.getElementById('catch-stats');
        stats.innerHTML = `
            <img src="${this.enemy.animatedSprite}" style="width: 96px; height: 96px; image-rendering: pixelated; margin-bottom: 10px;">
            <h3>${this.enemy.name}</h3>
            <p>Level: ${this.enemy.level}</p>
            <p>Type: ${this.enemy.type}</p>
            <p>HP: ${this.enemy.maxHp}</p>
        `;
        document.getElementById('new-catch-overlay').classList.remove('hidden');
        // Waits for user to click Continue -> closeCatchScreen -> win(true)
    }

    pokemonBtn() {
        if (this.isAttacking) return;
        document.getElementById('pokemon-menu').classList.remove('hidden');
        // Ensure back button is visible (might have been hidden by forced switch)
        document.querySelector('#pokemon-menu .back-btn').classList.remove('hidden');
        const list = document.getElementById('pokemon-list');
        list.innerHTML = '';

        this.player.team.forEach((p, index) => {
            let div = document.createElement('div');
            div.className = 'menu-item';
            div.innerText = `${p.name} (Lv.${p.level}) - HP: ${p.hp}/${p.maxHp}`;
            if (index === 0) div.style.border = "2px solid gold"; // Active

            div.onclick = () => this.switchPokemon(index);
            list.appendChild(div);
        });
    }

    async switchPokemon(index) {
        if (index === 0) {
            showDialog("Already in battle!");
            return;
        }
        let p = this.player.team[index];
        if (p.hp <= 0) {
            showDialog("It's fainted!");
            return;
        }

        this.closeMenus();
        showDialog(`Go! ${p.name}!`);

        // Swap
        let temp = this.player.team[0];
        this.player.team[0] = this.player.team[index];
        this.player.team[index] = temp;

        // Update Player Sprite (DOM element) - Force reload
        const playerImg = document.getElementById('player-sprite');
        if (playerImg && this.player.team[0].backSprite) {
            // Force browser to reload image by setting to empty first
            playerImg.src = '';
            setTimeout(() => {
                playerImg.src = this.player.team[0].backSprite + '?t=' + Date.now();
            }, 10);
        }

        // Update Battle UI (includes XP bar)
        this.updateBattleUI();

        // Update World HUD as well
        updateHUD();

        await this.delay(1000);
        this.enemyTurn();
    }

    runBtn() {
        if (this.isAttacking) return;
        showDialog("Got away safely!");
        setTimeout(() => this.endBattle(), 1000);
    }

    async win(caught) {
        // XP and Money Gain
        let xpGain = this.enemy.level * 10;
        let p = this.player.team[0];
        let startExp = p.exp;
        let moneyGain = 100;

        this.player.money += moneyGain;
        questSystem.update('hunt');

        // Animate XP bar filling up
        let expPerFrame = Math.ceil(xpGain / 30); // Animate over ~30 frames
        for (let i = 0; i < xpGain; i += expPerFrame) {
            p.exp = Math.min(startExp + i + expPerFrame, startExp + xpGain);

            // Update XP bar
            let maxExp = p.level * 100;
            let expPct = (p.exp / maxExp) * 100;
            document.getElementById('player-exp-bar').style.width = `${expPct}%`;

            // Check for level up during animation
            if (p.exp >= p.level * 100) {
                p.exp -= p.level * 100;
                p.level++;
                p.maxHp += 5;
                p.hp = p.maxHp;

                // VISUAL RESET
                document.getElementById('player-exp-bar').style.width = '0%';
                await this.delay(200); // Pause to show empty bar

                this.updateBattleUI();

                // LEVEL UP UI
                await this.showLevelUpScreen(p);
            }

            await this.delay(50); // Smooth animation
        }

        // Final update
        p.exp = startExp + xpGain;
        while (p.exp >= p.level * 100) {
            p.exp -= p.level * 100;
            p.level++;
            p.maxHp += 5;
            // Only heal on level up, not regular wins!
            p.hp = p.maxHp;

            this.updateBattleUI();
            await this.showLevelUpScreen(p);
        }

        this.updateBattleUI();
        await this.delay(500);

        this.endBattle();
    }

    async showLevelUpScreen(p) {
        const overlay = document.getElementById('level-up-overlay');
        const content = document.getElementById('levelup-content');
        const moveContainer = document.getElementById('move-learn-container');
        const continueBtn = document.getElementById('levelup-continue-btn');

        overlay.classList.remove('hidden');
        moveContainer.classList.add('hidden');
        continueBtn.classList.remove('hidden');

        content.innerHTML = `
            <strong style="color:cyan; font-size: 24px;">${p.name} grew to Lv.${p.level}!</strong><br><br>
            Max HP +5<br>
            Stats increased!
        `;

        // Check for new move (Every 5 levels for demo)
        if (p.level % 5 === 0) {
            let tier = Math.floor(p.level / 20) + 1; // Unlock next tier
            // For demo, just get a move from next tier or same tier
            let newMove = getMove(p.type, Math.min(3, Math.floor(p.level / 15)));

            // Check if we already have it
            // We need to store moves in pokemon object now.
            // If not present, we assume they have 1 move based on level.
            if (!p.moves) p.moves = [getMove(p.type, Math.floor((p.level - 1) / 20))];

            let hasMove = p.moves.find(m => m.name === newMove.name);
            if (!hasMove) {
                if (p.moves.length < 4) {
                    p.moves.push(newMove);
                    content.innerHTML += `<br><br><span style="color:yellow;">Learned ${newMove.name}!</span>`;
                } else {
                    // Move Learning UI
                    continueBtn.classList.add('hidden'); // Hide continue until decision
                    moveContainer.classList.remove('hidden');
                    document.getElementById('new-move-name').innerText = newMove.name;

                    const list = document.getElementById('move-forget-list');
                    list.innerHTML = '';

                    p.moves.forEach((m, i) => {
                        let btn = document.createElement('div');
                        btn.className = 'forget-btn';
                        btn.innerText = `Forget ${m.name}`;
                        btn.onclick = () => {
                            p.moves[i] = newMove;
                            this.closeLevelUp();
                            showDialog(`Forgot ${m.name} and learned ${newMove.name}!`, 2000);
                        };
                        list.appendChild(btn);
                    });

                    // Wait for user interaction
                    return new Promise(resolve => {
                        this.closeLevelUp = () => {
                            overlay.classList.add('hidden');
                            resolve();
                        };
                        this.skipLearnMove = () => {
                            showDialog(`Gave up on learning ${newMove.name}.`, 2000);
                            this.closeLevelUp();
                        };
                    });
                }
            }
        }

        // Wait for Continue
        return new Promise(resolve => {
            this.closeLevelUp = () => {
                overlay.classList.add('hidden');
                resolve();
            };
        });
    }

    lose() {
        showDialog(`${this.player.team[0].name} fainted!`);
        setTimeout(() => {
            showDialog("You whited out...");
            setTimeout(() => {
                this.endBattle();
                // NO AUTO-HEAL! Pokemon stay fainted until healed at Poke Center
            }, 2000);
        }, 2000);
    }

    endBattle() {
        this.isActive = false;
        this.isAttacking = false;
        hideDialog(); // Force hide dialog
        this.ui.classList.add('hidden');
        document.getElementById('mobile-controls').classList.remove('hidden');
        document.getElementById('hamburger-btn').classList.remove('battle-hidden');
        document.getElementById('bottom-hud').classList.remove('hud-battle'); // Reset HUD
        document.getElementById('level-up-overlay').classList.add('hidden'); // Ensure closed

        // Clear any lingering animations
        document.getElementById('gameCanvas').classList.remove('anim-shake');
        document.getElementById('flash-overlay').classList.remove('anim-flash');
        document.getElementById('enemy-sprite').classList.remove('anim-shrink'); // Ensure enemy is visible next time
        document.getElementById('pokeball-anim').classList.add('hidden');

        renderer.draw(); // Redraw world
        updateHUD(); // Update HUD
    }
}