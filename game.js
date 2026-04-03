// ============================================================
// CONFIGURE YOUR EASTER EGG HUNT HERE!
// ============================================================
// The word spelled out by collecting eggs in the maze.
// Change this to any word — eggs auto-adjust to match!
const EGG_WORD = 'TIFFIN';
// The full clue message shown on the win screen:
const CLUE_MESSAGE = 'Tiffin is carrying your next clue!';
// ============================================================

// Maze: 0=wall, 1=path
// This maze has branching paths, dead ends, and two routes to the finish.
const COLS = 9;
const ROWS = 11;
const MAZE = [
//   0  1  2  3  4  5  6  7  8
    [0, 0, 0, 0, 0, 0, 0, 0, 0], // 0
    [0, 1, 1, 1, 1, 1, 0, 1, 0], // 1  S at (1,1), dead-end spur at (1,7)
    [0, 0, 0, 0, 1, 0, 0, 1, 0], // 2
    [0, 1, 1, 1, 1, 1, 1, 1, 0], // 3  wide corridor, branches left & right
    [0, 1, 0, 1, 0, 0, 0, 0, 0], // 4  left drops down, right drops down
    [0, 1, 0, 1, 1, 1, 1, 1, 0], // 5
    [0, 1, 0, 0, 0, 1, 0, 1, 0], // 6  cross-link between paths
    [0, 1, 1, 1, 1, 1, 0, 1, 0], // 7
    [0, 0, 0, 0, 1, 0, 0, 1, 0], // 8
    [0, 1, 1, 1, 1, 1, 1, 1, 0], // 9  F at (9,7)
    [0, 0, 0, 0, 0, 0, 0, 0, 0], // 10
];

const START = { row: 1, col: 1 };
const FINISH = { row: 9, col: 7 };

const EGG_COLORS = ['#FF6B8A', '#51CF66', '#339AF0', '#FCC419', '#CC5DE8', '#FF922B',
                     '#F06595', '#20C997', '#845EF7', '#FD7E14'];

// === PATHFINDING — eggs are placed automatically along the shortest path ===
function findPath() {
    const queue = [{ row: START.row, col: START.col }];
    const visited = new Set();
    const parent = {};
    const startKey = `${START.row},${START.col}`;
    visited.add(startKey);

    while (queue.length) {
        const { row: r, col: c } = queue.shift();
        if (r === FINISH.row && c === FINISH.col) break;

        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = r + dr, nc = c + dc;
            const key = `${nr},${nc}`;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS &&
                MAZE[nr][nc] === 1 && !visited.has(key)) {
                visited.add(key);
                parent[key] = `${r},${c}`;
                queue.push({ row: nr, col: nc });
            }
        }
    }

    // Trace back from finish to start
    const path = [];
    let key = `${FINISH.row},${FINISH.col}`;
    while (key && key !== `${START.row},${START.col}`) {
        const [r, c] = key.split(',').map(Number);
        path.unshift({ row: r, col: c });
        key = parent[key];
    }
    return path;
}

function placeEggs() {
    const path = findPath();
    // Exclude the finish cell itself
    const usable = path.slice(0, -1);
    const count = EGG_WORD.length;
    if (count === 0 || usable.length === 0) return [];
    const spacing = usable.length / (count + 1);
    return Array.from({ length: count }, (_, i) => {
        const idx = Math.min(Math.round(spacing * (i + 1)), usable.length - 1);
        return usable[idx];
    });
}

// Computed at game start
let eggPositions = [];

// === STATE ===
let player = { ...START };
let collected = new Set();
let cellSize = 0;
let gameActive = false;
let audioCtx = null;

// === HELPERS ===
const $ = (id) => document.getElementById(id);

// === AUDIO ===
function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

function playNote(freq, duration, delay = 0) {
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        const t = ctx.currentTime + delay;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.start(t);
        osc.stop(t + duration);
    } catch (e) { /* audio not available */ }
}

function playCollectSound() {
    playNote(523, 0.1, 0);
    playNote(659, 0.1, 0.1);
    playNote(784, 0.2, 0.2);
}

function playWinSound() {
    [523, 659, 784, 1047].forEach((f, i) => playNote(f, 0.3, i * 0.15));
}

function playBump() {
    playNote(200, 0.08);
}

function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
}

// === SCREENS ===
function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    $(id).classList.add('active');
}

// === CELL SIZE CALCULATION ===
function calcCellSize() {
    const pad = 20;
    const letterBarH = 60;
    const dpadH = 136;
    const eggCountH = 24;
    const gaps = 30;
    const availH = window.innerHeight - letterBarH - dpadH - eggCountH - gaps - pad;
    const availW = window.innerWidth - pad;
    const fromH = Math.floor(availH / ROWS);
    const fromW = Math.floor(availW / COLS);
    return Math.max(28, Math.min(fromH, fromW, 52));
}

// === MAZE RENDERING ===
function renderMaze() {
    cellSize = calcCellSize();
    document.documentElement.style.setProperty('--cell', cellSize + 'px');

    const maze = $('maze');
    maze.innerHTML = '';
    maze.style.gridTemplateColumns = `repeat(${COLS}, ${cellSize}px)`;
    maze.style.gridTemplateRows = `repeat(${ROWS}, ${cellSize}px)`;

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.style.width = cellSize + 'px';
            cell.style.height = cellSize + 'px';

            if (MAZE[r][c] === 0) {
                cell.classList.add('cell-wall');
            } else if (r === FINISH.row && c === FINISH.col) {
                cell.classList.add('cell-path', 'cell-finish');
            } else {
                cell.classList.add('cell-path');
            }
            maze.appendChild(cell);
        }
    }

    // Render eggs
    const wrapper = $('maze-wrapper');
    wrapper.querySelectorAll('.egg').forEach((e) => e.remove());

    eggPositions.forEach((pos, i) => {
        if (collected.has(i)) return;
        const egg = document.createElement('div');
        egg.className = 'egg';
        egg.id = `egg-${i}`;
        egg.style.backgroundColor = EGG_COLORS[i % EGG_COLORS.length];
        egg.style.width = (cellSize * 0.7) + 'px';
        egg.style.height = (cellSize * 0.85) + 'px';
        egg.style.left = (pos.col * cellSize + cellSize * 0.15) + 'px';
        egg.style.top = (pos.row * cellSize + cellSize * 0.075) + 'px';
        egg.textContent = '?';
        wrapper.appendChild(egg);
    });

    updatePlayerPosition();
}

function updatePlayerPosition() {
    const p = $('player');
    const size = cellSize * 0.8;
    const offset = (cellSize - size) / 2;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = (player.col * cellSize + offset) + 'px';
    p.style.top = (player.row * cellSize + offset) + 'px';
}

// === LETTER BAR ===
function renderLetterBar() {
    const bar = $('letter-bar');
    bar.innerHTML = '';
    for (let i = 0; i < EGG_WORD.length; i++) {
        const slot = document.createElement('div');
        slot.className = 'letter-slot';
        slot.id = `slot-${i}`;
        slot.style.backgroundColor = EGG_COLORS[i % EGG_COLORS.length];

        const q = document.createElement('span');
        q.className = 'question-mark';
        q.textContent = '?';

        const l = document.createElement('span');
        l.className = 'letter-text';
        l.textContent = EGG_WORD[i];

        slot.appendChild(q);
        slot.appendChild(l);
        bar.appendChild(slot);
    }
}

function revealLetter(index) {
    const slot = $(`slot-${index}`);
    if (slot) slot.classList.add('collected');
}

// === EGG COUNT ===
function updateEggCount() {
    $('egg-count').textContent = `Eggs: ${collected.size} / ${EGG_WORD.length}`;
}

// === PLAYER MOVEMENT ===
function movePlayer(dr, dc) {
    if (!gameActive) return;

    const newRow = player.row + dr;
    const newCol = player.col + dc;

    if (newRow < 0 || newRow >= ROWS || newCol < 0 || newCol >= COLS) {
        playBump();
        return;
    }
    if (MAZE[newRow][newCol] === 0) {
        playBump();
        return;
    }

    player.row = newRow;
    player.col = newCol;
    updatePlayerPosition();

    // Check for egg at new position
    eggPositions.forEach((pos, i) => {
        if (pos.row === newRow && pos.col === newCol && !collected.has(i)) {
            collectEgg(i);
        }
    });

    // Check for finish
    if (newRow === FINISH.row && newCol === FINISH.col) {
        if (collected.size === EGG_WORD.length) {
            gameActive = false;
            setTimeout(showWin, 400);
        }
    }
}

function collectEgg(index) {
    collected.add(index);
    vibrate(50);
    playCollectSound();

    const eggEl = $(`egg-${index}`);
    if (eggEl) eggEl.classList.add('collected');

    revealLetter(index);
    updateEggCount();
}

// === WIN ===
function showWin() {
    vibrate([100, 50, 100, 50, 200]);
    playWinSound();
    createConfetti();

    const winWord = $('win-word');
    winWord.innerHTML = '';
    for (let i = 0; i < EGG_WORD.length; i++) {
        const letter = document.createElement('div');
        letter.className = 'win-letter';
        letter.style.backgroundColor = EGG_COLORS[i % EGG_COLORS.length];
        letter.style.animationDelay = (i * 0.15) + 's';
        letter.textContent = EGG_WORD[i];
        winWord.appendChild(letter);
    }

    $('clue-text').textContent = CLUE_MESSAGE;
    showScreen('win-screen');
}

function createConfetti() {
    const container = $('confetti');
    container.innerHTML = '';
    const colors = ['#FF6B8A', '#51CF66', '#339AF0', '#FCC419', '#CC5DE8', '#FF922B', '#F06595', '#20C997'];
    for (let i = 0; i < 80; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = (Math.random() * 100) + '%';
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.width = (Math.random() * 8 + 4) + 'px';
        piece.style.height = (Math.random() * 14 + 6) + 'px';
        piece.style.animationDelay = (Math.random() * 3) + 's';
        piece.style.animationDuration = (Math.random() * 2 + 2) + 's';
        container.appendChild(piece);
    }
}

// === SWIPE CONTROLS ===
function setupSwipe() {
    let startX = 0, startY = 0;
    const MIN_SWIPE = 30;

    const wrapper = $('maze-wrapper');

    wrapper.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
    }, { passive: true });

    wrapper.addEventListener('touchmove', (e) => {
        e.preventDefault();
    }, { passive: false });

    wrapper.addEventListener('touchend', (e) => {
        const t = e.changedTouches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;

        if (Math.abs(dx) < MIN_SWIPE && Math.abs(dy) < MIN_SWIPE) return;

        if (Math.abs(dx) > Math.abs(dy)) {
            movePlayer(0, dx > 0 ? 1 : -1);
        } else {
            movePlayer(dy > 0 ? 1 : -1, 0);
        }
    }, { passive: true });
}

// === D-PAD CONTROLS ===
function setupDpad() {
    document.querySelectorAll('.dpad-btn').forEach((btn) => {
        const dr = parseInt(btn.dataset.dr);
        const dc = parseInt(btn.dataset.dc);
        btn.addEventListener('click', () => movePlayer(dr, dc));
    });
}

// === KEYBOARD CONTROLS ===
function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
        if (!gameActive) return;
        switch (e.key) {
            case 'ArrowUp': movePlayer(-1, 0); e.preventDefault(); break;
            case 'ArrowDown': movePlayer(1, 0); e.preventDefault(); break;
            case 'ArrowLeft': movePlayer(0, -1); e.preventDefault(); break;
            case 'ArrowRight': movePlayer(0, 1); e.preventDefault(); break;
        }
    });
}

// === PHOTO CHECK ===
function checkPhoto() {
    const img = new Image();
    img.src = 'joshy.jpg';
    img.onerror = () => {
        $('player').classList.add('no-photo');
    };
}

// === START GAME ===
function startGame() {
    getAudioCtx();

    player = { ...START };
    collected = new Set();
    eggPositions = placeEggs();
    gameActive = true;

    showScreen('game-screen');
    renderLetterBar();
    renderMaze();
    updateEggCount();
}

// === INIT ===
function init() {
    $('start-btn').addEventListener('click', startGame);
    setupSwipe();
    setupDpad();
    setupKeyboard();
    checkPhoto();

    window.addEventListener('resize', () => {
        if (gameActive) renderMaze();
    });
}

init();
