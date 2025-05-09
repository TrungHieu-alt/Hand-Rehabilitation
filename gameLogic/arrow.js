/* Virtual Archery – tên bắn lực cố định, luôn thấy cung + tên đang lắp */
const WS_URL = "ws://localhost:8000/ws";
const cvs = document.getElementById("game");
const ctx = cvs.getContext("2d");
const msgEl = document.getElementById("msg");
const scoreEl = document.getElementById("score");
const arrowEl = document.getElementById("arrowBox");
const toggleInputBtn = document.getElementById("toggleInput");
/* ===== cấu hình ===== */
const ARROW_LEN = 150;          // Mũi tên dài 150 pixels
const ARROW_HEAD = 10;          // Đầu mũi tên (không dùng trong rendering hình ảnh)

/* ===== cấu hình ===== */
const ARROW_VX = 950;          // Tốc độ ngang của mũi tên: 950 pixels/giây
const ARROW_VY = 0;            // Tốc độ dọc ban đầu: 0 (bắn ngang)
const GRAV = 900;              // Gia tốc trọng lực: 900 pixels/giây^2
const MAX_ARROW = 5;           // Số mũi tên tối đa: 5
const TARGET_R = 28;           // Bán kính bia: 28 pixels
const TARGET_BOW_HEIGHT = 152; // Chiều cao mục tiêu cho hình ảnh cung
const X_STRING_NORMAL = 60;    // Vị trí dây cung khi không kéo
const X_STRING_PULLED = 50;    // Vị trí dây cung khi kéo

/* 9 bia xếp hình kim cương */
const BASE_TARGETS = [
  [-60, 0], [0,-60], [0,0], [0,60], [60,0],
  [-60,-60], [-60,60], [60,-60], [60,60]
].map(([dx,dy]) => ({ x: 520+dx, y: 240+dy, r: TARGET_R }));

/* ===== state ===== */
let bowY = cvs.height / 2; // Tọa độ y của cung (ban đầu ở giữa canvas)
let pulling = false;       // Trạng thái kéo cung (true khi nắm tay hoặc click chuột)
let arrow = null;          // Mũi tên đang bay: {x, y, vx, vy}
let arrowsLeft = MAX_ARROW; // Số mũi tên còn lại
let score = 0;             // Điểm số
let targets = JSON.parse(JSON.stringify(BASE_TARGETS)); // Danh sách bia
let useMouseInput = false;  // true: dùng chuột, false: dùng cử chỉ tay

/* ===== hình ảnh ===== */
const bowImage = new Image();
bowImage.src = '../asset/img/bow.png'; // Hình ảnh cung nghỉ (96x202 pixels)
const bowPullImage = new Image();
bowPullImage.src = '../asset/img/bow_pull.png'; // Hình ảnh cung kéo (141x202 pixels)
const arrowImage = new Image();
arrowImage.src = '../asset/img/arrow.png'; // Hình ảnh mũi tên (156x51 pixels)

/* ===== helpers ===== */
const palmCenter = lm =>
  lm && lm.length >= 18
    ? { x: (lm[0].x + lm[5].x + lm[17].x) / 3,
        y: (lm[0].y + lm[5].y + lm[17].y) / 3 }
    : null;
// Tính trung bình tọa độ x, y của 3 điểm mốc (landmarks) trên tay
// lm[0], lm[5], lm[17]: Các điểm mốc trên bàn tay từ dữ liệu WebSocket

function resetGame(){
  arrowsLeft = MAX_ARROW; arrowEl.textContent = `▶ ${arrowsLeft}`;
  score = 0;             scoreEl.textContent = "Score 0";
  targets = JSON.parse(JSON.stringify(BASE_TARGETS));
  arrow = null;
  updateInstructions();
}

/* Cập nhật hướng dẫn dựa trên chế độ đầu vào */
function updateInstructions(){
  if (useMouseInput) {
    msgEl.textContent = "Move mouse to aim, click to pull, release to shoot";
  } else {
    msgEl.textContent = "Open palm ⇒ Closed fist ⇒ Open palm để bắn";
  }
}

// Biến theo dõi Thumb_Down
let thumbDownStart = 0;
const THUMB_DOWN_TIMEOUT = 2000; // 2 giây

/* Chuyển đổi chế độ đầu vào */
toggleInputBtn.addEventListener('click', () => {
  useMouseInput = !useMouseInput;
  toggleInputBtn.textContent = useMouseInput ? "Switch to Hand Gesture" : "Switch to Mouse";
  updateInstructions();
});

/* ===== WebSocket điều khiển ===== */
new WebSocket(WS_URL).onmessage = e=>{
  if (useMouseInput) return; // Bỏ qua nếu đang dùng chuột

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
  if(!pc) return;

  const handX = (1 - pc.x) * cvs.width; // Chuyển tọa độ x tay sang canvas
  const handY = pc.y * cvs.height; // Chuyển tọa độ y tay sang canvas

  /* mũi tên đang bay – bỏ qua input */
  if (arrow) return;

  /* restart khi game kết thúc */
  if ((arrowsLeft === 0 || targets.length === 0) && pkt.gesture === "Closed_Fist"){
    resetGame(); return;
  }

  /* điều khiển cung */
  if (pkt.gesture === "Closed_Fist"){
    pulling = true;
    bowY = handY;
  } else if (pulling && pkt.gesture === "Open_Palm"){
    if (arrowsLeft > 0){
      const tailX = X_STRING_PULLED;
      const arrowTipX = tailX + ARROW_LEN;
      arrow = { x: arrowTipX, y: bowY, vx: ARROW_VX, vy: ARROW_VY };
      arrowsLeft--;
      arrowEl.textContent = `▶ ${arrowsLeft}`;
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
    // 8: Độ dày viền bia
    // "#ffbca7": Màu nền bia (hồng cam)
    // "#000": Màu viền bia (đen)
    // "#fff": Màu tâm bia (trắng)
    // 0.35: Tỷ lệ bán kính tâm bia so với bán kính bia
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
    80 - scaledWidth / 2, // 80: Tọa độ x tâm cung; scaledWidth / 2: Căn giữa ngang
    bowY - TARGET_BOW_HEIGHT / 2, // bowY: Tọa độ y tâm cung; TARGET_BOW_HEIGHT / 2: Căn giữa dọc
    scaledWidth,         // Chiều rộng tỷ lệ (72.24px hoặc 106.12px)
    TARGET_BOW_HEIGHT    // 152: Chiều cao mục tiêu
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

/* ===== vòng lặp chính ===== */
let prev = performance.now();
function loop(now){
  const dt = (now - prev) / 1000; prev = now;

  /* cập nhật mũi tên bay */
  if (arrow){
    arrow.vy += GRAV * dt;      // GRAV=900: Tăng vận tốc dọc do trọng lực
    arrow.x += arrow.vx * dt;   // vx=950: Cập nhật tọa độ x
    arrow.y += arrow.vy * dt;   // Cập nhật tọa độ y
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
    // cvs.width, cvs.height: Kích thước canvas (thường là 640x480 hoặc do HTML định nghĩa)
  }

  /* ——— render ——— */
  ctx.fillStyle = "#4a3232";
  ctx.fillRect(0, 0, cvs.width, cvs.height);
  // "#4a3232": Màu nền canvas (nâu đỏ)
  // 0, 0: Góc trên trái của hình chữ nhật nền
  // cvs.width, cvs.height: Chiều rộng, cao của canvas

  drawTargets();
  drawBow();

  if (arrow){
    drawArrow(arrow.x, arrow.y, true);
  } else if (arrowsLeft > 0){
    const tailX = pulling ? X_STRING_PULLED : X_STRING_NORMAL;
    const arrowTipX = tailX + ARROW_LEN;
    drawArrow(arrowTipX, bowY, false);
  }

  requestAnimationFrame(loop);
}

/* ===== Mouse controls ===== */
cvs.addEventListener('mousemove', function(event) {
  if (!useMouseInput) return; // Bỏ qua nếu đang dùng cử chỉ tay
  const rect = cvs.getBoundingClientRect();
  const mouseY = event.clientY - rect.top;
  if (mouseY >= 0 && mouseY <= cvs.height) {
    bowY = mouseY;
  }
});

cvs.addEventListener('mousedown', function(event) {
  if (!useMouseInput) return; // Bỏ qua nếu đang dùng cử chỉ tay
  if (event.button === 0) { // Left mouse button
    if (arrowsLeft === 0 || targets.length === 0) {
      resetGame();
    } else {
      pulling = true;
    }
  }
});

cvs.addEventListener('mouseup', function(event) {
  if (!useMouseInput) return; // Bỏ qua nếu đang dùng cử chỉ tay
  if (event.button === 0 && pulling) {
    if (arrowsLeft > 0 && !arrow) {
      const tailX = X_STRING_PULLED;
      const arrowTipX = tailX + ARROW_LEN;
      arrow = { x: arrowTipX, y: bowY, vx: ARROW_VX, vy: ARROW_VY };
      arrowsLeft--;
      arrowEl.textContent = `▶ ${arrowsLeft}`;
      msgEl.textContent = "";
    }
    pulling = false;
  }
});

resetGame();                 // Thiết lập ban đầu
requestAnimationFrame(loop);