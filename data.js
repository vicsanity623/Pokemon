// Pokemon Types & Moves Logic
const TYPES = ['normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon'];

// Procedurally generated moves so we don't need a 5MB database
function getMove(type, powerTier) {
    const moves = {
        'fire': ['Ember', 'Flame Wheel', 'Flamethrower', 'Fire Blast'],
        'water': ['Bubble', 'Water Gun', 'Surf', 'Hydro Pump'],
        'grass': ['Vine Whip', 'Razor Leaf', 'Mega Drain', 'Solar Beam'],
        'normal': ['Scratch', 'Tackle', 'Slam', 'Hyper Beam'],
        'electric': ['Thundershock', 'Spark', 'Thunderbolt', 'Thunder']
    };

    let list = moves[type] || moves['normal'];
    let index = Math.min(list.length - 1, powerTier);
    return {
        name: list[index],
        type: type,
        power: (index + 1) * 20,
        accuracy: 100 - (index * 5)
    };
}

// Quest Generator
class QuestSystem {
    constructor(player) {
        this.activeQuest = null;
        this.player = player;
    }

    generate() {
        if (this.activeQuest && !this.activeQuest.completed) return;

        const types = ['hunt', 'walk'];
        const type = types[Math.floor(Math.random() * types.length)];
        const level = this.player.pLevel; // Player internal level

        if (type === 'hunt') {
            let targetCount = 3 + Math.floor(Math.random() * 5);
            this.activeQuest = {
                type: 'hunt',
                desc: `Defeat ${targetCount} Wild Pokemon`,
                target: targetCount,
                current: 0,
                reward: 'Potion',
                rewardQty: 2,
                completed: false
            };
        } else {
            let steps = 200;
            this.activeQuest = {
                type: 'walk',
                desc: `Travel ${steps} steps`,
                target: steps,
                current: 0,
                reward: 'Pokeball',
                rewardQty: 5,
                completed: false
            };
        }
        this.updateUI();
    }

    update(type, amount = 1) {
        if (!this.activeQuest || this.activeQuest.completed) return;
        if (this.activeQuest.type === type) {
            this.activeQuest.current += amount;
            if (this.activeQuest.current >= this.activeQuest.target) {
                this.complete();
            }
            this.updateUI();
        }
    }

    complete() {
        this.activeQuest.completed = true;
        showDialog(`Quest Complete! Got ${this.activeQuest.rewardQty} ${this.activeQuest.reward}s!`, 3000);
        // Add items to player bag (implied)
        this.activeQuest = null;
        setTimeout(() => this.generate(), 4000);
    }

    updateUI() {
        if (this.activeQuest) {
            document.getElementById('quest-desc').innerText =
                `${this.activeQuest.desc} (${this.activeQuest.current}/${this.activeQuest.target})`;
        }
    }
}

const ITEMS = {
    'Potion': { effect: 'heal', val: 20 },
    'Super Potion': { effect: 'heal', val: 50 },
    'Pokeball': { effect: 'catch', val: 1.0 },
    'Rare Candy': { effect: 'level', val: 1 }
};