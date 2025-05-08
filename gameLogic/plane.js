/* Plane vs Meteors – lưu High Score JSON trong localStorage & show trên HTML */
const WS_URL = "ws://localhost:8000/ws";
const cvs = document.getElementById("game");
const ctx = cvs.getContext("2d");

/* DOM elements cho scoreboard và nút chuyển đổi */
const scoreEl = document.getElementById("score");
const highEl = document.getElementById("high");
const instructionsEl = document.getElementById("instructions");
const toggleInputBtn = document.getElementById("toggleInput");

/* Hình ảnh */
const shipImage = new Image();
const shipDieImage = new Image();
const asteroidImages = [];

for (let i = 1; i <= 4; i++) {
    const img = new Image();
    img.src = `../asset/img/asteroid/asteroid${i}.png`;
    asteroidImages.push(img);
}

// Load all images
const allImages = [shipImage, shipDieImage, ...asteroidImages];
let imagesLoaded = 0;
const totalImages = allImages.length;

allImages.forEach(img => {
    img.onload = () => {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
            resetGame();
        }
    };
    if (img.complete) {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
            resetGame();
        }
    }
});

// Set sources after defining onload to catch cached images
shipImage.src = '../asset/img/ship.png';
shipDieImage.src = '../asset/img/ship_die.png';

/* ---------- player & meteor state ---------- */
const plane = { x: cvs.width/2, y: cvs.height-60, size: 60,
                targetX: cvs.width/2, targetY: cvs.height-60 };
const meteors = [];
let lastSpawn = 0, score = 0, gameOver = false, isDying = false, deathTime = 0;
let useMouseInput = true; // true: chuột, false: cử chỉ tay
const frameDuration = 50; // ms per frame
const totalFrames = 18;

/* ---------- HIGH SCORE helpers ---------- */
const HS_KEY = "planeGameHighScore";
const loadHigh = () => { try{ return JSON.parse(localStorage.getItem(HS_KEY))?.highscore ?? 0 }catch{ return 0 } };
const saveHigh = s => { const cur=loadHigh(); if(s>cur){localStorage.setItem(HS_KEY, JSON.stringify({highscore:s})); return s;} return cur; };
let highScore = loadHigh(); highEl.textContent = `High ${highScore}`;

/* ---------- helper: palm center ---------- */
const palmCenter = lm => lm && lm.length>=18
  ? { x:(lm[0].x+lm[5].x+lm[17].x)/3, y:(lm[0].y+lm[5].y+lm[17].y)/3 } : null;

let thumbDownStart = 0;
const THUMB_DOWN_TIMEOUT = 2000;

/* Cập nhật hướng dẫn dựa trên chế độ đầu vào */
function updateInstructions(){
  if (useMouseInput) {
    instructionsEl.textContent = "Move mouse to aim, click to restart";
  } else {
    instructionsEl.textContent = "Use hand gestures to control";
  }
}

/* Chuyển đổi chế độ đầu vào */
toggleInputBtn.addEventListener('click', () => {
  useMouseInput = !useMouseInput;
  toggleInputBtn.textContent = useMouseInput ? "Switch to Hand Gesture" : "Switch to Mouse";
  updateInstructions();
});

/* ---------- WebSocket ---------- */
new WebSocket(WS_URL).onmessage = e => {
  if (useMouseInput) return; // Bỏ qua nếu đang dùng chuột

  const d = JSON.parse(e.data);
  if (d.gesture === "Thumb_Down") {
    if (thumbDownStart === 0) {
      thumbDownStart = Date.now();
    } else if (Date.now() - thumbDownStart >= THUMB_DOWN_TIMEOUT) {
      window.location.href = "../index.html";
    }
  } else {
    thumbDownStart = 0;
  }

  /* 1. Khi Game Over & thấy Closed_Fist → reset */
  if (gameOver && d.gesture === "Closed_Fist") {
    resetGame();
    return;
  }

  /* 2. Bình thường: cập-nhật toạ độ bàn tay */
  const pc = palmCenter(d.landmarks);
  if (!pc) return;
  plane.targetX = (1 - pc.x) * cvs.width;   // đảo X
  plane.targetY = pc.y * cvs.height;
};

/* ---------- Mouse controls ---------- */
cvs.addEventListener('mousemove', function(event) {
  if (!useMouseInput) return; // Bỏ qua nếu đang dùng cử chỉ tay
  const rect = cvs.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;
  if (mouseX >= 0 && mouseX <= cvs.width && mouseY >= 0 && mouseY <= cvs.height) {
    plane.targetX = mouseX;
    plane.targetY = mouseY;
  }
});

cvs.addEventListener('mousedown', function(event) {
  if (!useMouseInput) return; // Bỏ qua nếu đang dùng cử chỉ tay
  if (event.button === 0 && gameOver) { // Left mouse button
    resetGame();
  }
});

/* ---------- meteor ---------- */
function spawnMeteor(){
  const imageIndex = Math.floor(Math.random() * 4);
  meteors.push({ x: Math.random()*cvs.width, y: -20, r: 15+Math.random()*15, vy: 2+Math.random()*3, image: asteroidImages[imageIndex] });
}

/* ---------- game loop ---------- */
function update(dt){
  if (!gameOver && !isDying) {
    plane.x += (plane.targetX - plane.x) * 0.2;
    plane.y += (plane.targetY - plane.y) * 0.2;
    const r = plane.size / 2;
    plane.x = Math.min(Math.max(plane.x, r), cvs.width - r);
    plane.y = Math.min(Math.max(plane.y, r), cvs.height - r);

    if (performance.now() - lastSpawn > 800) {
      spawnMeteor();
      lastSpawn = performance.now();
    }

    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.y += m.vy;
      if (Math.hypot(m.x - plane.x, m.y - plane.y) < m.r + r) {
        isDying = true;
        deathTime = 0;
        break;
      }
      if (m.y - m.r > cvs.height) meteors.splice(i, 1);
    }

    score += dt * 0.01;
  } else if (isDying) {
    deathTime += dt;
    const frame = Math.floor(deathTime / frameDuration);
    if (frame >= totalFrames) {
      isDying = false;
      gameOver = true;
      highScore = saveHigh(Math.floor(score));
    }
  }
}

/* ---------- render & DOM update ---------- */
function draw(){
  if (imagesLoaded < totalImages) return;
  ctx.clearRect(0,0,cvs.width,cvs.height);

  /* meteors */
  meteors.forEach(m => {
    ctx.drawImage(
      m.image,
      m.x - m.r,
      m.y - m.r,
      m.r * 2,
      m.r * 2
    );
  });

  /* ship or death animation */
  if (!gameOver && !isDying) {
    ctx.drawImage(
      shipImage,
      plane.x - plane.size / 2,
      plane.y - plane.size / 2,
      plane.size,
      plane.size
    );
  } else if (isDying) {
    const frame = Math.min(Math.floor(deathTime / frameDuration), totalFrames - 1);
    const frameX = frame * 128;
    ctx.drawImage(
      shipDieImage,
      frameX, 0, 128, 128,
      plane.x - plane.size / 2,
      plane.y - plane.size / 2,
      plane.size,
      plane.size
    );
  }

  /* game over banner */
  if (gameOver){
    ctx.fillStyle="#fff"; ctx.font="bold 32px Poppins"; ctx.textAlign="center";
    ctx.fillText("Game Over", cvs.width/2, cvs.height/2);
    ctx.font="20px Poppins";
    ctx.fillText(useMouseInput ? "Click to play again" : "Nắm tay để chơi lại", cvs.width/2, cvs.height/2+40);
  }

  /* update scoreboard text */
  scoreEl.textContent = `Score ${Math.floor(score)}`;
  highEl.textContent = `High ${highScore}`;
}

function resetGame() {
  score = 0;
  gameOver = false;
  isDying = false;
  deathTime = 0;
  lastSpawn = performance.now();
  meteors.length = 0;
  plane.x = cvs.width / 2;
  plane.y = cvs.height - 60;
  plane.targetX = plane.x;
  plane.targetY = plane.y;
  updateInstructions();
}

/* ---------- main raf loop ---------- */
let prev = performance.now();
(function loop(now){
  const dt = now - prev; prev = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
})(prev);