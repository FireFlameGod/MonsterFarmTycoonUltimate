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
let mapOffsetX = window.innerWidth / 2; 
let mapOffsetY = 150;
const visualOverlap = 20; // Visszavettem 4-re a szebb illeszkedésért
const mapSize = 30; 
let mapData = [];
let objectData = []; // ÚJ: Itt tároljuk a fákat és köveket

// KÉPEK
const images = {};
const fileNames = {
    grass: 'grass.png',
    flower: 'grass_flower.png',
    sand: 'sand.png',
    water: 'water.png',
    tree: 'tree.png',  // ÚJ
    rock: 'rock.png'   // ÚJ
};

Object.keys(fileNames).forEach(key => {
    images[key] = new Image();
    images[key].src = fileNames[key];
    images[key].onload = () => { if (currentPlayer) drawMap(); };
});

// --- 1. DINAMIKUS TÉRKÉP ÉS OBJEKTUM GENERÁLÁS ---
function generateMap() {
    mapData = Array(mapSize).fill().map(() => Array(mapSize).fill(0));
    objectData = Array(mapSize).fill().map(() => Array(mapSize).fill(null));

    const islandSize = 14; 
    const startPos = Math.floor((mapSize - islandSize) / 2);
    const endPos = startPos + islandSize;
    
    for (let y = startPos; y < endPos; y++) {
        for (let x = startPos; x < endPos; x++) {
            if (x === startPos || x === endPos - 1 || y === startPos || y === endPos - 1) {
                mapData[y][x] = 3; // Homok
            } else {
                mapData[y][x] = (Math.random() < 0.15) ? 2 : 1; // Fű/Virág
                
                // Véletlenszerű fák és kövek elhelyezése
                let rand = Math.random();
                if (rand < 0.10) {
                    objectData[y][x] = { type: 'tree', health: 3 };
                } else if (rand < 0.05) {
                    objectData[y][x] = { type: 'rock', health: 5 };
                }
            }
        }
    }
}
generateMap();

let isDragging = false;
let lastX, lastY;

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

    for (let y = 0; y < mapData.length; y++) {
        for (let x = 0; x < mapData[y].length; x++) {
            let screenX = (x - y) * (tileW / 2) + mapOffsetX;
            let screenY = (x + y) * (tileH / 2) + mapOffsetY;
            
            if (screenX > -tileW && screenX < canvas.width + tileW && 
                screenY > -tileH && screenY < canvas.height + tileH) {
                
                // 1. Talaj rajzolása
                drawTile(screenX, screenY, mapData[y][x]);

                // 2. Objektumok rajzolása (fa, kő) a talaj tetejére
                let obj = objectData[y][x];
                if (obj) {
                    let objImg = images[obj.type];
                    if (objImg && objImg.complete) {
                        // A fát/követ középre igazítjuk és picit feljebb toljuk
                        let scale = 0.8;
                        let w = tileW * scale;
                        let h = (objImg.height * (w / objImg.width));
                        ctx.drawImage(objImg, screenX - w/2, screenY - h + (tileH/1.5), w, h);
                    }
                }
            }
        }
    }
}

function drawTile(x, y, type) {
    let img = null;
    if (type === 0) img = images.water;
    else if (type === 1) img = images.grass;
    else if (type === 2) img = images.flower;
    else if (type === 3) img = images.sand;

    if (img && img.complete) {
        let drawHeight = img.height * (tileW / img.width);
        ctx.drawImage(img, Math.floor(x - (tileW / 2) - (visualOverlap / 2)), Math.floor(y - (visualOverlap / 2)), tileW + visualOverlap, drawHeight + visualOverlap);
    }
}

// --- 3. KATTINTÁS ÉS MOZGATÁS ---
canvas.addEventListener('click', (e) => {
    if (isDragging) return;

    // Izometrikus egér koordináta számítás
    let mx = e.clientX - mapOffsetX;
    let my = e.clientY - mapOffsetY;

    let tx = Math.floor((my / (tileH / 2) + mx / (tileW / 2)) / 2);
    let ty = Math.floor((my / (tileH / 2) - mx / (tileW / 2)) / 2);

    if (tx >= 0 && tx < mapSize && ty >= 0 && ty < mapSize) {
        let target = objectData[ty][tx];
        if (target) {
            target.health--;
            if (target.health <= 0) {
                // Nyeremény: fa esetén 10 pénz, kő esetén 20
                let reward = (target.type === 'tree' ? 10 : 20);
                update(ref(db, `users/${currentPlayer}`), { money: increment(reward) });
                objectData[ty][tx] = null;
            }
            drawMap();
        }
    }
});

window.addEventListener('mousemove', (e) => {
    if (isDragging) {
        let deltaX = e.clientX - lastX;
        let deltaY = e.clientY - lastY;
        let newX = mapOffsetX + deltaX;
        let newY = mapOffsetY + deltaY;

        const totalW = (mapSize * tileW) / 2;
        const totalH = (mapSize * tileH);

        if (newX > window.innerWidth / 2 - totalW && newX < window.innerWidth / 2 + totalW) mapOffsetX = newX;
        if (newY > -totalH / 2 && newY < totalH / 1.5) mapOffsetY = newY;

        lastX = e.clientX; lastY = e.clientY;
        drawMap();
    }
});

canvas.addEventListener('mousedown', (e) => { isDragging = false; lastX = e.clientX; lastY = e.clientY; setTimeout(() => { if(Math.abs(e.clientX - lastX) > 5) isDragging = true; }, 100); });
window.addEventListener('mouseup', () => { setTimeout(() => isDragging = false, 50); });

// --- 4. RENDSZER ---
window.loginOrRegister = function() {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    if (!user || !pass) return;

    const dbRef = ref(db);
    get(child(dbRef, `users/${user}`)).then((snapshot) => {
        if (snapshot.exists()) {
            if (snapshot.val().password === pass) startGame(user);
            else document.getElementById('error-msg').style.display = 'block';
        } else {
            set(ref(db, 'users/' + user), { username: user, password: pass, money: 100, level: 1 }).then(() => startGame(user));
        }
    });
};

function startGame(user) {
    currentPlayer = user;
    localStorage.setItem('mf_user', user);
    localStorage.setItem('mf_pass', document.getElementById('password').value);
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'block';
    document.getElementById('player-name').innerText = user;
    const centerX = 0; // Izometrikus (x-y) miatt a vízszintes közép 0 eltolásnál van
    const centerY = (mapSize * (tileH / 2));
    mapOffsetX = window.innerWidth / 2; 
    mapOffsetY = (window.innerHeight / 2) - (mapSize * tileH / 4);
    resizeCanvas(); 
    onValue(ref(db, `users/${user}/money`), (snap) => {
        document.getElementById('money-display').innerText = snap.val();
    });
}

window.onload = function() {
    const u = localStorage.getItem('mf_user');
    const p = localStorage.getItem('mf_pass');
    if(u && p) {
        document.getElementById('username').value = u;
        document.getElementById('password').value = p;
        window.loginOrRegister();
    }
};

window.addMoney = function() {
    if(currentPlayer) update(ref(db, `users/${currentPlayer}`), { money: increment(50) });
};

window.logout = function() {
    localStorage.clear();
    location.reload();
};