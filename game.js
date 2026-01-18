import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, child, update, increment, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- FIREBASE CONFIG (MARAD A RÉGI) ---
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

// Térkép beállítások
const tileW = 128; 
const tileH = 64; 
let mapOffsetX = window.innerWidth / 2; 
let mapOffsetY = 150;
const visualOverlap = 20
// KÉPEK BETÖLTÉSE
// Létrehozunk egy objektumot a képeknek
const images = {};
const fileNames = {
    grass: 'grass.png',
    flower: 'grass_flower.png',
    sand: 'sand.png',
    water: 'water.png'
};

Object.keys(fileNames).forEach(key => {
    images[key] = new Image();
    images[key].src = fileNames[key];
    images[key].onload = () => { if (currentPlayer) drawMap(); };
});


// SZIGET TÉRKÉP (1 = Fű, 0 = Víz)
const mapData = [
    [0,0,0,0,0,0,0,0,0,0],
    [0,0,3,3,3,3,3,3,0,0], // Part
    [0,3,1,1,2,1,1,1,3,0], // Fű és virág bent
    [0,3,1,2,1,1,2,1,3,0],
    [0,3,1,1,1,1,1,1,3,0],
    [0,3,2,1,1,2,1,2,3,0],
    [0,3,1,1,1,1,1,1,3,0],
    [0,3,1,1,2,1,1,1,3,0],
    [0,0,3,3,3,3,3,3,0,0],
    [0,0,0,0,0,0,0,0,0,0]
];

// Mozgatás változók
let isDragging = false;
let lastX, lastY;

// --- 1. JÁTÉKMOTOR ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawMap();
}
window.addEventListener('resize', resizeCanvas);

function drawMap() {
    if (!ctx || !images.water.complete) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // --- VÉGTELEN VÍZ HÁTTÉR ---
    // Létrehozunk egy mintát a water.png-ből
    const ptrn = ctx.createPattern(images.water, 'repeat');
    ctx.fillStyle = ptrn;
    
    // Elmentjük a rajz állapotát, eltoljuk a háttért is a kamerával, majd visszaállítjuk
    ctx.save();
    ctx.translate(mapOffsetX % tileW, mapOffsetY % tileH); 
    ctx.fillRect(-tileW * 2, -tileH * 2, canvas.width + tileW * 4, canvas.height + tileH * 4);
    ctx.restore();
    
    // Optimalizálás: image smoothing kikapcsolása pixel artnál
    ctx.imageSmoothingEnabled = false; 

    for (let y = 0; y < mapData.length; y++) {
        for (let x = 0; x < mapData[y].length; x++) {
            let screenX = (x - y) * (tileW / 2) + mapOffsetX;
            let screenY = (x + y) * (tileH / 2) + mapOffsetY;
            
            drawTile(screenX, screenY, mapData[y][x]);
        }
    }
}

function drawTile(x, y, type) {
    let img = null;
    
    // Meghatározzuk melyik kép kell a szám alapján
    if (type === 0) img = images.water;
    else if (type === 1) img = images.grass;
    else if (type === 2) img = images.flower;
    else if (type === 3) img = images.sand;

    if (img && img.complete) {
        // Kiszámoljuk a magasságot, hogy ne torzuljon a kép
        let drawHeight = img.height * (tileW / img.width);
        
        ctx.drawImage(
            img, 
            Math.floor(x - (tileW / 2) - (visualOverlap / 2)), 
            Math.floor(y - (visualOverlap / 2)), 
            tileW + visualOverlap, 
            drawHeight + visualOverlap
        );
    } else {
        // Tartalék rajzolás (ha még tölt a kép)
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + tileW / 2, y + tileH / 2);
        ctx.lineTo(x, y + tileH);
        ctx.lineTo(x - tileW / 2, y + tileH / 2);
        ctx.fillStyle = type === 0 ? "#3498db" : (type === 3 ? "#f1c40f" : "#2ecc71");
        ctx.fill();
    }
}

// --- 2. INPUT KEZELÉS (Marad a régi) ---
canvas.addEventListener('mousedown', (e) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('mousemove', (e) => {
    if (isDragging) {
        mapOffsetX += e.clientX - lastX; mapOffsetY += e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        drawMap();
    }
});
window.addEventListener('mouseup', () => isDragging = false);

// Mobil input
canvas.addEventListener('touchstart', (e) => { isDragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; e.preventDefault(); }, {passive: false});
canvas.addEventListener('touchmove', (e) => {
    if (isDragging) {
        mapOffsetX += e.touches[0].clientX - lastX; mapOffsetY += e.touches[0].clientY - lastY;
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
        drawMap();
    }
    e.preventDefault();
}, {passive: false});
canvas.addEventListener('touchend', () => isDragging = false);

// --- 3. LOGIN & RENDSZER (Marad a régi) ---
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

    resizeCanvas(); 
    // A drawMap-et majd a kép betöltése is hívja, de biztos ami biztos:
    drawMap();
    
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