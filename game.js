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
let gameZoom = window.innerWidth < 600 ? 0.6 : 1.0;
let mapOffsetX = window.innerWidth / 2; 
let mapOffsetY = -500; 

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
        iron_ore: 5,   // Bányából
        gold_ore: 1,   // Ritka bányából
        carp: 3        // Hajóból (ponty)
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
    iron_ore: new Image(),
    gold_ore: new Image(),
    fish_common: new Image(),
    fish_rare: new Image(),
    goblin: new Image()
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
            document.getElementById('game-canvas').style.cursor = 'crosshair';
            alert("Válaszd ki a helyet a szigeten!");
        } else {
            alert("Nincs elég Commerce Coinod!");
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
    
    // --- DISCORD WEBHOOK ELŐKÉSZÍTÉSE ---
    // Ide jön majd a kód, ha meglesz a webhook URL-ed
    console.log(`Webhook küldése: ${currentPlayer} elérte a(z) ${lvl}. szintet!`);
    // sendDiscordMessage(`${currentPlayer} szintet lépett! Új szint: **${lvl}**`);
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


function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * ratio;
    canvas.height = window.innerHeight * ratio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.scale(ratio, ratio);
    
    // Mobilon kicsit távolítjuk a kamerát automatikusan
    gameZoom = window.innerWidth < 600 ? 0.6 : 1.0;
    
    drawMap();
}


async function sendDiscordMessage(msg) {
    const webhookURL = "IDE_JÖN_A_WEBHOOK_URL";
    try {
        await fetch(webhookURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: msg })
        });
    } catch (e) { console.error("Discord hiba:", e); }
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
            let screenX = (x - y) * (tileW / 2) * gameZoom + mapOffsetX;
            let screenY = (x + y) * (tileH / 2) * gameZoom + mapOffsetY;
            
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
                        scale = 1.3;
                        yOffset = 40;
                    } 
                    else if (obj.type === 'rock') {
                        scale = 0.9;
                        yOffset = 55;
                    } 
                    else if (obj.type === 'house') {
                        scale = 2.0;    // Itt növeld a ház méretét
                        yOffset = 110;   // Itt told lejjebb/feljebb
                    } 
                    else if (obj.type === 'mine') {
                        scale = 2.0;    // Itt növeld a bánya méretét
                        yOffset = 120;
                    } 
                    else if (obj.type === 'boat') {
                        scale = 2.0;
                        yOffset = 100;   // A hajó kevesebb offsetet kap, hogy a vízben üljön
                    }

                    // Kiszámoljuk a szélességet és magasságot az új scale alapján
                    let w = tileW * scale * gameZoom; // Beletettük a gameZoom-ot!
                    let h = (img.height * (w / img.width));

                    // Az yOffset-et is skálázni kell a zoommal, hogy az épület a helyén maradjon
                    let zoomedYOffset = yOffset * gameZoom;

                    // Megrajzolás (marad a korábbi logikád)
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
        
        ctx.drawImage(img, 
            Math.floor(x - (tileW / 2 * gameZoom) - (visualOverlap / 2 * gameZoom)), 
            Math.floor(y - (visualOverlap / 2 * gameZoom)), 
            drawWidth, 
            drawHeight
        );
    }
}

let isDragging = false;
let startDragX, startDragY, lastX, lastY;
let lastTouchX = 0, lastTouchY = 0;
canvas.style.cursor = 'default';
canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    startDragX = e.clientX; startDragY = e.clientY;
    lastX = e.clientX; lastY = e.clientY;
    canvas.style.cursor = 'grabbing'; // Húzáskor "megragadó" kéz
});

// MOBIL: Érintés kezdete
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        isDragging = true;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        startDragX = lastTouchX;
        startDragY = lastTouchY;
    }
}, { passive: false });

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
        canvas.style.cursor = 'grabbing';
        drawMap();
    }
});

canvas.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length === 1) {
        e.preventDefault(); // Megállítja az oldal görgetését
        
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        
        mapOffsetX += touchX - lastTouchX;
        mapOffsetY += touchY - lastTouchY;

        // Ugyanazok a határok mobilra is
        if (mapOffsetX < -500) mapOffsetX = -500;
        if (mapOffsetX > window.innerWidth + 500) mapOffsetX = window.innerWidth + 500;
        if (mapOffsetY < -1500) mapOffsetY = -1500;
        if (mapOffsetY > 500) mapOffsetY = 500;

        lastTouchX = touchX;
        lastTouchY = touchY;
        
        drawMap();
    }
}, { passive: false });

window.addEventListener('mouseup', (e) => {
    if (isDragging) {
        let moveDist = Math.hypot(e.clientX - startDragX, e.clientY - startDragY);
        if (moveDist < 5) handleMapClick(e.clientX, e.clientY);
    }
    isDragging = false;
    canvas.style.cursor = isBuilding ? 'crosshair' : 'default';
});

function handleDrag(dx, dy) {
    mapOffsetX += dx;
    mapOffsetY += dy;

    // Kamera korlátok (Bounds)
    if (mapOffsetX < -500) mapOffsetX = -500;
    if (mapOffsetX > window.innerWidth + 500) mapOffsetX = window.innerWidth + 500;
    if (mapOffsetY < -1500) mapOffsetY = -1500;
    if (mapOffsetY > 500) mapOffsetY = 500;

    drawMap();
}



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

            // --- ÚJ ADATSZERKEZET MENTÉSE ---
            const buildingData = { 
                type: isBuilding.type, 
                lvl: 1,               // Kezdő szint
                workers: 0,           // Alapból nincs benne senki
                // A ház nem fogad munkást (ő ad slotot), a bánya/hajó igen
                maxWorkers: (isBuilding.type === 'house') ? 0 : 1,
                health: 999 
            };

            set(ref(db, `islands/${currentPlayer}/${key}`), buildingData);
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
    
    const cheatBtn = document.getElementById('admin-cheat-btn');
    if (cheatBtn) {
        cheatBtn.style.display = 'block';
    }

    try {
        const userSnap = await get(ref(db, `users/${user}`));
        if (!userSnap.val().hasIsland) {
            objectData = createInitialIsland(user);
            await update(ref(db, `users/${user}`), { hasIsland: true });
        }

        // --- SZIGET FIGYELŐ (Épületek és NPC gomb kezelése) ---
        onValue(ref(db, `islands/${user}`), (snap) => {
            objectData = snap.exists() ? snap.val() : {};
            
            // Megnézzük, van-e háza a szigeten az NPC gombhoz
            const hasHouse = Object.values(objectData).some(o => o.type === 'house');
            const npcBtn = document.getElementById('npc-manage-btn');
            if (npcBtn) {
                npcBtn.style.display = hasHouse ? 'block' : 'none';
            }

            updateShopAvailability(objectData);
            drawMap();
        });

        // --- FELHASZNÁLÓ FIGYELŐ (Pénz, XP, Szint) ---
        onValue(ref(db, `users/${user}`), (snap) => {
            const d = snap.val();
            if (d) {
                const xp = d.xp || 0;
                const currentLevel = calculateLevel(xp);

                document.getElementById('money-display').innerText = d.coin || 0;
                document.getElementById('xp-display').innerText = xp;
                
                const lvlElement = document.getElementById('level-display');
                if (lvlElement) lvlElement.innerText = currentLevel;

                // Szintlépés figyelése
                if (lastLevel !== null && currentLevel > lastLevel) {
                    showLevelUp(currentLevel);
                }
                lastLevel = currentLevel;
            }
        });

    } catch (e) { console.error(e); }

    // A termelés kiürítve, amíg meg nem írjuk az item-rendszert
    setInterval(() => {
        if (!currentPlayer || !objectData) return;
        // Ide jön majd az érc és hal gyűjtés kódja
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
window.addEventListener('resize', resizeCanvas);