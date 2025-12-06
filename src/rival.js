/**
 * Rival Trainer System
 * - Day 1 intro: Rival walks across screen ignoring player
 * - Battle encounters every 2 days with approach
 * - Player frozen during rival scenes
 * - Exit animation after battles
 * - Sarcastic arena-focused dialog
 */

class RivalSystem {
    constructor(player) {
        this.player = player;
        this.lastEncounterDay = -2; // Allow encounters starting Day 2
        this.encounterInterval = 2; // Days between encounters
        this.rivalName = 'GARY';

        // State machine
        this.state = 'idle'; // idle, intro, approaching, exiting
        this.rivalPosition = null; // {x, y}
        this.approachSpeed = 0.08; // Reduced from 0.1
        this.walkSpeed = 0.06; // Slower walk speed for intro/exit (was 0.15)
        this.exitDirection = 1; // 1 = right, -1 = left

        // Intro sequence
        this.hasHadIntro = false;
        this.introTime = 120; // 2 minutes in seconds (2 min * 60 sec)

        // Player freeze control
        this.playerFrozen = false;

        // Arena taunts
        this.arenaStage = 1; // Track rival's claimed arena stage

        // Load Pikachu sprite for rival
        this.sprite = new Image();
        this.sprite.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png';
    }

    /**
     * Check if it's time for intro sequence
     */
    shouldPlayIntro(elapsedSeconds) {
        return (
            !this.hasHadIntro &&
            elapsedSeconds >= this.introTime &&
            !battleSystem.isActive
        );
    }

    /**
     * Check if it's time for a rival battle encounter
     */
    shouldEncounter(currentDay) {
        return (
            this.hasHadIntro && // Only after intro
            currentDay - this.lastEncounterDay >= this.encounterInterval &&
            !battleSystem.isActive &&
            this.player.team.length > 0 &&
            currentDay > 0 &&
            this.state === 'idle'
        );
    }

    /**
     * Start Day 1 intro sequence - rival walks across screen
     */
    startIntro() {
        this.state = 'intro';
        this.hasHadIntro = true;

        // Spawn off-screen to the left
        this.rivalPosition = {
            x: this.player.x - 15,
            y: this.player.y
        };

        this.exitDirection = 1; // Walk right
        this.freezePlayer();

        // Sarcastic intro dialog
        showDialog(`${this.rivalName}: "Heh, you're just starting? Pathetic."`, 3000);

        setTimeout(() => {
            showDialog(`${this.rivalName}: "I've already cleared Arena Stage ${this.arenaStage + 5}!"`, 3000);
        }, 3500);

        setTimeout(() => {
            showDialog(`${this.rivalName}: "Try to keep up... if you can!"`, 3000);
        }, 7000);
    }

    /**
     * Start rival approach for battle
     */
    startApproach() {
        this.state = 'approaching';

        // Spawn 15-20 tiles away from player
        const angle = Math.random() * Math.PI * 2;
        const distance = 15 + Math.random() * 5;

        this.rivalPosition = {
            x: this.player.x + Math.cos(angle) * distance,
            y: this.player.y + Math.sin(angle) * distance
        };

        this.freezePlayer();

        // Sarcastic approach dialog with arena reference
        const taunts = [
            `"Back for another beating? I'm on Arena Stage ${this.arenaStage + 10} now!"`,
            `"Still stuck on baby Pokemon? I've crushed Arena Stage ${this.arenaStage + 12}!"`,
            `"You'll never catch up to me! Arena Stage ${this.arenaStage + 8} was a breeze!"`,
            `"Pathetic! I bet you haven't even found the Arena yet!"`,
            `"While you were napping, I cleared Arena Stage ${this.arenaStage + 15}!"`
        ];

        const taunt = taunts[Math.floor(Math.random() * taunts.length)];
        showDialog(`${this.rivalName}: ${taunt}`, 3000);
    }

    /**
     * Start exit sequence after battle
     */
    startExit() {
        this.state = 'exiting';
        this.freezePlayer();

        // Determine exit direction (away from player)
        const dx = this.rivalPosition.x - this.player.x;
        this.exitDirection = dx > 0 ? 1 : -1;

        // Post-battle dialog
        const afterBattleTaunts = [
            `"Lucky win! I'm still ahead in the Arena rankings!"`,
            `"Whatever. I've already beaten legendaries in the Arena!"`,
            `"Enjoy your small victory. The Arena awaits the REAL champion!"`,
            `"I don't have time for this. Arena Stage ${this.arenaStage + 20} is calling!"`,
            `"You beat my weakest Pokemon. My Arena team would destroy you!"`
        ];

        const taunt = afterBattleTaunts[Math.floor(Math.random() * afterBattleTaunts.length)];
        showDialog(`${this.rivalName}: ${taunt}`, 2500);

        // Increment rival's "arena stage" for next encounter
        this.arenaStage += 3;
    }

    /**
     * Freeze player movement
     */
    freezePlayer() {
        this.playerFrozen = true;
        // Clear player movement inputs
        if (typeof input !== 'undefined') {
            input.keys = {};
        }
    }

    /**
     * Unfreeze player movement
     */
    unfreezePlayer() {
        this.playerFrozen = false;
    }

    /**
     * Check if player should be frozen
     */
    isPlayerFrozen() {
        return this.playerFrozen;
    }

    /**
     * Update rival state machine
     */
    update(currentDay, world, elapsedSeconds) {
        // Check for intro sequence
        if (this.shouldPlayIntro(elapsedSeconds)) {
            this.startIntro();
        }

        // Check for new encounter
        if (this.shouldEncounter(currentDay)) {
            this.startApproach();
        }

        // Update based on current state
        switch (this.state) {
            case 'intro':
                this.updateIntro();
                break;
            case 'approaching':
                this.updateApproach(currentDay); // Pass currentDay for triggerBattle
                break;
            case 'exiting':
                this.updateExit();
                break;
        }
    }

    /**
     * Update intro sequence - walk horizontally across screen
     */
    updateIntro() {
        if (!this.rivalPosition) return;

        // Walk horizontally
        this.rivalPosition.x += this.exitDirection * this.walkSpeed;

        // Check if off screen (20 tiles from player)
        const dist = Math.abs(this.rivalPosition.x - this.player.x);
        if (dist > 20) {
            // Despawn and unfreeze player
            this.rivalPosition = null;
            this.state = 'idle';
            this.unfreezePlayer();
        }
    }

    /**
     * Update approach sequence - move toward player
     */
    updateApproach(currentDay) {
        if (!this.rivalPosition) return;

        const dx = this.player.x - this.rivalPosition.x;
        const dy = this.player.y - this.rivalPosition.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 1.5) {
            // Still approaching
            this.rivalPosition.x += (dx / dist) * this.approachSpeed;
            this.rivalPosition.y += (dy / dist) * this.approachSpeed;
        } else {
            // Close enough - trigger battle
            this.triggerBattle(currentDay);
        }
    }

    /**
     * Update exit sequence - walk off screen horizontally
     */
    updateExit() {
        if (!this.rivalPosition) return;

        // Walk horizontally in exit direction
        this.rivalPosition.x += this.exitDirection * this.walkSpeed;

        // Check if off screen (15 tiles from player in x-axis)
        const dist = Math.abs(this.rivalPosition.x - this.player.x);
        if (dist > 15) {
            // Despawn and unfreeze player
            this.rivalPosition = null;
            this.state = 'idle';
            this.unfreezePlayer();
        }
    }

    /**
     * Trigger the rival battle
     */
    triggerBattle(currentDay) {
        this.lastEncounterDay = currentDay;

        // Calculate rival team level
        let maxPlayerLevel = 1;
        if (this.player.team.length > 0) {
            maxPlayerLevel = Math.max(...this.player.team.map(p => p.level || 1));
        }

        const rivalLevel = maxPlayerLevel + 2 + Math.floor(Math.random() * 4);

        // Unfreeze player during battle
        this.unfreezePlayer();

        // Start trainer battle
        battleSystem.startBattle(true, rivalLevel - maxPlayerLevel);

        // Set up post-battle exit
        // We'll trigger exit when battle ends (handled in main.js)
    }

    /**
     * Called when battle ends - start exit sequence
     */
    onBattleEnd() {
        if (this.state === 'approaching') {
            // Position rival at player location for exit
            this.rivalPosition = {
                x: this.player.x,
                y: this.player.y
            };
            this.startExit();
        }
    }

    /**
     * Draw rival sprite
     */
    draw(ctx, canvas, world, player) {
        if (!this.rivalPosition) return;

        const TILE_SIZE = 80;

        // Calculate screen position
        let drawX = (this.rivalPosition.x - player.x) * TILE_SIZE + canvas.width / 2 - TILE_SIZE / 2;
        let drawY = (this.rivalPosition.y - player.y) * TILE_SIZE + canvas.height / 2 - TILE_SIZE / 2;

        // Bounce animation (similar to player)
        let bounceY = 0;
        const isMoving = this.state === 'intro' || this.state === 'exiting' || this.state === 'approaching';
        if (isMoving) {
            bounceY = Math.abs(Math.sin(Date.now() / 100)) * -5; // Bounce up 5px
        }

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(
            drawX + TILE_SIZE / 2,
            drawY + TILE_SIZE - 5,
            15,
            5,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // Draw Pikachu sprite
        ctx.save();

        // Flip sprite based on direction for intro/exit
        const shouldFlip = (this.state === 'intro' || this.state === 'exiting') && this.exitDirection < 0;

        if (shouldFlip) {
            ctx.translate(drawX + TILE_SIZE, drawY - 10 + bounceY);
            ctx.scale(-1, 1);
            ctx.drawImage(this.sprite, 0, 0, TILE_SIZE, TILE_SIZE);
        } else {
            ctx.drawImage(
                this.sprite,
                drawX,
                drawY - 10 + bounceY,
                TILE_SIZE,
                TILE_SIZE
            );
        }
        ctx.restore();

        // Draw rival name above sprite
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(
            this.rivalName,
            drawX + TILE_SIZE / 2,
            drawY - 15
        );
        ctx.fillText(
            this.rivalName,
            drawX + TILE_SIZE / 2,
            drawY - 15
        );

        // Draw indicator based on state
        if (this.state === 'approaching') {
            // Exclamation mark
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 24px Arial';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeText(
                '!',
                drawX + TILE_SIZE / 2,
                drawY - 35
            );
            ctx.fillText(
                '!',
                drawX + TILE_SIZE / 2,
                drawY - 35
            );
        } else if (this.state === 'exiting') {
            // Arrow showing exit direction
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 20px Arial';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            const arrow = this.exitDirection > 0 ? '→' : '←';
            ctx.strokeText(
                arrow,
                drawX + TILE_SIZE / 2,
                drawY - 35
            );
            ctx.fillText(
                arrow,
                drawX + TILE_SIZE / 2,
                drawY - 35
            );
        }
    }

    /**
     * Serialize rival data for saving
     */
    getSaveData() {
        return {
            lastEncounterDay: this.lastEncounterDay,
            rivalName: this.rivalName,
            hasHadIntro: this.hasHadIntro,
            arenaStage: this.arenaStage
        };
    }

    /**
     * Load rival data from save
     */
    loadSaveData(data) {
        this.lastEncounterDay = data.lastEncounterDay || -2;
        this.rivalName = data.rivalName || 'GARY';
        this.hasHadIntro = data.hasHadIntro || false;
        this.arenaStage = data.arenaStage || 1;
        // Reset state on load
        this.state = 'idle';
        this.rivalPosition = null;
        this.playerFrozen = false;
    }
}
