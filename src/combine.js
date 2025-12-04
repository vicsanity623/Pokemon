class CombineSystem {
    constructor(player) {
        this.player = player;
        // 3 Slots for merging
        this.slots = [null, null, null];
        this.cost = 5000;
    }

    // Add a Pokemon from Storage/Party to a merge slot
    addToSlot(pokemon, sourceIndex, sourceType) {
        // 1. Find first empty slot
        let slotIndex = this.slots.findIndex((s) => s === null);

        if (slotIndex === -1) {
            showDialog('Merge slots are full!');
            return false;
        }

        // 2. Validation: Must be same species as others
        const firstFilled = this.slots.find((s) => s !== null);
        if (firstFilled) {
            // Strip stars for name comparison
            const pName = this.cleanName(pokemon.name);
            const slotName = this.cleanName(firstFilled.data.name);

            if (pName !== slotName) {
                showDialog(`Must merge identical species! (Need ${slotName})`);
                return false;
            }
        }

        // 3. Validation: Max Merge Level
        if ((pokemon.mergeCount || 0) >= 3) {
            showDialog('This Pokemon is already at Max Merge Level!');
            return false;
        }

        // Add to slot
        this.slots[slotIndex] = {
            data: pokemon,
            sourceIndex: sourceIndex,
            sourceType: sourceType // 'box' or 'party'
        };

        return true;
    }

    removeFromSlot(index) {
        if (this.slots[index]) {
            // Logic to return item is handled by simply clearing the slot
            // because we don't delete the original until the final merge button is pressed
            this.slots[index] = null;
            return true;
        }
        return false;
    }

    canMerge() {
        // Check if all slots are full
        if (this.slots.includes(null)) return false;
        // Check money
        if (this.player.money < this.cost) return false;
        return true;
    }

    performMerge() {
        if (!this.canMerge()) {
            if (this.player.money < this.cost)
                showDialog('Not enough money! Need $5000.');
            else showDialog('Need 3 Pokemon to merge!');
            return;
        }

        const p1 = this.slots[0].data;
        const p2 = this.slots[1].data;
        const p3 = this.slots[2].data;

        // 1. Calculate Best Stats (Inheritance)
        const newStats = {
            strength: Math.max(
                p1.stats.strength,
                p2.stats.strength,
                p3.stats.strength
            ),
            defense: Math.max(
                p1.stats.defense,
                p2.stats.defense,
                p3.stats.defense
            ),
            speed: Math.max(p1.stats.speed, p2.stats.speed, p3.stats.speed),
            hp: Math.max(p1.stats.hp, p2.stats.hp, p3.stats.hp),
            special: Math.max(
                p1.stats.special,
                p2.stats.special,
                p3.stats.special
            )
        };

        // 2. Determine Merge Level
        // Takes the highest merge count of ingredients + 1
        const currentMaxMerge = Math.max(
            p1.mergeCount || 0,
            p2.mergeCount || 0,
            p3.mergeCount || 0
        );
        const newMergeCount = currentMaxMerge + 1;

        // 3. Create Name with Stars
        const baseName = this.cleanName(p1.name);
        let starString = '✨'.repeat(newMergeCount);
        const newName = `${baseName} ${starString}`;

        // 4. Create New Pokemon Object
        const mergedPokemon = {
            ...p1, // Copy basic data from first pokemon
            name: newName,
            mergeCount: newMergeCount,
            stats: newStats,
            // Recalculate Max HP based on new stats
            maxHp: p1.level * 5 + newStats.hp,
            hp: p1.level * 5 + newStats.hp // Full heal
        };

        // 5. DELETE Ingredients from Source
        // We sort by index descending to avoid shifting issues when deleting from arrays
        const sources = [...this.slots].sort(
            (a, b) => b.sourceIndex - a.sourceIndex
        );

        sources.forEach((slot) => {
            if (slot.sourceType === 'party') {
                this.player.team.splice(slot.sourceIndex, 1);
            } else if (slot.sourceType === 'box') {
                // Assuming currentBox global is active
                this.player.storage[currentBox][slot.sourceIndex] = null;
            }
        });

        // 6. Add Result to Party (or Box if full)
        if (this.player.team.length < 6) {
            this.player.team.push(mergedPokemon);
            showDialog(`Merge Successful! Obtained ${newName}!`);
        } else {
            // Find empty box slot
            let placed = false;
            for (let i = 0; i < 25; i++) {
                if (this.player.storage[currentBox][i] === null) {
                    this.player.storage[currentBox][i] = mergedPokemon;
                    placed = true;
                    showDialog(`Merge Successful! Sent ${newName} to Box!`);
                    break;
                }
            }
            if (!placed)
                showDialog('Box and Party full! (Merge failed safely)'); // Edge case
        }

        // 7. Deduct Cost & Reset
        this.player.money -= this.cost;
        this.slots = [null, null, null];

        // Update UI
        updateHUD();
        renderPC();
    }

    cleanName(name) {
        return name.replace(/ ✨/g, '').trim();
    }
}
