import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, child, update, increment, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- FIREBASE CONFIG ---
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

// --- VÁLTOZÓK ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let currentPlayer = null;

const tileW = 128; 
const tileH = 64; 
const mapSize = 30; 
const visualOverlap = 20;

// A TE KAMERA BEÁLLÍTÁSAID
let mapOffsetX = window.innerWidth / 2; 
let mapOffsetY = -500; 

let mapData = [];
let objectData = {}; // OBJEKTUMKÉNT INDÍTJUK

const rewards = {
    tree: { coin: 15, xp: 10, health: 3 },
    rock: { coin: 30, xp: 25, health: 5 }
};

// KÉPEK
const images = {};
const fileNames = {
    grass: 'grass.png',
    flower: 'grass_flower.png',
    sand: 'sand.png',
    water: 'water.png',
    tree: 'tree.png',
    rock: 'rock.png'
};

Object.keys(fileNames).forEach(key => {
    images[key] = new Image();
    images[key].src = fileNames[key];
    images[key].onload = () => { if (currentPlayer) drawMap(); };
});

// --- 1. PÁLYA ALAP GENERÁLÁSA (FŰ/VÍZ) ---
function setupBaseTerrain() {
    mapData = Array(mapSize).fill().map(() => Array(mapSize).fill(0)); // 0 = Víz
    const islandSize = 14; 
    const startPos = Math.floor((mapSize - islandSize) / 2);
    const endPos = startPos + islandSize;
    
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            if (y >= startPos && y < endPos && x >= startPos && x < endPos) {
                if (x === startPos || x === endPos - 1 || y === startPos || y === endPos - 1) {
                    mapData[y][x] = 3; // Homok
                } else {
                    mapData[y][x] = (Math.random() < 0.15) ? 2 : 1; // Fű/Virág
                }
            } else {
                mapData[y][x] = 0; // Minden más víz
            }
        }
    }
}
setupBaseTerrain();

// --- 2. ÚJ JÁTÉKOS SZIGET GENERÁLÁSA (FÁK/KÖVEK) ---
function createInitialIsland(userId) {
    let newObjects = {};
    const islandSize = 14; 
    const startPos = Math.floor((mapSize - islandSize) / 2);
    const endPos = startPos + islandSize;

    for (let y = startPos + 1; y < endPos - 1; y++) {
        for (let x = startPos + 1; x < endPos - 1; x++) {
            let rand = Math.random();
            const key = `${y}_${x}`;
            if (rand < 0.12) {
                newObjects[key] = { type: 'tree', health: rewards.tree.health };
            } else if (rand < 0.22) { 
                newObjects[key] = { type: 'rock', health: rewards.rock.health };
            }
        }
    }
    set(ref(db, `islands/${userId}`), newObjects);
    return newObjects;
}

// --- 3. RAJZOLÁS ---
function drawMap() {
    if (!ctx) return;
    ctx.fillStyle = "#000000"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false; 

    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            let screenX = (x - y) * (tileW / 2) + mapOffsetX;
            let screenY = (x + y) * (tileH / 2) + mapOffsetY;
            
            if (screenX > -tileW && screenX < canvas.width + tileW && 
                screenY > -tileH && screenY < canvas.height + tileH) {
                
                drawTile(screenX, screenY, mapData[y][x]);

                // TÁRGYAK RAJZOLÁSA KULCS ALAPJÁN
                const key = `${y}_${x}`;
                let obj = objectData[key]; 
                
                if (obj && images[obj.type] && images[obj.type].complete) {
                    let img = images[obj.type];
                    let scale = (obj.type === 'tree') ? 1.0 : 0.7; 
                    let w = tileW * scale;
                    let h = (img.height * (w / img.width));
                    let yOffset = (obj.type === 'tree') ? 40 : 45; 

                    if (obj.isShaking) {
                        ctx.globalAlpha = 0.6;
                        ctx.drawImage(img, screenX - w/2 + (Math.random()*10-5), screenY - h + (tileH / 2) + yOffset, w, h);
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

// --- 4. INPUTOK ---
let isDragging = false;
let startDragX, startDragY, lastX, lastY;

canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    startDragX = e.clientX;
    startDragY = e.clientY;
    lastX = e.clientX;
    lastY = e.clientY;
});

window.addEventListener('mousemove', (e) => {
    if (isDragging) {
        mapOffsetX += e.clientX - lastX;
        mapOffsetY += e.clientY - lastY;

        // A TE KÉRT KORLÁTAID
        if (mapOffsetX < 0) mapOffsetX = 0;
        if (mapOffsetX > window.innerWidth) mapOffsetX = window.innerWidth;
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
    if (objectData[key]) {
        let target = objectData[key];
        target.health--;
        target.isShaking = true;
        drawMap();
        
        setTimeout(() => {
            if (objectData[key]) {
                objectData[key].isShaking = false;
                drawMap();
            }
        }, 100);

        if (target.health <= 0) {
            const reward = rewards[target.type];
            update(ref(db, `users/${currentPlayer}`), {
                coin: increment(reward.coin),
                xp: increment(reward.xp)
            });
            set(ref(db, `islands/${currentPlayer}/${key}`), null);
            delete objectData[key];
        }
        drawMap();
    }
}

// --- 5. RENDSZER ---
window.loginOrRegister = function() {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    if (!user || !pass) return;

    get(child(ref(db), `users/${user}`)).then((snapshot) => {
        if (snapshot.exists()) {
            if (snapshot.val().password === pass) startGame(user);
            else document.getElementById('error-msg').style.display = 'block';
        } else {
            // ÚJ JÁTÉKOS: Itt jelöljük meg, hogy MÉG NINCS inicializálva
            set(ref(db, 'users/' + user), { 
                username: user, 
                password: pass, 
                coin: 100, 
                xp: 0,
                hasIsland: false // Ez a kulcs fogja megvédeni a szigetet
            }).then(() => startGame(user));
        }
    });
};

function startGame(user) {
    currentPlayer = user;
    localStorage.setItem('mf_user', user);
    localStorage.setItem('mf_pass', document.getElementById('password').value);
    
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex'; 
    document.getElementById('player-name').innerText = user;


    try {
        // 1. Megnézzük, járt-e már itt a játékos
        const userSnap = await get(ref(db, `users/${user}`));
        const userData = userSnap.val();

        // 2. Ha még nincs szigete (false vagy hiányzik), generálunk EGYETLEN EGYSZER
        if (!userData.hasIsland) {
            console.log("Sziget generálása első alkalommal...");
            const newIsland = createInitialIsland(user);
            objectData = newIsland;
            // Elmentjük, hogy már van szigete
            await update(ref(db, `users/${user}`), { hasIsland: true });
        }

        // 3. CSAK EZUTÁN indítjuk el a folyamatos figyelőt
        onValue(ref(db, `islands/${user}`), (snapshot) => {
            if (snapshot.exists()) {
                objectData = snapshot.val();
            } else {
                // Ha a hasIsland true, de nincs adat, akkor tényleg üres a sziget
                objectData = {}; 
            }
            drawMap();
        });

    } catch (error) {
        console.error("Hiba az indulásnál:", error);
    }

    // Erőforrások betöltése
    onValue(ref(db, `users/${user}`), (snap) => {
        const data = snap.val();
        if (data) {
            document.getElementById('money-display').innerText = data.coin || 0;
            document.getElementById('xp-display').innerText = data.xp || 0;
        }
    });

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

window.logout = function() {
    localStorage.clear();
    location.reload();
};

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawMap();
}
window.addEventListener('resize', resizeCanvas);