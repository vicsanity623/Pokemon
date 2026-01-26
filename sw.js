const GAME_VERSION = 'v3.2.3';
const CACHE_NAME = `pokeworld-${GAME_VERSION}`;

const ASSETS = [
    './',
    './index.html',
    './style.css',
    './src/main.js',
    './src/map.js',
    './src/crafting.js',
    './src/enemies.js',
    './src/resources.js',
    './src/rpg_core.js',
    './src/guardian.js',
    './src/utils.js',
    './src/world.js',
    './src/anime-bg.js',
    './src/battle.js',
    './src/data.js',
    './src/combine.js',
    './src/loading.js',
    './manifest.json',
    './src/rival.js',
    './src/arena.js',
    './src/home.js',
    './src/store.js',
    './src/defense.js',
    './src/expansion.js',
    './src/liminal.js',
    './src/multiplayer.js',
    './290pxhouse.png',
    './daycare.png',
    './herbalist.png',
    './villager.png',
    './music.mp3',
    './battle.mp3',
    './attack1.mp3',
    './attack2.mp3',
    './attack3.mp3',
    './pickup.mp3',
    './assets/sprites/bounty_board.png',
    './assets/sprites/cave_entrance.png',
    './assets/sprites/pokemon/25.png',
    './assets/sprites/pokemon/egg.png'
];

// 1. INSTALL: Cache files and force activation
self.addEventListener('install', (e) => {
    console.log(`[SW] Installing ${GAME_VERSION}`);
    self.skipWaiting(); // FORCE the new service worker to install immediately
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// 2. ACTIVATE: Delete OLD caches
self.addEventListener('activate', (e) => {
    console.log(`[SW] Activating ${GAME_VERSION}`);
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log(`[SW] Deleting old cache: ${key}`);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    return self.clients.claim(); // Take control of the page immediately
});

// 3. FETCH: Network First, Fallback to Cache
// This fixes the "must delete app to update" bug.
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request)
            .then((response) => {
                // If we got a valid response from the network, return it
                return response;
            })
            .catch(() => {
                // If network fails (offline), return the cached version
                return caches.match(e.request);
            })
    );
});
