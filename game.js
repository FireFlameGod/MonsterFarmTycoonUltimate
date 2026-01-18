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

// Térkép beállítások
const tileW = 64; 
const tileH = 32; 
let mapOffsetX = window.innerWidth / 2; 
let mapOffsetY = 150;

// SZIGET TÉRKÉP (10x10)
const mapData = [
    [0,0,0,0,0,0,0,0,0,0],
    [0,0,1,1,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,1,0],
    [0,1,1,1,1,1,1,1,1,0],
    [0,1,1,1,1,1,1,1,1,0],
    [0,1,1,1,1,1,1,1,1,0],
    [0,1,1,1,1,1,1,1,1,0],
    [0,1,1,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,1,1,0,0],
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < mapData.length; y++) {
        for (let x = 0; x < mapData[y].length; x++) {
            let screenX = (x - y) * (tileW / 2) + mapOffsetX;
            let screenY = (x + y) * (tileH / 2) + mapOffsetY;
            drawTile(screenX, screenY, mapData[y][x]);
        }
    }
}

function drawTile(x, y, type) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + tileW / 2, y + tileH / 2);
    ctx.lineTo(x, y + tileH);
    ctx.lineTo(x - tileW / 2, y + tileH / 2);
    ctx.closePath();

    if (type === 1) {
        ctx.fillStyle = "#2ecc71"; 
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#27ae60"; 
        ctx.stroke();
    } else {
        ctx.fillStyle = "rgba(52, 152, 219, 0.3)";
        ctx.fill();
    }
}

// --- 2. INPUT KEZELÉS ---
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

// --- 3. LOGIN & RENDSZER ---
// Fontos: Globálissá tesszük a függvényeket, hogy a HTML gombok lássák őket!
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

    resizeCanvas(); drawMap();
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
