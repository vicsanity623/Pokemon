/**
 * Rival Trainer System (DOM Version)
 * - Controls the HTML <img> element id="rival-sprite"
 * - Updates CSS position based on game coordinates
 */

class RivalSystem {
    constructor(player) {
        this.player = player;
        this.lastEncounterDay = -2; 
        this.encounterInterval = 2; 
        this.rivalName = 'GARY';

        // State machine
        this.state = 'idle'; // idle, intro, approaching, exiting
        this.rivalPosition = null; // {x, y}
        this.approachSpeed = 0.08; 
        this.walkSpeed = 0.06; 
        this.exitDirection = 1; 

        this.hasHadIntro = false;
        this.introTime = 120; // 2 minutes

        this.playerFrozen = false;
        this.arenaStage = 1; 

        // Get the HTML element we added to index.html
        this.domElement = document.getElementById('rival-sprite');
    }

    shouldPlayIntro(elapsedSeconds) {
        return (!this.hasHadIntro && elapsedSeconds >= this.introTime && !battleSystem.isActive);
    }

    shouldEncounter(currentDay) {
        return (
            this.hasHadIntro && 
            currentDay - this.lastEncounterDay >= this.encounterInterval &&
            !battleSystem.isActive &&
            this.player.team.length > 0 &&
            currentDay > 0 &&
            this.state === 'idle'
        );
    }

    startIntro() {
        this.state = 'intro';
        this.hasHadIntro = true;
        
        // Spawn off-screen left
        this.rivalPosition = { x: this.player.x - 15, y: this.player.y };
        this.exitDirection = 1; // Walk right
        
        this.freezePlayer();
        this.updateDOMVisibility(true); // Show sprite

        showDialog(`${this.rivalName}: "Heh, you're just starting? Pathetic."`, 3000);
        setTimeout(() => showDialog(`${this.rivalName}: "I've already cleared Arena Stage ${this.arenaStage + 5}!"`, 3000), 3500);
        setTimeout(() => showDialog(`${this.rivalName}: "Try to keep up... if you can!"`, 3000), 7000);
    }

    startApproach() {
        this.state = 'approaching';
        const angle = Math.random() * Math.PI * 2;
        const distance = 15 + Math.random() * 5;
        this.rivalPosition = {
            x: this.player.x + Math.cos(angle) * distance,
            y: this.player.y + Math.sin(angle) * distance
        };

        this.freezePlayer();
        this.updateDOMVisibility(true);

        const taunts = [
            `"Back for another beating? I'm on Arena Stage ${this.arenaStage + 10} now!"`,
            `"Still stuck on baby Pokemon? I've crushed Arena Stage ${this.arenaStage + 12}!"`,
            `"Pathetic! I bet you haven't even found the Arena yet!"`
        ];
        showDialog(`${this.rivalName}: ${taunts[Math.floor(Math.random() * taunts.length)]}`, 3000);
    }

    startExit() {
        this.state = 'exiting';
        this.freezePlayer();
        this.updateDOMVisibility(true);

        const dx = this.rivalPosition.x - this.player.x;
        this.exitDirection = dx > 0 ? 1 : -1;

        const afterBattleTaunts = [
            `"Lucky win! I'm still ahead in the Arena rankings!"`,
            `"Whatever. I've already beaten legendaries in the Arena!"`,
            `"You beat my weakest Pokemon. My Arena team would destroy you!"`
        ];
        showDialog(`${this.rivalName}: ${afterBattleTaunts[Math.floor(Math.random() * afterBattleTaunts.length)]}`, 2500);
        this.arenaStage += 3;
    }

    freezePlayer() {
        this.playerFrozen = true;
        if (typeof input !== 'undefined') input.keys = {};
    }

    unfreezePlayer() {
        this.playerFrozen = false;
    }

    isPlayerFrozen() { return this.playerFrozen; }

    // --- MAIN LOOP ---
    update(currentDay, world, elapsedSeconds) {
        // Logic Triggers
        if (this.shouldPlayIntro(elapsedSeconds)) this.startIntro();
        if (this.shouldEncounter(currentDay)) this.startApproach();

        // Movement Logic
        switch (this.state) {
            case 'intro': this.updateIntro(); break;
            case 'approaching': this.updateApproach(currentDay); break;
            case 'exiting': this.updateExit(); break;
        }

        // VISUAL UPDATE: Move the HTML element to match Game Coordinates
        this.updateDOMPosition();
    }

    updateIntro() {
        if (!this.rivalPosition) return;
        this.rivalPosition.x += this.exitDirection * this.walkSpeed;
        if (Math.abs(this.rivalPosition.x - this.player.x) > 20) {
            this.rivalPosition = null;
            this.state = 'idle';
            this.unfreezePlayer();
            this.updateDOMVisibility(false);
        }
    }

    updateApproach(currentDay) {
        if (!this.rivalPosition) return;
        const dx = this.player.x - this.rivalPosition.x;
        const dy = this.player.y - this.rivalPosition.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 1.5) {
            this.rivalPosition.x += (dx / dist) * this.approachSpeed;
            this.rivalPosition.y += (dy / dist) * this.approachSpeed;
        } else {
            this.triggerBattle(currentDay);
        }
    }

    updateExit() {
        if (!this.rivalPosition) return;
        this.rivalPosition.x += this.exitDirection * this.walkSpeed;
        if (Math.abs(this.rivalPosition.x - this.player.x) > 15) {
            this.rivalPosition = null;
            this.state = 'idle';
            this.unfreezePlayer();
            this.updateDOMVisibility(false);
        }
    }

    triggerBattle(currentDay) {
        this.lastEncounterDay = currentDay;
        // Hide sprite during battle so it doesn't float over battle UI
        this.updateDOMVisibility(false);
        
        let maxPlayerLevel = 1;
        if (this.player.team.length > 0) maxPlayerLevel = Math.max(...this.player.team.map(p => p.level || 1));
        
        this.unfreezePlayer();
        battleSystem.startBattle(true, (maxPlayerLevel + 2) - maxPlayerLevel); // Simple logic
    }

    onBattleEnd() {
        if (this.state === 'approaching') {
            this.rivalPosition = { x: this.player.x, y: this.player.y };
            this.startExit();
        }
    }

    // --- DOM HELPER FUNCTIONS ---

    updateDOMVisibility(isVisible) {
        if (!this.domElement) return;
        if (isVisible) this.domElement.classList.remove('hidden');
        else this.domElement.classList.add('hidden');
    }

    updateDOMPosition() {
        if (!this.domElement || !this.rivalPosition || this.state === 'idle') return;

        // Convert Game Coordinates (Grid) to CSS Pixels
        // Assuming TILE_SIZE is 80 (from your previous code)
        const TILE_SIZE = 80;
        const canvas = document.getElementById('gameCanvas');
        
        if (!canvas) return;

        // Calculate position relative to the center of the screen (where player is)
        const screenX = (this.rivalPosition.x - this.player.x) * TILE_SIZE + (window.innerWidth / 2);
        const screenY = (this.rivalPosition.y - this.player.y) * TILE_SIZE + (window.innerHeight / 2);

        // Apply to CSS
        this.domElement.style.left = `${screenX}px`;
        this.domElement.style.top = `${screenY}px`;

        // Handle Direction Flip
        if (this.exitDirection < 0 || (this.state === 'approaching' && this.rivalPosition.x > this.player.x)) {
            this.domElement.style.transform = 'translate(-50%, -50%) scaleX(-1)'; // Face Left
        } else {
            this.domElement.style.transform = 'translate(-50%, -50%) scaleX(1)'; // Face Right
        }
    }

    // Saving/Loading...
    getSaveData() {
        return {
            lastEncounterDay: this.lastEncounterDay,
            rivalName: this.rivalName,
            hasHadIntro: this.hasHadIntro,
            arenaStage: this.arenaStage
        };
    }

    loadSaveData(data) {
        this.lastEncounterDay = data.lastEncounterDay || -2;
        this.rivalName = data.rivalName || 'GARY';
        this.hasHadIntro = data.hasHadIntro || false;
        this.arenaStage = data.arenaStage || 1;
        this.state = 'idle';
        this.updateDOMVisibility(false);
    }
    
    // Empty draw method because main.js might still be calling it
    draw() {} 
}