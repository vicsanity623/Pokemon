class BattleSystem {
    constructor(player) {
        this.player = player;
        this.isActive = false;
        this.enemy = null;
        this.turn = 0; // 0: Player, 1: Enemy
        this.ui = document.getElementById('battle-ui');
    }

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

            // Draw Enemy Sprite on Canvas
            // (Note: In a full engine we'd clear canvas and draw battle scene. 
            // Here we overlay UI on top of map, but let's clear map to black)
            const ctx = document.getElementById('gameCanvas').getContext('2d');
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

            let img = new Image();
            img.src = this.enemy.sprite;
            img.onload = () => {
                ctx.drawImage(img, window.innerWidth - 200, 50, 150, 150);
            };

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
            let pImg = new Image();
            pImg.src = pPoke.backSprite;
            pImg.onload = () => {
                ctx.drawImage(pImg, 50, window.innerHeight - 250, 150, 150);
            };

            showDialog(`Wild ${this.enemy.name} appeared!`);

        } catch (e) {
            console.error(e);
            this.endBattle();
        }
    }

    updateBattleUI() {
        if (!this.enemy) return;
        document.getElementById('enemy-name').innerText = this.enemy.name;
        document.getElementById('enemy-level').innerText = formatLevel(this.enemy.level);
        document.getElementById('enemy-hp-bar').style.width = (this.enemy.hp / this.enemy.maxHp * 100) + "%";

        let p = this.player.team[0];
        document.getElementById('player-pokename').innerText = p.name;
        document.getElementById('player-level').innerText = formatLevel(p.level);
        document.getElementById('player-hp-bar').style.width = (p.hp / p.maxHp * 100) + "%";
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

    useMove(slot) {
        this.closeMoves();
        let p = this.player.team[0];
        let tier = Math.floor(p.level / 20);
        let move = getMove(p.type, tier); // Simply using generated move for now

        showDialog(`${p.name} used ${move.name}!`);

        // Damage calc
        let dmg = Math.floor(move.power * (p.level / this.enemy.level));
        this.enemy.hp -= dmg;
        if (this.enemy.hp < 0) this.enemy.hp = 0;
        this.updateBattleUI();

        if (this.enemy.hp <= 0) {
            setTimeout(() => this.win(), 1000);
        } else {
            setTimeout(() => this.enemyTurn(), 1500);
        }
    }

    enemyTurn() {
        let p = this.player.team[0];
        let dmg = Math.floor(10 * (this.enemy.level / p.level)); // Simple calc
        p.hp -= dmg;
        if (p.hp < 0) p.hp = 0;
        showDialog(`${this.enemy.name} attacked!`);
        this.updateBattleUI();

        if (p.hp <= 0) {
            setTimeout(() => this.lose(), 1000);
        }
    }

    bagBtn() {
        // Simple catch mechanic for demo
        if (this.player.bag['Pokeball'] > 0) {
            this.player.bag['Pokeball']--;
            showDialog("Threw a Pokeball!");
            setTimeout(() => {
                if (Math.random() > 0.3) {
                    showDialog(`Gotcha! ${this.enemy.name} was caught!`);
                    this.player.addPokemon({ ...this.enemy, hp: this.enemy.maxHp }); // Heal on catch
                    questSystem.update('hunt');
                    setTimeout(() => this.endBattle(), 2000);
                } else {
                    showDialog("It broke free!");
                    setTimeout(() => this.enemyTurn(), 1000);
                }
            }, 1000);
        } else {
            showDialog("No Pokeballs!");
        }
    }

    runBtn() {
        showDialog("Got away safely!");
        setTimeout(() => this.endBattle(), 1000);
    }

    win() {
        showDialog(`Defeated ${this.enemy.name}!`);
        // Exp Logic
        let p = this.player.team[0];
        p.level++;
        p.maxHp += 5;
        questSystem.update('hunt');
        setTimeout(() => this.endBattle(), 2000);
    }

    lose() {
        showDialog("You whited out...");
        // Heal team
        this.player.team.forEach(p => p.hp = p.maxHp);
        // Teleport random
        this.player.x += 10;
        setTimeout(() => this.endBattle(), 2000);
    }

    endBattle() {
        this.isActive = false;
        this.ui.classList.add('hidden');
        document.getElementById('mobile-controls').classList.remove('hidden');
        renderer.draw(); // Redraw world
    }
}