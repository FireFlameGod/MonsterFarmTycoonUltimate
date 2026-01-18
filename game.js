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
let gameZoom = 1.0;
let mapOffsetX = -500; // Visszaállítva
let mapOffsetY = -200; 

let mapData = [];
let objectData = {}; 
let isBuilding = null;
let isDragging = false;
let lastX, lastY, startDragX, startDragY;

const images = {};
const fileNames = {
    grass: 'grass.png', flower: 'grass_flower.png', sand: 'sand.png', water: 'water.png',
    tree: 'tree.png', rock: 'rock.png', house: 'assets/house.png', boat: 'assets/boat.png', mine: 'assets/mine.png'
};

Object.keys(fileNames).forEach(key => { images[key] = new Image(); images[key].src = fileNames[key]; });

function drawMap() {
    if (!currentPlayer || !mapData.length) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            let screenX = (x - y) * (tileW / 2) * gameZoom + mapOffsetX;
            let screenY = (x + y) * (tileH / 2) * gameZoom + mapOffsetY;

            if (screenX > -200 && screenX < window.innerWidth + 200 && screenY > -200 && screenY < window.innerHeight + 200) {
                // Táj rajzolása
                let type = mapData[y][x];
                let img = type === 1 ? images.grass : (type === 2 ? images.flower : (type === 3 ? images.sand : images.water));
                if (img.complete) ctx.drawImage(img, screenX - (tileW/2)*gameZoom, screenY, tileW*gameZoom, tileH*gameZoom);

                // Objektumok
                const key = `${y}_${x}`;
                if (objectData[key]) {
                    let obj = objectData[key];
                    let objImg = images[obj.type];
                    if (objImg && objImg.complete) {
                        let scale = (obj.type === 'house' || obj.type === 'mine') ? 2.0 : 1.2;
                        let w = tileW * scale * gameZoom;
                        let h = (objImg.height * (w / objImg.width));
                        ctx.drawImage(objImg, screenX - w/2, screenY - h + (tileH*gameZoom), w, h);
                    }
                }
            }
        }
    }
}

function gameLoop() { drawMap(); requestAnimationFrame(gameLoop); }

canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    lastX = e.clientX; lastY = e.clientY;
    startDragX = e.clientX; startDragY = e.clientY;
});

window.addEventListener('pointermove', (e) => {
    if (isDragging) {
        mapOffsetX += e.clientX - lastX;
        mapOffsetY += e.clientY - lastY;

        // --- KAMERA BOUNDS (A kért 0 és -1000 értékek) ---
        if (mapOffsetX > 0) mapOffsetX = 0;
        if (mapOffsetX < -1000) mapOffsetX = -1000;
        if (mapOffsetY > 0) mapOffsetY = 0;
        if (mapOffsetY < -1000) mapOffsetY = -1000;

        lastX = e.clientX; lastY = e.clientY;
    }
});

window.addEventListener('pointerup', (e) => {
    if (isDragging) {
        let dist = Math.hypot(e.clientX - startDragX, e.clientY - startDragY);
        if (dist < 10) handleMapClick(e.clientX, e.clientY);
    }
    isDragging = false;
});

function handleMapClick(mx, my) {
    // Kattintás kezelés (építés/vágás) marad a régi
}

async function startGame(user) {
    currentPlayer = user;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('player-name').innerText = user;

    // Sziget generálás
    mapData = Array(mapSize).fill().map(() => Array(mapSize).fill(0));
    for(let y=8; y<22; y++) for(let x=8; x<22; x++) mapData[y][x] = 1;

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
        }
    });

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gameLoop();
}

// Window funkciók a HTML gombokhoz
window.loginOrRegister = function() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    get(child(ref(db), `users/${user}`)).then((snap) => {
        if (snap.exists() && snap.val().password === pass) startGame(user);
        else if (!snap.exists()) set(ref(db, 'users/' + user), { password: pass, coin: 500, xp: 0 }).then(() => startGame(user));
        else document.getElementById('error-msg').style.display = 'block';
    });
};

window.toggleShop = function() { 
    const s = document.getElementById('shop-window');
    s.style.display = s.style.display === 'flex' ? 'none' : 'flex';
};

window.openNpcModal = () => document.getElementById('npc-modal').style.display = 'flex';
window.closeNpcModal = () => document.getElementById('npc-modal').style.display = 'none';
window.logout = () => location.reload();