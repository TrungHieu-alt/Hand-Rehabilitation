/* Puzzle Drag & Drop – drag numbered pieces to a 4x3 grid using hand movements */
const WS_URL = "ws://localhost:8000/ws";
const cvs = document.getElementById("game");
const ctx = cvs.getContext("2d");

/* DOM elements for scoreboard */
const timeEl = document.getElementById("time");
const bestEl = document.getElementById("best");

/* ---------- puzzle state ---------- */
const GRID_ROWS = 4, GRID_COLS = 3;
const PIECE_SIZE = 100, GRID_X = (cvs.width - GRID_COLS * PIECE_SIZE) / 2, GRID_Y = 100;
const pieces = [];
let selectedPiece = null, gameOver = false, startTime = null, elapsedTime = 0;
let handX = cvs.width / 2, handY = cvs.height / 2;

/* ---------- BEST TIME helpers ---------- */
const BT_KEY = "puzzleGameBestTime";
const loadBest = () => { try { return JSON.parse(localStorage.getItem(BT_KEY))?.bestTime ?? Infinity } catch { return Infinity } };
const saveBest = t => { const cur = loadBest(); if (t < cur) { localStorage.setItem(BT_KEY, JSON.stringify({ bestTime: t })); return t; } return cur; };
let bestTime = loadBest(); bestEl.textContent = `Best Time ${bestTime === Infinity ? "0s" : Math.floor(bestTime) + "s"}`;

/* ---------- helper: palm center ---------- */
const palmCenter = lm => lm && lm.length >= 18
  ? { x: (lm[0].x + lm[5].x + lm[17].x) / 3, y: (lm[0].y + lm[5].y + lm[17].y) / 3 } : null;

/* ---------- WebSocket ---------- */
new WebSocket(WS_URL).onmessage = e => {
  const d = JSON.parse(e.data);
  /* 1. When Game Over & see Closed_Fist → reset */
  if (gameOver && d.gesture === "Closed_Fist") {
    resetGame();
    return;
  }
  /* 2. Normal: update hand coordinates */
  const pc = palmCenter(d.landmarks);
  if (!pc) return;
  handX = (1 - pc.x) * cvs.width; // invert X
  handY = pc.y * cvs.height;
  /* 3. Select or drop piece based on gesture */
  if (d.gesture === "Closed_Fist" && !selectedPiece) {
    selectPiece();
  } else if (d.gesture === "Open_Palm" && selectedPiece) {
    dropPiece();
  }
};

/* ---------- puzzle setup ---------- */
function initPuzzle() {
  pieces.length = 0;
  const numbers = Array.from({ length: 12 }, (_, i) => i + 1);
  numbers.sort(() => Math.random() - 0.5); // shuffle
  for (let i = 0; i < GRID_ROWS * GRID_COLS; i++) {
    const row = Math.floor(i / GRID_COLS), col = i % GRID_COLS;
    pieces.push({
      id: i + 1,
      number: numbers[i],
      homeX: GRID_X + col * PIECE_SIZE,
      homeY: GRID_Y + row * PIECE_SIZE,
      x: 20 + Math.random() * (cvs.width - 40),
      y: GRID_Y + GRID_ROWS * PIECE_SIZE + 20 + Math.random() * 100,
      locked: false
    });
  }
}

/* ---------- select and drop ---------- */
function selectPiece() {
  for (const p of pieces) {
    if (!p.locked && Math.hypot(p.x + PIECE_SIZE / 2 - handX, p.y + PIECE_SIZE / 2 - handY) < PIECE_SIZE / 2) {
      selectedPiece = p;
      break;
    }
  }
}

function dropPiece() {
  const p = selectedPiece;
  const col = Math.floor((p.x - GRID_X + PIECE_SIZE / 2) / PIECE_SIZE);
  const row = Math.floor((p.y - GRID_Y + PIECE_SIZE / 2) / PIECE_SIZE);
  if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
    const targetX = GRID_X + col * PIECE_SIZE;
    const targetY = GRID_Y + row * PIECE_SIZE;
    const targetId = row * GRID_COLS + col + 1;
    if (p.id === targetId) {
      p.x = targetX;
      p.y = targetY;
      p.locked = true;
      selectedPiece = null;
      checkWin();
    }
  }
  selectedPiece = null;
}

/* ---------- game loop ---------- */
function update(dt) {
  if (gameOver) return;
  if (!startTime) startTime = performance.now();
  elapsedTime = (performance.now() - startTime) / 1000;
  if (selectedPiece) {
    selectedPiece.x = handX - PIECE_SIZE / 2;
    selectedPiece.y = handY - PIECE_SIZE / 2;
  }
}

/* ---------- render & DOM update ---------- */
function draw() {
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  /* grid */
  ctx.strokeStyle = "#555"; ctx.lineWidth = 2;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      ctx.strokeRect(GRID_X + c * PIECE_SIZE, GRID_Y + r * PIECE_SIZE, PIECE_SIZE, PIECE_SIZE);
    }
  }
  /* pieces */
  pieces.forEach(p => {
    ctx.fillStyle = p.locked ? "#4af" : "#fff";
    ctx.fillRect(p.x, p.y, PIECE_SIZE, PIECE_SIZE);
    ctx.fillStyle = "#000"; ctx.font = "bold 24px Poppins"; ctx.textAlign = "center";
    ctx.fillText(p.number, p.x + PIECE_SIZE / 2, p.y + PIECE_SIZE / 2 + 8);
  });
  /* hand cursor */
  const cursorColor = selectedPiece ? '#f55' : '#09f'; // Red when grabbing, blue when not
  ctx.beginPath(); ctx.arc(handX, handY, 10, 0, Math.PI * 2); ctx.fillStyle = cursorColor; ctx.fill();
  /* update scoreboard */
  timeEl.textContent = `Time ${Math.floor(elapsedTime)}s`;
  bestEl.textContent = `Best Time ${bestTime === Infinity ? "0s" : Math.floor(bestTime) + "s"}`;
  /* game over banner */
  if (gameOver) {
    ctx.fillStyle = "#fff"; ctx.font = "bold 32px Poppins"; ctx.textAlign = "center";
    ctx.fillText("Hoàn Thành!", cvs.width / 2, cvs.height / 2);
    ctx.font = "20px Poppins";
    ctx.fillText("Nắm tay để chơi lại", cvs.width / 2, cvs.height / 2 + 40);
  }
}

/* ---------- win condition ---------- */
function checkWin() {
  if (pieces.every(p => p.locked)) {
    gameOver = true;
    bestTime = saveBest(Math.floor(elapsedTime));
  }
}

/* ---------- reset game ---------- */
function resetGame() {
  gameOver = false;
  startTime = null;
  elapsedTime = 0;
  selectedPiece = null;
  initPuzzle();
}

/* ---------- main raf loop ---------- */
initPuzzle();
let prev = performance.now();
(function loop(now) {
  const dt = now - prev; prev = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
})(prev);