import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, child, update, increment, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const auth = getAuth(app); // <--- EZT ADD HOZZÁ!
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let currentPlayer = null;
const isMobile = window.innerWidth < 768;
let gameZoom = isMobile ? 0.6 : 1.0; // Mobilon távolabb van a kamera, hogy többet láss
let mapOffsetX = isMobile ? window.innerWidth / 2 : 500; 
let mapOffsetY = isMobile ? 50 : -500;
let currentInvTab = 'fish';


const tileW = 128; 
const tileH = 64; 
const mapSize = 30; 
const visualOverlap = 20;

//let mapOffsetX = window.innerWidth / 2; 
//let mapOffsetY = -500; 

let mapData = [];
let objectData = {
  "y_x": {
    "type": "mine",
    "lvl": 1,
    "workers": 1, // Hány NPC van ott jelenleg
    "maxWorkers": 1 // Mennyi a limit (Lvl 1-nél 1)
  }
}; 

let isBuilding = null;
let lastLevel = null;
const rewards = {
    tree: { coin: 15, xp: 10, health: 3 },
    rock: { coin: 30, xp: 25, health: 5 },
    house: { health: 999 },
    boat: { health: 999 },
    mine: { health: 999 }
};

const userData = {
    coin: 1000,
    xp: 500,
    inventory: {
        fish: 0,   // Bányából
        fish2: 0,   // Ritka bányából
        fish3: 0,
        kraken: 0,
        green_jade: 0,
        purple_jade: 0        // Hajóból (ponty)
    },
    unlocked_npc_slots: 1 // A ház adja
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
    mine: 'assets/mine.png',
    fish: 'icons/fish1.png',
    fish2: 'icons/fish2.png',
    fish3: 'icons/fish3.png',
    kraken: 'icons/kraken.png',
    green_jade: 'icons/green_jade.png',
    purple_jade: 'icons/purple_jade.png'
};

const MINING_TIME = 10000; // 10 másodperc
let floatingIcons = [];
let isGameRunning = true;
Object.keys(fileNames).forEach(key => {
    images[key] = new Image();
    images[key].src = fileNames[key];
    images[key].onload = () => { if (currentPlayer) drawMap(); };
});
let gameStarted = false;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentPlayer = user.uid;
        
        // 1. Elrejtjük a bejelentkező felületet
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.style.display = 'none';

        // 2. Csak egyszer indítjuk el a játékot
        if (!gameStarted) {
            gameStarted = true;
            startGame(); 
        }
    } else {
        // 3. Ha nincs belépve (vagy kilépett), mutassuk a login-t
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.style.display = 'flex'; // vagy 'block'
        gameStarted = false;
    }
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
            document.getElementById('game-canvas').style.cursor = 'crosshair';
            showStatus("Válaszd ki az épület helyét!");   
        } else {

        }
    });
};

// XP Matek: Megmondja, hányas szintű vagy az XP-d alapján
function calculateLevel(xp) {
    // Képlet: level = (XP / 100) ^ (1 / 1.5)
    // Ez azt jelenti: Lv1: 0 XP, Lv2: 100 XP, Lv3: 282 XP, Lv4: 520 XP...
    if (!xp || xp < 100) return 1;
    return Math.floor(Math.pow(xp / 100, 1 / 1.5)) + 1;
}

function getTotalXpForLevel(level) {
    if (level <= 1) return 0;
    // Visszafelé számoljuk: XP = 100 * (level - 1) ^ 1.5
    return Math.floor(100 * Math.pow(level - 1, 1.5));
}

// Függvény XP adáshoz (ezt hívd meg, ha a játékos csinál valamit)
window.addXp = function(amount) {
    if (currentPlayer) {
        update(ref(db, `users/${currentPlayer}`), {
            xp: increment(amount)
        });
    }
};


window.showLevelUp = function(lvl) {
    document.getElementById('new-level-number').innerText = lvl;
    document.getElementById('level-up-modal').style.display = 'flex';
    
    const message = `🚀 **${currentPlayer}** szintet lépett! Új szint: **${lvl}** a szigeten! 🏝️`;
    
    // Meghívjuk a korábban megírt proxy-s függvényt
    sendDiscordLog(message);
};

window.closeLevelUp = function() {
    document.getElementById('level-up-modal').style.display = 'none';
};

window.openNpcModal = function() {
    const stats = getNpcStats();
    document.getElementById('free-npc-count').innerText = stats.free;
    document.getElementById('total-npc-count').innerText = stats.total;
    
    const container = document.getElementById('npc-workplaces');
    container.innerHTML = ""; // Alaphelyzet

    Object.keys(objectData).forEach(key => {
        const obj = objectData[key];
        if (obj.type === 'mine' || obj.type === 'boat') {
            const div = document.createElement('div');
            div.className = 'shop-item';
            div.innerHTML = `
                <span>${obj.type === 'mine' ? '⛏️ Bánya' : '⛵ Hajó'} (Munkás: ${obj.workers || 0}/1)</span>
                <button onclick="assignWorker('${key}')" ${stats.free > 0 && (obj.workers || 0) < 1 ? '' : 'disabled'}>+</button>
                <button onclick="removeWorker('${key}')" ${(obj.workers || 0) > 0 ? '' : 'disabled'}>-</button>
            `;
            container.appendChild(div);
        }
    });
    
    document.getElementById('npc-modal').style.display = 'flex';
}

window.closeNpcModal = function() {
    document.getElementById('npc-modal').style.display = 'none';
}

window.assignWorker = function(key) {
    const stats = getNpcStats();
    if (stats.free > 0) {
        update(ref(db, `islands/${currentPlayer}/${key}`), {
            workers: increment(1)
        });
        setTimeout(openNpcModal, 200); // Ablak frissítése
    }
};

window.removeWorker = function(key) {
    if (objectData[key].workers > 0) {
        update(ref(db, `islands/${currentPlayer}/${key}`), {
            workers: increment(-1)
        });
        setTimeout(openNpcModal, 200);
    }
};


// Inventory ablak nyitás/csukás
window.toggleInventory = function() {
    const win = document.getElementById('inventory-window');
    const isOpen = win.style.display === 'flex';
    win.style.display = isOpen ? 'none' : 'flex';
    
    if (!isOpen) {
        refreshInventoryUI();
    }
};

window.switchInvTab = function(tabId) {
    currentInvTab = tabId;
    
    // Fülek vizuális váltása
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.innerText.toLowerCase().includes(tabId === 'fish' ? 'halak' : 'ércek')) {
            btn.classList.add('active');
        }
    });
    
    refreshInventoryUI();
};



window.refreshInventoryUI = async function() {
    const listContainer = document.getElementById('inventory-list');
    if (!listContainer) return;
    listContainer.innerHTML = ""; 

    const snap = await get(ref(db, `users/${currentPlayer}/inventory`));
    const inv = snap.val() || {};

    // Adatok definiálása kategóriák szerint
    const categories = {
        fish: [
            { id: 'fish', name: 'Közönséges hal' },
            { id: 'fish2', name: 'Ritka hal' },
            { id: 'fish3', name: 'Egzotikus hal' },
            { id: 'kraken', name: 'Kraken' }
        ],
        ores: [
            { id: 'green_jade', name: 'Zöld Jade' },
            { id: 'purple_jade', name: 'Lila Jade' }
        ]
    };

    // Csak az aktuális kategória elemeit jelenítjük meg
    categories[currentInvTab].forEach(item => {
        const count = inv[item.id] || 0;

        let finalIcon;
       if (fileNames[item.id]) {
            // Ha Image objektum (new Image()), akkor az .src kell nekünk
            // Ha sima string (pl. 'assets/house.png'), akkor maradhat úgy
            finalIcon = (typeof fileNames[item.id] === 'object') ? fileNames[item.id].src : fileNames[item.id];
        } else {
            finalIcon = `icons/${item.id}.png`;
        }

        if (!finalIcon || finalIcon === "" || finalIcon.includes('undefined')) {
            finalIcon = `icons/${item.id}.png`;
        }

        const row = document.createElement('div');
        row.className = "inv-row";

        row.style.opacity = (count === 0) ? "0.4" : "1";

        row.innerHTML = `
            <img src="${finalIcon}" onerror="this.src='icons/placeholder.png'" style="width:30px; height:30px; margin-right:10px;">
            <span class="item-name">${item.name}</span>
            <span class="item-count">${count} db</span>
        `;
        
        listContainer.appendChild(row);
    });
};

function gameLoop() {
    if (!isGameRunning) return;

    drawMap(); 

    // Ez a sor gondoskodik róla, hogy csak akkor rajzoljon, ha kell
    requestAnimationFrame(gameLoop);
}


function showStatus(text) {
    const el = document.getElementById('game-status');
    el.innerText = text;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 2000);
}

async function logToDiscord(msg) {
    const proxyUrl = "https://script.google.com/macros/s/AKfycbwXyNt9AwP9fF2Bfn7v-bP3jP3OBIRYx5ZXv2ir3-2pNlWCQFfGFHnI8i25YGTnE7g/exec";

    try {
        await fetch(proxyUrl, {
            method: 'POST',
            mode: 'no-cors', // Fontos a Google Script miatt
            body: JSON.stringify({ message: msg })
        });
    } catch (e) {
        console.log("Discord log hiba, de a játék megy tovább.");
    }
}

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

function getNpcStats() {
    let totalCapacity = 0;
    let currentlyWorking = 0;

    Object.values(objectData).forEach(obj => {
        // A ház adja a férőhelyet
        if (obj.type === 'house') {
            // Ha lvl 1 -> 2, ha lvl 2 -> 4
            let capacity = (obj.lvl === 2) ? 4 : 2; 
            totalCapacity += capacity;
        }
        // Dolgozók összeszámolása
        if (obj.type === 'mine' || obj.type === 'boat') {
            currentlyWorking += (obj.workers || 0);
        }
    });
    return {
        total: totalCapacity,
        busy: currentlyWorking,
        free: totalCapacity - currentlyWorking
    };
}


async function calculateOfflineEarnings() {
    if (!currentPlayer || !objectData) return;

    const userRef = ref(db, `users/${currentPlayer}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists() && snapshot.val().lastActive) {
        const lastActive = snapshot.val().lastActive;
        const now = Date.now();
        
        // Kiszámoljuk az eltelt másodperceket
        const elapsedSeconds = Math.floor((now - lastActive) / 1000);
        
        // Csak akkor számolunk, ha több mint 30 másodpercre ment el
        if (elapsedSeconds > 30) {
            let totalGreenJade = 0;
            let totalPurpleJade = 0;

            // Végignézzük a bányákat a betöltött objectData-ban
            for (const key in objectData) {
                const obj = objectData[key];
                if (obj.type === 'mine' && obj.workers > 0) {
                    // Hány 10 másodperces ciklus telt el? (10000ms = 10s)
                    const cycles = Math.floor(elapsedSeconds / 10);
                    
                    // Valószínűségi alapon elosztjuk (70% zöld, 30% lila)
                    for (let i = 0; i < cycles; i++) {
                        if (Math.random() < 0.3) {
                            totalPurpleJade += obj.workers;
                        } else {
                            totalGreenJade += obj.workers;
                        }
                    }
                }
            }

            // Ha találtunk valamit, mentsük el és mutassuk meg
            if (totalGreenJade > 0 || totalPurpleJade > 0) {
                // Firebase mentés - Green Jade
                if (totalGreenJade > 0) {
                    const gRef = ref(db, `users/${currentPlayer}/inventory/green_jade`);
                    const gSnap = await get(gRef);
                    await set(gRef, (gSnap.val() || 0) + totalGreenJade);
                }
                // Firebase mentés - Purple Jade
                if (totalPurpleJade > 0) {
                    const pRef = ref(db, `users/${currentPlayer}/inventory/purple_jade`);
                    const pSnap = await get(pRef);
                    await set(pRef, (pSnap.val() || 0) + totalPurpleJade);
                }

                // UI megjelenítése
                const modal = document.getElementById('afk-modal');
                const rewardDiv = document.getElementById('afk-rewards');
                
                if (modal && rewardDiv) {
                    // Megkeressük a már betöltött képek forrását (src)
                    const greenSrc = images['green_jade'] ? images['green_jade'].src : 'assets/green_jade.png';
                    const purpleSrc = images['purple_jade'] ? images['purple_jade'].src : 'assets/purple_jade.png';

                    rewardDiv.innerHTML = `
                        <p style="display:flex; align-items:center; justify-content:center; gap:10px;">
                            <img src="${greenSrc}" width="30"> <b>${totalGreenJade}</b> Green Jade
                        </p>
                        <p style="display:flex; align-items:center; justify-content:center; gap:10px;">
                            <img src="${purpleSrc}" width="30"> <b>${totalPurpleJade}</b> Purple Jade
                        </p>
                    `;
                    modal.style.display = 'block';
                }
            }
        }
    }
}


// Ez a függvény elindul egyszer, és folyamatosan fut a háttérben
function startProductionCycle() {
    setInterval(async () => {
        // Végignézzük az összes objektumot a térképen
        for (const key in objectData) {
            const obj = objectData[key];

            // Ha bánya és van benne munkás
            if (obj.type === 'mine' && obj.workers > 0) {
                const coords = key.split('_');
                const y = parseInt(coords[0]);
                const x = parseInt(coords[1]);
                await processMining(obj.workers, x, y);
            }
          
            // Itt később jöhet a hajó is:
            // if (obj.type === 'boat' && obj.workers > 0) { ... }
        }
        if (currentPlayer) {
            set(ref(db, `users/${currentPlayer}/lastActive`), Date.now());
        }
    }, MINING_TIME);
}

// Maga a bányászati logika
async function processMining(workerCount, mineX, mineY) {
    // 70% Green Jade, 30% Purple Jade
    const isPurple = Math.random() < 0.3;
    const itemKey = isPurple ? 'purple_jade' : 'green_jade';
    
    const amount = workerCount; 

    console.log(`Bányászat sikeres: +${amount} ${itemKey}`);

    // Mentés Firebase-be
    const invRef = ref(db, `users/${currentPlayer}/inventory/${itemKey}`);
    
    const snap = await get(invRef);
    const current = snap.val() || 0;
    await set(invRef, current + amount);

    // JAVÍTÁS: Dupla perjel (//) a komment elejére!
    // Képernyő koordináták kiszámolása az animációhoz
    const zW = tileW * gameZoom;
    const zH = tileH * gameZoom;
    
    // Izometrikus képlet - JAVÍTÁS: mineX és mineY használata
    let screenX = (mineX - mineY) * (zW / 2) + mapOffsetX;
    let screenY = (mineX + mineY) * (zH / 2) + mapOffsetY;

    // Indítjuk az ikont a kiszámolt ponton
    createFloatingIcon(mineX, mineY, itemKey);

    // Ha nyitva az inventory, frissítsük a látványt
    if (typeof refreshInventoryUI === "function" && 
        document.getElementById('inventory-window') && 
        document.getElementById('inventory-window').style.display === 'flex') {
        refreshInventoryUI();
    }
}

function createFloatingIcon(gridX, gridY, itemId) {
    floatingIcons.push({
        gridX: gridX,
        gridY: gridY,
        yOffset: 0, // Ez fog növekedni, ahogy száll fel
        itemId: itemId,
        opacity: 1,
        life: 1.0
    });
}

function drawFloatingIcons() {
    const zW = tileW * gameZoom;
    const zH = tileH * gameZoom;

    for (let i = floatingIcons.length - 1; i >= 0; i--) {
        let icon = floatingIcons[i];
        
        // Számoljuk ki, hol van a bánya MOST a képernyőn
        let screenX = (icon.gridX - icon.gridY) * (zW / 2) + mapOffsetX;
        let screenY = (icon.gridX + icon.gridY) * (zH / 2) + mapOffsetY;

        // Az ikon emelkedése
        icon.yOffset -= 1.5; 
        icon.opacity -= 0.015;
        icon.life -= 0.015;

        ctx.save();
        ctx.globalAlpha = icon.opacity;
        
        const img = images[icon.itemId];
        if (img) {
            // A screenY-hoz hozzáadjuk az emelkedést (yOffset)
            ctx.drawImage(img, screenX - 10, screenY + icon.yOffset - 60, 25, 25);
        }
        
        ctx.fillStyle = "white";
        ctx.font = `bold ${14 * gameZoom}px Arial`;
        ctx.fillText("+1", screenX + 15, screenY + icon.yOffset - 45);
        
        ctx.restore();

        if (icon.life <= 0) {
            floatingIcons.splice(i, 1);
        }
    }
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
    if (!ctx || !objectData) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const zW = tileW * gameZoom;
    const zH = tileH * gameZoom;
    const zOverlap = visualOverlap * gameZoom;

    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            let screenX = (x - y) * (zW / 2) + mapOffsetX;
            let screenY = (x + y) * (zH / 2) + mapOffsetY;
            
            if (screenX > -zW && screenX < canvas.width + zW && 
                screenY > -zH && screenY < canvas.height + zH) {
                
                drawTile(screenX, screenY, mapData[y][x], zW, zH, zOverlap);

                const key = `${y}_${x}`;
                let obj = objectData[key]; 
                
                if (obj && images[obj.type] && images[obj.type].complete) {
                    let img = images[obj.type];
                    let scale = 1.0;
                    let yOffset = 40;
                    let bounce = 0;
                    let squashW = 0; // Itt adjuk meg nekik a 0 alapértéket
                    let squashH = 0;
                    // Beállítások típusonként
                    if (obj.type === 'tree') { scale = 1.3; yOffset = 40; } 
                    else if (obj.type === 'rock') { scale = 0.9; yOffset = 55; } 
                    else if (obj.type === 'house') { scale = 2.0; yOffset = 110; } 
                    else if (obj.type === 'mine') { 
                        scale = 2.0; 
                        yOffset = 120; 
                        if (obj.workers > 0) {
                            // Egy közös animációs alap (sinus hullám)
                            let anim = Math.sin(Date.now() / 250); 
                            
                            // Ugrás: csak a hullám pozitív részében ugrik fel
                            bounce = Math.max(0, anim) * (2 * gameZoom);
                            
                            // Rugalmasság: -10 és +10 pixel között változik a zoom függvényében
                            let strength = 5 * gameZoom;
                            squashW = -anim * strength; 
                            squashH = anim * strength;
                        }
                    } 
                    else if (obj.type === 'boat') { scale = 2.0; yOffset = 100; }

                    // Méretek kiszámolása az animált értékekkel
                    let w = zW * scale;
                    let h = (img.height * (w / img.width));
                    let finalYOffset = yOffset * gameZoom;

                    let finalW = w + squashW;
                    let finalH = h + squashH;

                    if (obj.isShaking) {
                        // A rázkódásnál is adjuk hozzá a bounce-t, hogy ne akadjon össze
                        ctx.globalAlpha = 0.6;
                        ctx.drawImage(img, screenX - finalW/2 + (Math.random()*4-2), (screenY - h + (zH / 2) + finalYOffset) - bounce - squashH, finalW, finalH);
                        ctx.globalAlpha = 1.0;
                    } else {
                        // A tiszta rajzolás
                        ctx.drawImage(
                            img, 
                            screenX - finalW / 2, 
                            (screenY - h + (zH / 2) + finalYOffset) - bounce - squashH, 
                            finalW, 
                            finalH
                        );
                    }
                }
            }
        }
    }

    // LEBEGŐ IKONOK RAJZOLÁSA (A ciklus után, hogy minden felett legyen)
    if (typeof drawFloatingIcons === "function") {
        drawFloatingIcons();
    }
}

function drawTile(x, y, type, zW, zH, zOverlap) {
    let img = images.water;
    if (type === 1) img = images.grass;
    else if (type === 2) img = images.flower;
    else if (type === 3) img = images.sand;
    
    if (img && img.complete) {
        // Kiszámoljuk a rajzolási magasságot a zoomolt szélesség alapján
        let drawHeight = img.height * (zW / img.width);
        
        ctx.drawImage(
            img, 
            Math.floor(x - (zW / 2) - (zOverlap / 2)), 
            Math.floor(y - (zOverlap / 2)), 
            zW + zOverlap, 
            drawHeight + zOverlap
        );
    }
}

let isDragging = false;
let startDragX, startDragY, lastX, lastY;

canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    startDragX = e.clientX; startDragY = e.clientY;
    lastX = e.clientX; lastY = e.clientY;
    
    // Elkerüljük a szövegkijelölést húzás közben
    canvas.setPointerCapture(e.pointerId);
});

window.addEventListener('pointermove', (e) => {
    if (isDragging) {
        mapOffsetX += e.clientX - lastX;
        mapOffsetY += e.clientY - lastY;

        if (isMobile) {
            // MOBIL HATÁROK (Engedékenyebb, hogy a kis képernyőn is mozogjon)
            if (mapOffsetX < -200) mapOffsetX = -200;
            if (mapOffsetX > window.innerWidth + 200) mapOffsetX = window.innerWidth + 200;
            if (mapOffsetY < -800) mapOffsetY = -800;
            if (mapOffsetY > 400) mapOffsetY = 400;
        } else {
            // EREDETI GÉPI HATÁROK (Változatlanul hagytuk neked!)
            if (mapOffsetX < 0) mapOffsetX = 0;
            if (mapOffsetX > window.innerWidth) mapOffsetX = window.innerWidth;
            if (mapOffsetY < -1000) mapOffsetY = -1000;
            if (mapOffsetY > 0) mapOffsetY = 0;
        }

        lastX = e.clientX; 
        lastY = e.clientY;
        drawMap();
    }
});

window.addEventListener('pointerup', (e) => {
    if (isDragging) {
        canvas.releasePointerCapture(e.pointerId);
        let moveDist = Math.hypot(e.clientX - startDragX, e.clientY - startDragY);
        // Ha alig mozdult el az ujja/egere, akkor az kattintás
        if (moveDist < 10) handleMapClick(e.clientX, e.clientY);
    }
    isDragging = false;
});

function handleMapClick(mouseX, mouseY) {
    let mx = (mouseX - mapOffsetX) / gameZoom; // Visszaosztjuk a zoommal!
    let my = (mouseY - mapOffsetY) / gameZoom; // Visszaosztjuk a zoommal!
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

            // --- ÚJ ADATSZERKEZET MENTÉSE ---
            const buildingData = { 
                type: isBuilding.type, 
                lvl: 1,               // Kezdő szint
                workers: 0,           // Alapból nincs benne senki
                // A ház nem fogad munkást (ő ad slotot), a bánya/hajó igen
                maxWorkers: (isBuilding.type === 'house') ? 0 : 1,
                health: 999 
            };

            set(ref(db, `islands/${currentPlayer}/${key}`), { type: isBuilding.type, health: 999 });
            isBuilding = null;
            canvas.style.cursor = 'default';
        } else {
            isBuilding = null;
            showStatus("Ide nem építhetsz!");
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

window.loginOrRegister = async function() {
    const username = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    const errorDisplay = document.getElementById('error-msg');
    
    // Funkció az üzenet megjelenítésére
    const showMsg = (text) => {
        errorDisplay.innerText = text;
        errorDisplay.style.display = 'block';
    };

    // Alap ellenőrzések
    if (!username || !pass) {
        showMsg("Kérlek, tölts ki minden mezőt!");
        return;
    }
    
    if (pass.length < 6) {
        showMsg("A jelszónak legalább 6 karakternek kell lennie!");
        return;
    }

    const fakeEmail = `${username}@monsterfarm.hu`;

    try {
        await signInWithEmailAndPassword(auth, fakeEmail, pass);
        // Ha sikerült, az onAuthStateChanged elintézi a többit
    } catch (error) {
        console.log("Auth hiba kódja:", error.code);

        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            // Megpróbáljuk regisztrálni, hátha új felhasználó
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, pass);
                
                // Adatbázis alapértékek beállítása
                await set(ref(db, 'users/' + userCredential.user.uid), {
                    username: username,
                    coin: 0,
                    xp: 0,
                    hasIsland: false
                });
                
                showMsg("Sikeres regisztráció! Belépés...");
            } catch (regError) {
                if (regError.code === 'auth/email-already-in-use') {
                    showMsg("Ez a név már foglalt, vagy rossz jelszó!");
                } else {
                    showMsg("Hiba történt: " + regError.message);
                }
            }
        } else if (error.code === 'auth/wrong-password') {
            showMsg("Hibás jelszó ehhez a névhez!");
        } else {
            showMsg("Hiba: " + error.message);
        }
    }
};

async function startGame(user) {
    currentPlayer = user;
    localStorage.setItem('mf_user', user);
    localStorage.setItem('mf_pass', document.getElementById('password').value);
    
    // UI MEGJELENÍTÉSE
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex'; 
    
    // Oldalsó menü (Bolt, Kilépés) megjelenítése
    const sideMenu = document.getElementById('side-menu-layer');
    if (sideMenu) sideMenu.style.display = 'flex';

    document.getElementById('player-name').innerText = user;

    // KAMERA IGAZÍTÁSA
    if (isMobile) {
        mapOffsetX = window.innerWidth / 2;
        mapOffsetY = 100;
    } else {
        mapOffsetX = 500;
        mapOffsetY = -300;
    }

    const cheatBtn = document.getElementById('admin-cheat-btn');
    if (cheatBtn) cheatBtn.style.display = 'block';

    try {
        const userSnap = await get(ref(db, `users/${user}`));
        if (!userSnap.val().hasIsland) {
            objectData = createInitialIsland(user);
            await update(ref(db, `users/${user}`), { hasIsland: true });
        }

        // --- SZIGET FIGYELŐ ---
        onValue(ref(db, `islands/${user}`), (snap) => {
            objectData = snap.exists() ? snap.val() : {};
            
            const hasHouse = Object.values(objectData).some(o => o.type === 'house');
            const npcBtn = document.getElementById('npc-manage-btn');
            if (npcBtn) {
                npcBtn.style.display = hasHouse ? 'flex' : 'none';
            }

            updateShopAvailability(objectData);
            drawMap();
        });

        // --- FELHASZNÁLÓ FIGYELŐ (XP CSÍK ÉS PÉNZ) ---
        onValue(ref(db, `users/${user}`), (snap) => {
            const d = snap.val();
            if (d) {
                const xp = d.xp || 0;
                const currentLevel = calculateLevel(xp);

                // Matek a progress barhoz (szükség van a getTotalXpForLevel függvényre!)
                const minXpForCurrent = getTotalXpForLevel(currentLevel);
                const minXpForNext = getTotalXpForLevel(currentLevel + 1);
                
                const xpGainedInLevel = xp - minXpForCurrent;
                const xpNeededForLevel = minXpForNext - minXpForCurrent;
                const progress = Math.min(100, (xpGainedInLevel / xpNeededForLevel) * 100);

                // UI Frissítés
                document.getElementById('money-display').innerText = Math.floor(d.coin || 0);
                document.getElementById('level-display').innerText = currentLevel;
                
                const xpProgress = document.getElementById('xp-progress');
                if (xpProgress) xpProgress.style.width = progress + "%";
                
                const xpText = document.getElementById('xp-text');
                if (xpText) xpText.innerText = `${Math.floor(xpGainedInLevel)} / ${Math.floor(xpNeededForLevel)} XP`;

                if (lastLevel !== null && currentLevel > lastLevel) {
                    showLevelUp(currentLevel);
                }
                lastLevel = currentLevel;
            }
        });

    } catch (e) { console.error(e); }


    // Csak egyszer futtassuk le a belépésnél
    if (!window.afkChecked) {
        calculateOfflineEarnings();
        window.afkChecked = true; // Megjegyezzük, hogy ezen a sessionön már ellenőriztük
    }
    startProductionCycle();
    gameLoop();
    setInterval(() => {
        if (!currentPlayer || !objectData) return;
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

    const startBtn = document.getElementById('login-start-btn'); 
    if (startBtn) {
        // A 'pointerdown' azonnal reagál érintésre, nem vár 300ms-ot mint a klikk
        startBtn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            window.loginOrRegister();
        });
    }
};


window.logout = async function() {
    // 1. Időpont mentése Firebase-be a kilépés előtt
    if (typeof currentPlayer !== 'undefined' && currentPlayer) {
        try {
            // Beállítjuk az utolsó aktivitást a mostani időre
            await set(ref(db, `users/${currentPlayer}/lastActive`), Date.now());
            console.log("Kijelentkezési idő elmentve.");
        } catch (error) {
            console.error("Hiba az idő mentésekor:", error);
        }
    }

    // 2. A korábbi tisztítási logika
    localStorage.clear(); 
    location.reload(); 
};
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; drawMap(); }
window.addEventListener('resize', resizeCanvas);