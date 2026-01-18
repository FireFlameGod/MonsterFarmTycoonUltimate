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
let mapOffsetX = window.innerWidth / 2; 
let mapOffsetY = 150;

let mapData = [];
let objectData = [];
const rewards = {
    tree: { coin: 15, xp: 10, health: 3 },  // Fa: 15 CC, 10 XP
    rock: { coin: 30, xp: 25, health: 5 }   // Kő: 30 CC, 25 XP
};

let currentXP = 0; // XP változó
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

function createInitialIsland(userId) {
    let newObjectData = {}; // Csak a tárgyakat mentjük (fák, kövek)
    const islandSize = 14; 
    const startPos = Math.floor((mapSize - islandSize) / 2);
    const endPos = startPos + islandSize;

    for (let y = startPos; y < endPos; y++) {
        for (let x = startPos; x < endPos; x++) {
            // Nem rakunk tárgyat a sziget szélére (homokra)
            if (!(x === startPos || x === endPos - 1 || y === startPos || y === endPos - 1)) {
                let rand = Math.random();
                if (rand < 0.12) {
                    newObjectData[`${y}_${x}`] = { type: 'tree', health: rewards.tree.health };
                } else if (rand < 0.22) { 
                    newObjectData[`${y}_${x}`] = { type: 'rock', health: rewards.rock.health };
                }
            }
        }
    }
    // Feltöltjük a Firebase-be az új szigetet
    set(ref(db, `islands/${userId}`), newObjectData);
    return newObjectData;
}

// Ezt írd a generateMap helyére:
function setupBaseTerrain() {
    mapData = Array(mapSize).fill().map(() => Array(mapSize).fill(0));
    const islandSize = 14; 
    const startPos = Math.floor((mapSize - islandSize) / 2);
    const endPos = startPos + islandSize;
    
    for (let y = startPos; y < endPos; y++) {
        for (let x = startPos; x < endPos; x++) {
            if (x === startPos || x === endPos - 1 || y === startPos || y === endPos - 1) {
                mapData[y][x] = 3; // Homok a szélén
            } else {
                mapData[y][x] = (Math.random() < 0.15) ? 2 : 1; // Fű vagy Virág
            }
        }
    }
}
setupBaseTerrain();

let isDragging = false;
let startDragX, startDragY, lastX, lastY;

// --- 2. JÁTÉKMOTOR ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawMap();
}
window.addEventListener('resize', resizeCanvas);

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
                const key = `${y}_${x}`;          
                let obj = objectData[y][x];
                if (obj && images[obj.type].complete) {
                    let img = images[obj.type];
                    let scale = (obj.type === 'tree') ? 1.0 : 0.7; 
                    let w = tileW * scale;
                    let h = (img.height * (w / img.width));
                    let yOffset = (obj.type === 'tree') ? 40 : 45; 

                    let shakeX = 0;
                    if (obj.isShaking) {
                        shakeX = Math.random() * 10 - 5;
                        ctx.globalAlpha = 0.6;
                    }

                    ctx.drawImage(img, screenX - w/2 + shakeX, screenY - h + (tileH / 2) + yOffset, w, h);
                    ctx.globalAlpha = 1.0;
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

// --- 3. INPUT (JAVÍTOTT KAMERA MOZGÁS) ---
canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    startDragX = e.clientX;
    startDragY = e.clientY;
    lastX = e.clientX;
    lastY = e.clientY;
});

window.addEventListener('mousemove', (e) => {
    if (isDragging) {
        let deltaX = e.clientX - lastX;
        let deltaY = e.clientY - lastY;
        
        mapOffsetX += deltaX;
        mapOffsetY += deltaY;

       
        // Vízszintes (Bal/Jobb)
        if (mapOffsetX < 0) mapOffsetX = 0; // Ne menjen túl balra
        if (mapOffsetX > window.innerWidth) mapOffsetX = window.innerWidth; // Ne menjen túl jobbra

        // Függőleges (Fel/Le)
        // A -200 és +800 közötti tartomány biztosítja, hogy lásd az alját is
        if (mapOffsetY < -1000) mapOffsetY = -1000; // Felső korlát (kevesebb fekete fent)
        if (mapOffsetY > 0) mapOffsetY = 0;  // Alsó korlát (több hely lefelé húzni)

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

    if (tx >= 0 && tx < mapSize && ty >= 0 && ty < mapSize) {
        const key = `${ty}_${tx}`;
        let target = objectData[ty][tx];
        if (target) {
            target.health--;
            target.isShaking = true;
            drawMap();
            
            setTimeout(() => {
                if (objectData[ty] && objectData[ty][tx]) {
                    objectData[ty][tx].isShaking = false;
                    drawMap();
                }
            }, 100);

            if (target.health <= 0) {
                const reward = rewards[target.type];
                update(ref(db, `users/${currentPlayer}`), {
                    coin: increment(reward.coin), // Commerce Coin hozzáadása
                    xp: increment(reward.xp)      // XP hozzáadása
                });
                
                set(ref(db, `islands/${currentPlayer}/${key}`), null);
                delete objectData[key];
            }
            drawMap();
        }
    }
}

// --- 4. RENDSZER ---
window.loginOrRegister = function() {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    if (!user || !pass) return;

    get(child(ref(db), `users/${user}`)).then((snapshot) => {
        if (snapshot.exists()) {
            if (snapshot.val().password === pass) startGame(user);
            else document.getElementById('error-msg').style.display = 'block';
        } else {
            set(ref(db, 'users/' + user), { username: user, password: pass, money: 100, wood: 0, stone: 0 }).then(() => startGame(user));
        }
    });
};

function startGame(user) {
    currentPlayer = user;
    localStorage.setItem('mf_user', user);
    localStorage.setItem('mf_pass', document.getElementById('password').value);
    
    document.getElementById('login-screen').style.display = 'none';
    const ui = document.getElementById('ui-layer');
    ui.style.display = 'flex'; 
    
    document.getElementById('player-name').innerText = user;

    // Kezdő középpont beállítása
    mapOffsetX = window.innerWidth / 2;
    mapOffsetY = -500;


    // 1. Sziget betöltése vagy létrehozása
    onValue(ref(db, `islands/${user}`), (snapshot) => {
        if (snapshot.exists()) {
            objectData = snapshot.val(); 
        } else {
            objectData = createInitialIsland(user); 
        }
        // Biztonsági mentés: ha valamiért mégis null lenne
        if (!objectData) objectData = {}; 
        drawMap();
    });

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