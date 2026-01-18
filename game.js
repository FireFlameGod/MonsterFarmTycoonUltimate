import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, child, update, increment, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyA-MauYrQl5WZ4TPv53vNxuUFnW3dEG0Z8",
    authDomain: "monsterfarmtycoonultimate.firebaseapp.com",
    databaseURL: "https://monsterfarmtycoonultimate-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "monsterfarmtycoonultimate",
    storageBucket: "monsterfarmtycoonultimate.firebasestorage.app",
    messagingSenderId: "621935486358",
    appId: "1:621935486358:web:ac7d20b0beb3933f64e9b7"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let currentPlayer = null;

const tileW = 128; 
const tileH = 64; 
const mapSize = 30; 
const visualOverlap = 20;
let gameZoom = 1.0;
let mapOffsetX = window.innerWidth / 2; 
let mapOffsetY = 100; 

let mapData = [];
let objectData = {}; 

let isBuilding = null;
let lastLevel = null;
let isDragging = false;
let startDragX, startDragY, lastX, lastY;
let lastTouchX = 0, lastTouchY = 0;

const rewards = {
    tree: { coin: 15, xp: 10, health: 3 },
    rock: { coin: 30, xp: 25, health: 5 },
    house: { health: 999 },
    boat: { health: 999 },
    mine: { health: 999 }
};

const images = {};
const fileNames = {
    grass: 'grass.png',
    flower: 'grass_flower.png',
    sand: 'sand.png',
    water: 'water.png',
    tree: 'tree.png',
    rock: 'rock.png',
    house: 'assets/house.png',
    boat: 'assets/boat.png',
    mine: 'assets/mine.png'
};

Object.keys(fileNames).forEach(key => {
    images[key] = new Image();
    images[key].src = fileNames[key];
});

// --- SEGÉDFÜGGVÉNYEK ---

function calculateLevel(xp) {
    if (!xp || xp < 100) return 1;
    return Math.floor(Math.pow(xp / 100, 1 / 1.5)) + 1;
}

function getNpcStats() {
    let totalCapacity = 0;
    let currentlyWorking = 0;
    Object.values(objectData).forEach(obj => {
        if (obj.type === 'house') totalCapacity += (obj.lvl === 2) ? 4 : 2;
        if (obj.type === 'mine' || obj.type === 'boat') currentlyWorking += (obj.workers || 0);
    });
    return { total: totalCapacity, busy: currentlyWorking, free: totalCapacity - currentlyWorking };
}

// --- JÁTÉK MOTOR (OPTIMALIZÁLT) ---

function drawMap() {
    if (!ctx || !currentPlayer || !mapData.length) return;

    // Kényszerített teljes törlés a skálázástól függetlenül
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            let screenX = (x - y) * (tileW / 2) * gameZoom + mapOffsetX;
            let screenY = (x + y) * (tileH / 2) * gameZoom + mapOffsetY;
            
            // Csak akkor rajzolunk, ha látszik
            if (screenX > -200 && screenX < window.innerWidth + 200 && screenY > -200 && screenY < window.innerHeight + 200) {
                drawTile(screenX, screenY, mapData[y][x]);

                const key = `${y}_${x}`;
                let obj = objectData[key]; 
                
                if (obj && images[obj.type] && images[obj.type].complete) {
                    let img = images[obj.type];
                    let scale = (obj.type === 'house' || obj.type === 'mine' || obj.type === 'boat') ? 2.0 : 1.2;
                    let yOffset = (obj.type === 'house') ? 110 : (obj.type === 'mine' ? 120 : 40);
                    if (obj.type === 'boat') yOffset = 100;

                    let w = tileW * scale * gameZoom;
                    let h = (img.height * (w / img.width));
                    let zoomedYOffset = yOffset * gameZoom;

                    if (obj.isShaking) {
                        ctx.globalAlpha = 0.6;
                        ctx.drawImage(img, screenX - w/2 + (Math.random()*4-2), screenY - h + (tileH / 2 * gameZoom) + zoomedYOffset, w, h);
                        ctx.globalAlpha = 1.0;
                    } else {
                        ctx.drawImage(img, screenX - w/2, screenY - h + (tileH / 2 * gameZoom) + zoomedYOffset, w, h);
                    }
                }
            }
        }
    }
}

function drawTile(x, y, type) {
    let img = images.water;
    if (type === 1) img = images.grass;
    else if (type === 2) img = images.flower;
    else if (type === 3) img = images.sand;
    if (img && img.complete) {
        let drawWidth = (tileW + visualOverlap) * gameZoom;
        let drawHeight = (img.height * (tileW / img.width) + visualOverlap) * gameZoom;
        ctx.drawImage(img, Math.floor(x - (tileW / 2 * gameZoom) - (visualOverlap / 2 * gameZoom)), Math.floor(y - (visualOverlap / 2 * gameZoom)), drawWidth, drawHeight);
    }
}

function gameLoop() {
    if (currentPlayer) drawMap();
    requestAnimationFrame(gameLoop);
}

// --- INTERAKCIÓK ---

function handleMapClick(mouseX, mouseY) {
    if (!currentPlayer || !mapData.length) return;

    const mx = (mouseX - mapOffsetX) / gameZoom;
    const my = (mouseY - mapOffsetY) / gameZoom;
    const tx = Math.floor((my / (tileH / 2) + mx / (tileW / 2)) / 2);
    const ty = Math.floor((my / (tileH / 2) - mx / (tileW / 2)) / 2);

    if (ty < 0 || ty >= mapSize || tx < 0 || tx >= mapSize) return;
    const key = `${ty}_${tx}`;

    if (isBuilding) {
        const tileType = mapData[ty][tx];
        let allowed = (isBuilding.type === 'boat' && tileType === 0) || ((isBuilding.type === 'house' || isBuilding.type === 'mine') && tileType >= 1);
        if (allowed && !objectData[key]) {
            update(ref(db, `users/${currentPlayer}`), { coin: increment(-isBuilding.price) });
            set(ref(db, `islands/${currentPlayer}/${key}`), { type: isBuilding.type, lvl: 1, workers: 0, health: 999 });
            isBuilding = null;
        }
    } else if (objectData[key]) {
        let target = objectData[key];
        if ((target.type === 'tree' || target.type === 'rock') && target.health > 0) {
            target.health--;
            target.isShaking = true;
            setTimeout(() => { if (objectData[key]) objectData[key].isShaking = false; }, 100);
            if (target.health <= 0) {
                const r = rewards[target.type];
                update(ref(db, `users/${currentPlayer}`), { coin: increment(r.coin), xp: increment(r.xp) });
                set(ref(db, `islands/${currentPlayer}/${key}`), null);
            }
        }
    }
}

// --- ESEMÉNYKEZELŐK ---

canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    startDragX = e.clientX; startDragY = e.clientY;
    lastX = e.clientX; lastY = e.clientY;
});

window.addEventListener('pointermove', (e) => {
    if (isDragging) {
        mapOffsetX += e.clientX - lastX;
        mapOffsetY += e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
    }
});

window.addEventListener('pointerup', (e) => {
    if (isDragging) {
        let moveDist = Math.hypot(e.clientX - startDragX, e.clientY - startDragY);
        if (moveDist < 10) handleMapClick(e.clientX, e.clientY);
    }
    isDragging = false;
});

// --- RENDSZER ---

function setupBaseTerrain() {
    mapData = Array(mapSize).fill().map(() => Array(mapSize).fill(0));
    const islandSize = 14; 
    const startPos = Math.floor((mapSize - islandSize) / 2);
    const endPos = startPos + islandSize;
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            if (y >= startPos && y < endPos && x >= startPos && x < endPos) {
                if (x === startPos || x === endPos - 1 || y === startPos || y === endPos - 1) mapData[y][x] = 3;
                else mapData[y][x] = (Math.random() < 0.15) ? 2 : 1;
            } else mapData[y][x] = 0;
        }
    }
}

async function startGame(user) {
    currentPlayer = user;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex'; 
    document.getElementById('player-name').innerText = user;
    
    setupBaseTerrain();
    
    const userSnap = await get(ref(db, `users/${user}`));
    if (!userSnap.val().hasIsland) {
        const islandSize = 14; 
        const startPos = Math.floor((mapSize - islandSize) / 2);
        const endPos = startPos + islandSize;
        let newObjs = {};
        for (let y = startPos + 1; y < endPos - 1; y++) {
            for (let x = startPos + 1; x < endPos - 1; x++) {
                let rand = Math.random();
                if (rand < 0.12) newObjs[`${y}_${x}`] = { type: 'tree', health: 3 };
                else if (rand < 0.22) newObjs[`${y}_${x}`] = { type: 'rock', health: 5 };
            }
        }
        await set(ref(db, `islands/${user}`), newObjs);
        await update(ref(db, `users/${user}`), { hasIsland: true });
    }

    onValue(ref(db, `islands/${user}`), (snap) => {
        objectData = snap.exists() ? snap.val() : {};
        const hasHouse = Object.values(objectData).some(o => o.type === 'house');
        document.getElementById('npc-manage-btn').style.display = hasHouse ? 'block' : 'none';
    });

    onValue(ref(db, `users/${user}`), (snap) => {
        const d = snap.val();
        if (d) {
            document.getElementById('money-display').innerText = d.coin || 0;
            document.getElementById('xp-display').innerText = d.xp || 0;
            const lvl = calculateLevel(d.xp || 0);
            document.getElementById('level-display').innerText = lvl;
            if (lastLevel !== null && lvl > lastLevel) showLevelUp(lvl);
            lastLevel = lvl;
        }
    });

    resizeCanvas();
    gameLoop();
}

// --- ABLAK KEZELÉS ---

function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * ratio;
    canvas.height = window.innerHeight * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    gameZoom = window.innerWidth < 600 ? 0.6 : 1.0;
}

window.loginOrRegister = function() {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    if (!user || !pass) return;
    get(child(ref(db), `users/${user}`)).then((snap) => {
        if (snap.exists()) {
            if (snap.val().password === pass) startGame(user);
            else alert("Hibás jelszó!");
        } else {
            set(ref(db, 'users/' + user), { username: user, password: pass, coin: 500, xp: 0, hasIsland: false }).then(() => startGame(user));
        }
    });
};

window.buyItem = function(type, price) {
    get(ref(db, `users/${currentPlayer}/coin`)).then((snap) => {
        if ((snap.val() || 0) >= price) {
            isBuilding = { type, price };
            window.toggleShop();
            alert("Válaszd ki a helyet!");
        } else alert("Nincs elég pénzed!");
    });
};

window.cheatMoney = function() { update(ref(db, `users/${currentPlayer}`), { coin: increment(1000) }); };
window.logout = function() { localStorage.clear(); location.reload(); };
window.toggleShop = function() { const s = document.getElementById('shop-window'); s.style.display = (s.style.display === 'none' || s.style.display === '') ? 'flex' : 'none'; };
window.closeLevelUp = function() { document.getElementById('level-up-modal').style.display = 'none'; };
window.showLevelUp = function(lvl) { document.getElementById('new-level-number').innerText = lvl; document.getElementById('level-up-modal').style.display = 'flex'; };

window.addEventListener('resize', resizeCanvas);
window.onload = () => {
    const u = localStorage.getItem('mf_user'), p = localStorage.getItem('mf_pass');
    if(u && p) { document.getElementById('username').value = u; document.getElementById('password').value = p; window.loginOrRegister(); }
};