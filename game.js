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

let mapOffsetX = window.innerWidth / 2; 
let mapOffsetY = -500; 

let mapData = [];
let objectData = {}; 
let isBuilding = null;

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
    images[key].onload = () => { if (currentPlayer) drawMap(); };
});

window.toggleShop = function() {
    const shop = document.getElementById('shop-window');
    if (shop) {
        // Ha rejtve van, flex-re váltjuk a középre igazítás miatt
        if (shop.style.display === 'none' || shop.style.display === '') {
            shop.style.display = 'flex';
        } else {
            shop.style.display = 'none';
        }
    }
};

window.cheatMoney = function() {
    if (currentPlayer) {
        update(ref(db, `users/${currentPlayer}`), {
            coin: increment(1000)
        });
    }
};

window.buyItem = function(type, price) {
    get(ref(db, `users/${currentPlayer}/coin`)).then((snap) => {
        const myCoins = snap.val() || 0;
        if (myCoins >= price) {
            isBuilding = { type: type, price: price };
            window.toggleShop();
            alert("Válaszd ki a helyet a szigeten!");
        } else {
            alert("Nincs elég Commerce Coinod!");
        }
    });
};

function updateShopAvailability(objects) {
    const purchasedTypes = Object.values(objects).map(o => o.type);
    
    ['house', 'mine', 'boat'].forEach(type => {
        const btn = document.getElementById('btn-' + type);
        if (btn) {
            if (purchasedTypes.includes(type)) {
                btn.innerText = "Megvéve";
                btn.disabled = true;
                btn.style.background = "#7f8c8d";
            } else {
                btn.innerText = "Vétel";
                btn.disabled = false;
                btn.style.background = "#27ae60";
            }
        }
    });
}



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
setupBaseTerrain();

function createInitialIsland(userId) {
    let newObjects = {};
    const islandSize = 14; 
    const startPos = Math.floor((mapSize - islandSize) / 2);
    const endPos = startPos + islandSize;
    for (let y = startPos + 1; y < endPos - 1; y++) {
        for (let x = startPos + 1; x < endPos - 1; x++) {
            let rand = Math.random();
            const key = `${y}_${x}`;
            if (rand < 0.12) newObjects[key] = { type: 'tree', health: rewards.tree.health };
            else if (rand < 0.22) newObjects[key] = { type: 'rock', health: rewards.rock.health };
        }
    }
    set(ref(db, `islands/${userId}`), newObjects);
    return newObjects;
}

function drawMap() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            let screenX = (x - y) * (tileW / 2) + mapOffsetX;
            let screenY = (x + y) * (tileH / 2) + mapOffsetY;
            
            if (screenX > -tileW && screenX < canvas.width + tileW && 
                screenY > -tileH && screenY < canvas.height + tileH) {
                
                drawTile(screenX, screenY, mapData[y][x]);

                const key = `${y}_${x}`;
                let obj = objectData[key]; 
                
                if (obj && images[obj.type] && images[obj.type].complete) {
                    let img = images[obj.type];

                    // ALAPÉRTELMEZETT ÉRTÉKEK
                    let scale = 1.0;
                    let yOffset = 40;

                    // EGYEDI BEÁLLÍTÁSOK TÍPUSONKÉNT
                    if (obj.type === 'tree') {
                        scale = 1.0;
                        yOffset = 40;
                    } 
                    else if (obj.type === 'rock') {
                        scale = 0.9;
                        yOffset = 40;
                    } 
                    else if (obj.type === 'house') {
                        scale = 2.0;    // Itt növeld a ház méretét
                        yOffset = 50;   // Itt told lejjebb/feljebb
                    } 
                    else if (obj.type === 'mine') {
                        scale = 2.0;    // Itt növeld a bánya méretét
                        yOffset = 48;
                    } 
                    else if (obj.type === 'boat') {
                        scale = 2.0;
                        yOffset = 25;   // A hajó kevesebb offsetet kap, hogy a vízben üljön
                    }

                    // Kiszámoljuk a szélességet és magasságot az új scale alapján
                    let w = tileW * scale;
                    let h = (img.height * (w / img.width));

                    // Megrajzolás (marad a korábbi logikád)
                    if (obj.isShaking) {
                        ctx.globalAlpha = 0.6;
                        ctx.drawImage(img, screenX - w/2 + (Math.random()*4-2), screenY - h + (tileH / 2) + yOffset, w, h);
                        ctx.globalAlpha = 1.0;
                    } else {
                        ctx.drawImage(img, screenX - w/2, screenY - h + (tileH / 2) + yOffset, w, h);
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
        let drawHeight = img.height * (tileW / img.width);
        ctx.drawImage(img, Math.floor(x - (tileW / 2) - (visualOverlap / 2)), Math.floor(y - (visualOverlap / 2)), tileW + visualOverlap, drawHeight + visualOverlap);
    }
}

let isDragging = false;
let startDragX, startDragY, lastX, lastY;

canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    startDragX = e.clientX; startDragY = e.clientY;
    lastX = e.clientX; lastY = e.clientY;
});

window.addEventListener('mousemove', (e) => {
    if (isDragging) {
        mapOffsetX += e.clientX - lastX;
        mapOffsetY += e.clientY - lastY;

        // --- KAMERA BOUNDS (Visszaállítva) ---
        // Vízszintes korlát
        if (mapOffsetX < 0) mapOffsetX = 0;
        if (mapOffsetX > window.innerWidth) mapOffsetX = window.innerWidth;
        
        // Függőleges korlát
        if (mapOffsetY < -1000) mapOffsetY = -1000;
        if (mapOffsetY > 0) mapOffsetY = 0;

        lastX = e.clientX; 
        lastY = e.clientY;
        drawMap();
    }
});

window.addEventListener('mouseup', (e) => {
    if (isDragging) {
        let moveDist = Math.hypot(e.clientX - startDragX, e.clientY - startDragY);
        if (moveDist < 5) handleMapClick(e.clientX, e.clientY);
    }
    isDragging = false;
});

function handleMapClick(mouseX, mouseY) {
    let mx = mouseX - mapOffsetX;
    let my = mouseY - mapOffsetY;
    let tx = Math.floor((my / (tileH / 2) + mx / (tileW / 2)) / 2);
    let ty = Math.floor((my / (tileH / 2) - mx / (tileW / 2)) / 2);
    const key = `${ty}_${tx}`;

    if (isBuilding) {
        if (!mapData[ty] || mapData[ty][tx] === undefined) return;
        const tileType = mapData[ty][tx];
        let allowed = (isBuilding.type === 'boat' && tileType === 0) || 
                      ((isBuilding.type === 'house' || isBuilding.type === 'mine') && tileType >= 1);

        if (allowed && !objectData[key]) {
            update(ref(db, `users/${currentPlayer}`), { coin: increment(-isBuilding.price) });
            set(ref(db, `islands/${currentPlayer}/${key}`), { type: isBuilding.type, health: 999 });
            isBuilding = null;
        } else {
            alert("Ide nem építhetsz!");
            isBuilding = null;
        }
        return;
    }

    if (objectData[key]) {
        let target = objectData[key];
        if (target.type === 'tree' || target.type === 'rock') {
            target.health--;
            target.isShaking = true;
            drawMap();
            setTimeout(() => { if (objectData[key]) { objectData[key].isShaking = false; drawMap(); } }, 100);
            if (target.health <= 0) {
                const r = rewards[target.type];
                update(ref(db, `users/${currentPlayer}`), { coin: increment(r.coin), xp: increment(r.xp) });
                set(ref(db, `islands/${currentPlayer}/${key}`), null);
                delete objectData[key];
            }
        }
    }
}

window.loginOrRegister = function() {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    if (!user || !pass) return;
    get(child(ref(db), `users/${user}`)).then((snapshot) => {
        if (snapshot.exists()) {
            if (snapshot.val().password === pass) startGame(user);
            else document.getElementById('error-msg').style.display = 'block';
        } else {
            set(ref(db, 'users/' + user), { username: user, password: pass, coin: 0, xp: 0, hasIsland: false }).then(() => startGame(user));
        }
    });
};

async function startGame(user) {
    currentPlayer = user;
    localStorage.setItem('mf_user', user);
    localStorage.setItem('mf_pass', document.getElementById('password').value);
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex'; 
    document.getElementById('player-name').innerText = user;

    try {
        const userSnap = await get(ref(db, `users/${user}`));
        if (!userSnap.val().hasIsland) {
            objectData = createInitialIsland(user);
            await update(ref(db, `users/${user}`), { hasIsland: true });
        }
        onValue(ref(db, `islands/${user}`), (snap) => {
            objectData = snap.exists() ? snap.val() : {};
            updateShopAvailability(objectData); // Minden változásnál frissítjük a boltot
            drawMap();
        });
        onValue(ref(db, `users/${user}`), (snap) => {
            const d = snap.val();
            if (d) {
                document.getElementById('money-display').innerText = d.coin || 0;
                document.getElementById('xp-display').innerText = d.xp || 0;
            }
        });
    } catch (e) { console.error(e); }

    setInterval(() => {
        if (!currentPlayer || !objectData) return;
        let mines = Object.values(objectData).filter(o => o.type === 'mine').length;
        if (mines > 0) update(ref(db, `users/${currentPlayer}`), { coin: increment(mines * 10) });
    }, 10000);

    resizeCanvas(); 
}

window.onload = function() {
    const u = localStorage.getItem('mf_user'), p = localStorage.getItem('mf_pass');
    if(u && p) {
        document.getElementById('username').value = u;
        document.getElementById('password').value = p;
        window.loginOrRegister();
    }
};

window.logout = function() { localStorage.clear(); location.reload(); };
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; drawMap(); }
window.addEventListener('resize', resizeCanvas);