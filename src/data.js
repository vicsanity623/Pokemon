// Pokemon Types & Moves Logic
const TYPES = [
    'normal',
    'fire',
    'water',
    'grass',
    'electric',
    'ice',
    'fighting',
    'poison',
    'ground',
    'flying',
    'psychic',
    'bug',
    'rock',
    'ghost',
    'dragon'
];

// Type Effectiveness Chart
// Key: Attacking Type -> Defending Type: Multiplier
const TYPE_CHART = {
    fire: {
        grass: 2.0,
        ice: 2.0,
        bug: 2.0,
        water: 0.5,
        fire: 0.5,
        rock: 0.5,
        dragon: 0.5
    },
    water: {
        fire: 2.0,
        ground: 2.0,
        rock: 2.0,
        water: 0.5,
        grass: 0.5,
        dragon: 0.5
    },
    grass: {
        water: 2.0,
        ground: 2.0,
        rock: 2.0,
        fire: 0.5,
        grass: 0.5,
        poison: 0.5,
        flying: 0.5,
        bug: 0.5,
        dragon: 0.5
    },
    electric: {
        water: 2.0,
        flying: 2.0,
        electric: 0.5,
        grass: 0.5,
        dragon: 0.5,
        ground: 0
    },
    ice: {
        grass: 2.0,
        ground: 2.0,
        flying: 2.0,
        dragon: 2.0,
        fire: 0.5,
        water: 0.5,
        ice: 0.5
    },
    fighting: {
        normal: 2.0,
        ice: 2.0,
        rock: 2.0,
        poison: 0.5,
        flying: 0.5,
        psychic: 0.5,
        bug: 0.5,
        ghost: 0
    },
    poison: { grass: 2.0, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5 },
    ground: {
        fire: 2.0,
        electric: 2.0,
        poison: 2.0,
        rock: 2.0,
        grass: 0.5,
        bug: 0.5,
        flying: 0
    },
    flying: { grass: 2.0, fighting: 2.0, bug: 2.0, electric: 0.5, rock: 0.5 },
    psychic: { fighting: 2.0, poison: 2.0, psychic: 0.5 },
    bug: {
        grass: 2.0,
        psychic: 2.0,
        poison: 0.5,
        fighting: 0.5,
        fire: 0.5,
        flying: 0.5,
        ghost: 0.5
    },
    rock: {
        fire: 2.0,
        ice: 2.0,
        flying: 2.0,
        bug: 2.0,
        fighting: 0.5,
        ground: 0.5
    },
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
        fire: ['Ember', 'Flame Wheel', 'Flamethrower', 'Fire Blast'],
        water: ['Bubble', 'Water Gun', 'Surf', 'Hydro Pump'],
        grass: ['Vine Whip', 'Razor Leaf', 'Mega Drain', 'Solar Beam'],
        normal: ['Scratch', 'Tackle', 'Slam', 'Hyper Beam'],
        electric: ['Thundershock', 'Spark', 'Thunderbolt', 'Thunder'],
        ice: ['Ice Shard', 'Ice Beam', 'Blizzard', 'Freeze'],
        fighting: ['Karate Chop', 'Low Kick', 'Submission', 'Hi Jump Kick'],
        poison: ['Poison Sting', 'Smog', 'Sludge', 'Sludge Bomb'],
        ground: ['Mud Slap', 'Dig', 'Earthquake', 'Fissure'],
        flying: ['Gust', 'Wing Attack', 'Drill Peck', 'Sky Attack'],
        psychic: ['Confusion', 'Psybeam', 'Psychic', 'Dream Eater'],
        bug: ['String Shot', 'Harden', 'Twineedle', 'Megahorn'], // Added Harden
        rock: ['Rock Throw', 'Rock Slide', 'Stone Edge', 'Rock Wrecker'],
        ghost: ['Lick', 'Confuse Ray', 'Shadow Ball', 'Shadow Claw'],
        dragon: ['Dragon Rage', 'Dragon Breath', 'Dragon Claw', 'Draco Meteor']
    };

    let list = moves[type] || moves['normal'];
    let index = Math.min(list.length - 1, powerTier);
    let name = list[index];

    // Status Move Logic
    let category = 'physical';
    if (
        ['Harden', 'String Shot', 'Growl', 'Tail Whip', 'Confuse Ray'].includes(
            name
        )
    ) {
        category = 'status';
    }

    return {
        name: name,
        type: type,
        power: category === 'status' ? 0 : (index + 1) * 20,
        accuracy: 100 - index * 5,
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
        showDialog(
            `Quest Complete! Got ${this.activeQuest.rewardQty} ${this.activeQuest.reward}s!`,
            3000
        );

        // Add items to player bag
        if (this.player.bag[this.activeQuest.reward]) {
            this.player.bag[this.activeQuest.reward] +=
                this.activeQuest.rewardQty;
        } else {
            this.player.bag[this.activeQuest.reward] =
                this.activeQuest.rewardQty;
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
    Potion: { effect: 'heal', val: 20, type: 'potion', price: 500 },
    'Super Potion': { effect: 'heal', val: 50, type: 'potion', price: 700 }, // Scaled slightly
    'Hyper Potion': { effect: 'heal', val: 100, type: 'potion', price: 1000 },
    'Max Potion': { effect: 'heal', val: 9999, type: 'potion', price: 2000 },
    Pokeball: { effect: 'catch', val: 1.0, type: 'ball', price: 100 },
    'Great Ball': { effect: 'catch', val: 1.5, type: 'ball', price: 250 },
    'Ultra Ball': { effect: 'catch', val: 2.0, type: 'ball', price: 1000 },
    'Master Ball': { effect: 'catch', val: 255, type: 'ball', price: 100000 },
    'Rare Candy': { effect: 'level', val: 1, type: 'misc', price: 4800 },
    Herb: { effect: 'sell', val: 0, type: 'misc', price: 100 } // Sell for 50
};

// Evolution data: Pokemon name (uppercase) -> { evolvesInto: name, level: required level }
const EVOLUTIONS = {
    // Starters
    BULBASAUR: { evolvesInto: 'IVYSAUR', level: 16, id: 2 },
    IVYSAUR: { evolvesInto: 'VENUSAUR', level: 32, id: 3 },
    CHARMANDER: { evolvesInto: 'CHARMELEON', level: 16, id: 5 },
    CHARMELEON: { evolvesInto: 'CHARIZARD', level: 36, id: 6 },
    SQUIRTLE: { evolvesInto: 'WARTORTLE', level: 16, id: 8 },
    WARTORTLE: { evolvesInto: 'BLASTOISE', level: 36, id: 9 },

    // Common Pokemon
    CATERPIE: { evolvesInto: 'METAPOD', level: 7, id: 11 },
    METAPOD: { evolvesInto: 'BUTTERFREE', level: 10, id: 12 },
    WEEDLE: { evolvesInto: 'KAKUNA', level: 7, id: 14 },
    KAKUNA: { evolvesInto: 'BEEDRILL', level: 10, id: 15 },
    PIDGEY: { evolvesInto: 'PIDGEOTTO', level: 18, id: 17 },
    PIDGEOTTO: { evolvesInto: 'PIDGEOT', level: 36, id: 18 },
    RATTATA: { evolvesInto: 'RATICATE', level: 20, id: 20 },
    SPEAROW: { evolvesInto: 'FEAROW', level: 20, id: 22 },
    EKANS: { evolvesInto: 'ARBOK', level: 22, id: 24 },
    PIKACHU: { evolvesInto: 'RAICHU', level: 22, id: 26 },
    SANDSHREW: { evolvesInto: 'SANDSLASH', level: 22, id: 28 },
    'NIDORAN♀': { evolvesInto: 'NIDORINA', level: 16, id: 30 },
    NIDORINA: { evolvesInto: 'NIDOQUEEN', level: 36, id: 31 },
    'NIDORAN♂': { evolvesInto: 'NIDORINO', level: 16, id: 33 },
    NIDORINO: { evolvesInto: 'NIDOKING', level: 36, id: 34 },
    CLEFAIRY: { evolvesInto: 'CLEFABLE', level: 36, id: 36 },
    VULPIX: { evolvesInto: 'NINETALES', level: 36, id: 38 },
    JIGGLYPUFF: { evolvesInto: 'WIGGLYTUFF', level: 36, id: 40 },
    ZUBAT: { evolvesInto: 'GOLBAT', level: 22, id: 42 },
    ODDISH: { evolvesInto: 'GLOOM', level: 21, id: 44 },
    GLOOM: { evolvesInto: 'VILEPLUME', level: 36, id: 45 },
    PARAS: { evolvesInto: 'PARASECT', level: 24, id: 47 },
    VENONAT: { evolvesInto: 'VENOMOTH', level: 31, id: 49 },
    DIGLETT: { evolvesInto: 'DUGTRIO', level: 26, id: 51 },
    MEOWTH: { evolvesInto: 'PERSIAN', level: 28, id: 53 },
    PSYDUCK: { evolvesInto: 'GOLDUCK', level: 33, id: 55 },
    MANKEY: { evolvesInto: 'PRIMEAPE', level: 28, id: 57 },
    GROWLITHE: { evolvesInto: 'ARCANINE', level: 36, id: 59 },
    POLIWAG: { evolvesInto: 'POLIWHIRL', level: 25, id: 61 },
    POLIWHIRL: { evolvesInto: 'POLIWRATH', level: 36, id: 62 },
    ABRA: { evolvesInto: 'KADABRA', level: 16, id: 64 },
    KADABRA: { evolvesInto: 'ALAKAZAM', level: 36, id: 65 },
    MACHOP: { evolvesInto: 'MACHOKE', level: 28, id: 67 },
    MACHOKE: { evolvesInto: 'MACHAMP', level: 36, id: 68 },
    BELLSPROUT: { evolvesInto: 'WEEPINBELL', level: 21, id: 70 },
    WEEPINBELL: { evolvesInto: 'VICTREEBEL', level: 36, id: 71 },
    TENTACOOL: { evolvesInto: 'TENTACRUEL', level: 30, id: 73 },
    GEODUDE: { evolvesInto: 'GRAVELER', level: 25, id: 75 },
    GRAVELER: { evolvesInto: 'GOLEM', level: 36, id: 76 },
    PONYTA: { evolvesInto: 'RAPIDASH', level: 40, id: 78 },
    SLOWPOKE: { evolvesInto: 'SLOWBRO', level: 37, id: 80 },
    MAGNEMITE: { evolvesInto: 'MAGNETON', level: 30, id: 82 },
    DODUO: { evolvesInto: 'DODRIO', level: 31, id: 85 },
    SEEL: { evolvesInto: 'DEWGONG', level: 34, id: 87 },
    GRIMER: { evolvesInto: 'MUK', level: 38, id: 89 },
    SHELLDER: { evolvesInto: 'CLOYSTER', level: 36, id: 91 },
    GASTLY: { evolvesInto: 'HAUNTER', level: 25, id: 93 },
    HAUNTER: { evolvesInto: 'GENGAR', level: 36, id: 94 },
    DROWZEE: { evolvesInto: 'HYPNO', level: 26, id: 97 },
    KRABBY: { evolvesInto: 'KINGLER', level: 28, id: 99 },
    VOLTORB: { evolvesInto: 'ELECTRODE', level: 30, id: 101 },
    EXEGGCUTE: { evolvesInto: 'EXEGGUTOR', level: 36, id: 103 },
    CUBONE: { evolvesInto: 'MAROWAK', level: 28, id: 105 },
    KOFFING: { evolvesInto: 'WEEZING', level: 35, id: 110 },
    RHYHORN: { evolvesInto: 'RHYDON', level: 42, id: 112 },
    HORSEA: { evolvesInto: 'SEADRA', level: 32, id: 117 },
    GOLDEEN: { evolvesInto: 'SEAKING', level: 33, id: 119 },
    STARYU: { evolvesInto: 'STARMIE', level: 36, id: 121 },
    MAGIKARP: { evolvesInto: 'GYARADOS', level: 20, id: 130 },
    EEVEE: { evolvesInto: 'VAPOREON', level: 36, id: 134 }, // Water stone in game, but level for simplicity
    OMANYTE: { evolvesInto: 'OMASTAR', level: 40, id: 139 },
    KABUTO: { evolvesInto: 'KABUTOPS', level: 40, id: 141 },
    DRATINI: { evolvesInto: 'DRAGONAIR', level: 30, id: 148 },
    DRAGONAIR: { evolvesInto: 'DRAGONITE', level: 55, id: 149 }
};

// Status Effect Data
// chance: 1.0 = 100%, 0.3 = 30%
const MOVE_EFFECTS = {
    "POISON STING": { status: 'PSN', chance: 0.3 },
    "SLUDGE": { status: 'PSN', chance: 0.4 },
    "TOXIC": { status: 'PSN', chance: 1.0 },

    "THUNDER WAVE": { status: 'PAR', chance: 1.0 },
    "THUNDERSHOCK": { status: 'PAR', chance: 0.1 },
    "SPARK": { status: 'PAR', chance: 0.3 },
    "BODY SLAM": { status: 'PAR', chance: 0.3 },

    "EMBER": { status: 'BRN', chance: 0.1 },
    "FLAMETHROWER": { status: 'BRN', chance: 0.1 },
    "FIRE BLAST": { status: 'BRN', chance: 0.3 },

    "SING": { status: 'SLP', chance: 0.55 },
    "HYPNOSIS": { status: 'SLP', chance: 0.6 },
    "SLEEP POWDER": { status: 'SLP', chance: 0.75 },

    "ICE BEAM": { status: 'FRZ', chance: 0.1 },
    "BLIZZARD": { status: 'FRZ', chance: 0.1 }
};
