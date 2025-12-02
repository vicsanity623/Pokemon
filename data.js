// Pokemon Types & Moves Logic
const TYPES = ['normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon'];

// Type Effectiveness Chart
// Key: Attacking Type -> Defending Type: Multiplier
const TYPE_CHART = {
    fire: { grass: 2.0, ice: 2.0, bug: 2.0, water: 0.5, fire: 0.5, rock: 0.5, dragon: 0.5 },
    water: { fire: 2.0, ground: 2.0, rock: 2.0, water: 0.5, grass: 0.5, dragon: 0.5 },
    grass: { water: 2.0, ground: 2.0, rock: 2.0, fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5 },
    electric: { water: 2.0, flying: 2.0, electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0 },
    ice: { grass: 2.0, ground: 2.0, flying: 2.0, dragon: 2.0, fire: 0.5, water: 0.5, ice: 0.5 },
    fighting: { normal: 2.0, ice: 2.0, rock: 2.0, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, ghost: 0 },
    poison: { grass: 2.0, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5 },
    ground: { fire: 2.0, electric: 2.0, poison: 2.0, rock: 2.0, grass: 0.5, bug: 0.5, flying: 0 },
    flying: { grass: 2.0, fighting: 2.0, bug: 2.0, electric: 0.5, rock: 0.5 },
    psychic: { fighting: 2.0, poison: 2.0, psychic: 0.5 },
    bug: { grass: 2.0, psychic: 2.0, poison: 0.5, fighting: 0.5, fire: 0.5, flying: 0.5, ghost: 0.5 },
    rock: { fire: 2.0, ice: 2.0, flying: 2.0, bug: 2.0, fighting: 0.5, ground: 0.5 },
    ghost: { ghost: 2.0, psychic: 0.5, normal: 0 },
    dragon: { dragon: 2.0 },
    normal: { rock: 0.5, ghost: 0 }
};

// Get Type Effectiveness Multiplier
function getTypeEffectiveness(attackType, defenderType) {
    if (!attackType || !defenderType) return 1.0;

    const chart = TYPE_CHART[attackType];
    if (!chart) return 1.0;

    return chart[defenderType] || 1.0;
}

// Procedurally generated moves so we don't need a 5MB database
function getMove(type, powerTier) {
    const moves = {
        'fire': ['Ember', 'Flame Wheel', 'Flamethrower', 'Fire Blast'],
        'water': ['Bubble', 'Water Gun', 'Surf', 'Hydro Pump'],
        'grass': ['Vine Whip', 'Razor Leaf', 'Mega Drain', 'Solar Beam'],
        'normal': ['Scratch', 'Tackle', 'Slam', 'Hyper Beam'],
        'electric': ['Thundershock', 'Spark', 'Thunderbolt', 'Thunder'],
        'ice': ['Ice Shard', 'Ice Beam', 'Blizzard', 'Freeze'],
        'fighting': ['Karate Chop', 'Low Kick', 'Submission', 'Hi Jump Kick'],
        'poison': ['Poison Sting', 'Smog', 'Sludge', 'Sludge Bomb'],
        'ground': ['Mud Slap', 'Dig', 'Earthquake', 'Fissure'],
        'flying': ['Gust', 'Wing Attack', 'Drill Peck', 'Sky Attack'],
        'psychic': ['Confusion', 'Psybeam', 'Psychic', 'Dream Eater'],
        'bug': ['String Shot', 'Harden', 'Twineedle', 'Megahorn'], // Added Harden
        'rock': ['Rock Throw', 'Rock Slide', 'Stone Edge', 'Rock Wrecker'],
        'ghost': ['Lick', 'Confuse Ray', 'Shadow Ball', 'Shadow Claw'],
        'dragon': ['Dragon Rage', 'Dragon Breath', 'Dragon Claw', 'Draco Meteor']
    };

    let list = moves[type] || moves['normal'];
    let index = Math.min(list.length - 1, powerTier);
    let name = list[index];

    // Status Move Logic
    let category = 'physical';
    if (['Harden', 'String Shot', 'Growl', 'Tail Whip', 'Confuse Ray'].includes(name)) {
        category = 'status';
    }

    return {
        name: name,
        type: type,
        power: category === 'status' ? 0 : (index + 1) * 20,
        accuracy: 100 - (index * 5),
        category: category
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

        // Add items to player bag
        if (this.player.bag[this.activeQuest.reward]) {
            this.player.bag[this.activeQuest.reward] += this.activeQuest.rewardQty;
        } else {
            this.player.bag[this.activeQuest.reward] = this.activeQuest.rewardQty;
        }

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
    'Potion': { effect: 'heal', val: 20, type: 'potion' },
    'Super Potion': { effect: 'heal', val: 50, type: 'potion' },
    'Hyper Potion': { effect: 'heal', val: 100, type: 'potion' },
    'Max Potion': { effect: 'heal', val: 9999, type: 'potion' },
    'Pokeball': { effect: 'catch', val: 1.0, type: 'ball' },
    'Great Ball': { effect: 'catch', val: 1.5, type: 'ball' },
    'Ultra Ball': { effect: 'catch', val: 2.0, type: 'ball' },
    'Master Ball': { effect: 'catch', val: 255, type: 'ball' }, // Instant catch
    'Rare Candy': { effect: 'level', val: 1, type: 'misc' },
    'Herb': { effect: 'sell', val: 0, type: 'misc' }
};