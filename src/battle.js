// --- FALLBACK ITEM DATA (Safety net if data.js is missing) ---
const BATTLE_ITEMS = {
    'Pokeball': { type: 'ball', val: 10 },
    'Great Ball': { type: 'ball', val: 20 },
    'Ultra Ball': { type: 'ball', val: 30 },
    'Master Ball': { type: 'ball', val: 255 },
    'Potion': { type: 'potion', val: 20 },
    'Super Potion': { type: 'potion', val: 50 },
    'Hyper Potion': { type: 'potion', val: 200 },
    'Max Potion': { type: 'potion', val: 9999 },
    'Herb': { type: 'potion', val: 5 }
};

class BattleSystem {
    constructor(player) {
        this.player = player;
        this.isActive = false;
        this.isAttacking = false;
        this.enemy = null;
        this.isTrainer = false;

        // --- NEW: Auto Battle Flag ---
        this.isAuto = false;
        // -----------------------------

        this.bg = new AnimeBattleBackground('battle-ui');
        this.ui = document.getElementById('battle-ui');

        this.turnQueue = [];
        this.queueIndex = 0;
        this.actingPokemon = null;

        if (!document.getElementById('flash-overlay')) {
            let f = document.createElement('div');
            f.id = 'flash-overlay';
            document.body.appendChild(f);
        }

        if (!document.getElementById('player-party-container')) {
            let s = document.createElement('div');
            s.id = 'player-party-container';
            this.ui.appendChild(s);
        }

        if (!document.getElementById('pokeball-anim')) {
            const img = document.createElement('img');
            img.id = 'pokeball-anim';
            img.className = 'hidden';
            img.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';
            img.style.position = 'absolute';
            img.style.left = '50%';
            img.style.bottom = '150px';
            img.style.width = '40px';
            img.style.zIndex = '1000';
            img.style.transform = 'translate(-50%, 0)';
            document.body.appendChild(img);
        }
    }

    triggerAnimation(elementId, animationClass) {
        const el = document.getElementById(elementId);
        if (!el) return;

        // 1. Remove class to reset
        el.classList.remove(animationClass);

        // 2. Force Browser Reflow (Magic line that resets animation state)
        void el.offsetWidth;

        // 3. Add class back to start animation
        el.classList.add(animationClass);
    }

    getAttackSound(moveName) {
        const move = moveName.toUpperCase();
        const heavyMoves = ['TACKLE', 'BODY SLAM', 'MEGA PUNCH', 'MEGA KICK', 'EARTHQUAKE', 'ROCK SLIDE', 'HYPER BEAM', 'GIGA IMPACT', 'THRASH', 'DOUBLE-EDGE'];
        const energyMoves = ['THUNDERBOLT', 'FLAMETHROWER', 'ICE BEAM', 'PSYCHIC', 'SHADOW BALL', 'SOLAR BEAM', 'HYDRO PUMP', 'FIRE BLAST', 'BLIZZARD', 'THUNDER'];
        const quickMoves = ['SCRATCH', 'QUICK ATTACK', 'BITE', 'FURY SWIPES', 'PECK', 'WING ATTACK', 'POISON STING', 'VINE WHIP', 'RAZOR LEAF', 'SLASH'];

        if (heavyMoves.includes(move)) return 'sfx-attack1';
        if (energyMoves.includes(move)) return 'sfx-attack2';
        if (quickMoves.includes(move)) return 'sfx-attack3';
        return 'sfx-attack1';
    }

    generateStats(isComboMatch = false) {
        // Combo Bonus: Max IVs if 20+ chain
        if (isComboMatch && typeof rpgSystem !== 'undefined' && rpgSystem.comboCount >= 20) {
            return { strength: 100, defense: 100, speed: 100, hp: 100, special: 100 };
        }

        return {
            strength: Math.floor(Math.random() * 89) + 12,
            defense: Math.floor(Math.random() * 89) + 12,
            speed: Math.floor(Math.random() * 89) + 12,
            hp: Math.floor(Math.random() * 89) + 12,
            special: Math.floor(Math.random() * 89) + 12
        };
    }

    delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

    async showAttackText(text) {
        const attackText = document.getElementById('attack-text');
        attackText.innerText = text.toUpperCase();
        attackText.classList.remove('anim-attack-text');
        void attackText.offsetWidth;
        attackText.classList.add('anim-attack-text');
        await this.delay(1500);
        attackText.classList.remove('anim-attack-text');
    }

    async showDamageNumber(damage, x, y) {
        const damageText = document.getElementById('damage-text');
        damageText.innerText = `-${damage}`;
        damageText.style.left = `${x}%`;
        damageText.style.top = `${y}%`;
        damageText.classList.remove('anim-damage-float');
        void damageText.offsetWidth;
        damageText.classList.add('anim-damage-float');
        await this.delay(1800);
        damageText.classList.remove('anim-damage-float');
    }

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
        } else { return; }

        void effectText.offsetWidth;
        effectText.classList.add('anim-effectiveness');
        await this.delay(1500);
        effectText.classList.remove('anim-effectiveness');
    }

    // --- NEW: Toggle Auto Mode ---
    toggleAuto() {
        this.isAuto = !this.isAuto;
        const btn = document.getElementById('btn-auto');
        if (btn) {
            btn.style.backgroundColor = this.isAuto ? '#e74c3c' : '#fff'; // Red when active
            btn.style.color = this.isAuto ? '#fff' : '#000';
            btn.innerText = this.isAuto ? 'STOP' : 'AUTO';
        }

        // If it's currently player's turn, trigger the loop immediately
        if (this.isAuto && this.turnQueue[this.queueIndex] && this.turnQueue[this.queueIndex].type === 'player') {
            this.autoBattleLoop();
        }
    }

    // --- NEW: Auto Battle Logic ---
    async autoBattleLoop() {
        if (!this.isActive || !this.isAuto || this.isAttacking) return;

        const current = this.turnQueue[this.queueIndex];
        // Ensure it's actually player turn
        if (!current || current.type !== 'player') return;

        this.actingPokemon = this.player.team[current.index];
        let p = this.actingPokemon;

        // 1. Heal Logic (If HP < 30%)
        if (p.hp / p.maxHp < 0.30) {
            const healItems = ['Potion', 'Super Potion', 'Hyper Potion', 'Herb'];
            let itemToUse = null;

            // Find first available potion
            for (let item of healItems) {
                if (this.player.bag[item] > 0) {
                    itemToUse = item;
                    break;
                }
            }

            if (itemToUse) {
                await this.delay(500);
                await this.useItem(itemToUse);
                return; // End turn after using item
            }
        }

        // 2. Attack Logic (Pick strongest move)
        // ensure moves exist
        if (!p.moves || p.moves.length === 0) {
            p.moves = [getMove(p.type, Math.floor(p.level / 20))];
        }

        // Simple AI: Pick highest power move
        // or just pick random if similar
        let bestMoveIndex = 0;
        let maxPower = 0;

        p.moves.forEach((m, idx) => {
            if (m.power > maxPower) {
                maxPower = m.power;
                bestMoveIndex = idx;
            }
        });

        await this.delay(500); // Small delay for visual pacing
        this.useMove(bestMoveIndex);
    }

    async startBattle(isTrainer = false, bossLevelBonus = 0, isArenaBoss = false, bossConfig = null, biome = 'grass') {
        this.isActive = true;
        this.isAttacking = false;
        this.isTrainer = isTrainer;

        // Reset Auto state on new battle
        this.isAuto = false;
        const btn = document.getElementById('btn-auto');
        if (btn) {
            btn.innerText = 'AUTO';
            btn.style.backgroundColor = '#fff';
            btn.style.color = '#000';
        }

        const canFight = this.player.team.some(p => p.hp > 0);
        if (!canFight) {
            showDialog("You have no conscious Pokemon left to fight!", 3000);
            this.endBattle();
            return;
        }

        this.ui.classList.remove('hidden');

        this.ui.style.backgroundColor = 'transparent';
        if (this.bg) {
            this.bg.resize();
            this.bg.start();
        }

        document.getElementById('boss-hud').classList.add('hidden');
        document.getElementById('enemy-stat-box').classList.add('hidden');

        const sidebar = document.getElementById('party-sidebar');
        if (sidebar) sidebar.classList.add('hidden');

        document.getElementById('mobile-controls').classList.add('hidden');
        document.getElementById('action-btns').classList.add('hidden');
        document.getElementById('hamburger-btn').classList.add('battle-hidden');
        document.getElementById('player-stat-box').classList.add('hidden');

        const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('gameCanvas'));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const battleMusic = /** @type {HTMLAudioElement} */ (document.getElementById('battle-music'));
        if (battleMusic) {
            /** @type {HTMLAudioElement} */
            const mainMusic = /** @type {HTMLAudioElement} */ (document.getElementById('main-music'));
            if (mainMusic) mainMusic.pause();
            battleMusic.currentTime = 0;
            battleMusic.play().catch((err) => console.log('Music blocked'));
        }

        let id;
        if (isArenaBoss && bossConfig) {
            id = bossConfig.id;
        } else {
            // --- UPDATED BIOME LOGIC (Strict Gen 1 Base Forms) ---
            if (biome === 'snow') {
                // Ice/Water Base Forms (No Legendaries, No Evolutions)
                const pool = [
                    7,   // Squirtle
                    54,  // Psyduck
                    60,  // Poliwag
                    72,  // Tentacool
                    79,  // Slowpoke
                    86,  // Seel
                    90,  // Shellder
                    98,  // Krabby
                    116, // Horsea
                    120, // Staryu
                    129  // Magikarp
                ];
                id = pool[Math.floor(Math.random() * pool.length)];
            } else if (biome === 'desert') {
                // Ground/Rock/Fire Base Forms (No Evolutions)
                const pool = [
                    4,   // Charmander
                    27,  // Sandshrew
                    37,  // Vulpix
                    50,  // Diglett
                    58,  // Growlithe
                    74,  // Geodude
                    77,  // Ponyta
                    104, // Cubone
                    111  // Rhyhorn
                ];
                id = pool[Math.floor(Math.random() * pool.length)];
            } else {
                // Grass / Normal Biome
                id = this.getRandomWildId();
            }
        }

        const level = this.calculateEnemyLevel(bossLevelBonus, bossConfig);

        // --- SHINY COMBO CHECK ---
        let shinyThreshold = 1 / 3000; 
        
        let isComboMatch = false;

        if (typeof rpgSystem !== 'undefined') {
            if (rpgSystem.comboSpecies === id) {
                isComboMatch = true;
                
                // COMBO BONUSES
                if (rpgSystem.comboCount >= 10) shinyThreshold *= 2;  // 1 in 1500
                if (rpgSystem.comboCount >= 20) shinyThreshold *= 3;  // 1 in 1000
                if (rpgSystem.comboCount >= 31) shinyThreshold *= 4;  // 1 in 750 (Max normal scaling)
                
                // Super Bonus for dedicated grinders (50+ Combo)
                if (rpgSystem.comboCount >= 50) shinyThreshold = 0.01; // 1 in 100
            }
        }

        const isShiny = (isArenaBoss && bossConfig) ? Math.random() < 0.5 : Math.random() < shinyThreshold;
        
        try {
            let res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
            let data = await res.json();

            const stats = this.generateStats(isComboMatch);
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

            if (!this.player.seen.includes(id)) { this.player.seen.push(id); }
            if (isShiny && !this.player.seenShiny.includes(id)) { this.player.seenShiny.push(id); }

            this.renderSquad();
            this.setupTurnQueue();

            const enemyImg = /** @type {HTMLImageElement} */ (document.getElementById('enemy-sprite'));
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
            this.updateBattleUI();

            // Show Combo Count if Active
            let msg = `A wild ${this.enemy.name} appeared!`;
            if (typeof rpgSystem !== 'undefined' && rpgSystem.comboCount > 0) {
                msg += ` (Chain: ${rpgSystem.comboCount})`;
            }
            showDialog(msg);

            document.getElementById('bottom-hud').classList.add('hud-battle');

            this.nextTurn();
        } catch (e) {
            console.error(e);
            this.endBattle();
        }
    }

    getRandomWildId() {
        // --- GRASS BIOME POOL (Regular) ---
        // EXCLUDES: Fire, Rock, Ground, Water, Ice (They are now exclusive to Desert/Snow)
        const BASE_FORM_IDS = [
            1,   // Bulbasaur
            10,  // Caterpie
            13,  // Weedle
            16,  // Pidgey
            19,  // Rattata
            21,  // Spearow
            23,  // Ekans
            25,  // Pikachu
            29,  // Nidoran F
            32,  // Nidoran M
            35,  // Clefairy
            39,  // Jigglypuff
            41,  // Zubat
            43,  // Oddish
            46,  // Paras
            48,  // Venonat
            52,  // Meowth
            56,  // Mankey
            63,  // Abra
            66,  // Machop
            69,  // Bellsprout
            81,  // Magnemite
            83,  // Farfetch'd
            84,  // Doduo
            88,  // Grimer
            92,  // Gastly
            96,  // Drowzee

            // --- GATED AREA (IDs 100+) ---
            // Unlocks at Level 50+
            100, // Voltorb
            102, // Exeggcute
            106, // Hitmonlee
            107, // Hitmonchan
            108, // Lickitung
            109, // Koffing
            113, // Chansey
            114, // Tangela
            115, // Kangaskhan
            122, // Mr. Mime
            123, // Scyther
            125, // Electabuzz
            127, // Pinsir
            128, // Tauros
            132, // Ditto
            133, // Eevee
            137, // Porygon
            143, // Snorlax
            147  // Dratini
        ];

        // 2. CHECK CONDITIONS
        // Allow 100+ only if Player Level > 50 OR World Day > 50
        let isLateGame = this.player.pLevel >= 50;

        if (typeof world !== 'undefined' && typeof clock !== 'undefined' && clock.gameDays >= 50) {
            isLateGame = true;
        }

        // 3. FILTER POOL
        let allowedPool = BASE_FORM_IDS.filter(id => {
            // If it's early game, BLOCK anything >= 100
            if (!isLateGame && id >= 100) return false;
            return true;
        });

        // 4. PICK RANDOM FROM POOL
        const randomIndex = Math.floor(Math.random() * allowedPool.length);
        return allowedPool[randomIndex];
    }

    calculateEnemyLevel(bonus, config) {
        // 1. Boss/Arena Configuration Override
        if (config && config.level) return config.level;

        // 2. Get Current Day from the Global Clock
        // If it's Day 0 (start), treat it as Day 1
        let currentDay = (typeof clock !== 'undefined') ? Math.max(1, clock.gameDays) : 1;

        // 3. Calculate Base Level (Day * 10)
        // Day 1 = 10, Day 2 = 20, Day 3 = 30...
        let baseLevel = currentDay * 10;

        // 4. Subtract 0 to 3 levels
        // Day 1 (10) becomes 7, 8, 9, or 10
        let variation = Math.floor(Math.random() * 4);

        // 5. Calculate Final Level
        return Math.max(2, baseLevel - variation + bonus);
    }

    renderSquad() {
        const container = document.getElementById('player-party-container');
        container.innerHTML = '';

        // 1. Ensure the container allows absolute positioning of children
        // (You might already have this in CSS, but this guarantees it)
        container.style.position = 'relative';
        container.style.width = '100%';
        container.style.height = '100%';

        this.player.team.forEach((p, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'party-member-wrapper';
            wrapper.id = `party-wrapper-${index}`;

            // --- NEW LAYOUT LOGIC ---
            wrapper.style.position = 'absolute';

            // Calculate Grid Position
            const row = Math.floor(index / 4); // 0 for first 4, 1 for next 2
            const col = index % 4;             // 0, 1, 2, 3

            // Adjust these numbers to fit your sprite sizes:
            const startY = 38;  // Row 0 starts 38% down the screen
            const rowGap = 16;  // Row 1 starts 16% lower (at 54%)
            const startX = 2;   // Start 2% from the left edge
            const colGap = 24;  // Each column is 24% wide

            // Apply coordinates
            // Row 0 Y = 38%, Row 1 Y = 54% 
            // (Leaves room for Dialog at 75%)
            wrapper.style.top = `${startY + (row * rowGap)}%`;
            wrapper.style.left = `${startX + (col * colGap)}%`;
            // ------------------------

            const hpBar = document.createElement('div');
            hpBar.className = 'sprite-hp-bar';
            hpBar.innerHTML = `<div class="sprite-hp-fill" id="squad-hp-${index}" style="width: ${(p.hp / p.maxHp) * 100}%"></div>`;

            const expBar = document.createElement('div');
            expBar.className = 'sprite-exp-bar';
            // Safety check for level to prevent divide by zero
            const level = p.level || 1;
            const expPct = (p.exp / (level * 100)) * 100;
            expBar.innerHTML = `<div class="sprite-exp-fill" id="squad-exp-${index}" style="width: ${expPct}%"></div>`;

            const levelText = document.createElement('div');
            levelText.className = 'sprite-level-text';
            levelText.innerText = `Lv.${p.level}`;

            const img = document.createElement('img');
            img.src = p.backSprite || p.sprite;
            img.className = 'party-sprite';

            // Visual feedback for fainted pokemon
            if (p.hp <= 0) {
                wrapper.classList.add('fainted-member');
                img.style.filter = 'grayscale(100%) opacity(0.5)';
            }

            wrapper.appendChild(hpBar);
            wrapper.appendChild(expBar);
            wrapper.appendChild(levelText);
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

            // --- CHECK AUTO MODE ---
            if (this.isAuto) {
                this.autoBattleLoop();
            }
            // -----------------------

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
            const expBar = document.getElementById(`squad-exp-${i}`);
            if (bar) {
                const pct = Math.max(0, (p.hp / p.maxHp) * 100);
                bar.style.width = `${pct}%`;
                if (p.hp <= 0) document.getElementById(`party-wrapper-${i}`).classList.add('fainted-member');
            }
            if (expBar) {
                const expPct = Math.min(100, (p.exp / (p.level * 100)) * 100);
                expBar.style.width = `${expPct}%`;
            }
        });
    }

    attackBtn() {
        if (this.isAttacking || !this.actingPokemon) return;
        document.getElementById('move-selector').classList.remove('hidden');
        let p = this.actingPokemon;
        if (!p.moves || p.moves.length === 0) { p.moves = [getMove(p.type, Math.floor(p.level / 20))]; }
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
        this.endBattle();
    }

    async handleStatusDamage(pokemon, isEnemy = false) {
        if (!pokemon.status) return;
        let damage = 0;
        let msg = "";
        if (pokemon.status === 'PSN') { damage = Math.max(1, Math.floor(pokemon.maxHp / 8)); msg = "is hurt by poison!"; }
        else if (pokemon.status === 'BRN') { damage = Math.max(1, Math.floor(pokemon.maxHp / 16)); msg = "is hurt by its burn!"; }

        if (damage > 0) {
            pokemon.hp = Math.max(0, pokemon.hp - damage);
            this.updateBattleUI();
            this.showDamageNumber(damage, isEnemy ? 70 : 25, isEnemy ? 25 : 60);
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

        // --- 1. Player Attack Animation (Lunge) ---
        const attackerIndex = this.player.team.indexOf(p);
        const attackerEl = document.getElementById(`party-wrapper-${attackerIndex}`);
        if (attackerEl) {
            attackerEl.classList.remove('anim-lunge', 'active-turn');
            void attackerEl.offsetWidth;
            attackerEl.classList.add('anim-lunge');
        }

        showDialog(`${p.name} used ${move.name}!`);
        await this.delay(500);
        this.showAttackText(move.name);
        playSFX(this.getAttackSound(move.name));

        // Screen Shake / Flash
        document.getElementById('gameCanvas').classList.add('anim-shake');
        document.getElementById('flash-overlay').classList.add('anim-flash');
        await this.delay(500);
        document.getElementById('gameCanvas').classList.remove('anim-shake');
        document.getElementById('flash-overlay').classList.remove('anim-flash');

        // Damage Calc
        const attackerStr = p.stats ? p.stats.strength : 50;
        const defenderDef = this.enemy.stats ? this.enemy.stats.defense : 50;
        const effectiveness = getTypeEffectiveness(move.type, this.enemy.type);
        const isCrit = Math.random() * 100 < Math.min(15, ((p.stats ? p.stats.special : 50) / 1000) * 15);

        let baseDmg = Math.floor(move.power * (p.level / this.enemy.level) * (attackerStr / 50));
        let dmg = Math.max(1, Math.floor(baseDmg * effectiveness * (isCrit ? 2 : 1) * (0.85 + Math.random() * 0.3) * (100 / (100 + defenderDef))));

        this.enemy.hp = Math.max(0, this.enemy.hp - dmg);
        this.updateBattleUI();

        // FIX: Use robust helper for consistent flashing
        this.triggerAnimation('enemy-sprite', 'anim-hit');

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

        // --- STATUS CHECK (Added) ---
        // 79% Chance to skip if Paralyzed. Always skip if Sleep/Freeze.
        if (this.enemy.status === 'SLP' || this.enemy.status === 'FRZ' || (this.enemy.status === 'PAR' && Math.random() < 0.79)) {
            const enemyEl = document.getElementById('enemy-sprite');
            if (enemyEl) {
                enemyEl.classList.remove('anim-shake');
                void enemyEl.offsetWidth;
                enemyEl.classList.add('anim-shake');
            }

            let msg = "is fully paralyzed!";
            if (this.enemy.status === 'SLP') msg = "is fast asleep.";
            if (this.enemy.status === 'FRZ') msg = "is frozen solid!";

            showDialog(`${this.enemy.name} ${msg}`);
            await this.delay(1000);

            this.queueIndex++;
            this.nextTurn();
            return;
        }
        // ----------------------------

        const targets = this.player.team.map((p, i) => ({ p, i })).filter(o => o.p.hp > 0);
        if (targets.length === 0) return;
        const targetObj = targets[Math.floor(Math.random() * targets.length)];
        const target = targetObj.p;

        const enemyEl = document.getElementById('enemy-sprite');
        if (enemyEl) {
            enemyEl.classList.remove('anim-enemy-attack');
            void enemyEl.offsetWidth;
            enemyEl.classList.add('anim-enemy-attack');
        }

        showDialog(`${this.enemy.name} used ${this.enemy.move.name}!`);
        await this.delay(500);
        this.showAttackText(this.enemy.move.name);
        playSFX(this.getAttackSound(this.enemy.move.name));

        document.getElementById('flash-overlay').classList.add('anim-flash');
        await this.delay(300);
        document.getElementById('flash-overlay').classList.remove('anim-flash');

        let attackerStr = this.enemy.stats.strength;
        let defenderDef = target.stats ? target.stats.defense : 50;
        let baseDmg = Math.floor((this.enemy.level * 3) * (attackerStr / 50));
        let dmg = Math.max(5, Math.floor(baseDmg * (100 / (100 + defenderDef))));

        target.hp = Math.max(0, target.hp - dmg);
        this.updateBattleUI();
        this.showDamageNumber(dmg, 25, 60);

        const wrapper = document.getElementById(`party-wrapper-${targetObj.i}`);
        if (wrapper) {
            wrapper.classList.remove('anim-hit', 'active-turn');
            void wrapper.offsetWidth;
            wrapper.classList.add('anim-hit');
            await this.delay(500);
            wrapper.classList.remove('anim-hit');
        }

        if (target.hp <= 0) showDialog(`${target.name} fainted!`);
        await this.delay(1000);
        await this.handleStatusDamage(this.enemy, true);

        if (this.enemy.hp <= 0) { this.win(false); }
        else { this.queueIndex++; this.nextTurn(); }
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
        const db = (typeof ITEMS !== 'undefined') ? ITEMS : BATTLE_ITEMS;
        let itemData = db[itemName];

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
        const enemySprite = document.getElementById('enemy-sprite');
        // REMOVED PREMATURE SHRINK HERE

        await this.delay(500);
        if (this.isTrainer) { showDialog("Can't steal!"); return; }
        this.isAttacking = true;
        this.player.bag[ballType]--;

        showDialog(`Go! ${ballType}!`);
        const ballAnim = document.getElementById('pokeball-anim');

        if (ballAnim) {
            // Ensure ball is visible and on top
            ballAnim.style.zIndex = '99999';
            ballAnim.style.display = 'block';

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

            // --- 3. Enemy Shrink Animation ---
            // This pulls the enemy into the ball
            const eSprite = document.getElementById('enemy-sprite');
            // FIX: Remove ALL potential animation classes to prevent conflicts
            eSprite.classList.remove('anim-shrink', 'anim-enemy-attack', 'anim-hit', 'anim-shake');
            void eSprite.offsetWidth; // Force reflow
            eSprite.classList.add('anim-shrink');
            // --------------------------------

            await this.delay(500);
            ballAnim.classList.remove('anim-throw');
            ballAnim.classList.add('anim-shake');
        } else {
            await this.delay(1000);
        }

        const db = (typeof ITEMS !== 'undefined') ? ITEMS : BATTLE_ITEMS;
        let hpPct = this.enemy.hp / this.enemy.maxHp;
        let catchChance = (db[ballType].val >= 255) ? 100 : (hpPct < 0.20 ? 90 : 10);
        let roll = Math.random() * 100;
        let success = roll <= catchChance;

        for (let i = 0; i < 3; i++) {
            await this.delay(800);
            if (!success && i >= Math.floor(Math.random() * 3)) {
                if (ballAnim) ballAnim.classList.add('hidden');

                // --- 4. Restore Enemy Size if Failed ---
                document.getElementById('enemy-sprite').classList.remove('anim-shrink');
                // --------------------------------------

                showDialog("Darn! It broke free!");
                await this.delay(1000);
                this.queueIndex++;
                this.nextTurn();
                return;
            }
        }
        this.catchSuccess();
    }
    
    // --- NEW COMBO LOGIC ---
    registerCombo(id, name, method) {
        if (typeof rpgSystem === 'undefined') return;

        // 1. LOGIC FOR CATCHING (Updates the Streak)
        if (method === 'catch') {
            // Check against ID (Number) instead of Name (String)
            if (rpgSystem.comboSpecies === id) {
                // Continuation!
                rpgSystem.comboCount++;
                showDialog(`Catch Combo: ${rpgSystem.comboCount} ${name}!`, 2000);
            } else {
                // Broken Streak!
                if (rpgSystem.comboCount > 0) {
                    showDialog(`Combo Broken! (Caught ${name})`, 2000);
                }
                // Start New Streak with ID
                rpgSystem.comboSpecies = id; 
                rpgSystem.comboCount = 1;
            }
        }
        
        // 2. LOGIC FOR DEFEATING (Preserves the Streak)
        else if (method === 'defeat') {
            // We do NOTHING here. The streak remains safe.
            if (rpgSystem.comboCount > 0) {
                // console.log(`Combo Safe`);
            }
        }
    }

    async catchSuccess() {
        this.isAttacking = true;
        const ballAnim = document.getElementById('pokeball-anim');
        if (ballAnim) ballAnim.classList.add('hidden');

        showDialog(`Gotcha! ${this.enemy.name} was caught!`, 2000);

        if (!this.player.seen.includes(this.enemy.id)) { this.player.seen.push(this.enemy.id); }
        if (this.enemy.isShiny && !this.player.seenShiny.includes(this.enemy.id)) { this.player.seenShiny.push(this.enemy.id); }

        await this.delay(1000);

        const caughtPokemon = {
            ...this.enemy,
            hp: this.enemy.maxHp,
            exp: 0,
            backSprite: this.enemy.isShiny
                ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/shiny/${this.enemy.id}.png`
                : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${this.enemy.id}.png`
        };

        this.player.addPokemon(caughtPokemon);
        const st = this.enemy.stats;
        const sr = st.strength + st.defense + st.speed + st.hp + st.special;

        const statsEl = document.getElementById('catch-stats');
        if (statsEl) {
            statsEl.innerHTML = `
                <img src="${this.enemy.animatedSprite || this.enemy.sprite}" style="width: 96px; image-rendering: pixelated; margin-bottom: 10px;">
                <h3>${this.enemy.name}</h3>
                <div style="color: #2ecc71; font-weight: bold; font-size: 16px;">SR: ${sr}</div>
                <div style="font-size: 10px; color: #888; margin-top: 5px;">Level ${this.enemy.level} | ${this.enemy.type.toUpperCase()}</div>
            `;
        }

        // Update Combo
        this.registerCombo(this.enemy.id, this.enemy.name, 'catch');

        document.getElementById('new-catch-overlay').classList.remove('hidden');
    }

    pokemonBtn() { showDialog("You are fighting as a squad! No switching needed."); }
    runBtn() {
        if (this.isAttacking) return;

        showDialog('Got away safely!', 2000);
        setTimeout(() => this.endBattle(), 1000);
    }

    async win(caught) {
        // 1. Calculate XP Gain
        // Divide XP among living squad members
        const livingMembers = this.player.team.filter(p => p.hp > 0);
        let xpGain = Math.floor(this.enemy.level * 20 / (livingMembers.length || 1));

        // Bonus for bosses
        if (this.enemy.isArenaBoss) xpGain *= 5;

        // Combo Bonus
        if (typeof rpgSystem !== 'undefined' && rpgSystem.comboCount >= 10) {
            xpGain = Math.floor(xpGain * 1.5);
        }

        this.player.money += 50 + (this.enemy.level * 25);

        // 2. Show Dialog
        let msg = `Victory! Team gained ${xpGain} XP!`;
        if (typeof rpgSystem !== 'undefined' && rpgSystem.comboCount >= 10) msg += " (Combo Bonus!)";
        showDialog(msg);

        // Update Combo
        this.registerCombo(this.enemy.id, this.enemy.name, 'defeat');

        // 3. ANIME XP SEQUENCE
        // A. Add the "Explosive" class to all visible XP bars in the squad list
        const expBars = document.querySelectorAll('.sprite-exp-fill');
        expBars.forEach(bar => bar.classList.add('anime-xp-active'));

        // B. Apply XP to data (This triggers the width change because we call updateBattleUI right after)
        let leveledUpPokemon = [];

        for (let p of this.player.team) {
            if (p.hp > 0) {
                p.exp += xpGain;
                // We don't resolve level up YET, we just let the bar fill past 100% visually if needed
                if (p.exp >= p.level * 100) {
                    leveledUpPokemon.push(p);
                }
            }
        }

        // C. Update UI - The CSS will now animate the width change over 3 seconds
        this.updateBattleUI();

        // D. FREEZE THE SCREEN (Wait for animation)
        await this.delay(2000);

        // E. Remove the explosive class
        expBars.forEach(bar => bar.classList.remove('anime-xp-active'));

        // 4. Handle Level Ups (now that animation is done)
        for (let p of leveledUpPokemon) {
            // While loop handles multiple level ups at once
            while (p.exp >= p.level * 100) {
                await this.levelUp(p);
            }
        }

        if (this.enemy.isArenaBoss) arenaSystem.winStage();

        if (typeof questSystem !== 'undefined') {
            questSystem.update('hunt');
        }

        // 5. End Battle
        this.endBattle();
    }

    async levelUp(p) {
        p.exp -= p.level * 100; p.level++;

        // Stat Increases
        const inc = {
            strength: Math.floor(Math.random() * 3) + 1,
            defense: Math.floor(Math.random() * 3) + 1,
            speed: Math.floor(Math.random() * 3) + 1,
            hp: Math.floor(Math.random() * 3) + 1,
            special: Math.floor(Math.random() * 3) + 1
        };
        p.stats.strength += inc.strength;
        p.stats.defense += inc.defense;
        p.stats.speed += inc.speed;
        p.stats.hp += inc.hp;
        p.stats.special += inc.special;

        p.maxHp = p.level * 5 + p.stats.hp;
        p.hp = p.maxHp;

        // Show Stats Screen
        await this.showLevelUpScreen(p, inc, 5);

        // --- CHECK MOVES ---
        await this.checkNewMoves(p);
        // -------------------

        await this.checkEvolution(p);
    }

    async checkNewMoves(p) {
        // Learn a move every 5 levels
        if (p.level % 5 !== 0) return;

        // Calculate Move Tier based on level (0-3)
        const moveTier = Math.min(3, Math.floor(p.level / 5) - 1);

        // Get Move Data
        const newMove = getMove(p.type, moveTier);

        if (!p.moves) p.moves = [];

        // Don't learn if we already have it
        if (p.moves.some(m => m.name === newMove.name)) return;

        if (p.moves.length < 4) {
            // Free slot? Learn automatically
            p.moves.push(newMove);
            showDialog(`${p.name} learned ${newMove.name} !`, 2000);
            await this.delay(2000);
        } else {
            // Full slots? Prompt User
            await this.promptMoveReplace(p, newMove);
        }
    }

    promptMoveReplace(p, newMove) {
        return new Promise(resolve => {
            const container = document.getElementById('move-learn-container');
            const list = document.getElementById('move-forget-list');
            const contBtn = document.getElementById('levelup-continue-btn');

            // Update UI Text
            document.getElementById('new-move-name').innerText = newMove.name;
            container.classList.remove('hidden');
            contBtn.classList.add('hidden'); // Hide continue so they MUST choose

            list.innerHTML = '';

            // Generate "Forget X" buttons
            p.moves.forEach((move, index) => {
                const btn = document.createElement('button');
                btn.className = 'forget-btn';
                btn.style.width = '100%';
                btn.style.marginBottom = '5px';
                btn.innerHTML = `Forget < strong > ${move.name}</strong > <span style="font-size:8px">(Pow:${move.power})</span>`;

                // Click Handler
                btn.onclick = () => {
                    showDialog(`Forgot ${move.name} and learned ${newMove.name} !`);
                    p.moves[index] = newMove; // Replace Logic
                    this.finishMoveLearn(resolve);
                };

                // Mobile Touch Support
                btn.ontouchstart = (e) => {
                    e.preventDefault();
                    btn.click();
                };

                list.appendChild(btn);
            });

            // Store resolve for the "Do not learn" button (skipLearnMove)
            this.pendingMoveResolve = resolve;
        });
    }

    // Called by the Red "Do Not Learn" button
    skipLearnMove() {
        showDialog(`Gave up on learning the move.`);
        if (this.pendingMoveResolve) {
            this.finishMoveLearn(this.pendingMoveResolve);
        }
    }

    // Cleanup UI and resume game
    finishMoveLearn(resolve) {
        document.getElementById('move-learn-container').classList.add('hidden');
        document.getElementById('levelup-continue-btn').classList.remove('hidden'); // Show continue button again
        setTimeout(() => resolve(), 1500);
    }

    async checkEvolution(p) {
        // Clean name to handle Shiny stars e.g. "ABRA ✨" -> "ABRA"
        const cleanName = p.name.split(' ')[0];
        const evoData = (typeof EVOLUTIONS !== 'undefined') ? EVOLUTIONS[cleanName] : null;

        if (evoData && p.level >= evoData.level) {
            showDialog(`What ? ${p.name} is evolving!`);

            // Flash Effect
            const overlay = document.getElementById('level-up-overlay');
            for (let i = 0; i < 3; i++) {
                overlay.style.backgroundColor = 'white';
                overlay.classList.remove('hidden'); // Ensure visible
                await this.delay(200);
                overlay.classList.add('hidden');
                await this.delay(200);
            }

            try {
                const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${evoData.id}`);
                const data = await res.json();

                // 1. Update Identity
                p.name = evoData.evolvesInto;
                p.id = evoData.id;
                p.type = data.types[0].type.name;

                // 2. FIX: Update ALL Sprites
                p.backSprite = data.sprites.back_default;
                p.sprite = data.sprites.front_default; // Icons

                // Animated Sprite (Try Gen 5 GIF, fallback to static)
                const anim = data.sprites.versions['generation-v']['black-white']['animated']['front_default'];
                p.animatedSprite = anim || data.sprites.front_default;

                showDialog(`Congratulations! Evolved into ${p.name}!`, 4000);
                await this.delay(4000);

                // Force HUD refresh to update Sidebar Icon immediately
                if (typeof updateHUD === 'function') updateHUD();

            } catch (e) {
                console.error("Evolution Error:", e);
            }
        }
    }

    async showLevelUpScreen(p, inc, hpInc) {
        const overlay = document.getElementById('level-up-overlay');
        overlay.classList.remove('hidden');
        document.getElementById('levelup-content').innerHTML = `<strong>${p.name} Lv.${p.level}!</strong><br>STR: +${inc.strength} DEF: +${inc.defense} SPD: +${inc.speed}`;
        return new Promise(resolve => { document.getElementById('levelup-continue-btn').onclick = () => { overlay.classList.add('hidden'); resolve(); }; });
    }

    lose() { showDialog('The squad whited out...'); setTimeout(() => this.endBattle(), 2000); }

    endBattle() {
        const enemySprite = /** @type {HTMLImageElement} */ (document.getElementById('enemy-sprite'));
        if (enemySprite) {
            enemySprite.classList.remove('anim-shrink', 'boss-sprite', 'anim-hit'); // Clear all potential anims
            enemySprite.classList.add('hidden');
            enemySprite.src = '';
        }
        this.bg.stop()
        this.isActive = false; this.isAttacking = false; this.ui.classList.add('hidden');
        this.turnQueue = []; this.actingPokemon = null;
        if (typeof hideDialog === 'function') hideDialog();
        // @ts-ignore
        if (typeof rivalSystem !== 'undefined') { rivalSystem.onBattleEnd(); }
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
        const mainMusic = /** @type {HTMLAudioElement} */ (document.getElementById('main-music'));
        const battleMusic = /** @type {HTMLAudioElement} */ (document.getElementById('battle-music'));
        if (battleMusic) battleMusic.pause();
        if (mainMusic) mainMusic.play().catch(e => { });
        document.getElementById('bottom-hud').classList.remove('hud-battle');
        if (typeof renderer !== 'undefined') renderer.draw();
        updateHUD();
    }
}
