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

    // Map moves to attack sounds
    getAttackSound(moveName) {
        const move = moveName.toUpperCase();

        // Heavy/Physical attacks - attack1.mp3 (punch, kick, slam)
        const heavyMoves = [
            'TACKLE',
            'BODY SLAM',
            'MEGA PUNCH',
            'MEGA KICK',
            'EARTHQUAKE',
            'ROCK SLIDE',
            'HYPER BEAM',
            'GIGA IMPACT',
            'THRASH',
            'DOUBLE-EDGE'
        ];

        // Energy/Special attacks - attack2.mp3 (beam, psychic, energy)
        const energyMoves = [
            'THUNDERBOLT',
            'FLAMETHROWER',
            'ICE BEAM',
            'PSYCHIC',
            'SHADOW BALL',
            'SOLAR BEAM',
            'HYDRO PUMP',
            'FIRE BLAST',
            'BLIZZARD',
            'THUNDER'
        ];

        // Quick/Light attacks - attack3.mp3 (scratch, bite, peck)
        const quickMoves = [
            'SCRATCH',
            'QUICK ATTACK',
            'BITE',
            'FURY SWIPES',
            'PECK',
            'WING ATTACK',
            'POISON STING',
            'VINE WHIP',
            'RAZOR LEAF',
            'SLASH'
        ];

        if (heavyMoves.includes(move)) return 'sfx-attack1';
        if (energyMoves.includes(move)) return 'sfx-attack2';
        if (quickMoves.includes(move)) return 'sfx-attack3';

        // Default fallback based on move name
        return 'sfx-attack1'; // Default to heavy sound
    }

    // Generate random stats for Pokemon (12-100 range)
    generateStats() {
        return {
            strength: Math.floor(Math.random() * 89) + 12, // 12-100
            defense: Math.floor(Math.random() * 89) + 12, // 12-100
            speed: Math.floor(Math.random() * 89) + 12, // 12-100
            hp: Math.floor(Math.random() * 89) + 12, // 12-100
            special: Math.floor(Math.random() * 89) + 12 // 12-100
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
        effectText.classList.remove(
            'super',
            'weak',
            'immune',
            'anim-effectiveness'
        );

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

    async startBattle(isTrainer = false, bossLevelBonus = 0, isArenaBoss = false, bossConfig = null) {
        this.isActive = true;
        this.isAttacking = false;
        this.ui.classList.remove('hidden');

        // --- FIX: HIDE ALL CONTROLS ---
        document.getElementById('mobile-controls').classList.add('hidden');
        document.getElementById('action-btns').classList.add('hidden'); // <--- ADDED THIS
        document.getElementById('hamburger-btn').classList.add('battle-hidden');

        // Switch to battle music
        const mainMusic = /** @type {HTMLAudioElement} */ (
            document.getElementById('main-music')
        );
        const battleMusic = /** @type {HTMLAudioElement} */ (
            document.getElementById('battle-music')
        );
        if (mainMusic && battleMusic) {
            mainMusic.pause();
            battleMusic.currentTime = 0;
            battleMusic
                .play()
                .catch((err) => console.log('Battle music autoplay blocked'));
        }

        // Filter lists for balanced spawning
        const LEGENDARY_IDS = [144, 145, 146, 150, 151];
        const EVOLVED_IDS = [
            2, 3, 5, 6, 8, 9, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 31, 34,
            36, 38, 40, 42, 44, 45, 47, 49, 51, 53, 55, 57, 59, 61, 62, 64, 65,
            67, 68, 71, 73, 75, 76, 78, 80, 82, 83, 85, 87, 89, 91, 93, 94, 97,
            99, 101, 103, 105, 106, 107, 108, 110, 112, 113, 114, 115, 117, 119,
            121, 122, 123, 127, 130, 131, 132, 134, 135, 136, 137, 139, 141,
            142, 143, 148, 149
        ];

        let id;
        let attempts = 0;
        let level;
        let isShiny;

        // Arena Boss or Wild Pokemon?
        if (isArenaBoss && bossConfig) {
            id = bossConfig.id;
            level = bossConfig.level;
            isShiny = Math.random() < 0.5;
        } else {
            // Smart Pokemon selection for wild battles
            do {
                id = Math.floor(Math.random() * 151) + 1;
                attempts++;

                if (this.player.pLevel < 40) {
                    if (LEGENDARY_IDS.includes(id) || EVOLVED_IDS.includes(id)) {
                        continue;
                    }
                }
                break;
            } while (attempts < 20);

            // Calculate level
            let avgLevel = 1;
            if (this.player.team.length > 0) {
                let totalLevel = this.player.team.reduce(
                    (sum, p) => sum + (p.level || 1),
                    0
                );
                avgLevel = Math.floor(totalLevel / this.player.team.length);
            }

            level = Math.max(
                1,
                avgLevel + Math.floor(Math.random() * 5) - 2 + bossLevelBonus
            );

            // Shiny Check (1/50 chance as requested previously)
            isShiny = Math.random() < 1 / 50;
        }

        // Fetch Data
        try {
            let res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
            let data = await res.json();

            let type = data.types[0].type.name;
            let tier = Math.floor(level / 20);
            let enemyMove = getMove(type, tier);

            let normalSprite = data.sprites.front_default;
            let shinySprite = data.sprites.front_shiny;
            let animatedSprite =
                data.sprites.versions['generation-v']['black-white'][
                'animated'
                ]['front_default'] || normalSprite;
            let animatedShiny =
                data.sprites.versions['generation-v']['black-white'][
                'animated'
                ]['front_shiny'] || shinySprite;

            let battleSprite = isShiny ? shinySprite : normalSprite;
            let catchSprite = isShiny ? animatedShiny : animatedSprite;

            const stats = this.generateStats();
            let maxHp = level * 5 + stats.hp;

            // --- BOSS STAT BOOST ---
            if (isArenaBoss) {
                maxHp = maxHp * 10;
                stats.strength = Math.floor(stats.strength * 2);
                stats.defense = Math.floor(stats.defense * 1.5);
                stats.special = Math.floor(stats.special * 1.5);
                stats.speed = Math.floor(stats.speed * 1.2);
            }

            this.enemy = {
                name: data.name.toUpperCase(),
                sprite: battleSprite,
                animatedSprite: catchSprite,
                maxHp: maxHp,
                hp: maxHp,
                level: level,
                type: type,
                move: enemyMove,
                isShiny: isShiny,
                id: id,
                stats: stats,
                isArenaBoss: isArenaBoss,
                stage: bossConfig ? bossConfig.stage : 0
            };

            // Render Enemy
            this.updateBattleUI();

            if (!this.player.seen.includes(id)) {
                this.player.seen.push(id);
            }

            if (isShiny && !this.player.seenShiny.includes(id)) {
                this.player.seenShiny.push(id);
                showDialog(`✨ A SHINY ${this.enemy.name} appeared! ✨`, 3000);
            }

            // --- BOSS UI SETUP ---
            const enemyImg = /** @type {HTMLImageElement} */ (
                document.getElementById('enemy-sprite')
            );
            const bossHud = document.getElementById('boss-hud');
            const enemyStatBox = document.getElementById('enemy-stat-box');
            const battleUi = document.getElementById('battle-ui');

            if (isArenaBoss) {
                if (bossHud) bossHud.classList.remove('hidden');
                if (enemyStatBox) enemyStatBox.classList.add('hidden');
                if (battleUi) battleUi.classList.add('boss-mode');
                enemyImg.classList.add('boss-sprite');

                const bossName = document.getElementById('boss-name');
                if (bossName) {
                    bossName.innerText = `STAGE ${this.enemy.stage}: ${this.enemy.name}`;
                }
            } else {
                if (bossHud) bossHud.classList.add('hidden');
                if (enemyStatBox) enemyStatBox.classList.remove('hidden');
                if (battleUi) battleUi.classList.remove('boss-mode');
                enemyImg.classList.remove('boss-sprite');
            }

            enemyImg.src = this.enemy.sprite;
            enemyImg.classList.remove('hidden');

            if (this.player.team.length === 0) {
                this.player.team.push({
                    name: 'PIKACHU',
                    level: 5,
                    maxHp: 40,
                    hp: 40,
                    exp: 0,
                    type: 'electric',
                    backSprite:
                        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/25.png'
                });
            }

            let pPoke = this.player.team[0];

            if (pPoke.hp <= 0) {
                showDialog(
                    `${pPoke.name} is fainted! Heal or swap Pokemon first!`,
                    3000
                );
                this.endBattle();
                return;
            }

            const playerImg = /** @type {HTMLImageElement} */ (
                document.getElementById('player-sprite')
            );
            playerImg.src = pPoke.backSprite;
            playerImg.classList.remove('hidden');

            const canvas = /** @type {HTMLCanvasElement} */ (
                document.getElementById('gameCanvas')
            );
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

            this.updateBattleUI();
            document.getElementById('battle-dialog').innerText =
                `A wild ${this.enemy.name} appeared!`;
            document.getElementById('bottom-hud').classList.add('hud-battle');
        } catch (e) {
            console.error(e);
            this.endBattle();
        }
    }

    updateBattleUI() {
        // Player Stats
        let p = this.player.team[0];
        // Generate Status HTML
        let pStatusHtml = p.status ? `<span class="status-badge status-${p.status}">${p.status}</span>` : '';

        document.getElementById('player-name').innerHTML = `${p.name} ${pStatusHtml}`;
        document.getElementById('player-level').innerText = `Lv.${p.level}`;
        document.getElementById('player-hp-text').innerText = `${Math.ceil(p.hp)}/${p.maxHp}`;
        document.getElementById('player-hp-fill').style.width = `${(p.hp / p.maxHp) * 100}%`;

        // XP Bar
        let maxExp = p.level * 100;
        let expPct = (p.exp / maxExp) * 100;
        document.getElementById('player-exp-bar').style.width = `${expPct}%`;

        // Enemy Stats
        let eStatusHtml = this.enemy.status ? `<span class="status-badge status-${this.enemy.status}">${this.enemy.status}</span>` : '';

        if (this.enemy.isArenaBoss) {
            let pct = (this.enemy.hp / this.enemy.maxHp) * 100;
            document.getElementById('boss-hp-fill').style.width = `${pct}%`;
            document.getElementById('boss-hp-text').innerText = `${Math.ceil(this.enemy.hp)}/${this.enemy.maxHp}`;
            // Add status to boss name if needed, or overlay it
            document.getElementById('boss-name').innerHTML = `STAGE ${this.enemy.stage}: ${this.enemy.name} ${eStatusHtml}`;
        } else {
            document.getElementById('enemy-name').innerHTML = `${this.enemy.name} ${eStatusHtml}`;
            document.getElementById('enemy-level').innerText = `Lv.${this.enemy.level}`;
            document.getElementById('enemy-hp-fill').style.width = `${(this.enemy.hp / this.enemy.maxHp) * 100}%`;
        }
    }     // We DO NOT reset the dialog here anymore, to preserve message history


    attackBtn() {
        if (this.isAttacking) return; // Prevent spam
        if (this.enemy.hp <= 0) return; // Prevent attacking fainted enemy

        document.getElementById('move-selector').classList.remove('hidden');

        let p = this.player.team[0];

        // 1. Safety Check: If pokemon has no moves list (old save), create one
        if (!p.moves || !Array.isArray(p.moves) || p.moves.length === 0) {
            let tier = Math.floor(p.level / 20);
            p.moves = [getMove(p.type, tier)];
        }

        // 2. Update all 4 Move Buttons
        for (let i = 0; i < 4; i++) {
            // Find the button (move-0, move-1, move-2, move-3)
            let btn = document.getElementById(`move-${i}`);

            if (btn) {
                // Check if the Pokemon has a move in this slot
                if (p.moves[i]) {
                    btn.innerText = p.moves[i].name;
                    btn.style.color = "black"; // Active
                } else {
                    btn.innerText = "-";
                    btn.style.color = "#ccc"; // Greyed out
                }
            }
        }
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
        if (typeof slot !== 'number' || slot < 0) { this.closeMoves(); return; }
        if (this.isAttacking) return;
        this.isAttacking = true;

        this.closeMoves();
        let p = this.player.team[0];

        // --- 1. CHECK PLAYER STATUS (Can they move?) ---
        if (p.status === 'SLP') {
            showDialog(`${p.name} is fast asleep.`);
            await this.delay(1000);
            // 33% chance to wake up
            if (Math.random() < 0.33) {
                p.status = null;
                showDialog(`${p.name} woke up!`);
                await this.delay(1000);
            } else {
                this.handleStatusDamage(p); // Check poison even if sleeping
                this.enemyTurn();
                return;
            }
        }
        if (p.status === 'FRZ') {
            showDialog(`${p.name} is frozen solid!`);
            await this.delay(1000);
            if (Math.random() < 0.2) {
                p.status = null;
                showDialog(`${p.name} thawed out!`);
            } else {
                this.handleStatusDamage(p);
                this.enemyTurn();
                return;
            }
        }
        if (p.status === 'PAR' && Math.random() < 0.25) {
            showDialog(`${p.name} is paralyzed! It can't move!`);
            await this.delay(1000);
            this.handleStatusDamage(p);
            this.enemyTurn();
            return;
        }

        // --- ATTACK LOGIC ---
        if (!p.moves || p.moves.length === 0) {
            let tier = Math.floor(p.level / 20);
            p.moves = [getMove(p.type, tier)];
        }
        let move = p.moves[slot] || p.moves[0];

        showDialog(`${p.name} used ${move.name}!`);
        await this.delay(500);
        this.showAttackText(move.name);

        const attackSound = this.getAttackSound(move.name);
        playSFX(attackSound);

        // Animation
        document.getElementById('gameCanvas').classList.add('anim-shake');
        document.getElementById('flash-overlay').classList.add('anim-flash');
        await this.delay(500);
        document.getElementById('gameCanvas').classList.remove('anim-shake');
        document.getElementById('flash-overlay').classList.remove('anim-flash');

        // Damage Calculation
        const attackerStrength = p.stats ? p.stats.strength : 50;
        const attackerSpecial = p.stats ? p.stats.special : 50;
        const defenderDefense = this.enemy.stats ? this.enemy.stats.defense : 50;

        const critChance = Math.min(15, (attackerSpecial / 1000) * 15);
        const isCrit = Math.random() * 100 < critChance;
        const critMultiplier = isCrit ? 2.0 : 1.0;
        const variance = (Math.random() * 0.3) + 0.85;

        let baseDmg = Math.floor(move.power * (p.level / this.enemy.level) * (attackerStrength / 50));
        let effectiveness = getTypeEffectiveness(move.type, this.enemy.type);
        let rawDmg = baseDmg * effectiveness * critMultiplier * variance;
        let dmg = Math.max(1, Math.floor(rawDmg * (100 / (100 + defenderDefense))));

        this.enemy.hp -= dmg;
        if (this.enemy.hp < 0) this.enemy.hp = 0;
        this.updateBattleUI();

        // --- 2. APPLY STATUS EFFECTS (New Logic) ---
        // Check if move has an effect defined in MOVE_EFFECTS
        if (typeof MOVE_EFFECTS !== 'undefined' && MOVE_EFFECTS[move.name.toUpperCase()]) {
            const effect = MOVE_EFFECTS[move.name.toUpperCase()];
            // If enemy doesn't already have status, and RNG hits
            if (!this.enemy.status && this.enemy.hp > 0 && Math.random() < effect.chance) {
                // Bosses are now fully susceptible (removed 50% resistance)
                if (true) {
                    this.enemy.status = effect.status;
                    await this.delay(500);

                    let statusName = effect.status === 'PSN' ? 'poisoned' :
                        effect.status === 'PAR' ? 'paralyzed' :
                            effect.status === 'BRN' ? 'burned' :
                                effect.status === 'SLP' ? 'asleep' : 'frozen';

                    showDialog(`${this.enemy.name} was ${statusName}!`);
                    playSFX('sfx-attack2'); // Sound cue
                    this.updateBattleUI();
                    await this.delay(1000);
                }
            }
        }

        // Visuals
        if (isCrit) {
            const attackText = document.getElementById('attack-text');
            const oldColor = attackText.style.color;
            attackText.style.color = "#FF0000";
            this.showAttackText("CRITICAL HIT!");
            setTimeout(() => { attackText.style.color = oldColor || "#FFD700"; }, 1500);
        } else {
            this.showEffectivenessText(effectiveness);
        }

        document.getElementById('enemy-stat-box').classList.add('anim-shake');
        this.showDamageNumber(dmg, 70, 25);
        await this.delay(500);
        document.getElementById('enemy-stat-box').classList.remove('anim-shake');

        if (isCrit) showDialog(`Critical Hit! Dealt ${dmg} damage!`);
        else showDialog(`Dealt ${dmg} damage!`);
        await this.delay(1000);

        if (this.enemy.hp <= 0) {
            showDialog(`${this.enemy.name} fainted!`);
            await this.delay(1000);
            this.win(false);
        } else {
            // Check Player Status Damage (Poison/Burn) at end of their turn
            await this.handleStatusDamage(p);
            if (p.hp <= 0) return; // If died from poison

            this.enemyTurn();
        }
    }

    async handleStatusDamage(pokemon) {
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
            pokemon.hp -= damage;
            if (pokemon.hp < 0) pokemon.hp = 0;

            this.updateBattleUI();

            // Visual Flash purple/red
            const overlay = document.getElementById('flash-overlay');
            overlay.style.backgroundColor = pokemon.status === 'PSN' ? 'rgba(128,0,128,0.3)' : 'rgba(255,0,0,0.3)';
            overlay.classList.add('anim-flash');

            showDialog(`${pokemon.name} ${msg}`);
            await this.delay(1000);

            overlay.classList.remove('anim-flash');
            overlay.style.backgroundColor = '';

            if (pokemon.hp <= 0) {
                showDialog(`${pokemon.name} fainted!`);
                await this.delay(1000);
                if (pokemon === this.player.team[0]) {
                    // Handle player fainting
                    // (Logic exists in enemyTurn, but if died here we need to trigger lose or swap)
                    // For simplicity, trigger the standard faint check
                    this.enemyTurn(); // This checks HP at start
                } else {
                    this.win(false);
                }
            }
        }
    }

    async enemyTurn() {
        let p = this.player.team[0];

        // --- 1. CHECK ENEMY STATUS (Can they move?) ---
        if (this.enemy.status === 'SLP') {
            showDialog(`${this.enemy.name} is fast asleep.`);
            await this.delay(1000);
            // 33% chance to wake up
            if (Math.random() < 0.33) {
                this.enemy.status = null;
                showDialog(`${this.enemy.name} woke up!`);
                await this.delay(1000);
            } else {
                await this.handleStatusDamage(this.enemy);
                this.finishEnemyTurn(); // Skip attack
                return;
            }
        }
        if (this.enemy.status === 'FRZ') {
            showDialog(`${this.enemy.name} is frozen solid!`);
            await this.delay(1000);
            if (Math.random() < 0.2) {
                this.enemy.status = null;
                showDialog(`${this.enemy.name} thawed out!`);
            } else {
                await this.handleStatusDamage(this.enemy);
                this.finishEnemyTurn();
                return;
            }
        }
        if (this.enemy.status === 'PAR' && Math.random() < 0.25) {
            showDialog(`${this.enemy.name} is paralyzed! It can't move!`);
            await this.delay(1000);
            await this.handleStatusDamage(this.enemy);
            this.finishEnemyTurn();
            return;
        }

        let moveName = this.enemy.move ? this.enemy.move.name : 'ATTACK';

        showDialog(`${this.enemy.name} used ${moveName}!`);
        await this.delay(500);

        // COMIC BOOK STYLE ATTACK TEXT for enemy!
        this.showAttackText(moveName);

        // Play attack sound based on move type
        const attackSound = this.getAttackSound(moveName);
        const sfx = /** @type {HTMLAudioElement} */ (
            document.getElementById(attackSound)
        );
        if (sfx) {
            sfx.pause();
            sfx.currentTime = 0;
            sfx.play().catch((err) => console.log('Attack SFX failed'));
        }

        // Enemy Attack Animation
        document.getElementById('flash-overlay').classList.add('anim-flash');
        await this.delay(300);
        document.getElementById('flash-overlay').classList.remove('anim-flash');

        // Enemy damage with stats
        const enemyStrength = this.enemy.stats ? this.enemy.stats.strength : 50;
        const playerDefense = p.stats ? p.stats.defense : 50;

        let baseDmg = Math.floor(
            10 * (this.enemy.level / p.level) * (enemyStrength / 50)
        );
        let dmg = Math.max(
            1,
            Math.floor(baseDmg * (100 / (100 + playerDefense)))
        );

        p.hp -= dmg;
        if (p.hp < 0) p.hp = 0;

        this.updateBattleUI();

        // Player Shake
        document.getElementById('player-stat-box').classList.add('anim-shake');

        // FLOATING DAMAGE NUMBER! (Position near player sprite - bottom left)
        this.showDamageNumber(dmg, 25, 60);

        await this.delay(500);
        document
            .getElementById('player-stat-box')
            .classList.remove('anim-shake');

        if (p.hp <= 0) {
            await this.delay(1000);

            // Check if any other pokemon are alive
            let hasAlive = this.player.team.some((poke) => poke.hp > 0);

            if (hasAlive) {
                showDialog(`${p.name} fainted! Choose another Pokemon!`);
                await this.delay(1000);
                this.isAttacking = false; // Allow menu to open
                this.pokemonBtn(); // Open menu
                // Hide back button to force switch
                document
                    .querySelector('#pokemon-menu .back-btn')
                    .classList.add('hidden');
            } else {
                this.lose();
            }
        } else {
            // Apply Status Damage to Enemy at end of their turn
            await this.handleStatusDamage(this.enemy);
            if (this.enemy.hp <= 0) {
                // If enemy died from poison
                // Win logic is handled in handleStatusDamage? 
                // No, handleStatusDamage calls win(false) if enemy dies.
                // But we need to make sure we don't reset turn if they died.
                return;
            }

            this.finishEnemyTurn();
        }
    }

    finishEnemyTurn() {
        // Reset to player turn prompt
        showDialog('What will you do?');
        this.isAttacking = false; // Unlock input
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
            if (this.player.bag[itemName] === 0)
                delete this.player.bag[itemName];
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
            if (this.player.bag[ballType] === 0)
                delete this.player.bag[ballType];
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

        // --- 1. ARENA BOSS HP CHECK (The "5% Rule") ---
        if (this.enemy.isArenaBoss) {
            let hpPercent = this.enemy.hp / this.enemy.maxHp;

            // If HP is greater than 5%, Fail immediately
            if (hpPercent > 0.05) {
                ballAnim.classList.remove('anim-throw');
                ballAnim.classList.add('hidden');

                showDialog("The Boss deflected it! Weakness required (< 5% HP)!");
                await this.delay(1500);

                this.enemyTurn(); // Boss attacks back
                return;
            }
        }

        // --- 2. LEGENDARY RESTRICTIONS (Mewtwo/Mew) ---
        const LEGENDARY_IDS = [144, 145, 146, 150, 151];
        const UNCATCHABLE_IDS = [150, 151]; // Mewtwo/Mew

        if (this.enemy.isArenaBoss && UNCATCHABLE_IDS.includes(this.enemy.id)) {
            ballAnim.classList.remove('anim-throw');
            ballAnim.classList.add('hidden');

            const pokemonName = this.enemy.id === 150 ? 'Mewtwo' : 'Mew';
            showDialog(`${pokemonName} cannot be caught! It's too powerful!`);
            await this.delay(2000);

            this.enemyTurn();
            return;
        }

        // Hide enemy sprite (captured visual)
        document.getElementById('enemy-sprite').classList.add('anim-shrink');

        await this.delay(500);
        ballAnim.classList.remove('anim-throw');
        ballAnim.classList.add('anim-shake');

        // --- NEW CATCH LOGIC ---
        let ballData = ITEMS[ballType];
        let ballRate = ballData.val;

        // Master Ball Check
        if (ballRate >= 255) {
            await this.delay(500);
            this.catchSuccess();
            return;
        }

        // Calculate Chance
        let hpPercent = this.enemy.hp / this.enemy.maxHp;
        let hpFactor = (1 - hpPercent) * 2 + 1;
        let difficulty = Math.max(1, this.enemy.level / 10);
        let catchChance = ((ballRate * 30) * hpFactor) / difficulty;

        // --- 3. LEGENDARY BIRD PENALTY ---
        if (this.enemy.isArenaBoss && LEGENDARY_IDS.includes(this.enemy.id)) {
            catchChance = catchChance / 8; // Harder to catch Articuno/Zapdos/Moltres
        }

        // Random roll (0 to 100)
        let roll = Math.random() * 100;

        // 3 Shakes Animation
        for (let i = 0; i < 3; i++) {
            await this.delay(800);
            if (roll > catchChance + (i * 5)) {
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
        // --- FIX 1: HIDE THE POKEBALL ANIMATION IMMEDIATELY ---
        // This stops it from blocking the stats text
        const ballAnim = document.getElementById('pokeball-anim');
        ballAnim.classList.remove('anim-shake');
        ballAnim.classList.add('hidden');

        showDialog(`Gotcha! ${this.enemy.name} was caught!`);
        await this.delay(1000);

        // Add to team
        let caughtPokemon = {
            ...this.enemy,
            hp: this.enemy.maxHp,
            exp: 0,
            // Safe Back Sprite Generation
            backSprite: this.enemy.isShiny
                ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/shiny/${this.enemy.id}.png`
                : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${this.enemy.id}.png`
        };
        this.player.addPokemon(caughtPokemon);
        questSystem.update('hunt');

        // --- FIX 2: CALCULATE SR (Score Rating) ---
        const st = this.enemy.stats;
        const sr = st.strength + st.defense + st.speed + st.hp + st.special;

        // Show Stats
        const stats = document.getElementById('catch-stats');

        stats.innerHTML = `
            <img src="${this.enemy.animatedSprite}" style="width: 96px; height: 96px; image-rendering: pixelated; margin-bottom: 10px;">
            <h3>${this.enemy.name}</h3>
            <p>Level: ${this.enemy.level} | Type: ${this.enemy.type}</p>
            
            <!-- ADDED SR DISPLAY HERE -->
            <div style="color: #2ecc71; font-weight: bold; font-size: 14px; margin: 5px 0;">SR: ${sr}</div>

            <div style="text-align: left; display: inline-block; font-size: 12px; margin-top: 5px;">
                <div><strong>HP:</strong> ${this.enemy.maxHp}</div>
                <div><strong>Strength:</strong> ${st.strength} | <strong>Defense:</strong> ${st.defense}</div>
                <div><strong>Speed:</strong> ${st.speed} | <strong>Special:</strong> ${st.special}</div>
            </div>
        `;
        document.getElementById('new-catch-overlay').classList.remove('hidden');
    }

    pokemonBtn() {
        if (this.isAttacking) return;
        document.getElementById('pokemon-menu').classList.remove('hidden');
        // Ensure back button is visible (might have been hidden by forced switch)
        document
            .querySelector('#pokemon-menu .back-btn')
            .classList.remove('hidden');
        const list = document.getElementById('pokemon-list');
        list.innerHTML = '';

        this.player.team.forEach((p, index) => {
            let div = document.createElement('div');
            div.className = 'menu-item';
            div.innerText = `${p.name} (Lv.${p.level}) - HP: ${p.hp}/${p.maxHp}`;
            if (index === 0) div.style.border = '2px solid gold'; // Active

            div.onclick = () => this.switchPokemon(index);
            list.appendChild(div);
        });
    }

    async switchPokemon(index) {
        if (index === 0) {
            showDialog('Already in battle!');
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
        const playerImg = /** @type {HTMLImageElement} */ (
            document.getElementById('player-sprite')
        );
        if (playerImg && this.player.team[0].backSprite) {
            // Force browser to reload image by setting to empty first
            playerImg.src = '';
            setTimeout(() => {
                playerImg.src =
                    this.player.team[0].backSprite + '?t=' + Date.now();
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
        showDialog('Got away safely!');
        setTimeout(() => this.endBattle(), 1000);
    }

    async win(caught) {
        // XP and Money Gain
        let xpGain = this.enemy.level * 10;
        let p = this.player.team[0];
        let moneyGain = 50 + (this.enemy.level * 25);

        this.player.money += moneyGain;
        questSystem.update('hunt');

        // --- DEFINE LEVEL UP LOGIC ---
        const performLevelUp = async () => {
            p.exp -= p.level * 100;
            p.level++;

            if (!p.stats) {
                if (this.generateStats) p.stats = this.generateStats();
                else if (typeof generatePokemonStats === 'function') p.stats = generatePokemonStats();
                else p.stats = { strength: 10, defense: 10, speed: 10, hp: 10, special: 10 };
            }

            const statIncreases = {
                strength: Math.floor(Math.random() * 3) + 1,
                defense: Math.floor(Math.random() * 3) + 1,
                speed: Math.floor(Math.random() * 3) + 1,
                hp: Math.floor(Math.random() * 3) + 1,
                special: Math.floor(Math.random() * 3) + 1
            };

            p.stats.strength += statIncreases.strength;
            p.stats.defense += statIncreases.defense;
            p.stats.speed += statIncreases.speed;
            p.stats.hp += statIncreases.hp;
            p.stats.special += statIncreases.special;

            const oldMaxHp = p.maxHp;
            p.maxHp = p.level * 5 + p.stats.hp;
            const hpIncrease = p.maxHp - oldMaxHp;

            p.hp = p.maxHp;

            this.updateBattleUI();
            await this.showLevelUpScreen(p, statIncreases, hpIncrease);
            await this.checkEvolution(p);
        };

        // --- ANIMATION LOOP ---
        let expRemaining = xpGain;
        let step = Math.max(1, Math.ceil(xpGain / 30));

        while (expRemaining > 0) {
            let addAmt = Math.min(step, expRemaining);
            p.exp += addAmt;
            expRemaining -= addAmt;

            let maxExp = p.level * 100;
            let expPct = (p.exp / maxExp) * 100;
            document.getElementById('player-exp-bar').style.width = `${expPct}%`;

            if (p.exp >= maxExp) {
                document.getElementById('player-exp-bar').style.width = '100%';
                await this.delay(200);
                document.getElementById('player-exp-bar').style.width = '0%';
                await performLevelUp();
            }
            await this.delay(50);
        }

        this.updateBattleUI();
        await this.delay(500);

        // --- ARENA BOSS WIN REWARD (FIXED) ---
        // We run this regardless of 'caught' status. 
        // If it's an arena boss, we beat the stage.
        if (this.enemy.isArenaBoss && typeof arenaSystem !== 'undefined') {
            arenaSystem.winStage();
        }

        this.endBattle();
    }

    async checkEvolution(p) {
        const cleanName = p.name.split(' ')[0];
        const evoData = EVOLUTIONS[cleanName];

        if (evoData && p.level >= evoData.level) {

            showDialog(`What? ${p.name} is evolving!`);
            playSFX('sfx-attack2');

            // --- EVOLUTION ANIMATION (Screen Flash) ---
            const overlay = document.getElementById('level-up-overlay');

            // Flash 3 times
            for (let i = 0; i < 3; i++) {
                overlay.style.backgroundColor = 'white';
                await this.delay(200);
                overlay.style.backgroundColor = 'black';
                await this.delay(200);
            }
            // ------------------------------------------

            const oldName = p.name;
            const stars = p.name.includes('✨') ? ' ' + p.name.split(' ').slice(1).join(' ') : '';

            // FIX: Use evolvesInto instead of name
            const newName = evoData.evolvesInto + stars;

            try {
                const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${evoData.id}`);
                const data = await res.json();

                p.name = newName;
                p.id = evoData.id;
                p.backSprite = data.sprites.back_default;
                p.sprite = data.sprites.front_default;
                p.animatedSprite = data.sprites.versions['generation-v']['black-white']['animated']['front_default'];
                p.type = data.types[0].type.name;

                p.maxHp += 20;
                p.hp = p.maxHp;
                if (p.stats) {
                    p.stats.strength += 10;
                    p.stats.defense += 10;
                    p.stats.speed += 5;
                    p.stats.special += 10;
                }

                showDialog(`Congratulations! Your ${oldName} evolved into ${newName}!`, 4000);
                playSFX('sfx-pickup');
                await this.delay(4000);

            } catch (e) {
                console.error("Evolution fetch failed", e);
                showDialog(`Evolution failed.`, 2000);
            }
        }
    }

    async showLevelUpScreen(p, statIncreases, hpIncrease) {
        const overlay = document.getElementById('level-up-overlay');
        const content = document.getElementById('levelup-content');
        const moveContainer = document.getElementById('move-learn-container');
        const continueBtn = /** @type {HTMLButtonElement} */ (
            document.getElementById('levelup-continue-btn')
        );
        overlay.classList.remove('hidden');
        moveContainer.classList.add('hidden');
        continueBtn.classList.remove('hidden');

        // Clone button to clear old events
        const newContinueBtn = /** @type {HTMLButtonElement} */ (
            continueBtn.cloneNode(true)
        );
        continueBtn.parentNode.replaceChild(newContinueBtn, continueBtn);

        content.innerHTML = `
            <strong style="color:cyan; font-size: 24px;">${p.name} grew to Lv.${p.level}!</strong><br><br>
            <div style="text-align: left; display: inline-block; font-size: 14px;">
                <div>Max HP: ${p.maxHp - hpIncrease} → ${p.maxHp} <span style="color:#2ecc71">(+${hpIncrease})</span></div>
                <div>Strength: +${statIncreases.strength}</div>
                <div>Defense: +${statIncreases.defense}</div>
                <div>Speed: +${statIncreases.speed}</div>
                <div>Special: +${statIncreases.special}</div>
            </div>
            <div style="margin-top:20px; font-size: 10px; color: #aaa; animation: blink 1s infinite;">
                (Tap anywhere to continue)
            </div>
        `;

        // Check for new move logic (Same as before)
        if (p.level % 5 === 0) {
            // FIX 1: Make moves get stronger faster (Level 10 = Tier 1, Level 20 = Tier 2)
            let moveTier = Math.floor(p.level / 10);

            // Initialize moves array if missing
            if (!p.moves) p.moves = [getMove(p.type, 0)];

            // FIX 2: Try 10 times to find a move we don't already have
            let newMove = null;
            for (let i = 0; i < 10; i++) {
                // Try to get a move of the current tier, or slightly lower if we know all high ones
                let tierToTry = Math.max(0, moveTier - (i % 2));
                let candidate = getMove(p.type, tierToTry);

                // Check if we already have it
                let alreadyHas = p.moves.find(m => m.name === candidate.name);
                if (!alreadyHas) {
                    newMove = candidate;
                    break; // Found a valid new move!
                }
            }

            // If we found a valid new move, start the learning process
            if (newMove) {
                if (p.moves.length < 4) {
                    p.moves.push(newMove);
                    content.innerHTML += `<br><br><span style="color:yellow;">Learned ${newMove.name}!</span>`;
                } else {
                    // Move Learning UI (Forget old move)
                    newContinueBtn.classList.add('hidden');
                    moveContainer.classList.remove('hidden');
                    document.getElementById('new-move-name').innerText = newMove.name;

                    const list = document.getElementById('move-forget-list');
                    list.innerHTML = '';

                    // Remove the onclick from overlay
                    overlay.onclick = null;

                    return new Promise(resolve => {
                        const close = () => {
                            overlay.classList.add('hidden');
                            overlay.onclick = null;
                            resolve();
                        };

                        p.moves.forEach((m, i) => {
                            let btn = document.createElement('div');
                            btn.className = 'forget-btn';
                            btn.innerText = `Forget ${m.name}`;
                            btn.onclick = (e) => {
                                e.stopPropagation();
                                p.moves[i] = newMove;
                                showDialog(`Forgot ${m.name} and learned ${newMove.name}!`, 2000);
                                close();
                            };
                            list.appendChild(btn);
                        });

                        this.skipLearnMove = () => {
                            showDialog(`Gave up on learning ${newMove.name}.`, 2000);
                            close();
                        };
                    });
                }
            }
        }

        // --- NEW TAP ANYWHERE LOGIC ---
        return new Promise((resolve) => {
            const finish = () => {
                overlay.classList.add('hidden');
                overlay.onclick = null; // Remove listener
                newContinueBtn.onclick = null;
                resolve();
            };

            // 1. Click the Button
            newContinueBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent double firing
                finish();
            };

            // 2. Click the Background (Tap Anywhere)
            overlay.onclick = () => {
                finish();
            };
        });
    }

    lose() {
        showDialog(`${this.player.team[0].name} fainted!`);
        setTimeout(() => {
            showDialog('You whited out...');
            setTimeout(() => {
                this.endBattle();
                // NO AUTO-HEAL! Pokemon stay fainted until healed at Poke Center
            }, 2000);
        }, 2000);
    }

    endBattle() {
        this.isActive = false;
        this.isAttacking = false;
        hideDialog();
        this.ui.classList.add('hidden');

        // --- FIX: RESTORE ALL CONTROLS ---
        document.getElementById('mobile-controls').classList.remove('hidden');
        document.getElementById('action-btns').classList.remove('hidden'); // <--- ADDED THIS
        document.getElementById('hamburger-btn').classList.remove('battle-hidden');

        // Trigger rival exit if in the middle of an encounter
        if (typeof rivalSystem !== 'undefined') {
            rivalSystem.onBattleEnd();
        }

        // Restore Music
        const mainMusic = /** @type {HTMLAudioElement} */ (
            document.getElementById('main-music')
        );
        const battleMusic = /** @type {HTMLAudioElement} */ (
            document.getElementById('battle-music')
        );
        if (mainMusic && battleMusic) {
            battleMusic.pause();
            mainMusic
                .play()
                .catch((err) => console.log('Main music autoplay blocked'));
        }

        document.getElementById('bottom-hud').classList.remove('hud-battle');
        document.getElementById('level-up-overlay').classList.add('hidden');

        // Clean up boss UI
        const bossHud = document.getElementById('boss-hud');
        const enemyStatBox = document.getElementById('enemy-stat-box');
        const battleUi = document.getElementById('battle-ui');
        if (bossHud) bossHud.classList.add('hidden');
        if (enemyStatBox) enemyStatBox.classList.remove('hidden');
        if (battleUi) battleUi.classList.remove('boss-mode');

        // Clear any lingering animations
        document.getElementById('gameCanvas').classList.remove('anim-shake');
        document.getElementById('flash-overlay').classList.remove('anim-flash');

        // Clear Enemy Sprite
        const enemySprite = /** @type {HTMLImageElement} */ (
            document.getElementById('enemy-sprite')
        );
        enemySprite.classList.remove('anim-shrink');
        enemySprite.classList.remove('boss-sprite');
        enemySprite.classList.add('hidden');
        enemySprite.src = '';

        document.getElementById('pokeball-anim').classList.add('hidden');

        renderer.draw();
        updateHUD();
    }
}
