class MapSystem {
    constructor(player, world) {
        this.player = player;
        this.world = world;
        this.isOpen = false;

        this.createMapButton();
    }

    createMapButton() {
        const btn = document.createElement('div');
        btn.id = 'btn-map';
        btn.className = 'action-btn';
        btn.style.bottom = '200px';
        btn.style.right = '20px';
        btn.style.backgroundColor = '#2980b9';
        btn.innerText = '🗺️';
        btn.onpointerdown = (e) => {
            e.preventDefault(); e.stopPropagation();
            this.toggleMap();
        };
        document.getElementById('action-btns').appendChild(btn);
    }

    toggleMap() {
        if (this.isOpen) {
            this.closeMap();
        } else {
            this.openMap();
        }
    }

    openMap() {
        if (typeof isPaused !== 'undefined') isPaused = true;
        this.isOpen = true;

        const modal = document.createElement('div');
        modal.id = 'map-ui';
        modal.className = 'full-screen-modal';
        modal.style.flexDirection = 'column';
        modal.style.zIndex = '10000';
        modal.style.background = 'rgba(0,0,0,0.95)'; // Darker background

        // Calculate Dynamic Size
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;

        // Reserve space for Header (50px) and Footer (100px)
        const canvasW = screenW - 20;
        const canvasH = screenH - 150;

        modal.innerHTML = `
            <div style="width: 100%; height: 100%; display:flex; flex-direction:column; align-items:center; justify-content: center;">
                <h2 style="color:gold; margin-bottom: 10px; font-size: 20px;">WORLD MAP</h2>
                
                <canvas id="map-canvas" width="${canvasW}" height="${canvasH}" 
                    style="border:2px solid #555; background:#000; image-rendering:pixelated; max-width:100%; box-shadow: 0 0 20px #000;">
                </canvas>
                
                <div style="font-size:10px; color:#aaa; margin-top:10px; display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
                    <span>⬜ Player</span> <span>🟥 Enemy</span> <span>🟩 Resource</span> <span>🏠 Building</span> <span>🟡 NPC</span>
                </div>
                
                <button class="back-btn" style="margin-top:15px; width:80%; max-width: 300px; height: 50px; font-size: 16px;" onpointerdown="mapSystem.closeMap()">CLOSE</button>
            </div>
        `;
        document.body.appendChild(modal);

        this.renderMap();
    }

    closeMap() {
        const el = document.getElementById('map-ui');
        if (el) el.remove();
        this.isOpen = false;
        if (typeof isPaused !== 'undefined') isPaused = false;
    }

    renderMap() {
        const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('map-canvas'));
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Map Settings
        const range = 50; // View radius (100x100 tiles total)

        // Calculate Scale to Fit Screen
        // We use Math.min to ensure the tiles stay square (aspect ratio) 
        // and fit within the smallest dimension of the screen
        const scaleX = canvas.width / (range * 2);
        const scaleY = canvas.height / (range * 2);
        const scale = Math.min(scaleX, scaleY);

        // Center the map in the canvas (if screen is rectangular)
        const drawOffsetX = (canvas.width - (range * 2 * scale)) / 2;
        const drawOffsetY = (canvas.height - (range * 2 * scale)) / 2;

        const startX = Math.round(this.player.x) - range;
        const startY = Math.round(this.player.y) - range;

        // 1. Draw Terrain
        for (let y = 0; y < range * 2; y++) {
            for (let x = 0; x < range * 2; x++) {
                const wx = startX + x;
                const wy = startY + y;
                const tile = this.world.getTile(wx, wy);

                ctx.fillStyle = this.world.getColor(tile);
                // Apply Offset + Scale
                ctx.fillRect(drawOffsetX + x * scale, drawOffsetY + y * scale, scale, scale);
                // Optional: Draw tiny grid lines if scale is large enough
                if (scale > 4) {
                    ctx.fillStyle = "rgba(0,0,0,0.1)";
                    ctx.fillRect(drawOffsetX + x * scale, drawOffsetY + y * scale, scale, scale); // Dim logic handled by getColor usually
                }
            }
        }

        // Helper to convert World Coord to Canvas Coord
        const getCanvasX = (wx) => drawOffsetX + (wx - startX) * scale;
        const getCanvasY = (wy) => drawOffsetY + (wy - startY) * scale;
        const isValid = (wx, wy) => wx >= startX && wx < startX + range * 2 && wy >= startY && wy < startY + range * 2;

        // 2. Draw Resources
        if (typeof resourceSystem !== 'undefined') {
            for (let key in resourceSystem.nodes) {
                const [rx, ry] = key.split(',').map(Number);
                if (isValid(rx, ry)) {
                    ctx.fillStyle = '#27ae60'; // Green
                    ctx.fillRect(getCanvasX(rx), getCanvasY(ry), scale, scale);
                }
            }
        }

        // 3. Draw Buildings
        this.world.buildings.forEach(b => {
            if (isValid(b.x, b.y)) {
                const cx = getCanvasX(b.x);
                const cy = getCanvasY(b.y);

                ctx.fillStyle = b.type === 'home' ? '#3498db' : (b.type === 'pokecenter' ? '#e74c3c' : '#f1c40f');

                // Draw bigger square (3x3 tiles relative size)
                const size = scale * 3;
                ctx.fillRect(cx - scale, cy - scale, size, size);

                // Icon
                ctx.fillStyle = '#fff';
                ctx.font = `${Math.max(10, scale)}px Arial`;
                ctx.textAlign = 'center';
                let icon = b.type === 'home' ? '🏠' : (b.type === 'pokecenter' ? '🏥' : '🏆');
                if (b.type === 'workbench') icon = '⚒️';
                ctx.fillText(icon, cx + scale / 2, cy + scale);
            }
        });

        // 4. Draw NPCs
        this.world.npcs.forEach(n => {
            if (isValid(n.x, n.y)) {
                ctx.fillStyle = '#f1c40f';
                ctx.beginPath();
                ctx.arc(getCanvasX(n.x) + scale / 2, getCanvasY(n.y) + scale / 2, scale, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // 5. Draw Enemies
        if (typeof enemySystem !== 'undefined') {
            enemySystem.enemies.forEach(e => {
                if (isValid(e.x, e.y)) {
                    ctx.fillStyle = '#c0392b';
                    ctx.fillRect(getCanvasX(e.x), getCanvasY(e.y), scale, scale);
                }
            });
        }

        // 6. Draw Player (Center)
        // Since the map is centered on player, they are always at:
        const px = drawOffsetX + (range * scale);
        const py = drawOffsetY + (range * scale);

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(px + scale / 2, py + scale / 2, scale * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}