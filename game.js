/* Plane vs Meteors – lưu High Score JSON trong localStorage & show trên HTML */
const WS_URL = "ws://localhost:8000/ws";
const cvs    = document.getElementById("game");
const ctx    = cvs.getContext("2d");

/* DOM elements cho scoreboard */
const scoreEl = document.getElementById("score");
const highEl  = document.getElementById("high");

/* ---------- player & meteor state ---------- */
const plane = { x: cvs.width/2, y: cvs.height-60, size: 40,
                targetX: cvs.width/2, targetY: cvs.height-60 };
const meteors = [];
let lastSpawn = 0, score = 0, gameOver = false;

/* ---------- HIGH SCORE helpers ---------- */
const HS_KEY = "planeGameHighScore";
const loadHigh = () => { try{ return JSON.parse(localStorage.getItem(HS_KEY))?.highscore ?? 0 }catch{ return 0 } };
const saveHigh = s => { const cur=loadHigh(); if(s>cur){localStorage.setItem(HS_KEY, JSON.stringify({highscore:s})); return s;} return cur; };
let highScore = loadHigh(); highEl.textContent = `High ${highScore}`;

/* ---------- helper: palm center ---------- */
const palmCenter = lm => lm && lm.length>=18
  ? { x:(lm[0].x+lm[5].x+lm[17].x)/3, y:(lm[0].y+lm[5].y+lm[17].y)/3 } : null;

/* ---------- WebSocket ---------- */
new WebSocket(WS_URL).onmessage = e => {
    const d  = JSON.parse(e.data);
  
    /* 1. Khi Game Over & thấy Closed_Fist → reset */
    if (gameOver && d.gesture === "Closed_Fist") {
      resetGame();
      return;                     // bỏ qua khung này, đợi loop tiếp
    }
  
    /* 2. Bình thường: cập-nhật toạ độ bàn tay */
    const pc = palmCenter(d.landmarks);
    if (!pc) return;
    plane.targetX = (1 - pc.x) * cvs.width;   // đảo X
    plane.targetY = pc.y * cvs.height;
  };
  
/* ---------- meteor ---------- */
function spawnMeteor(){
  meteors.push({ x:Math.random()*cvs.width, y:-20, r:15+Math.random()*15, vy:2+Math.random()*3 });
}

/* ---------- game loop ---------- */
function update(dt){
  plane.x += (plane.targetX-plane.x)*0.2;
  plane.y += (plane.targetY-plane.y)*0.2;
  const r = plane.size/2;
  plane.x = Math.min(Math.max(plane.x,r), cvs.width-r);
  plane.y = Math.min(Math.max(plane.y,r), cvs.height-r);

  if(performance.now()-lastSpawn>800){ spawnMeteor(); lastSpawn=performance.now(); }

  for(let i=meteors.length-1;i>=0;i--){
    const m = meteors[i]; m.y += m.vy;
    if(Math.hypot(m.x-plane.x,m.y-plane.y)<m.r+r) gameOver = true;
    if(m.y-m.r>cvs.height) meteors.splice(i,1);
  }

  if(!gameOver){ score += dt*0.01; }
  else{ highScore = saveHigh(Math.floor(score)); }
}

/* ---------- render & DOM update ---------- */
function draw(){
  ctx.clearRect(0,0,cvs.width,cvs.height);

  /* plane */
  ctx.beginPath();
  ctx.moveTo(plane.x, plane.y-plane.size/2);
  ctx.lineTo(plane.x-plane.size/2, plane.y+plane.size/2);
  ctx.lineTo(plane.x+plane.size/2, plane.y+plane.size/2);
  ctx.closePath(); ctx.fillStyle="#4af"; ctx.fill();

  /* meteors */
  ctx.fillStyle="#fa4";
  meteors.forEach(m=>{ ctx.beginPath(); ctx.arc(m.x,m.y,m.r,0,Math.PI*2); ctx.fill(); });

  /* update scoreboard text */
  scoreEl.textContent = `Score ${Math.floor(score)}`;
  highEl.textContent  = `High ${highScore}`;

  /* game over banner */
  if(gameOver){
    ctx.fillStyle="#fff"; ctx.font="bold 32px Poppins"; ctx.textAlign="center";
    ctx.fillText("Game Over", cvs.width/2, cvs.height/2);
    ctx.font="20px Poppins";
    ctx.fillText("Nắm tay để chơi lại", cvs.width/2, cvs.height/2+40);
  }
}
    function resetGame() {
        score     = 0;
        gameOver  = false;
        lastSpawn = performance.now();
        meteors.length = 0;                       // xoá sạch thiên thạch
        plane.x = cvs.width/2;                    // về giữa
        plane.y = cvs.height-60;
        plane.targetX = plane.x;
        plane.targetY = plane.y;
    }
  

/* ---------- main raf loop ---------- */
let prev = performance.now();
(function loop(now){
  const dt = now - prev; prev = now;
  if(!gameOver) update(dt);
  draw();
  requestAnimationFrame(loop);
})(prev);
