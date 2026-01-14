/**
 * AnimeBattleBackground - Generates a dynamic, high-speed anime action background.
 * Renders a stylized sky with multi-layered vertical speed lines using HTML5 Canvas.
 */
class AnimeBattleBackground {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId) || document.body;
        
        // Configuration options
        this.config = {
            direction: 'up', // 'up' or 'down'
            baseSpeed: 15,    // How fast the scene moves
            lineCount: 80,   // Number of speed lines
            colors: {
                top: '#1a2a6c',    // Deep blue
                middle: '#b21f1f', // (Optional mid-point, usually skipped for sky)
                bottom: '#fdbb2d', // (Optional, replaced below for sky look)
                skyTop: '#005C97', // Anime Sky Top
                skyBot: '#363795', // Anime Sky Bottom
                lineColor: '#ffffff'
            },
            ...options
        };

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // Optimize for no transparency
        this.lines = [];
        this.animationId = null;
        this.width = 0;
        this.height = 0;

        this.init();
    }

    init() {
        // Style the canvas to fill the container behind the UI
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.zIndex = '-1'; // Ensure it stays behind Pokemon/UI
        this.canvas.style.pointerEvents = 'none'; // Don't block clicks

        // Insert canvas into DOM
        // Check if container has relative positioning, if not, force it so absolute child works
        const computedStyle = getComputedStyle(this.container);
        if (computedStyle.position === 'static') {
            this.container.style.position = 'relative';
        }
        
        // Clear existing canvases if re-initializing
        const existing = this.container.querySelector('canvas[data-anime-bg]');
        if (existing) existing.remove();
        
        this.canvas.setAttribute('data-anime-bg', 'true');
        this.container.prepend(this.canvas);

        this.resize();
        this.createLines();
        
        // Handle window resizing
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        
        // Handle High DPI displays (Retina) for crisp lines
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);
    }

    createLines() {
        this.lines = [];
        for (let i = 0; i < this.config.lineCount; i++) {
            this.lines.push(this.generateLine());
        }
    }

    generateLine(resetY = false) {
        // Parallax logic: 
        // Layer 0: Far away (slow, thin, opaque)
        // Layer 1: Close (fast, thick, transparent)
        const layer = Math.random(); 
        
        const speedMult = layer > 0.8 ? 2.5 : (layer > 0.5 ? 1.5 : 0.8);
        const width = layer > 0.8 ? Math.random() * 4 + 2 : Math.random() * 1.5 + 0.5;
        const opacity = layer > 0.8 ? 0.3 : (layer > 0.5 ? 0.5 : 0.15);
        
        return {
            x: Math.random() * this.width,
            y: resetY ? this.height + (Math.random() * 200) : Math.random() * this.height,
            length: Math.random() * 300 + 100, // Long streaks
            width: width,
            speed: (Math.random() * 10 + this.config.baseSpeed) * speedMult,
            opacity: opacity
        };
    }

    drawBackground() {
        // Create the Anime Sky Gradient (Vertical)
        // Matches the blue streaks in your example images
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        
        // Deep Blue top -> Lighter Cyan bottom (Simulates atmosphere)
        gradient.addColorStop(0, '#021124'); // Dark Space/Blue
        gradient.addColorStop(0.4, '#0f4b85'); // Mid Sky
        gradient.addColorStop(1, '#00d2ff'); // Horizon Cyan

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    animate() {
        // Clear canvas (optimization: drawing background overwrites anyway)
        this.drawBackground();

        this.ctx.shadowBlur = 0; // Reset effects

        // Draw and update lines
        this.lines.forEach((line, index) => {
            // Move line
            if (this.config.direction === 'up') {
                line.y -= line.speed;
            } else {
                line.y += line.speed;
            }

            // Reset if off-screen
            if (this.config.direction === 'up' && line.y + line.length < 0) {
                this.lines[index] = this.generateLine(true);
            } else if (this.config.direction === 'down' && line.y > this.height) {
                this.lines[index] = this.generateLine(true);
                this.lines[index].y = -this.lines[index].length;
            }

            // Draw line
            this.ctx.beginPath();
            
            // Visual style: Tapered ends look faster
            // We use a gradient for the line itself to make it fade at tails
            const lineGrad = this.ctx.createLinearGradient(line.x, line.y, line.x, line.y + line.length);
            lineGrad.addColorStop(0, `rgba(255, 255, 255, 0)`); // Fade out top
            lineGrad.addColorStop(0.5, `rgba(255, 255, 255, ${line.opacity})`); // Solid middle
            lineGrad.addColorStop(1, `rgba(255, 255, 255, 0)`); // Fade out bottom

            this.ctx.fillStyle = lineGrad;
            this.ctx.rect(line.x, line.y, line.width, line.length);
            this.ctx.fill();
        });

        // Add a "Flash" overlay occasionally to simulate high energy impact
        // (Optional: Makes it look like thunder or power surges)
        if (Math.random() > 0.98) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.1})`;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    start() {
        if (!this.animationId) {
            this.animate();
        }
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    // Call this if you want to switch to a "Dark Mode" intense background
    setTheme(theme) {
        if(theme === 'dark') {
             // Red/Black danger theme
             this.config.colors.skyTop = '#000000';
             this.config.colors.skyBot = '#434343';
        }
    }
}

// Make it globally available or export it
window.AnimeBattleBackground = AnimeBattleBackground;
