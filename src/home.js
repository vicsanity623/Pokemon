/**
 * Player Home System
 * - Permanent house building on map
 * - Teleport home with 20-minute cooldown
 * - Heal and save at home
 */

class HomeSystem {
    constructor(player) {
        this.player = player;
        this.houseLocation = null; // {x, y}
        this.hasSpawned = false;

        // Teleport cooldown (20 minutes in milliseconds)
        this.teleportCooldown = 60 * 1000; // 60 seconds (was 20 minutes)
        this.lastTeleportTime = -this.teleportCooldown; // Allow immediate first use

        // House sprite (using a building icon from Pokemon world)
        this.houseSprite = new Image();
        // Using a house emoji as fallback since Pokemon API doesn't have house sprites
        // We'll render it as a colorful building
        this.spriteLoaded = false;
    }

    /**
     * Spawn the player's house at game start
     */
    spawnHouse(world, playerStartX, playerStartY) {
        if (this.hasSpawned) return;

        // Spawn house near player start position (5-8 tiles away)
        const angle = Math.random() * Math.PI * 2;
        const distance = 5 + Math.random() * 3;

        let houseX = Math.round(playerStartX + Math.cos(angle) * distance);
        let houseY = Math.round(playerStartY + Math.sin(angle) * distance);

        // Ensure not on water
        if (world.getTile(houseX, houseY) === 'water') {
            let safe = world.findSafeNear(houseX, houseY);
            houseX = safe.x;
            houseY = safe.y;
        }

        this.houseLocation = { x: houseX, y: houseY };
        this.hasSpawned = true;

        // Add to world buildings
        world.buildings.push({
            type: 'home',
            x: houseX,
            y: houseY
        });

        showDialog('Your house has been built nearby! Press A to interact.', 4000);
    }

    /**
     * Check if teleport is on cooldown
     */
    canTeleport() {
        const now = Date.now();
        const timeSinceLastTeleport = now - this.lastTeleportTime;
        return timeSinceLastTeleport >= this.teleportCooldown;
    }

    /**
     * Get remaining cooldown time in seconds
     */
    getRemainingCooldown() {
        const now = Date.now();
        const timeSinceLastTeleport = now - this.lastTeleportTime;
        const remaining = this.teleportCooldown - timeSinceLastTeleport;
        return Math.max(0, Math.ceil(remaining / 1000));
    }

    /**
     * Teleport player to home
     */
    teleportHome() {
        if (!this.hasSpawned || !this.houseLocation) {
            showDialog('You don\'t have a house yet!', 2000);
            return false;
        }

        if (!this.canTeleport()) {
            const remainingSeconds = this.getRemainingCooldown();
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            showDialog(`Teleport on cooldown: ${minutes}m ${seconds}s remaining`, 3000);
            return false;
        }

        // Teleport player
        this.player.x = this.houseLocation.x;
        this.player.y = this.houseLocation.y;

        // Update cooldown
        this.lastTeleportTime = Date.now();

        // Visual/audio feedback
        playSFX('sfx-pickup');
        showDialog('Teleported home!', 2000);

        return true;
    }

    /**
     * Interact with house (heal + save)
     */
    interact() {
        // Heal all Pokemon
        this.player.healAllPokemon();

        // Save game
        saveGame();

        // Feedback
        playSFX('sfx-heal');
        showDialog('Pokemon healed! Game saved!', 3000);
    }

    /**
     * Check if player is near home
     */
    isNearHome(playerX, playerY) {
        if (!this.houseLocation) return false;

        const dist = Math.sqrt(
            Math.pow(this.houseLocation.x - playerX, 2) +
            Math.pow(this.houseLocation.y - playerY, 2)
        );

        return dist < 3.0;
    }

    /**
     * Serialize home data for saving
     */
    getSaveData() {
        return {
            houseLocation: this.houseLocation,
            hasSpawned: this.hasSpawned,
            lastTeleportTime: this.lastTeleportTime
        };
    }

    /**
     * Load home data from save
     */
    loadSaveData(data) {
        this.houseLocation = data.houseLocation || null;
        this.hasSpawned = data.hasSpawned || false;
        this.lastTeleportTime = data.lastTeleportTime || -this.teleportCooldown;
    }
}
