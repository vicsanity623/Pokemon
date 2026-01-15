class ArenaSystem {
    constructor(player) {
        this.player = player;
        this.stage = 1; // Global counter (e.g., 152 = Tier 2, Stage 1)
        this.isActive = false;
    }

    /**
     * Determines the current Tier (I, II, III...) based on stage count
     */
    getTier() {
        return Math.floor((this.stage - 1) / 151) + 1;
    }

    /**
     * Determines the relative stage (1-151) within the current Tier
     */
    getRelativeStage() {
        return ((this.stage - 1) % 151) + 1;
    }

    /**
     * Converts number to Roman Numeral for "Diablo Style" display
     */
    getRomanTier() {
        const tier = this.getTier();
        const romans = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
        return romans[tier] || `T${tier}`;
    }

    /**
     * Returns the Pokedex ID the player should face.
     * Maps base forms to their Final Evolution.
     */
    getBossID() {
        const dexNum = this.getRelativeStage(); // 1 to 151
        
        // 1. Handle Legendaries explicitly
        if (dexNum === 150) return 150; // Mewtwo
        if (dexNum === 151) return 151; // Mew

        // 2. Force Evolution Map (Gen 1)
        // Maps any ID to its final stage ID
        const FINAL_EVO_MAP = {
            // Starters
            1: 3, 2: 3, 3: 3,       // Bulbasaur line -> Venusaur
            4: 6, 5: 6, 6: 6,       // Charmander line -> Charizard
            7: 9, 8: 9, 9: 9,       // Squirtle line -> Blastoise
            // Bugs
            10: 12, 11: 12, 12: 12, // Caterpie -> Butterfree
            13: 15, 14: 15, 15: 15, // Weedle -> Beedrill
            // Birds / Normal
            16: 18, 17: 18, 18: 18, // Pidgey -> Pidgeot
            19: 20, 20: 20,         // Rattata -> Raticate
            21: 22, 22: 22,         // Spearow -> Fearow
            23: 24, 24: 24,         // Ekans -> Arbok
            25: 26, 26: 26,         // Pikachu -> Raichu
            27: 28, 28: 28,         // Sandshrew -> Sandslash
            29: 31, 30: 31, 31: 31, // Nidoran F -> Nidoqueen
            32: 34, 33: 34, 34: 34, // Nidoran M -> Nidoking
            35: 36, 36: 36,         // Clefairy -> Clefable
            37: 38, 38: 38,         // Vulpix -> Ninetales
            39: 40, 40: 40,         // Jigglypuff -> Wigglytuff
            41: 42, 42: 42,         // Zubat -> Golbat
            43: 45, 44: 45, 45: 45, // Oddish -> Vileplume
            46: 47, 47: 47,         // Paras -> Parasect
            48: 49, 49: 49,         // Venonat -> Venomoth
            50: 51, 51: 51,         // Diglett -> Dugtrio
            52: 53, 53: 53,         // Meowth -> Persian
            54: 55, 55: 55,         // Psyduck -> Golduck
            56: 57, 57: 57,         // Mankey -> Primeape
            58: 59, 59: 59,         // Growlithe -> Arcanine
            60: 62, 61: 62, 62: 62, // Poliwag -> Poliwrath
            63: 65, 64: 65, 65: 65, // Abra -> Alakazam
            66: 68, 67: 68, 68: 68, // Machop -> Machamp
            69: 71, 70: 71, 71: 71, // Bellsprout -> Victreebel
            72: 73, 73: 73,         // Tentacool -> Tentacruel
            74: 76, 75: 76, 76: 76, // Geodude -> Golem
            77: 78, 78: 78,         // Ponyta -> Rapidash
            79: 80, 80: 80,         // Slowpoke -> Slowbro
            81: 82, 82: 82,         // Magnemite -> Magneton
            83: 83,                 // Farfetch'd (No Evo)
            84: 85, 85: 85,         // Doduo -> Dodrio
            86: 87, 87: 87,         // Seel -> Dewgong
            88: 89, 89: 89,         // Grimer -> Muk
            90: 91, 91: 91,         // Shellder -> Cloyster
            92: 94, 93: 94, 94: 94, // Gastly -> Gengar
            95: 95,                 // Onix (No Evo in Gen 1)
            96: 97, 97: 97,         // Drowzee -> Hypno
            98: 99, 99: 99,         // Krabby -> Kingler
            100: 101, 101: 101,     // Voltorb -> Electrode
            102: 103, 103: 103,     // Exeggcute -> Exeggutor
            104: 105, 105: 105,     // Cubone -> Marowak
            106: 106,               // Hitmonlee
            107: 107,               // Hitmonchan
            108: 108,               // Lickitung
            109: 110, 110: 110,     // Koffing -> Weezing
            111: 112, 112: 112,     // Rhyhorn -> Rhydon
            113: 113,               // Chansey
            114: 114,               // Tangela
            115: 115,               // Kangaskhan
            116: 117, 117: 117,     // Horsea -> Seadra
            118: 119, 119: 119,     // Goldeen -> Seaking
            120: 121, 121: 121,     // Staryu -> Starmie
            122: 122,               // Mr. Mime
            123: 123,               // Scyther
            124: 124,               // Jynx
            125: 125,               // Electabuzz
            126: 126,               // Magmar
            127: 127,               // Pinsir
            128: 128,               // Tauros
            129: 130, 130: 130,     // Magikarp -> Gyarados
            131: 131,               // Lapras
            132: 132,               // Ditto
            // Eevee Handling (Randomize Eeveelution)
            133: 134, 134: 134, 135: 135, 136: 136, 
            137: 137,               // Porygon
            138: 139, 139: 139,     // Omanyte -> Omastar
            140: 141, 141: 141,     // Kabuto -> Kabutops
            142: 142,               // Aerodactyl
            143: 143,               // Snorlax
            144: 144, 145: 145, 146: 146, // Birds
            147: 149, 148: 149, 149: 149  // Dratini -> Dragonite
        };

        return FINAL_EVO_MAP[dexNum] || dexNum;
    }

    startStage() {
        this.isActive = true;
        const tier = this.getTier();
        const relativeStage = this.getRelativeStage();

        // --- DIFFICULTY SCALING ---
        // Tier 1 Base Level = 25.
        // Tier 2 Base Level = 50.
        // Tier 3 Base Level = 75.
        const tierBaseLevel = 25 * tier; 
        
        // Add levels based on progress (approx +0.3 level per stage)
        const stageBonus = Math.floor(relativeStage / 3);
        
        const finalLevel = tierBaseLevel + stageBonus;

        // Shiny Chance: 5% normally, 100% if it's a Legend or Tier 5+
        const isLegend = (relativeStage >= 144 && relativeStage <= 146) || relativeStage >= 150;
        const isShiny = (tier >= 5 || Math.random() < 0.05);

        const config = {
            id: this.getBossID(),
            level: finalLevel,
            isShiny: isShiny,
            stage: `${this.getRomanTier()} - ${relativeStage}`
        };

        // If Eevee (133), pick random Eeveelution
        if (config.id === 134) {
            const eevees = [134, 135, 136]; // Vaporeon, Jolteon, Flareon
            config.id = eevees[Math.floor(Math.random() * 3)];
        }

        console.log(`Starting Arena Tier ${tier} Stage ${relativeStage} vs ID ${config.id}`);

        // Launch Battle
        battleSystem.startBattle(false, 0, true, config);
    }

    winStage() {
        this.stage++;
        this.isActive = false;
        
        // Optional: Save game automatically after every boss?
        if (typeof saveGame === 'function') saveGame();

        // 50% chance to immediately continue to next stage logic could go here
        // but typically we wait for player input
    }
}
