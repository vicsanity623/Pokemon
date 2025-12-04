class AssetLoader {
    constructor() {
        this.assets = {
            audio: [
                'music.mp3',
                'battle.mp3',
                'pickup.mp3',
                'attack1.mp3',
                'attack2.mp3',
                'attack3.mp3'
            ],
            images: [
                'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png',
                'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png',
                'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/potion.png'
            ]
        };
        this.cache = {
            audio: {},
            images: {}
        };
        this.totalAssets = this.assets.audio.length + this.assets.images.length;
        this.loadedCount = 0;
        this.loadingScreen = null;
        this.progressBar = null;
        this.progressText = null;
    }

    initUI() {
        // Create Loading Screen Overlay
        this.loadingScreen = document.createElement('div');
        this.loadingScreen.id = 'loading-screen';
        this.loadingScreen.style.position = 'fixed';
        this.loadingScreen.style.top = '0';
        this.loadingScreen.style.left = '0';
        this.loadingScreen.style.width = '100%';
        this.loadingScreen.style.height = '100%';
        this.loadingScreen.style.backgroundColor = '#000';
        this.loadingScreen.style.zIndex = '9999';
        this.loadingScreen.style.display = 'flex';
        this.loadingScreen.style.flexDirection = 'column';
        this.loadingScreen.style.justifyContent = 'center';
        this.loadingScreen.style.alignItems = 'center';
        this.loadingScreen.style.color = '#fff';
        this.loadingScreen.style.fontFamily =
            "'Courier New', Courier, monospace";

        // Title
        const title = document.createElement('h1');
        title.innerText = 'POKEMON';
        title.style.marginBottom = '20px';
        title.style.textShadow = '2px 2px #333';
        this.loadingScreen.appendChild(title);

        // Progress Bar Container
        const barContainer = document.createElement('div');
        barContainer.style.width = '300px';
        barContainer.style.height = '20px';
        barContainer.style.border = '2px solid #fff';
        barContainer.style.borderRadius = '10px';
        barContainer.style.overflow = 'hidden';
        barContainer.style.marginBottom = '10px';
        this.loadingScreen.appendChild(barContainer);

        // Progress Bar Fill
        this.progressBar = document.createElement('div');
        this.progressBar.style.width = '0%';
        this.progressBar.style.height = '100%';
        this.progressBar.style.backgroundColor = '#2ecc71';
        this.progressBar.style.transition = 'width 0.2s';
        barContainer.appendChild(this.progressBar);

        // Text
        this.progressText = document.createElement('div');
        this.progressText.innerText = 'Loading assets... 0%';
        this.loadingScreen.appendChild(this.progressText);

        document.body.appendChild(this.loadingScreen);
    }

    updateProgress() {
        this.loadedCount++;
        const pct = Math.floor((this.loadedCount / this.totalAssets) * 100);
        if (this.progressBar) this.progressBar.style.width = `${pct}%`;
        if (this.progressText)
            this.progressText.innerText = `Loading assets... ${pct}%`;
    }

    async loadAll() {
        this.initUI();

        // Load Player Team Sprites (if save exists)
        this.loadSaveDataSprites();

        const promises = [];

        // Load Audio
        this.assets.audio.forEach((src) => {
            promises.push(
                new Promise((resolve) => {
                    const audio = new Audio();
                    audio.oncanplaythrough = () => {
                        this.updateProgress();
                        resolve();
                    };
                    audio.onerror = () => {
                        console.warn(`Failed to load audio: ${src}`);
                        this.updateProgress(); // Count it anyway to avoid hanging
                        resolve();
                    };
                    audio.src = src;
                    audio.load();
                    this.cache.audio[src] = audio;
                })
            );
        });

        // Load Images
        this.assets.images.forEach((src) => {
            promises.push(
                new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        this.updateProgress();
                        resolve();
                    };
                    img.onerror = () => {
                        console.warn(`Failed to load image: ${src}`);
                        this.updateProgress();
                        resolve();
                    };
                    img.src = src;
                    this.cache.images[src] = img;
                })
            );
        });

        await Promise.all(promises);

        // Small delay for UX
        await new Promise((r) => setTimeout(r, 500));

        this.hide();
    }

    loadSaveDataSprites() {
        try {
            const raw = localStorage.getItem('poke_save');
            if (raw) {
                const data = JSON.parse(raw);
                if (data.player && data.player.team) {
                    data.player.team.forEach((p) => {
                        if (p.sprite) this.assets.images.push(p.sprite);
                        if (p.backSprite) this.assets.images.push(p.backSprite);
                        if (p.animatedSprite)
                            this.assets.images.push(p.animatedSprite);
                    });
                    // Update total count
                    this.totalAssets =
                        this.assets.audio.length + this.assets.images.length;
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
            setTimeout(() => {
                this.loadingScreen.remove();
            }, 500);
        }
    }
}

const assetLoader = new AssetLoader();
