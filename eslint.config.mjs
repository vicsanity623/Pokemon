import globals from "globals";
import pluginJs from "@eslint/js";

export default [
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.es2021,
                // Project Globals
                player: "readonly",
                world: "readonly",
                battleSystem: "readonly",
                questSystem: "readonly",
                clock: "readonly",
                mergeSystem: "readonly",
                assetLoader: "readonly",
                input: "readonly",
                renderer: "readonly",
                mainMusic: "readonly",
                battleMusic: "readonly",
                musicVolume: "readonly",
                // Functions
                showDialog: "readonly",
                hideDialog: "readonly",
                playSFX: "readonly",
                saveGame: "readonly",
                loadGame: "readonly",
                updateHUD: "readonly",
                generatePokemonStats: "readonly",
                // Classes
                Player: "readonly",
                World: "readonly",
                Renderer: "readonly",
                BattleSystem: "readonly",
                QuestSystem: "readonly",
                GameClock: "readonly",
                CombineSystem: "readonly",
                AssetLoader: "readonly",
                SeededRandom: "readonly",
                NPC: "readonly",
                // Data
                ITEMS: "readonly",
                EVOLUTIONS: "readonly",
                TYPES: "readonly",
                TYPE_CHART: "readonly",
                // UI Functions (called from HTML)
                toggleMainMenu: "readonly",
                openPokedex: "readonly",
                openPC: "readonly",
                togglePlayerBag: "readonly",
                openOptions: "readonly",
                closeOptions: "readonly",
                setGameSpeed: "readonly",
                setVolume: "readonly",
                closePokedex: "readonly",
                closePC: "readonly",
                prevBox: "readonly",
                nextBox: "readonly",
                addToParty: "readonly",
                moveToPC: "readonly",
                cancelPCSelection: "readonly",
                showBagTab: "readonly",
                closePlayerBag: "readonly",
                swapPokemon: "readonly",
                showPokemonStats: "readonly",
                closePokemonStats: "readonly",
                closePokemonList: "readonly",
                useBagItem: "readonly",
                showPokedexTab: "readonly",
                // Cross-file dependencies
                getMove: "readonly",
                getTypeEffectiveness: "readonly",
                currentBox: "readonly",
                renderPC: "readonly",
                isTrainer: "readonly",
                VIEW_W: "readonly",
                VIEW_H: "readonly"
            }
        },
        rules: {
            "no-unused-vars": "off",
            "no-undef": "warn",
            "no-console": "off"
        }
    },
    pluginJs.configs.recommended,
    {
        rules: {
            "no-unused-vars": "off",
            "no-undef": "warn"
        }
    }
];
