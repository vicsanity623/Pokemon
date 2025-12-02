const TILE_SIZE = 80; // Scaled up for mobile visibility
const VIEW_W = 11; // Tiles wide
const VIEW_H = 15; // Tiles high

class World {
    constructor(seed) {
        this.rng = new SeededRandom(seed);
        this.items = {}; // Store items by "x,y" key
        this.initItems();
    }

    initItems() {
        // Randomly scatter items
        for (let i = 0; i < 50; i++) {
            let x = Math.floor(Math.random() * 200) - 100;
            let y = Math.floor(Math.random() * 200) - 100;
            let type = Math.random() > 0.5 ? 'Potion' : 'Pokeball';
            this.items[`${x},${y}`] = type;
        }
    }

    getItem(x, y) {
        return this.items[`${x},${y}`];
    }

    removeItem(x, y) {
        delete this.items[`${x},${y}`];
    }

    getTile(x, y) {
        // Biome Noise (Low Frequency)
        // Scale coordinates down for larger features
        let biomeVal = this.rng.noise(x * 0.05, y * 0.05);

        // Grass Noise (Very Low Frequency for Large Clusters)
        // We want clusters of 40+ tiles, so very smooth noise
        let grassVal = this.rng.noise(x * 0.1, y * 0.1);

        // Structures
        if (Math.abs(Math.floor(x)) % 50 === 0 && Math.abs(Math.floor(y)) % 50 === 0) return 'center';
        if (Math.abs(Math.floor(x)) % 53 === 0 && Math.abs(Math.floor(y)) % 53 === 0) return 'store';

        // Biomes based on smooth noise
        if (biomeVal < 0.3) return 'water';

        // Grass logic: Large clusters
        if (grassVal > 0.6) return 'grass_tall';

        if (biomeVal > 0.8) return 'flowers'; // Rare flower fields

        return 'grass';
    }

    getColor(type) {
        switch (type) {
            case 'water': return '#3498db';
            case 'grass_tall': return '#27ae60';
            case 'grass': return '#2ecc71';
            case 'flowers': return '#e74c3c';
            case 'center': return '#c0392b';
            case 'store': return '#2980b9'; // Blue roof
            default: return '#000';
        }
    }

    getItemColor(type) {
        return type === 'Potion' ? '#9b59b6' : '#e74c3c';
    }
}

class Player {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.speed = 0.04; // Fixed slow speed (was 0.08)
        this.money = 0;
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
        this.sprite.src = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iv/heartgold-soulsilver/25.png";

        this.particles = [];
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx.imageSmoothingEnabled = false;
    }

    addParticle(x, y) {
        this.particles.push({
            x: x,
            y: y,
            life: 0.8, // Shorter life
            vx: (Math.random() - 0.5) * 0.2, // Much slower spread
            vy: (Math.random() - 0.5) * 0.2
        });
    }

    drawParticles(offsetX, offsetY) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.life -= 0.02; // Fade slower
            p.x += p.vx;
            p.y += p.vy;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            let drawX = (p.x - this.player.x) * TILE_SIZE + this.canvas.width / 2 + offsetX;
            let drawY = (p.y - this.player.y) * TILE_SIZE + this.canvas.height / 2 + offsetY;

            this.ctx.fillStyle = `rgba(200, 200, 200, ${p.life})`;
            this.ctx.fillRect(drawX, drawY, 3, 3); // Smaller particles
        }
    }

    draw() {
        const cx = Math.ceil(this.canvas.width / TILE_SIZE);
        const cy = Math.ceil(this.canvas.height / TILE_SIZE);
        const startX = this.player.x - Math.floor(cx / 2);
        const startY = this.player.y - Math.floor(cy / 2);

        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Map
        // We need to render enough tiles to cover the screen based on fractional position
        const startTileX = Math.floor(this.player.x) - Math.floor(cx / 2) - 1;
        const startTileY = Math.floor(this.player.y) - Math.floor(cy / 2) - 1;

        // Offset for smooth scrolling
        const offsetX = (this.player.x - Math.floor(this.player.x)) * TILE_SIZE;
        const offsetY = (this.player.y - Math.floor(this.player.y)) * TILE_SIZE;

        // Draw a bit more to cover edges
        for (let y = 0; y < cy + 2; y++) {
            for (let x = 0; x < cx + 2; x++) {
                let worldX = startTileX + x;
                let worldY = startTileY + y;
                let tile = this.world.getTile(worldX, worldY);

                // Calculate screen position relative to center
                // We want player to be exactly in center
                // ScreenX = (worldX - playerX) * TILE_SIZE + CanvasCenter

                let drawX = (worldX - this.player.x) * TILE_SIZE + this.canvas.width / 2 - TILE_SIZE / 2;
                let drawY = (worldY - this.player.y) * TILE_SIZE + this.canvas.height / 2 - TILE_SIZE / 2;

                this.ctx.fillStyle = this.world.getColor(tile);
                this.ctx.fillRect(Math.floor(drawX), Math.floor(drawY), TILE_SIZE + 1, TILE_SIZE + 1); // +1 to fix gaps

                // Texture detail
                if (tile === 'grass_tall') {
                    this.ctx.fillStyle = 'rgba(0,0,0,0.1)';
                    this.ctx.fillRect(Math.floor(drawX) + 5, Math.floor(drawY) + 5, TILE_SIZE - 10, TILE_SIZE - 10);
                }

                // Draw Item
                let item = this.world.getItem(worldX, worldY);
                if (item) {
                    this.ctx.fillStyle = this.world.getItemColor(item);
                    this.ctx.beginPath();
                    this.ctx.arc(Math.floor(drawX) + TILE_SIZE / 2, Math.floor(drawY) + TILE_SIZE / 2, 10, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.strokeStyle = '#fff';
                    this.ctx.lineWidth = 2;
                    this.ctx.stroke();
                }
            }
        }

        // Draw Player (Always Center)
        const px = this.canvas.width / 2 - TILE_SIZE / 2;
        const py = this.canvas.height / 2 - TILE_SIZE / 2;

        // Shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 5, 15, 5, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Dust Particles (Spawn if moving)
        // We spawn them at player feet in world coordinates
        // Footstep effect: Lower frequency
        if (this.player.moving) {
            if (Math.random() < 0.1) { // Reduced from 0.3
                this.addParticle(this.player.x + 0.5, this.player.y + 0.9);
            }
        }
        this.drawParticles(0, 0);

        // Sprite (Flip if facing RIGHT, since raw sprite faces LEFT)
        this.ctx.save();
        if (this.player.dir === 'right') {
            this.ctx.translate(px + TILE_SIZE, py - 10);
            this.ctx.scale(-1, 1);
            this.ctx.drawImage(this.sprite, 0, 0, TILE_SIZE, TILE_SIZE);
        } else {
            this.ctx.drawImage(this.sprite, px, py - 10, TILE_SIZE, TILE_SIZE);
        }
        this.ctx.restore();

        // Tall Grass Overlay (Occlusion)
        let currentTile = this.world.getTile(Math.round(this.player.x), Math.round(this.player.y));
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