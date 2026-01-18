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

// --- 1. GENERÁLÁS ---
function generateMap() {
    mapData = Array(mapSize).fill().map(() => Array(mapSize).fill(0));
    objectData = Array(mapSize).fill().map(() => Array(mapSize).fill(null));

    const islandSize = 14; 
    const startPos = Math.floor((mapSize - islandSize) / 2);
    const endPos = startPos + islandSize;
    
    for (let y = startPos; y < endPos; y++) {
        for (let x = startPos; x < endPos; x++) {
            if (x === startPos || x === endPos - 1 || y === startPos || y === endPos - 1) {
                mapData[y][x] = 3; 
            } else {
                mapData[y][x] = (Math.random() < 0.15) ? 2 : 1; 
                let rand = Math.random();
                if (rand < 0.12) {
                    objectData[y][x] = { type: 'tree', health: 3 };
                } else if (rand < 0.22) { 
                    objectData[y][x] = { type: 'rock', health: 5 };
                }
            }
        }
    }
}
generateMap();

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

// --- 3. INPUT (KAMERA BOUND JAVÍTVA) ---
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
        
        let nextX = mapOffsetX + deltaX;
        let nextY = mapOffsetY + deltaY;

        // Kamera korlát (Bound) - nem engedi elveszni a szigetet
        const margin = 400; 
        if (nextX > -margin && nextX < window.innerWidth + margin) mapOffsetX = nextX;
        if (nextY > -margin && nextY < window.innerHeight + margin) mapOffsetY = nextY;

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
                let isTree = (target.type === 'tree');
                update(ref(db, `users/${currentPlayer}`), {
                    money: increment(isTree ? 10 : 20),
                    wood: increment(isTree ? 5 : 0),
                    stone: increment(isTree ? 0 : 3)
                });
                objectData[ty][tx] = null;
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
    ui.style.display = 'flex'; // Itt flex kell a szép elrendezéshez
    
    document.getElementById('player-name').innerText = user;

    mapOffsetX = window.innerWidth / 2;
    mapOffsetY = 100;

    resizeCanvas(); 
    onValue(ref(db, `users/${user}`), (snap) => {
        const data = snap.val();
        if (data) {
            document.getElementById('money-display').innerText = data.money || 0;
            document.getElementById('wood-display').innerText = data.wood || 0;
            document.getElementById('stone-display').innerText = data.stone || 0;
        }
    });
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