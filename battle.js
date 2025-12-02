class BattleSystem {
    constructor(player) {
        this.player = player;
        this.isActive = false;
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

    async startBattle(isTrainer = false, bossLevelBonus = 0) {
        this.isActive = true;
        this.ui.classList.remove('hidden');
        document.getElementById('mobile-controls').classList.add('hidden');

        // Determine Enemy
        // Procedurally generate ID between 1 and 151
        let id = Math.floor(Math.random() * 151) + 1;
        let level = Math.max(1, this.player.pLevel + Math.floor(Math.random() * 5) - 2 + bossLevelBonus);

        // Fetch Data (Simplified fetch)
        try {
            let res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
            let data = await res.json();

            this.enemy = {
                name: data.name.toUpperCase(),
                sprite: data.sprites.front_default,
                maxHp: level * 5 + 20,
                hp: level * 5 + 20,
                level: level,
                type: data.types[0].type.name
            };

            // Render Enemy
            this.updateBattleUI();

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

        // Enemy Stats
        document.getElementById('enemy-name').innerText = this.enemy.name;
        document.getElementById('enemy-level').innerText = `Lv.${this.enemy.level}`;
        document.getElementById('enemy-hp-fill').style.width = `${(this.enemy.hp / this.enemy.maxHp) * 100}%`;

        // We DO NOT reset the dialog here anymore, to preserve message history
    }

    attackBtn() {
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
        this.closeMoves();
        let p = this.player.team[0];
        let tier = Math.floor(p.level / 20);
        let move = getMove(p.type, tier);

        showDialog(`${p.name} used ${move.name}!`);
        await this.delay(1000);

        // Player Attack Animation
        // We don't have a DOM element for player sprite (it's on canvas), 
        // so we'll just flash the screen or shake the enemy UI
        document.getElementById('gameCanvas').classList.add('anim-shake'); // Shake screen
        document.getElementById('flash-overlay').classList.add('anim-flash');

        await this.delay(500);
        document.getElementById('gameCanvas').classList.remove('anim-shake');
        document.getElementById('flash-overlay').classList.remove('anim-flash');

        // Damage calc
        let dmg = Math.floor(move.power * (p.level / this.enemy.level));
        this.enemy.hp -= dmg;
        if (this.enemy.hp < 0) this.enemy.hp = 0;
        this.updateBattleUI();

        // Enemy Shake (Visual feedback on UI box)
        document.getElementById('enemy-stat-box').classList.add('anim-shake');
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
        showDialog(`${this.enemy.name} attacked!`);
        await this.delay(1000);

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
        await this.delay(500);
        document.getElementById('player-stat-box').classList.remove('anim-shake');

        if (p.hp <= 0) {
            await this.delay(1000);
            this.lose();
        } else {
            // Reset to player turn prompt
            showDialog("What will you do?");
        }
    }

    bagBtn() {
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

    async useItem(item) {
        this.pendingItem = item;
        document.getElementById('bag-menu').classList.add('hidden'); // Hide bag, show confirm
        document.getElementById('confirmation-dialog').classList.remove('hidden');
        document.getElementById('confirm-text').innerText = `Use ${item}?`;
    }

    async confirmAction(confirmed) {
        document.getElementById('confirmation-dialog').classList.add('hidden');
        if (!confirmed) {
            this.updateBattleUI(); // Return to main menu state effectively
            return;
        }

        let item = this.pendingItem;
        this.pendingItem = null;

        if (item === 'Potion') {
            let p = this.player.team[0];
            if (p.hp === p.maxHp) {
                showDialog("HP is full!");
                return;
            }
            this.player.bag[item]--;
            p.hp = Math.min(p.hp + 20, p.maxHp);
            showDialog(`Used Potion! ${p.name} healed.`);
            this.updateBattleUI();
            await this.delay(1000);
            this.enemyTurn();
        } else if (item === 'Pokeball') {
            this.player.bag[item]--;
            await this.throwPokeball();
        }
    }

    async throwPokeball() {
        showDialog(`Player used Pokeball!`);
        await this.delay(1000);

        // Animation: Throw
        const ball = document.getElementById('pokeball-anim');
        const enemySprite = document.getElementById('enemy-sprite');

        ball.classList.remove('hidden');
        ball.classList.add('anim-throw');

        await this.delay(1000); // Wait for throw to land

        // Animation: Capture (Enemy Shrink)
        enemySprite.classList.add('anim-shrink');
        await this.delay(500); // Wait for shrink

        ball.classList.remove('anim-throw'); // Stop throw anim, keep position

        // Calculate Catch Rate
        // Base: 25%. If HP < 20%, Boost to 90%
        let catchRate = 0.25;
        if (this.enemy.hp / this.enemy.maxHp < 0.2) {
            catchRate = 0.9;
        }

        // Shake Logic (3 Checks)
        let caught = true;
        for (let i = 0; i < 3; i++) {
            await this.delay(500);
            // Shake Animation
            ball.classList.add(i % 2 === 0 ? 'anim-shake-left' : 'anim-shake-right');
            await this.delay(500);
            ball.classList.remove('anim-shake-left', 'anim-shake-right');

            if (Math.random() > catchRate) {
                caught = false;
                break;
            }
        }

        if (caught) {
            // Flash
            const overlay = document.getElementById('flash-overlay');
            overlay.classList.add('anim-flash');
            await this.delay(500);
            overlay.classList.remove('anim-flash');

            ball.classList.add('hidden');
            await this.catchSuccess();
        } else {
            // Break Free
            ball.classList.add('hidden');
            enemySprite.classList.remove('anim-shrink'); // Grow back
            showDialog("Dang! It escaped...");
            await this.delay(1500);
            this.enemyTurn();
        }
    }

    async catchSuccess() {
        showDialog(`Gotcha! ${this.enemy.name} was caught!`);
        await this.delay(1000);

        // Add to team
        this.player.addPokemon({ ...this.enemy, hp: this.enemy.maxHp });
        questSystem.update('hunt');

        // Show Stats
        const stats = document.getElementById('catch-stats');
        stats.innerHTML = `
            <h3>${this.enemy.name}</h3>
            <p>Level: ${this.enemy.level}</p>
            <p>Type: ${this.enemy.type}</p>
            <p>HP: ${this.enemy.maxHp}</p>
        `;
        document.getElementById('new-catch-overlay').classList.remove('hidden');
        // Waits for user to click Continue -> closeCatchScreen -> win(true)
    }

    pokemonBtn() {
        document.getElementById('pokemon-menu').classList.remove('hidden');
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

        // Redraw Player Sprite
        const ctx = document.getElementById('gameCanvas').getContext('2d');
        // Clear player area (simple hack, better to redraw whole scene but this works for now)
        // Actually we need to redraw the sprite.
        let pImg = new Image();
        pImg.src = this.player.team[0].backSprite;
        pImg.onload = () => {
            // Clear rect where player is
            ctx.fillStyle = '#000';
            ctx.fillRect(50, window.innerHeight - 250, 150, 150);
            ctx.drawImage(pImg, 50, window.innerHeight - 250, 150, 150);
        };

        this.updateBattleUI();
        await this.delay(1000);
        this.enemyTurn();
    }

    runBtn() {
        showDialog("Got away safely!");
        setTimeout(() => this.endBattle(), 1000);
    }

    async win(caught) {
        // If caught, we already showed "Gotcha!"
        // If defeated, we already showed "Fainted!" in useMove

        // XP Gain
        let xpGain = this.enemy.level * 10;
        let p = this.player.team[0];
        p.exp += xpGain;

        // Money Gain
        let moneyGain = 100;
        this.player.money += moneyGain;

        // Quest Update (Defeat or Catch counts as 'hunt' progress)
        questSystem.update('hunt');

        showDialog(`${p.name} gained ${xpGain} XP!`);
        await this.delay(1500);

        showDialog(`Player looted $${moneyGain}!`);
        await this.delay(1500);

        // Level Up Check (Simple: 100 XP per level)
        if (p.exp >= p.level * 100) {
            p.exp -= p.level * 100;
            p.level++;
            p.maxHp += 5;
            p.hp = p.maxHp; // Full heal on level up
            showDialog(`${p.name} grew to Lv. ${p.level}!`);
            await this.delay(1500);
        }

        this.endBattle();
    }

    lose() {
        showDialog(`${this.player.team[0].name} fainted!`);
        setTimeout(() => {
            showDialog("You whited out...");
            setTimeout(() => {
                this.endBattle();
                // Respawn logic could go here
                this.player.team.forEach(p => p.hp = p.maxHp); // Heal all for demo
            }, 2000);
        }, 2000);
    }

    endBattle() {
        this.isActive = false;
        hideDialog(); // Force hide dialog
        this.ui.classList.add('hidden');
        document.getElementById('mobile-controls').classList.remove('hidden');
        document.getElementById('bottom-hud').classList.remove('hud-battle'); // Reset HUD

        // Clear any lingering animations
        document.getElementById('gameCanvas').classList.remove('anim-shake');
        document.getElementById('flash-overlay').classList.remove('anim-flash');
        document.getElementById('enemy-sprite').classList.remove('anim-shrink'); // Ensure enemy is visible next time
        document.getElementById('pokeball-anim').classList.add('hidden');

        renderer.draw(); // Redraw world
        updateHUD(); // Update HUD
    }
}