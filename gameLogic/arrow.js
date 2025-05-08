/*  Virtual Archery – tên bắn lực cố định, luôn thấy cung + tên đang lắp */
const WS_URL  = "ws://localhost:8000/ws";
const cvs     = document.getElementById("game");
const ctx     = cvs.getContext("2d");
const msgEl   = document.getElementById("msg");
const scoreEl = document.getElementById("score");
const arrowEl = document.getElementById("arrowBox");
/* ===== cấu hình ===== */
const ARROW_LEN = 100;          // ⭐ mũi tên dài 100 px
const ARROW_HEAD = 10;          //   đầu nhọn 10 px

/* ===== cấu hình ===== */
const ARROW_VX  = 950;          // tốc độ ngang (px/s)
const ARROW_VY  =   0;          // bắn ngang (0 = không chếch)
const GRAV      = 900;          // trọng lực nhẹ
const MAX_ARROW = 5;            // số mũi tên
const TARGET_R  = 28;

/* 9 bia xếp kim cương */
const BASE_TARGETS = [
  [-60,  0], [  0,-60], [  0, 0], [  0, 60], [ 60, 0],
  [-60,-60], [-60, 60], [ 60,-60], [ 60, 60]
].map(([dx,dy]) => ({ x: 520+dx, y: 240+dy, r: TARGET_R }));

/* ===== state ===== */
let bowY       = cvs.height / 2;
let pulling    = false;          // đang giữ nắm tay
let arrow      = null;           // {x,y,vx,vy}
let arrowsLeft = MAX_ARROW;
let score      = 0;
let targets    = JSON.parse(JSON.stringify(BASE_TARGETS));
let thumbDownStart = 0;
const THUMB_DOWN_TIMEOUT = 2000;

/* ===== helpers ===== */
const palmCenter = lm =>
  lm && lm.length >= 18
    ? { x: (lm[0].x + lm[5].x + lm[17].x) / 3,
        y: (lm[0].y + lm[5].y + lm[17].y) / 3 }
    : null;

function resetGame(){
  arrowsLeft = MAX_ARROW; arrowEl.textContent = `▶ ${arrowsLeft}`;
  score = 0;             scoreEl.textContent = "Score 0";
  targets = JSON.parse(JSON.stringify(BASE_TARGETS));
  arrow   = null;
  msgEl.textContent = "Open palm ⇒ Closed fist ⇒ Open palm để bắn";
}

/* ===== WebSocket điều khiển ===== */
new WebSocket(WS_URL).onmessage = e=>{
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
  
  const pc  = palmCenter(pkt.landmarks);
  if(!pc) return;

  const handX = (1 - pc.x) * cvs.width;
  const handY =  pc.y       * cvs.height;

  /* mũi tên đang bay – bỏ qua input */
  if (arrow) return;

  /* restart khi game kết thúc */
  if ((arrowsLeft === 0 || targets.length === 0) && pkt.gesture === "Closed_Fist"){
    resetGame(); return;
  }

  /* điều khiển cung */
  if (pkt.gesture === "Closed_Fist"){
    pulling = true;
    bowY    = handY;
  } else if (pulling && pkt.gesture === "Open_Palm"){
    if (arrowsLeft > 0){
      arrow = { x: 80, y: bowY, vx: ARROW_VX, vy: ARROW_VY };
      arrowsLeft--; arrowEl.textContent = `▶ ${arrowsLeft}`;
      msgEl.textContent = "";
    }
    pulling = false;
  } else if (!pulling){
    bowY = handY;
  }
};

/* ===== vẽ ===== */
function drawTargets(){
  targets.forEach(t=>{
    ctx.lineWidth = 8;  ctx.strokeStyle = "#000";  ctx.fillStyle = "#ffbca7";
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r * 0.35, 0, Math.PI*2); ctx.fill();
  });
}

function drawBow(){
    const w = 22;
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#000";
    ctx.fillStyle   = "#ff0000";      // ⭐ cung đỏ tươi
  
    // (vẽ thân … giữ nguyên)
  
    /* dây cung – đổi sang đen */
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000";         // ⭐ dây đen
    ctx.beginPath();
    ctx.moveTo(80 - w + 2, bowY - 76);
    ctx.lineTo(80 - w + 2, bowY + 76);
    ctx.stroke();
  }
  
  function drawArrow(x, y){
    const shaftColor = "#000";      // ⭐ thân đen
    const headColor  = "#000";      // ⭐ đầu đen luôn
    const fletchColor= "#000";      // ⭐ đuôi đen
    const len  = ARROW_LEN;         // dùng hằng mới
    const head = ARROW_HEAD;
  
    // thân
    ctx.strokeStyle = shaftColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - (len - head), y);
    ctx.stroke();
  
    // đầu mũi tên
    ctx.fillStyle = headColor;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - head, y - head / 2);
    ctx.lineTo(x - head, y + head / 2);
    ctx.closePath();
    ctx.fill();
  
    // lông đuôi (V)
    ctx.strokeStyle = fletchColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - (len - head), y);
    ctx.lineTo(x - (len - head) + 6, y - 4);
    ctx.moveTo(x - (len - head), y);
    ctx.lineTo(x - (len - head) + 6, y + 4);
    ctx.stroke();
  }
  
/* ===== vòng lặp chính ===== */
let prev = performance.now();
function loop(now){
  const dt = (now - prev) / 1000; prev = now;

  /* cập nhật mũi tên bay */
  if (arrow){
    arrow.vy += GRAV * dt;
    arrow.x  += arrow.vx * dt;
    arrow.y  += arrow.vy * dt;

    /* trúng bia */
    for (let i = targets.length - 1; i >= 0; i--){
      const t = targets[i];
      if (Math.hypot(arrow.x - t.x, arrow.y - t.y) < t.r){
        targets.splice(i, 1);
        score++; scoreEl.textContent = `Score ${score}`;
        arrow = null;
        break;
      }
    }
    /* bay ra ngoài màn */
    if (arrow && (arrow.x > cvs.width || arrow.y > cvs.height)) arrow = null;
  }

  /* ——— render ——— */
  ctx.fillStyle = "#4a3232";
  ctx.fillRect(0, 0, cvs.width, cvs.height);

  drawTargets();
  drawBow();

  /* ① mũi tên đang bay */
  if (arrow){
    drawArrow(arrow.x, arrow.y);
  }
  /* ② chưa bắn, còn tên ⇒ hiển thị tên gắn trên dây */
  else if (!pulling && arrowsLeft > 0){
    drawArrow(80, bowY);
  }
  /* ③ thao tác kéo (hiệu ứng dây – tùy thích) */
  else if (pulling){
    ctx.strokeStyle = "#0f8"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(80, bowY); ctx.lineTo(80 - 120, bowY); ctx.stroke();
  }

  requestAnimationFrame(loop);
}
resetGame();                 // thiết lập ban đầu
requestAnimationFrame(loop);
