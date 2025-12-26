class BattleSystem {
    constructor(player) {
        this.player = player;
        this.isActive = false;
        this.isAttacking = false; // Prevent spam
        this.enemy = null;
        this.isTrainer = false;
        this.ui = document.getElementById('battle-ui');
        
        this.turnQueue = []; // Order of attackers based on speed
        this.queueIndex = 0; // Current attacker in the queue
        this.actingPokemon = null; // The specific squad member currently choosing a move

        // Create Flash Overlay if not exists
        if (!document.getElementById('flash-overlay')) {
            let f = document.createElement('div');
            f.id = 'flash-overlay';
            document.body.appendChild(f);
        }

        // Create Squad Container for FF-style layout if not exists
        if (!document.getElementById('player-party-container')) {
            let s = document.createElement('div');
            s.id = 'player-party-container';
            this.ui.appendChild(s);
        }
    }

    // Map moves to attack sounds
    getAttackSound(moveName) {
        const move = moveName.toUpperCase();

        // Heavy/Physical attacks - attack1.mp3
        const heavyMoves = [
            'TACKLE', 'BODY SLAM', 'MEGA PUNCH', 'MEGA KICK', 'EARTHQUAKE',
            'ROCK SLIDE', 'HYPER BEAM', 'GIGA IMPACT', 'THRASH', 'DOUBLE-EDGE'
        ];

        // Energy/Special attacks - attack2.mp3
        const energyMoves = [
            'THUNDERBOLT', 'FLAMETHROWER', 'ICE BEAM', 'PSYCHIC', 'SHADOW BALL',
            'SOLAR BEAM', 'HYDRO PUMP', 'FIRE BLAST', 'BLIZZARD', 'THUNDER'
        ];

        // Quick/Light attacks - attack3.mp3
        const quickMoves = [
            'SCRATCH', 'QUICK ATTACK', 'BITE', 'FURY SWIPES', 'PECK',
            'WING ATTACK', 'POISON STING', 'VINE WHIP', 'RAZOR LEAF', 'SLASH'
        ];

        if (heavyMoves.includes(move)) return 'sfx-attack1';
        if (energyMoves.includes(move)) return 'sfx-attack2';
        if (quickMoves.includes(move)) return 'sfx-attack3';

        return 'sfx-attack1'; // Default
    }

    // Generate random stats for Pokemon (12-100 range)
    generateStats() {
        return {
            strength: Math.floor(Math.random() * 89) + 12,
            defense: Math.floor(Math.random() * 89) + 12,
            speed: Math.floor(Math.random() * 89) + 12,
            hp: Math.floor(Math.random() * 89) + 12,
            special: Math.floor(Math.random() * 89) + 12
        };
    }

    delay(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

    // Comic Book Style Attack Text
    async showAttackText(text) {
        const attackText = document.getElementById('attack-text');
        attackText.innerText = text.toUpperCase();
        attackText.classList.remove('anim-attack-text');
        void attackText.offsetWidth; // Force reflow
        attackText.classList.add('anim-attack-text');
        await this.delay(1500);
        attackText.classList.remove('anim-attack-text');
    }

    // Floating Damage Number
    async showDamageNumber(damage, x, y) {
        const damageText = document.getElementById('damage-text');
        damageText.innerText = `-${damage}`;
        damageText.style.left = `${x}%`;
        damageText.style.top = `${y}%`;
        damageText.classList.remove('anim-damage-float');
        void damageText.offsetWidth; // Force reflow
        damageText.classList.add('anim-damage-float');
        await this.delay(1800);
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
            return;
        }

        void effectText.offsetWidth;
        effectText.classList.add('anim-effectiveness');
        await this.delay(1500);
        effectText.classList.remove('anim-effectiveness');
    }

    async startBattle(isTrainer = false, bossLevelBonus = 0, isArenaBoss = false, bossConfig = null) {
        this.isActive = true;
        this.isAttacking = false;
        this.isTrainer = isTrainer;
        this.ui.classList.remove('hidden');

        // --- RESET UI HUDS ---
        document.getElementById('boss-hud').classList.add('hidden');
        document.getElementById('enemy-stat-box').classList.add('hidden');

        // --- HIDE PARTY SIDEBAR ---
        const sidebar = document.getElementById('party-sidebar');
        if (sidebar) sidebar.classList.add('hidden');

        // --- HIDE WORLD UI ---
        document.getElementById('mobile-controls').classList.add('hidden');
        document.getElementById('action-btns').classList.add('hidden');
        document.getElementById('hamburger-btn').classList.add('battle-hidden');
        document.getElementById('player-stat-box').classList.add('hidden');

        // --- BLACK OUT CANVAS ---
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Music
        const battleMusic = document.getElementById('battle-music');
        if (battleMusic) {
            document.getElementById('main-music').pause();
            battleMusic.currentTime = 0;
            battleMusic.play().catch((err) => console.log('Music blocked'));
        }

        const id = (isArenaBoss && bossConfig) ? bossConfig.id : this.getRandomWildId();
        const level = this.calculateEnemyLevel(bossLevelBonus, bossConfig);
        const isShiny = (isArenaBoss && bossConfig) ? Math.random() < 0.5 : Math.random() < 0.02;

        try {
            let res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
            let data = await res.json();

            const stats = this.generateStats();
            let maxHp = level * 5 + stats.hp;
            if (isArenaBoss) {
                maxHp *= 10;
                stats.strength *= 2;
                stats.defense *= 1.5;
                stats.special *= 1.5;
                stats.speed *= 1.2;
            }

            this.enemy = {
                name: data.name.toUpperCase(),
                sprite: isShiny ? data.sprites.front_shiny : data.sprites.front_default,
                animatedSprite: data.sprites.versions['generation-v']['black-white']['animated'][isShiny ? 'front_shiny' : 'front_default'] || data.sprites.front_default,
                maxHp: maxHp, hp: maxHp, level: level, type: data.types[0].type.name,
                move: getMove(data.types[0].type.name, Math.floor(level / 20)),
                isShiny: isShiny, id: id, stats: stats, isArenaBoss: isArenaBoss, stage: bossConfig ? bossConfig.stage : 0
            };

            this.renderSquad();
            this.setupTurnQueue();

            const enemyImg = document.getElementById('enemy-sprite');
            enemyImg.src = this.enemy.sprite;
            enemyImg.classList.remove('hidden');
            if (isArenaBoss) {
                enemyImg.classList.add('boss-sprite');
                document.getElementById('boss-hud').classList.remove('hidden');
                document.getElementById('boss-name').innerText = `STAGE ${this.enemy.stage}: ${this.enemy.name}`;
            } else {
                enemyImg.classList.remove('boss-sprite');
                document.getElementById('enemy-stat-box').classList.remove('hidden');
            }

            this.updateBattleUI();
            showDialog(`A wild ${this.enemy.name} appeared!`);
            document.getElementById('bottom-hud').classList.add('hud-battle');

            this.nextTurn();
        } catch (e) {
            console.error(e);
            this.endBattle();
        }
    }

    getRandomWildId() {
        const LEGENDARY_IDS = [144, 145, 146, 150, 151];
        let id;
        do {
            id = Math.floor(Math.random() * 151) + 1;
            if (this.player.pLevel < 40 && LEGENDARY_IDS.includes(id)) continue;
            break;
        } while (true);
        return id;
    }

    calculateEnemyLevel(bonus, config) {
        if (config && config.level) return config.level;
        const playerLevel = this.player.pLevel || 1;
        let randomOffset = Math.floor(Math.random() * 5) - 2; // -2, -1, 0, 1, 2
        return Math.max(1, playerLevel + randomOffset + bonus);
    }

    renderSquad() {
        const container = document.getElementById('player-party-container');
        container.innerHTML = '';
        
        this.player.team.forEach((p, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'party-member-wrapper';
            wrapper.id = `party-wrapper-${index}`;
            
            const hpBar = document.createElement('div');
            hpBar.className = 'sprite-hp-bar';
            hpBar.innerHTML = `<div class="sprite-hp-fill" id="squad-hp-${index}" style="width: ${(p.hp/p.maxHp)*100}%"></div>`;
            
            const img = document.createElement('img');
            img.src = p.backSprite || p.sprite;
            img.className = 'party-sprite';
            if (p.hp <= 0) wrapper.classList.add('fainted-member');

            wrapper.appendChild(hpBar);
            wrapper.appendChild(img);
            container.appendChild(wrapper);
        });
    }

    setupTurnQueue() {
        this.turnQueue = [];
        this.player.team.forEach((p, index) => {
            if (p.hp > 0) {
                this.turnQueue.push({ type: 'player', index: index, speed: p.stats ? p.stats.speed : 50 });
            }
        });
        this.turnQueue.push({ type: 'enemy', index: -1, speed: this.enemy.stats.speed });
        this.turnQueue.sort((a, b) => b.speed - a.speed);
        this.queueIndex = 0;
    }

    async nextTurn() {
        if (!this.isActive || this.enemy.hp <= 0) return; 
        
        if (!this.player.team.some(p => p.hp > 0)) {
            this.lose();
            return;
        }

        if (this.queueIndex >= this.turnQueue.length) {
            this.setupTurnQueue();
        }

        const current = this.turnQueue[this.queueIndex];
        
        if (current.type === 'player' && this.player.team[current.index].hp <= 0) {
            this.queueIndex++;
            this.nextTurn();
            return;
        }

        document.querySelectorAll('.party-member-wrapper').forEach(w => w.classList.remove('active-turn'));

        if (current.type === 'player') {
            this.actingPokemon = this.player.team[current.index];
            document.getElementById(`party-wrapper-${current.index}`).classList.add('active-turn');
            showDialog(`What will ${this.actingPokemon.name} do?`);
            this.isAttacking = false;
        } else {
            await this.enemyTurn();
        }
    }

    updateBattleUI() {
        let eStatusHtml = this.enemy.status ? `<span class="status-badge status-${this.enemy.status}">${this.enemy.status}</span>` : '';
        if (this.enemy.isArenaBoss) {
            let pct = (this.enemy.hp / this.enemy.maxHp) * 100;
            document.getElementById('boss-hp-fill').style.width = `${pct}%`;
            document.getElementById('boss-hp-text').innerText = `${Math.ceil(this.enemy.hp)}/${this.enemy.maxHp}`;
            document.getElementById('boss-name').innerHTML = `STAGE ${this.enemy.stage}: ${this.enemy.name} ${eStatusHtml}`;
        } else {
            document.getElementById('enemy-name').innerHTML = `${this.enemy.name} ${eStatusHtml}`;
            document.getElementById('enemy-level').innerText = `Lv.${this.enemy.level}`;
            document.getElementById('enemy-hp-fill').style.width = `${(this.enemy.hp / this.enemy.maxHp) * 100}%`;
        }

        this.player.team.forEach((p, i) => {
            const bar = document.getElementById(`squad-hp-${i}`);
            if (bar) {
                const pct = Math.max(0, (p.hp / p.maxHp) * 100);
                bar.style.width = `${pct}%`;
                if (p.hp <= 0) document.getElementById(`party-wrapper-${i}`).classList.add('fainted-member');
            }
        });
    }

    attackBtn() {
        if (this.isAttacking || !this.actingPokemon) return;
        document.getElementById('move-selector').classList.remove('hidden');
        let p = this.actingPokemon;

        if (!p.moves || p.moves.length === 0) {
            p.moves = [getMove(p.type, Math.floor(p.level / 20))];
        }

        for (let i = 0; i < 4; i++) {
            let btn = document.getElementById(`move-${i}`);
            if (btn) {
                if (p.moves[i]) {
                    btn.innerText = p.moves[i].name;
                    btn.style.color = "black";
                } else {
                    btn.innerText = "-";
                    btn.style.color = "#ccc";
                }
            }
        }
    }

    closeMoves() { document.getElementById('move-selector').classList.add('hidden'); }
    closeMenus() { 
        document.getElementById('bag-menu').classList.add('hidden');
        document.getElementById('pokemon-menu').classList.add('hidden');
        document.getElementById('confirmation-dialog').classList.add('hidden');
    }
    closeCatchScreen() {
        document.getElementById('new-catch-overlay').classList.add('hidden');
        this.win(true);
    }

    async handleStatusDamage(pokemon, isEnemy = false) {
        if (!pokemon.status) return;

        let damage = 0;
        let msg = "";

        if (pokemon.status === 'PSN') {
            damage = Math.max(1, Math.floor(pokemon.maxHp / 8));
            msg = "is hurt by poison!";
        } else if (pokemon.status === 'BRN') {
            damage = Math.max(1, Math.floor(pokemon.maxHp / 16));
            msg = "is hurt by its burn!";
        }

        if (damage > 0) {
            pokemon.hp = Math.max(0, pokemon.hp - damage);
            this.updateBattleUI();

            let x = isEnemy ? 70 : 25;
            let y = isEnemy ? 25 : 60;
            this.showDamageNumber(damage, x, y);

            showDialog(`${pokemon.name} ${msg}`);
            await this.delay(1000);

            if (pokemon.hp <= 0) {
                showDialog(`${pokemon.name} fainted!`);
                await this.delay(1000);
                if (!isEnemy) document.getElementById(`party-wrapper-${this.player.team.indexOf(pokemon)}`).classList.add('fainted-member');
            }
        }
    }

    async useMove(slot) {
        if (this.isAttacking) return;
        this.isAttacking = true;
        this.closeMoves();

        let p = this.actingPokemon;

        // Check status conditions
        if (p.status === 'SLP' || p.status === 'FRZ' || (p.status === 'PAR' && Math.random() < 0.25)) {
            showDialog(`${p.name} is unable to move!`);
            await this.delay(1000);
            this.queueIndex++; 
            this.nextTurn(); 
            return;
        }

        let move = p.moves[slot] || p.moves[0];
        showDialog(`${p.name} used ${move.name}!`);
        await this.delay(500);
        this.showAttackText(move.name);
        playSFX(this.getAttackSound(move.name));

        document.getElementById('gameCanvas').classList.add('anim-shake');
        document.getElementById('flash-overlay').classList.add('anim-flash');
        await this.delay(500);
        document.getElementById('gameCanvas').classList.remove('anim-shake');
        document.getElementById('flash-overlay').classList.remove('anim-flash');

        const attackerStr = p.stats ? p.stats.strength : 50;
        const defenderDef = this.enemy.stats ? this.enemy.stats.defense : 50;
        const effectiveness = getTypeEffectiveness(move.type, this.enemy.type);
        const isCrit = Math.random() * 100 < Math.min(15, ((p.stats ? p.stats.special : 50) / 1000) * 15);

        let baseDmg = Math.floor(move.power * (p.level / this.enemy.level) * (attackerStr / 50));
        let dmg = Math.max(1, Math.floor(baseDmg * effectiveness * (isCrit ? 2 : 1) * (0.85 + Math.random() * 0.3) * (100 / (100 + defenderDef))));

        this.enemy.hp = Math.max(0, this.enemy.hp - dmg);
        this.updateBattleUI();

        // Apply Move Effects
        if (typeof MOVE_EFFECTS !== 'undefined' && MOVE_EFFECTS[move.name.toUpperCase()]) {
            const effect = MOVE_EFFECTS[move.name.toUpperCase()];
            if (!this.enemy.status && Math.random() < effect.chance) {
                this.enemy.status = effect.status;
                showDialog(`${this.enemy.name} was ${effect.status}!`);
                await this.delay(1000);
            }
        }

        if (isCrit) this.showAttackText("CRITICAL HIT!");
        else this.showEffectivenessText(effectiveness);

        this.showDamageNumber(dmg, 70, 25);
        await this.delay(1000);

        if (this.enemy.hp <= 0) {
            showDialog(`${this.enemy.name} fainted!`, 2000);
            await this.delay(2000);
            this.win(false);
        } else {
            await this.handleStatusDamage(p, false);
            this.queueIndex++;
            this.nextTurn();
        }
    }

    async enemyTurn() {
        if (this.enemy.hp <= 0 || !this.isActive) return;
        
        const targets = this.player.team.map((p, i) => ({p, i})).filter(o => o.p.hp > 0);
        if (targets.length === 0) return;
        const targetObj = targets[Math.floor(Math.random() * targets.length)];
        const target = targetObj.p;

        showDialog(`${this.enemy.name} used ${this.enemy.move.name}!`);
        await this.delay(500);
        this.showAttackText(this.enemy.move.name);
        playSFX(this.getAttackSound(this.enemy.move.name));

        document.getElementById('flash-overlay').classList.add('anim-flash');
        await this.delay(300);
        document.getElementById('flash-overlay').classList.remove('anim-flash');

        // Buffed Damage Formula
        let attackerStr = this.enemy.stats.strength;
        let defenderDef = target.stats ? target.stats.defense : 50;
        let baseDmg = Math.floor((this.enemy.level * 3) * (attackerStr / 50));
        let dmg = Math.max(5, Math.floor(baseDmg * (100 / (100 + defenderDef))));

        target.hp = Math.max(0, target.hp - dmg);
        this.updateBattleUI();
        this.showDamageNumber(dmg, 25, 60);
        
        const wrapper = document.getElementById(`party-wrapper-${targetObj.i}`);
        if (wrapper) {
            wrapper.classList.add('anim-shake');
            await this.delay(500);
            wrapper.classList.remove('anim-shake');
        }

        if (target.hp <= 0) showDialog(`${target.name} fainted!`);
        await this.delay(1000);
        
        await this.handleStatusDamage(this.enemy, true);
        
        if (this.enemy.hp <= 0) {
            this.win(false);
        } else {
            this.queueIndex++;
            this.nextTurn();
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
        if (!itemData) return;
        document.getElementById('bag-menu').classList.add('hidden');

        if (itemData.type === 'ball') {
            await this.throwPokeball(itemName);
            return;
        }

        this.isAttacking = true;
        this.player.bag[itemName]--;
        
        let p = this.actingPokemon;
        p.hp = Math.min(p.maxHp, p.hp + itemData.val);
        this.updateBattleUI();
        showDialog(`Used ${itemName} on ${p.name}!`);
        await this.delay(1000);
        this.queueIndex++;
        this.nextTurn();
    }

    async throwPokeball(ballType) {
        if (this.isTrainer) { showDialog("Can't steal!"); return; }
        this.isAttacking = true;
        this.player.bag[ballType]--;

        showDialog(`Go! ${ballType}!`);
        const ballAnim = document.getElementById('pokeball-anim');
        ballAnim.classList.remove('hidden', 'anim-shake');
        ballAnim.classList.add('anim-throw');
        await this.delay(1000);

        if (this.enemy.isArenaBoss && (this.enemy.hp / this.enemy.maxHp) > 0.05) {
            showDialog("The Boss deflected it! Weakness required (< 5% HP)!");
            ballAnim.classList.add('hidden');
            await this.delay(1000);
            this.queueIndex++;
            this.nextTurn();
            return;
        }

        document.getElementById('enemy-sprite').classList.add('anim-shrink');
        await this.delay(500);
        ballAnim.classList.remove('anim-throw');
        ballAnim.classList.add('anim-shake');

        let hpPct = this.enemy.hp / this.enemy.maxHp;
        let catchChance = (ITEMS[ballType].val >= 255) ? 100 : (hpPct < 0.20 ? 90 : 10);
        let roll = Math.random() * 100;
        let success = roll <= catchChance;

        for (let i = 0; i < 3; i++) {
            await this.delay(800);
            if (!success && i >= Math.floor(Math.random() * 3)) {
                ballAnim.classList.add('hidden');
                document.getElementById('enemy-sprite').classList.remove('anim-shrink');
                showDialog("Darn! It broke free!");
                await this.delay(1000);
                this.queueIndex++;
                this.nextTurn();
                return;
            }
        }
        this.catchSuccess();
    }

    async catchSuccess() {
        // 1. Instantly stop all battle logic
        this.isAttacking = true; 
        document.getElementById('pokeball-anim').classList.add('hidden');
        
        showDialog(`Gotcha! ${this.enemy.name} was caught!`, 2000);
        await this.delay(1000);

        // 2. Prepare the data properly. 
        // IMPORTANT: We must add the backSprite here, or the Squad Renderer will crash!
        const caughtPokemon = { 
            ...this.enemy, 
            hp: this.enemy.maxHp, 
            exp: 0,
            backSprite: this.enemy.isShiny 
                ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/shiny/${this.enemy.id}.png` 
                : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${this.enemy.id}.png`
        };

        // 3. Add to player and calculate SR for the display
        this.player.addPokemon(caughtPokemon);
        const st = this.enemy.stats;
        const sr = st.strength + st.defense + st.speed + st.hp + st.special;

        // 4. Update the UI and show the screen
        const statsEl = document.getElementById('catch-stats');
        if (statsEl) {
            statsEl.innerHTML = `
                <img src="${this.enemy.animatedSprite || this.enemy.sprite}" style="width: 96px; image-rendering: pixelated; margin-bottom: 10px;">
                <h3>${this.enemy.name}</h3>
                <div style="color: #2ecc71; font-weight: bold; font-size: 16px;">SR: ${sr}</div>
                <div style="font-size: 10px; color: #888; margin-top: 5px;">Level ${this.enemy.level} | ${this.enemy.type.toUpperCase()}</div>
            `;
        }
        
        document.getElementById('new-catch-overlay').classList.remove('hidden');
    }

    pokemonBtn() {
        showDialog("You are fighting as a squad! No switching needed.");
    }

    runBtn() {
        if (this.isAttacking) return;
        showDialog('Got away safely!', 2000);
        setTimeout(() => this.endBattle(), 1000);
    }

    async win(caught) {
        let xpGain = Math.floor(this.enemy.level * 20 / this.player.team.filter(p => p.hp > 0).length);
        this.player.money += 50 + (this.enemy.level * 25);
        
        for (let p of this.player.team) {
            if (p.hp > 0) {
                p.exp += xpGain;
                if (p.exp >= p.level * 100) await this.levelUp(p);
            }
        }

        if (this.enemy.isArenaBoss) arenaSystem.winStage();
        this.endBattle();
    }

    async levelUp(p) {
        p.exp -= p.level * 100;
        p.level++;
        const inc = { 
            strength: Math.floor(Math.random()*3)+1, 
            defense: Math.floor(Math.random()*3)+1, 
            speed: Math.floor(Math.random()*3)+1, 
            hp: Math.floor(Math.random()*3)+1, 
            special: Math.floor(Math.random()*3)+1 
        };
        p.stats.strength += inc.strength; 
        p.stats.defense += inc.defense; 
        p.stats.speed += inc.speed; 
        p.stats.hp += inc.hp; 
        p.stats.special += inc.special;
        
        p.maxHp = p.level * 5 + p.stats.hp; 
        p.hp = p.maxHp;
        
        await this.showLevelUpScreen(p, inc, 5);
        await this.checkEvolution(p);
    }

    async checkEvolution(p) {
        const evoData = EVOLUTIONS[p.name.split(' ')[0]];
        if (evoData && p.level >= evoData.level) {
            showDialog(`What? ${p.name} is evolving!`);
            const overlay = document.getElementById('level-up-overlay');
            for (let i = 0; i < 3; i++) { 
                overlay.style.backgroundColor = 'white'; 
                await this.delay(200); 
                overlay.style.backgroundColor = 'black'; 
                await this.delay(200); 
            }
            try {
                const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${evoData.id}`);
                const data = await res.json();
                p.name = evoData.evolvesInto; 
                p.id = evoData.id; 
                p.backSprite = data.sprites.back_default; 
                p.type = data.types[0].type.name;
                showDialog(`Congratulations! Evolved into ${p.name}!`, 4000);
                await this.delay(4000);
            } catch (e) { 
                console.error(e); 
            }
        }
    }

    async showLevelUpScreen(p, inc, hpInc) {
        const overlay = document.getElementById('level-up-overlay');
        overlay.classList.remove('hidden');
        document.getElementById('levelup-content').innerHTML = `
            <strong>${p.name} Lv.${p.level}!</strong><br>
            STR: +${inc.strength} DEF: +${inc.defense} SPD: +${inc.speed}
        `;
        return new Promise(resolve => {
            document.getElementById('levelup-continue-btn').onclick = () => { 
                overlay.classList.add('hidden'); 
                resolve(); 
            };
        });
    }

    lose() {
        showDialog('The squad whited out...');
        setTimeout(() => this.endBattle(), 2000);
    }

    endBattle() {
        this.isActive = false;
        this.isAttacking = false;
        this.ui.classList.add('hidden');
        
        if (typeof hideDialog === 'function') hideDialog();
        
        document.getElementById('boss-hud').classList.add('hidden');
        document.getElementById('enemy-stat-box').classList.add('hidden');
        
        const sidebar = document.getElementById('party-sidebar');
        if (sidebar) sidebar.classList.remove('hidden');

        document.getElementById('mobile-controls').classList.remove('hidden');
        document.getElementById('action-btns').classList.remove('hidden');
        document.getElementById('hamburger-btn').classList.remove('battle-hidden');
        document.getElementById('player-stat-box').classList.remove('hidden');
        
        const squadContainer = document.getElementById('player-party-container');
        if (squadContainer) squadContainer.innerHTML = '';

        const mainMusic = document.getElementById('main-music');
        const battleMusic = document.getElementById('battle-music');
        if (battleMusic) battleMusic.pause();
        if (mainMusic) mainMusic.play().catch(e => {});

        const enemySprite = document.getElementById('enemy-sprite');
        enemySprite.classList.remove('anim-shrink', 'boss-sprite');
        enemySprite.classList.add('hidden');
        enemySprite.src = '';

        document.getElementById('bottom-hud').classList.remove('hud-battle');

        if (typeof renderer !== 'undefined') renderer.draw();
        updateHUD();
    }
}