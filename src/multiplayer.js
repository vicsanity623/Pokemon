class MultiplayerSystem {
    constructor(player) {
        this.player = player;
        this.peer = null;
        this.conn = null;
        this.myId = null;
        this.isConnected = false;

        // The other player's data
        this.otherPlayer = {
            active: false,
            x: 0,
            y: 0,
            dir: 'down',
            spriteUrl: 'assets/sprites/pokemon/25.png',
            lastUpdate: Date.now()
        };

        this.loadedSprite = new Image();
        this.loadedSprite.src = this.otherPlayer.spriteUrl;
    }

    // --- HOST GAME ---
    hostGame() {
        // Create a Peer connection (Auto-generates ID)
        this.peer = new Peer();

        this.peer.on('open', (id) => {
            this.myId = id;
            console.log('My ID is: ' + id);

            // Show ID to user
            prompt("Copy this ID and send it to your friend:", id);
            showDialog("Waiting for friend to join...", 5000);
        });

        // Wait for connection
        this.peer.on('connection', (conn) => {
            this.setupConnection(conn);
            showDialog("Friend connected!", 3000);
        });
    }

    // --- JOIN GAME ---
    joinGame() {
        const hostId = prompt("Enter your friend's ID:");
        if (!hostId) return;

        this.peer = new Peer();

        this.peer.on('open', () => {
            const conn = this.peer.connect(hostId);
            this.setupConnection(conn);
        });
    }

    // --- COMMON SETUP ---
    setupConnection(conn) {
        this.conn = conn;
        this.isConnected = true;

        // Receive Data
        this.conn.on('data', (data) => {
            this.handleData(data);
        });

        this.conn.on('close', () => {
            showDialog("Friend disconnected.", 3000);
            this.otherPlayer.active = false;
            this.isConnected = false;
        });
    }

    // --- UPDATE LOOP (Send Data) ---
    update() {
        if (!this.isConnected || !this.conn) return;

        // Only send if connection is open
        if (this.conn.open) {
            // Send my position to them
            this.conn.send({
                type: 'move',
                x: this.player.x,
                y: this.player.y,
                dir: this.player.dir,
                // Send current pokemon sprite (Front sprite for them to see)
                sprite: this.player.team[0] ? this.player.team[0].sprite : null
            });
        }
    }

    // --- HANDLE RECEIVED DATA ---
    handleData(data) {
        if (data.type === 'move') {
            this.otherPlayer.active = true;
            this.otherPlayer.x = data.x;
            this.otherPlayer.y = data.y;
            this.otherPlayer.dir = data.dir;
            this.otherPlayer.lastUpdate = Date.now();

            // If they changed pokemon, load new sprite
            if (data.sprite && data.sprite !== this.otherPlayer.spriteUrl) {
                this.otherPlayer.spriteUrl = data.sprite;
                this.loadedSprite.src = data.sprite;
            }
        }
    }

    // --- RENDER OTHER PLAYER ---
    draw(ctx, canvas, player) {
        if (!this.isConnected || !this.otherPlayer.active) return;

        // Safety: If no data for 5 seconds, hide them
        if (Date.now() - this.otherPlayer.lastUpdate > 5000) return;

        // Calculate Screen Position
        // TILE_SIZE from main.js global
        const drawX = (this.otherPlayer.x - player.x) * TILE_SIZE + canvas.width / 2 - TILE_SIZE / 2;
        const drawY = (this.otherPlayer.y - player.y) * TILE_SIZE + canvas.height / 2 - TILE_SIZE / 2;

        // Draw Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(drawX + TILE_SIZE / 2, drawY + TILE_SIZE - 5, 15, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw Sprite
        ctx.save();
        if (this.otherPlayer.dir === 'right') {
            ctx.translate(drawX + TILE_SIZE, drawY - 10);
            ctx.scale(-1, 1);
            ctx.drawImage(this.loadedSprite, 0, 0, TILE_SIZE, TILE_SIZE);
        } else {
            ctx.drawImage(this.loadedSprite, drawX, drawY - 10, TILE_SIZE, TILE_SIZE);
        }
        ctx.restore();

        // Name Tag
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("Friend", drawX + TILE_SIZE / 2, drawY - 15);
    }
}