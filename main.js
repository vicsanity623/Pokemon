// Global Instances
const player = new Player();
const world = new World(Date.now());
const canvas = document.getElementById('gameCanvas');
const renderer = new Renderer(canvas, world, player);
const battleSystem = new BattleSystem(player);
const questSystem = new QuestSystem(player);
const clock = new GameClock();

// Intro Story
const introText = [
    "Year 20XX...",
    "The world has fallen.",
    "You wake up alone.",
    "Take your Pokeballs.",
    "Survive."
];
let introIndex = 0;

function runIntro() {
    if (introIndex < introText.length) {
        showDialog(introText[introIndex], 0);
        introIndex++;
        setTimeout(runIntro, 2500);
    } else {
        hideDialog();
        showDialog("Use D-Pad to move. Tap A to interact.", 3000);
        questSystem.generate();
    }
}

// Main Loop
let lastTime = 0;
function gameLoop(timestamp) {
    if (!battleSystem.isActive) {
        // Movement Logic
        let moved = false;
        let dx = 0;
        let dy = 0;

        // Throttle movement speed
        if (timestamp - lastTime > 150) {
            if (input.isDown('ArrowUp')) { dy = -1; player.dir = 'up'; moved = true; }
            else if (input.isDown('ArrowDown')) { dy = 1; player.dir = 'down'; moved = true; }
            else if (input.isDown('ArrowLeft')) { dx = -1; player.dir = 'left'; moved = true; }
            else if (input.isDown('ArrowRight')) { dx = 1; player.dir = 'right'; moved = true; }

            if (moved) {
                // Collision
                let tile = world.getTile(player.x + dx, player.y + dy);
                if (tile !== 'water') {
                    player.x += dx;
                    player.y += dy;
                    player.steps++;
                    questSystem.update('walk');

                    // Encounter Check
                    if (tile === 'grass_tall' && Math.random() < 0.15) {
                        battleSystem.startBattle();
                    }
                    // Rival Check (Every 20 survior levels)
                    if (player.pLevel % 20 === 0 && player.pLevel > 1) {
                        // Simple check to ensure we don't fight rival repeatedly on same level
                        // In full game, use a flag.
                    }
                }
                lastTime = timestamp;
            }
        }

        clock.update(player);
        renderer.draw();
    }
    requestAnimationFrame(gameLoop);
}

// Init
window.onload = () => {
    // Give starter items
    player.team.push({
        name: 'PIKACHU',
        level: 5,
        maxHp: 40,
        hp: 40,
        exp: 0,
        type: 'electric',
        backSprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/25.png'
    });

    runIntro();
    requestAnimationFrame(gameLoop);
};