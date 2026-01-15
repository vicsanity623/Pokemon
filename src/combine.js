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

        // 4. REMOVE FROM SOURCE IMMEDIATELY
        // We rely on Global 'currentBox' if type is 'box'.
        // This prevents duplication bugs.
        if (sourceType === 'party') {
            this.player.team.splice(sourceIndex, 1);
        } else if (sourceType === 'box') {
            // Check if currentBox is defined (Global from main.js)
            if (typeof currentBox === 'undefined') {
                console.error("Critical: currentBox is undefined in addToSlot");
                showDialog("Error: Box data missing.");
                return false;
            }
            this.player.storage[currentBox][sourceIndex] = null;
        }

        // Add to slot
        this.slots[slotIndex] = {
            data: pokemon,
            sourceIndex: sourceIndex,
            sourceType: sourceType,
            sourceBox: (typeof currentBox !== 'undefined') ? currentBox : 0
        };

        return true;
    }

    removeFromSlot(index) {
        const slot = this.slots[index];
        if (!slot) return false;

        // RETURN LOGIC
        let placed = false;
        let returnLocation = "";

        // 1. Try to return to Party first
        if (this.player.team.length < 6) {
            this.player.team.push(slot.data);
            placed = true;
            returnLocation = "Party";
        } else {
            // 2. Try to return to Original Box (if known) or Current Box
            // We trust the slot.sourceBox if it exists, otherwise fallback
            let targetBox = (typeof slot.sourceBox !== 'undefined') ? slot.sourceBox :
                (typeof currentBox !== 'undefined' ? currentBox : 0);

            // Try target box
            for (let i = 0; i < 25; i++) {
                if (this.player.storage[targetBox][i] === null) {
                    this.player.storage[targetBox][i] = slot.data;
                    placed = true;
                    returnLocation = `Box ${targetBox + 1}`;
                    break;
                }
            }

            // 3. If target box full, find ANY empty box
            if (!placed) {
                for (let b = 0; b < 100; b++) {
                    for (let i = 0; i < 25; i++) {
                        if (this.player.storage[b][i] === null) {
                            this.player.storage[b][i] = slot.data;
                            placed = true;
                            returnLocation = `Box ${b + 1}`;
                            break;
                        }
                    }
                    if (placed) break;
                }
            }
        }

        if (placed) {
            showDialog(`${slot.data.name} returned to ${returnLocation}.`);
            this.slots[index] = null;
            return true;
        } else {
            showDialog("No space in Party or PC! Cannot remove.");
            return false;
        }
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

        // 1. Calculate Best Base Stats (Inheritance)
        const newStats = {
            strength: Math.max(p1.stats.strength, p2.stats.strength, p3.stats.strength),
            defense: Math.max(p1.stats.defense, p2.stats.defense, p3.stats.defense),
            speed: Math.max(p1.stats.speed, p2.stats.speed, p3.stats.speed),
            hp: Math.max(p1.stats.hp, p2.stats.hp, p3.stats.hp),
            special: Math.max(p1.stats.special, p2.stats.special, p3.stats.special)
        };

        // 2. Determine Merge Level (Stars)
        const currentMaxMerge = Math.max(
            p1.mergeCount || 0,
            p2.mergeCount || 0,
            p3.mergeCount || 0
        );
        const newMergeCount = currentMaxMerge + 1;

        // 3. LEVEL BOOST CALCULATION
        const levelBoost = 3 * newMergeCount;
        const newLevel = p1.level + levelBoost;

        // 4. BOOST STATS TO MATCH NEW LEVEL
        newStats.strength += levelBoost * 2;
        newStats.defense += levelBoost * 2;
        newStats.speed += levelBoost * 2;
        newStats.special += levelBoost * 2;
        newStats.hp += levelBoost * 2;

        // 5. Create Name with Stars
        const baseName = this.cleanName(p1.name);
        let starString = '✨'.repeat(newMergeCount);
        const newName = `${baseName} ${starString}`;

        // 6. Create New Pokemon Object
        const mergedPokemon = {
            ...p1, // Copy basic data
            name: newName,
            level: newLevel, // Set new boosted level
            mergeCount: newMergeCount,
            stats: newStats,
            // Recalculate Max HP (Base + Stat)
            maxHp: (newLevel * 5) + newStats.hp,
            hp: (newLevel * 5) + newStats.hp // Full heal
        };

        // 7. CLEAR SLOTS
        // Source Pokemon were already removed from party/PC in addToSlot
        this.slots = [null, null, null];

        // 8. Add Result to Party (or Box if full)
        if (this.player.team.length < 6) {
            this.player.team.push(mergedPokemon);
            showDialog(`Merge Successful! ${newName} (Lv.${newLevel}) created!`);
        } else {
            let placed = false;
            // Try current box first (if available)
            let targetBox = (typeof currentBox !== 'undefined') ? currentBox : 0;

            for (let i = 0; i < 25; i++) {
                if (this.player.storage[targetBox][i] === null) {
                    this.player.storage[targetBox][i] = mergedPokemon;
                    placed = true;
                    showDialog(`Merge Successful! Sent ${newName} (Lv.${newLevel}) to Box!`);
                    break;
                }
            }
            if (!placed)
                showDialog('Box and Party full! Pokemon lost in the void...');
        }

        // 9. Deduct Cost
        this.player.money -= this.cost;

        // Update UI
        // Assuming updateHUD and renderPC are global functions from main.js
        if (typeof updateHUD === 'function') updateHUD();
        if (typeof renderPC === 'function') renderPC();
    }

    cleanName(name) {
        return name.replace(/✨/g, '').trim();
    }

    getSaveData() {
        return {
            slots: this.slots
        };
    }

    loadSaveData(data) {
        if (data && data.slots) {
            this.slots = data.slots;
        }
    }
}
