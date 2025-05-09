/* Virtual Archery – fixed force arrow shooting, bow and arrow always visible */
const WS_URL = "ws://localhost:8000/ws";
const cvs = document.getElementById("game");
const ctx = cvs.getContext("2d");
const msgEl = document.getElementById("msg");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const toggleInputBtn = document.getElementById("toggleInput");

const DPR = window.devicePixelRatio || 1;

function fit(){
  cvs.width = window.innerWidth * DPR;
  cvs.height = window.innerHeight * DPR;
  cvs.style.width = window.innerWidth + 'px';
  cvs.style.height = window.innerHeight + 'px';
  ctx.scale(DPR, DPR);
}

window.addEventListener('resize', fit);
fit();

/* ===== configuration ===== */
const ARROW_LEN = 150;          // Arrow length: 150 pixels
const ARROW_VX = 1500;          // Horizontal arrow speed: 1500 pixels/second
const ARROW_VY = 0;            // Initial vertical speed: 0 (shoots straight)
const GRAV = 500;              // Gravity acceleration: 500 pixels/second²
const TARGET_R = 28;           // Target radius: 28 pixels
const TARGET_BOW_HEIGHT = 152; // Bow image height: 152 pixels
const X_STRING_NORMAL = 60;    // String position when not pulled
const X_STRING_PULLED = 50;    // String position when pulled

/* ===== state ===== */
let bowY = cvs.height / 2; // Bow y-coordinate (starts at canvas center)
let pulling = false;       // Pulling state (true when fist closed or mouse clicked)
let arrow = null;          // Flying arrow: {x, y, vx, vy}
let score = 0;             // Score
let lives = 2;             // Lives
let gameOver = false;      // Game over state
let targets = [];          // List of targets
let useMouseInput = false; // true: use mouse, false: use hand gestures
const HS_KEY = "archeryHighScore";
let highScore = localStorage.getItem(HS_KEY) ? parseInt(localStorage.getItem(HS_KEY)) : 0;

/* ===== images ===== */
const bowImage = new Image();
bowImage.src = '../asset/img/bow.png'; // Resting bow image (96x202 pixels)
const bowPullImage = new Image();
bowPullImage.src = '../asset/img/bow_pull.png'; // Pulled bow image (141x202 pixels)
const arrowImage = new Image();
arrowImage.src = '../asset/img/arrow.png'; // Arrow image (156x51 pixels)

/* ===== helpers ===== */
const palmCenter = lm =>
  lm && lm.length >= 18
    ? { x: (lm[0].x + lm[5].x + lm[17].x) / 3,
        y: (lm[0].y + lm[5].y + lm[17].y) / 3 }
    : null;

function spawnTargets() {
  const numTargets = 5; // Always spawn 5 targets
  targets = [];
  for (let i = 0; i < numTargets; i++) {
    let x, y;
    let attempts = 0;
    do {
      // Ensure the target stays within the right half of the screen and doesn't go off-screen
      x = Math.random() * (cvs.width / 2 - 2 * TARGET_R) + cvs.width / 2 + TARGET_R;
      // Ensure the target stays fully inside vertically
      y = Math.random() * (cvs.height - 2 * TARGET_R) + TARGET_R;
      attempts++;
    } while (
      attempts < 100 &&
      targets.some(t => Math.hypot(t.x - x, t.y - y) < 2 * TARGET_R)
    );
    if (attempts >= 100) {
      console.warn("Could not find non-overlapping position for target");
    }
    targets.push({ x, y, r: TARGET_R });
  }
}

function respawnTargets(){
  spawnTargets();
}

function resetGame(){
  lives = 2;
  gameOver = false;
  score = 0;
  scoreEl.textContent = "Score: 0";
  livesEl.textContent = "Lives: 2";
  respawnTargets();
  arrow = null;
  updateInstructions();
  // Ensure bowY is within bounds after reset
  bowY = Math.max(TARGET_BOW_HEIGHT / 2, Math.min(cvs.height / 2, cvs.height - TARGET_BOW_HEIGHT / 2));
}

/* Update instructions based on input mode */
function updateInstructions(){
  if (useMouseInput) {
    msgEl.textContent = "Move mouse to aim, click to pull, release to shoot";
  } else {
    msgEl.textContent = "Open palm ⇒ Close fist ⇒ Open palm to shoot";
  }
}

/* Thumb_Down tracking */
let thumbDownStart = 0;
const THUMB_DOWN_TIMEOUT = 2000; // 2 seconds

/* Toggle input mode */
toggleInputBtn.addEventListener('click', () => {
  useMouseInput = !useMouseInput;
  toggleInputBtn.textContent = useMouseInput ? "Switch to Hand Gestures" : "Switch to Mouse";
  updateInstructions();
});

/* ===== WebSocket controls ===== */
new WebSocket(WS_URL).onmessage = e => {
  if (useMouseInput) return; // Ignore if using mouse

  const pkt = JSON.parse(e.data);

  if (pkt.gesture === "Thumb_Down") {
    if (thumbDownStart === 0) {
      thumbDownStart = Date.now();
    } else if (Date.now() - thumbDownStart >= THUMB_DOWN_TIMEOUT) {
      window.location.href = "../index.html";
    }
  } else {
    thumbDownStart = 0;
  }
  const pc = palmCenter(pkt.landmarks);
  if (!pc) return;

  const handX = (1 - pc.x) * cvs.width; // Convert hand x to canvas
  let handY = pc.y * cvs.height; // Convert hand y to canvas

  // Clamp handY to keep bowY within screen
  handY = Math.max(TARGET_BOW_HEIGHT / 2, Math.min(handY, cvs.height - TARGET_BOW_HEIGHT / 2));

  /* Ignore input if arrow is flying */
  if (arrow) return;

  /* Restart when game is over */
  if (gameOver && pkt.gesture === "Closed_Fist") {
    resetGame();
    return;
  }

  /* Control bow */
  if (!gameOver) {
    if (pkt.gesture === "Closed_Fist") {
      pulling = true;
      bowY = handY;
    } else if (pulling && pkt.gesture === "Open_Palm") {
      if (!arrow) {
        const tailX = X_STRING_PULLED;
        const arrowTipX = tailX + ARROW_LEN;
        arrow = { x: arrowTipX, y: bowY, vx: ARROW_VX, vy: ARROW_VY };
        msgEl.textContent = "";
      }
      pulling = false;
    } else if (!pulling) {
      bowY = handY;
    }
  }
};

/* ===== drawing ===== */
function drawTargets(){
  targets.forEach(t => {
    ctx.lineWidth = 8; ctx.strokeStyle = "#000"; ctx.fillStyle = "#ffbca7";
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r * 0.35, 0, Math.PI*2); ctx.fill();
  });
}

function drawBow(){
  const currentBowImage = pulling ? bowPullImage : bowImage;
  const naturalWidth = currentBowImage.naturalWidth;
  const naturalHeight = currentBowImage.naturalHeight;
  if (naturalHeight === 0) return; // Avoid division by zero if image not loaded
  const scaleFactor = TARGET_BOW_HEIGHT / naturalHeight;
  const scaledWidth = naturalWidth * scaleFactor;
  ctx.drawImage(
    currentBowImage,
    80 - scaledWidth / 2,
    bowY - TARGET_BOW_HEIGHT / 2,
    scaledWidth,
    TARGET_BOW_HEIGHT
  );
}

function drawArrow(x, y, isFlying = false){
  const targetArrowWidth = ARROW_LEN; // 150
  const naturalArrowWidth = 156;
  const naturalArrowHeight = 51;
  const scaledArrowHeight = (naturalArrowHeight / naturalArrowWidth) * targetArrowWidth;
  if (isFlying && arrow) {
    ctx.save();
    ctx.translate(x, y);
    const angle = Math.atan2(arrow.vy, arrow.vx);
    ctx.rotate(angle);
    ctx.drawImage(
      arrowImage,
      -targetArrowWidth,
      -scaledArrowHeight / 2,
      targetArrowWidth,
      scaledArrowHeight
    );
    ctx.restore();
  } else {
    ctx.drawImage(
      arrowImage,
      x - targetArrowWidth,
      y - scaledArrowHeight / 2,
      targetArrowWidth,
      scaledArrowHeight
    );
  }
}

/* ===== main loop ===== */
let prev = performance.now();
function loop(now){
  const dt = (now - prev) / 1000; prev = now;

  if (!gameOver) {
    /* Update flying arrow */
    if (arrow) {
      arrow.vy += GRAV * dt;
      arrow.x += arrow.vx * dt;
      arrow.y += arrow.vy * dt;
      let hit = false;
      for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        if (Math.hypot(arrow.x - t.x, arrow.y - t.y) < t.r) {
          targets.splice(i, 1);
          score++; scoreEl.textContent = `Score: ${score}`;
          hit = true;
          break;
        }
      }
      if (hit) {
        arrow = null;
      } else if (arrow.x > cvs.width || arrow.y > cvs.height) {
        arrow = null;
        lives--;
        livesEl.textContent = `Lives: ${lives}`;
        if (lives <= 0) {
          gameOver = true;
          if (score > highScore) {
            highScore = score;
            localStorage.setItem(HS_KEY, highScore);
          }
        }
      }
    }

    if (targets.length === 0 && lives > 0) {
      respawnTargets();
    }
  }

  /* ——— render ——— */
  ctx.fillStyle = "#4a3232";
  ctx.fillRect(0, 0, cvs.width, cvs.height);

  if (!gameOver) {
    drawTargets();
    drawBow();
    if (!arrow) {
      if (pulling) {
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        const startX = X_STRING_PULLED + ARROW_LEN;
        const endX = startX + cvs.width / 3;
        const steps = 20;
        const dx = (endX - startX) / steps;
        for (let i = 0; i <= steps; i++) {
          const x = startX + i * dx;
          const t = (x - startX) / ARROW_VX;
          const y = bowY + 0.5 * GRAV * t * t;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const tailX = pulling ? X_STRING_PULLED : X_STRING_NORMAL;
      const arrowTipX = tailX + ARROW_LEN;
      drawArrow(arrowTipX, bowY, false);
    } else {
      drawArrow(arrow.x, arrow.y, true);
    }
  }

  if (gameOver) {
    ctx.fillStyle = "white";
    ctx.font = "48px Poppins";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", cvs.width / 2, cvs.height / 2 - 50);
    ctx.fillText(`Score: ${score}`, cvs.width / 2, cvs.height / 2);
    ctx.fillText(`High Score: ${highScore}`, cvs.width / 2, cvs.height / 2 + 50);
    ctx.font = "24px Poppins";
    ctx.fillText(useMouseInput ? "Click to play again" : "Close fist to play again", cvs.width / 2, cvs.height / 2 + 100);
  }

  requestAnimationFrame(loop);
}

/* ===== Mouse controls ===== */
cvs.addEventListener('mousemove', function(event) {
  if (!useMouseInput || gameOver) return;
  const rect = cvs.getBoundingClientRect();
  let mouseY = event.clientY - rect.top;
  // Clamp mouseY to keep bowY within screen
  mouseY = Math.max(TARGET_BOW_HEIGHT / 2, Math.min(mouseY, cvs.height - TARGET_BOW_HEIGHT / 2));
  bowY = mouseY;
});

cvs.addEventListener('mousedown', function(event) {
  if (!useMouseInput) return;
  if (event.button === 0) {
    if (gameOver) {
      resetGame();
    } else {
      pulling = true;
    }
  }
});

cvs.addEventListener('mouseup', function(event) {
  if (!useMouseInput || gameOver) return;
  if (event.button === 0 && pulling) {
    if (!arrow) {
      const tailX = X_STRING_PULLED;
      const arrowTipX = tailX + ARROW_LEN;
      arrow = { x: arrowTipX, y: bowY, vx: ARROW_VX, vy: ARROW_VY };
      msgEl.textContent = "";
    }
    pulling = false;
  }
});

resetGame();                 // Initial setup
requestAnimationFrame(loop);