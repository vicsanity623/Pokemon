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
        btn.style.bottom = '200px'; // Above Attack Button
        btn.style.right = '20px';
        btn.style.backgroundColor = '#2980b9'; // Blue
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
        modal.className = 'full-screen-modal'; // Reuse CSS
        modal.style.flexDirection = 'column';
        modal.style.zIndex = '10000';
        
        modal.innerHTML = `
            <div style="background:#111; border:4px solid #fff; padding:10px; border-radius:10px; display:flex; flex-direction:column; align-items:center;">
                <h2 style="color:gold; margin:0 0 10px 0;">WORLD MAP</h2>
                <canvas id="map-canvas" width="300" height="300" style="border:2px solid #555; background:#000; image-rendering:pixelated;"></canvas>
                <div style="font-size:10px; color:#aaa; margin-top:5px;">
                    ⬜ Player | 🟥 Enemy | 🟩 Resource | 🏠 Building | 🟡 NPC
                </div>
                <button class="back-btn" style="margin-top:10px; width:100%;" onpointerdown="mapSystem.closeMap()">CLOSE</button>
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
        const canvas = document.getElementById('map-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        // Map Settings
        const range = 50; // Show 50 tiles in each direction (100x100 area)
        const scale = 300 / (range * 2); // Scale to fit canvas

        const startX = Math.round(this.player.x) - range;
        const startY = Math.round(this.player.y) - range;

        // 1. Draw Terrain
        for (let y = 0; y < range * 2; y++) {
            for (let x = 0; x < range * 2; x++) {
                const wx = startX + x;
                const wy = startY + y;
                const tile = this.world.getTile(wx, wy);
                
                ctx.fillStyle = this.world.getColor(tile);
                ctx.fillRect(x * scale, y * scale, scale, scale);
            }
        }

        // 2. Draw Resources (Trees/Rocks)
        if (typeof resourceSystem !== 'undefined') {
            for (let key in resourceSystem.nodes) {
                const [rx, ry] = key.split(',').map(Number);
                if (rx >= startX && rx < startX + range*2 && ry >= startY && ry < startY + range*2) {
                    ctx.fillStyle = '#27ae60'; // Green dots for resources
                    const drawX = (rx - startX) * scale;
                    const drawY = (ry - startY) * scale;
                    ctx.fillRect(drawX, drawY, scale, scale);
                }
            }
        }

        // 3. Draw Buildings
        this.world.buildings.forEach(b => {
            if (b.x >= startX && b.x < startX + range*2 && b.y >= startY && b.y < startY + range*2) {
                const drawX = (b.x - startX) * scale;
                const drawY = (b.y - startY) * scale;
                
                // House = Blue, Center = Red, Arena = Gold
                ctx.fillStyle = b.type === 'home' ? '#3498db' : (b.type === 'pokecenter' ? '#e74c3c' : '#f1c40f');
                
                // Draw bigger square for buildings
                ctx.fillRect(drawX - scale, drawY - scale, scale*3, scale*3);
                
                // Label
                ctx.fillStyle = '#fff';
                ctx.font = '8px Arial';
                ctx.textAlign = 'center';
                let label = b.type === 'home' ? 'HOME' : (b.type === 'pokecenter' ? 'CENTER' : 'ARENA');
                ctx.fillText(label, drawX + scale/2, drawY - scale);
            }
        });

        // 4. Draw NPCs
        this.world.npcs.forEach(n => {
            if (n.x >= startX && n.x < startX + range*2 && n.y >= startY && n.y < startY + range*2) {
                const drawX = (n.x - startX) * scale;
                const drawY = (n.y - startY) * scale;
                ctx.fillStyle = '#f1c40f'; // Yellow
                ctx.beginPath();
                ctx.arc(drawX + scale/2, drawY + scale/2, scale, 0, Math.PI*2);
                ctx.fill();
            }
        });

        // 5. Draw Enemies
        if (typeof enemySystem !== 'undefined') {
            enemySystem.enemies.forEach(e => {
                if (e.x >= startX && e.x < startX + range*2 && e.y >= startY && e.y < startY + range*2) {
                    const drawX = (e.x - startX) * scale;
                    const drawY = (e.y - startY) * scale;
                    ctx.fillStyle = '#c0392b'; // Red
                    ctx.fillRect(drawX, drawY, scale, scale);
                }
            });
        }

        // 6. Draw Player (Center)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(150, 150, scale * 1.5, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
    }
}