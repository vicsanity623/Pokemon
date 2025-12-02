const TILE_SIZE = 48; // Scaled up for mobile visibility
const VIEW_W = 11; // Tiles wide
const VIEW_H = 15; // Tiles high

class World {
    constructor(seed) {
        this.rng = new SeededRandom(seed);
        this.structures = {}; // Store locations of stops
    }

    getTile(x, y) {
        // Procedural Generation Logic
        let val = this.rng.at(x, y);

        // Structure Check (Every 500 steps roughly, mapped to coords)
        // We use a simplified grid check for structures
        if (Math.abs(x) % 50 === 0 && Math.abs(y) % 50 === 0) return 'center';
        if (Math.abs(x) % 53 === 0 && Math.abs(y) % 53 === 0) return 'store';

        if (val > 0.65) return 'water';
        if (val > 0.45) return 'grass_tall';
        if (val > 0.4) return 'flowers';
        return 'grass';
    }

    getColor(type) {
        switch (type) {
            case 'water': return '#3498db';
            case 'grass_tall': return '#27ae60'; // Darker
            case 'grass': return '#2ecc71';
            case 'flowers': return '#e74c3c'; // Actually grass with flowers, simplistic render
            case 'center': return '#c0392b'; // Red roof
            case 'store': return '#2980b9'; // Blue roof
            default: return '#000';
        }
    }
}

class Player {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.steps = 0;
        this.moving = false;
        this.dir = 'down'; // down, up, left, right

        // Stats
        this.pLevel = 1; // Survival Level
        this.team = []; // Pokemon objects
        this.bag = { 'Potion': 5, 'Pokeball': 10 };
    }

    surviveLevelUp() {
        this.pLevel++;
        showDialog(`You survived another day. Survivor Level: ${this.pLevel}`, 4000);
        document.getElementById('meta-level').innerText = this.pLevel;
    }

    addPokemon(pokeData) {
        if (this.team.length < 6) this.team.push(pokeData);
        else showDialog("Team full! Sent to PC (void).");
    }
}

class Renderer {
    constructor(canvas, world, player) {
        this.ctx = canvas.getContext('2d');
        this.canvas = canvas;
        this.world = world;
        this.player = player;
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Load Player Sprite (Ash style)
        this.sprite = new Image();
        this.sprite.src = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iv/heartgold-soulsilver/25.png"; // Placeholder: Pikachu as player avatar for simplicity in 6 files
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx.imageSmoothingEnabled = false;
    }

    draw() {
        const cx = Math.ceil(this.canvas.width / TILE_SIZE);
        const cy = Math.ceil(this.canvas.height / TILE_SIZE);
        const startX = this.player.x - Math.floor(cx / 2);
        const startY = this.player.y - Math.floor(cy / 2);

        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Map
        for (let y = 0; y < cy; y++) {
            for (let x = 0; x < cx; x++) {
                let worldX = startX + x;
                let worldY = startY + y;
                let tile = this.world.getTile(worldX, worldY);

                this.ctx.fillStyle = this.world.getColor(tile);
                this.ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

                // Texture detail
                if (tile === 'grass_tall') {
                    this.ctx.fillStyle = 'rgba(0,0,0,0.1)';
                    this.ctx.fillRect(x * TILE_SIZE + 5, y * TILE_SIZE + 5, TILE_SIZE - 10, TILE_SIZE - 10);
                }
            }
        }

        // Draw Player
        const px = Math.floor(cx / 2) * TILE_SIZE;
        const py = Math.floor(cy / 2) * TILE_SIZE;

        // Shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 5, 15, 5, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Sprite
        this.ctx.drawImage(this.sprite, px, py - 10, TILE_SIZE, TILE_SIZE);

        // Tall Grass Overlay (Occlusion)
        let currentTile = this.world.getTile(this.player.x, this.player.y);
        if (currentTile === 'grass_tall') {
            this.ctx.fillStyle = 'rgba(39, 174, 96, 0.8)'; // Semi-transparent grass color
            this.ctx.fillRect(px, py + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE / 2);

            // Random grass blades
            this.ctx.fillStyle = '#1e8449';
            this.ctx.fillRect(px + 5, py + TILE_SIZE / 2 + 5, 4, 10);
            this.ctx.fillRect(px + 25, py + TILE_SIZE / 2 + 2, 4, 12);
        }
    }
}