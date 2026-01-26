class AssetLoader {
    constructor() {
        // We use Key-Value pairs now. 
        // Key = How the code finds it (e.g. 'bounty_board')
        // Value = Where the file is (e.g. './assets/...')
        this.assets = {
            audio: [
                'music.mp3',
                'battle.mp3',
                'pickup.mp3',
                'attack1.mp3',
                'attack2.mp3',
                'attack3.mp3'
            ],
            images: {
                // REQUIRED FOR GAMEPLAY (The ones that were missing)
                'bounty_board': './assets/sprites/bounty_board.png',
                'dungeon_entrance': './assets/sprites/cave_entrance.png',

                // ITEMS (Changed to local to stop GitHub blocking you)
                'poke-ball': './assets/sprites/items/poke-ball.png',
                'great-ball': './assets/sprites/items/great-ball.png',
                'ultra-ball': './assets/sprites/items/ultra-ball.png',
                'master-ball': './assets/sprites/items/master-ball.png',
                'potion': './assets/sprites/items/potion.png',
                'super-potion': './assets/sprites/items/super-potion.png',
                'hyper-potion': './assets/sprites/items/hyper-potion.png',
                'max-potion': './assets/sprites/items/max-potion.png',
            }
        };

        // This is where the loaded HTMLImageElements live
        this.imgs = {};

        this.cache = {
            audio: {}
        };

        // Calculate total: Audio array length + Image Object keys length
        this.totalAssets = this.assets.audio.length + Object.keys(this.assets.images).length;
        this.loadedCount = 0;
        this.loadingScreen = null;
        this.progressBar = null;
        this.progressText = null;
    }

    initUI() {
        this.loadingScreen = document.createElement('div');
        this.loadingScreen.id = 'loading-screen';
        Object.assign(this.loadingScreen.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: '#000', zIndex: '9999', display: 'flex',
            flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            color: '#fff', fontFamily: "'Courier New', Courier, monospace"
        });

        const title = document.createElement('h1');
        title.innerText = 'POKEMON';
        title.style.marginBottom = '20px';
        this.loadingScreen.appendChild(title);

        const barContainer = document.createElement('div');
        Object.assign(barContainer.style, {
            width: '300px', height: '20px', border: '2px solid #fff',
            borderRadius: '10px', overflow: 'hidden', marginBottom: '10px'
        });
        this.loadingScreen.appendChild(barContainer);

        this.progressBar = document.createElement('div');
        Object.assign(this.progressBar.style, {
            width: '0%', height: '100%', backgroundColor: '#2ecc71', transition: 'width 0.2s'
        });
        barContainer.appendChild(this.progressBar);

        this.progressText = document.createElement('div');
        this.progressText.innerText = 'Loading assets... 0%';
        this.loadingScreen.appendChild(this.progressText);

        document.body.appendChild(this.loadingScreen);
    }

    updateProgress() {
        this.loadedCount++;
        const pct = Math.floor((this.loadedCount / this.totalAssets) * 100);
        if (this.progressBar) this.progressBar.style.width = `${pct}%`;
        if (this.progressText) this.progressText.innerText = `Loading assets... ${pct}%`;
    }

    async loadAll() {
        this.initUI();
        this.loadSaveDataSprites(); // Pre-load saved team sprites

        const promises = [];

        // 1. Load Audio
        this.assets.audio.forEach((src) => {
            promises.push(new Promise((resolve) => {
                const audio = new Audio();
                audio.oncanplaythrough = () => { this.updateProgress(); resolve(); };
                audio.onerror = () => { console.warn(`Audio missing: ${src}`); this.updateProgress(); resolve(); };
                audio.src = src;
                audio.load();
                this.cache.audio[src] = audio;
            }));
        });

        // 2. Load Images (Updated Logic for Object keys)
        Object.entries(this.assets.images).forEach(([key, src]) => {
            promises.push(new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.imgs[key] = img; // Store accessible by Name
                    this.updateProgress();
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Image missing: ${src} (Key: ${key})`);
                    // Create a placeholder pink square so game doesn't crash
                    this.imgs[key] = new Image();
                    this.imgs[key].src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
                    this.updateProgress();
                    resolve();
                };
                img.src = src;
            }));
        });

        await Promise.all(promises);
        await new Promise((r) => setTimeout(r, 500));
        this.hide();
    }

    loadSaveDataSprites() {
        // This handles extra sprites from save files (Pokemon team)
        try {
            const raw = localStorage.getItem('poke_save');
            if (raw) {
                const data = JSON.parse(raw);
                if (data.player && data.player.team) {
                    const extraImages = [];
                    data.player.team.forEach((p) => {
                        if (p.sprite) extraImages.push(p.sprite);
                        if (p.backSprite) extraImages.push(p.backSprite);
                    });

                    // Add these to total count so bar doesn't look stuck
                    this.totalAssets += extraImages.length;

                    // Load them dynamically
                    extraImages.forEach(src => {
                        const img = new Image();
                        img.onload = () => this.updateProgress();
                        img.onerror = () => this.updateProgress();
                        img.src = src;
                        // We don't need to name these, browser cache handles them
                    });
                }
            }
        } catch (e) {
            console.error('Error reading save for sprites', e);
        }
    }

    hide() {
        if (this.loadingScreen) {
            this.loadingScreen.style.opacity = '0';
            this.loadingScreen.style.transition = 'opacity 0.5s';
            setTimeout(() => { this.loadingScreen.remove(); }, 500);
        }
    }
}

const assetLoader = new AssetLoader();