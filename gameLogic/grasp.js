/* Grasp‑n‑Drop – v0.6  (analysis‑driven fix with enhanced graphics)

   Problem observed: pointer jumped too fast → loss of precision.
   Root causes:
     1. Dynamic mapping stretches limited hand motion to full screen ⇒ high gain.
     2. Extra SPEED multiplier (1.5) amplifies movement even more.
     3. No temporal smoothing ⇒ every tiny tremor moves the cursor.

   Fixes implemented:
     ✔ Remove extra SPEED gain (set to 1.0).
     ✔ Add exponential smoothing (SMOOTH = 0.25).
     ✔ Keep calibration but add 10 % safety margin so mapping is
       slightly less aggressive (reduces gain, preserves reach).
     ✔ "c" resets calibration as before.

   New enhancements:
     ✔ Replace circles with trash paper image.
     ✔ Replace drop zone rectangle with trash bin image.
     ✔ Restore background image.
     ✔ Fix trash bin to a fixed position (bottom-right, 2:1 aspect ratio).
     ✔ Spawn new trash paper on new levels, keep bin position.
     ✔ Assign random stop positions for trash papers on the road (y = 563px to 688px).
*/
(() => {
  /* ---------- canvas & HUD setup ---------- */
  const cvs      = document.getElementById("game");
  const ctx      = cvs.getContext("2d");
  const statusEl = document.getElementById("status");
  const backButton = document.getElementById("backButton");
  backButton.addEventListener("click", () => {
    window.location.href = "../index.html";
  });
  const DPR      = window.devicePixelRatio || 1;

  const SPEED  = 1.0;   // gain after mapping
  const SMOOTH = 0.25;  // 0‑1, higher = snappier, lower = smoother
  const gravity = 0.1;  // gravity for physics

  /* ---------- load images ---------- */
  const trashPaperImg = new Image();
  trashPaperImg.src = '../asset/img/trash_paper.png';

  const trashBinImg = new Image();
  trashBinImg.src = '../asset/img/trash_can.png';

  const backgroundImg = new Image();
  backgroundImg.src = '../asset/img/GrapsBackground.jpg';

  let imagesLoaded = 0;
  const totalImages = 3;

  trashPaperImg.onload = imageLoaded;
  trashBinImg.onload = imageLoaded;
  backgroundImg.onload = imageLoaded;

  function imageLoaded() {
    imagesLoaded++;
    if (imagesLoaded === totalImages) {
      // Start game loop
      (function loop(){ update(); render(); requestAnimationFrame(loop); })();
    }
  }

  /* ---------- fit canvas ---------- */
  let stopPositions = []; // Khởi tạo mảng rỗng
  function fit(){
    cvs.width  = innerWidth  * DPR;
    cvs.height = innerHeight * DPR;
    cvs.style.width  = innerWidth + 'px';
    cvs.style.height = innerHeight + 'px';
    ctx.reset?.();
    ctx.scale(DPR, DPR);
    // Cập nhật stopPositions khi thay đổi kích thước
    stopPositions = [
      563 / innerHeight,
      550 / innerHeight,
      450 / innerHeight,
      535 / innerHeight,
      500 / innerHeight
    ];
  }
  addEventListener('resize', fit, {passive:true});
  fit();

  /* ---------- calibration state ---------- */
  let calib = { minX:1, maxX:0, minY:1, maxY:0 };
  function resetCalib(){ calib = {minX:1,maxX:0,minY:1,maxY:0}; }
  addEventListener('keydown', e=>{ if(e.key==='c') resetCalib(); });

  let thumbDownStart = 0;
  const THUMB_DOWN_TIMEOUT = 2000;

  /* ---------- game state ---------- */
  const fixedZone = { x: 0.75, y: 0.5, w: 0.20, h: 0.10 }; // Fixed bin position (bottom-right, 2:1)
  let level = 0;
  const items = [];
  const pointer = {x:innerWidth/2,y:innerHeight/2,grab:false};

  function spawn(n){
    items.length = 0;
    for(let i = 0; i < n; i++) {
      const stopY = stopPositions[Math.floor(Math.random() * stopPositions.length)] * innerHeight;
      items.push({
        x: Math.random() * innerWidth * 0.5 + 40,
        y: Math.random() * innerHeight * 0.5 + 40,
        r: 28,
        held: false,
        vx: 0,
        vy: 0,
        stopY: stopY // Assign random stop position
      });
    }
  }
  spawn([3, 4, 5][level]); // Initial spawn based on level

  /* ---------- helpers ---------- */
  const clamp = (v,min,max) => Math.min(Math.max(v,min),max);
  const palmCenter = lm => lm && lm.length >= 18 ? {x:(lm[0].x+lm[5].x+lm[17].x)/3,y:(lm[0].y+lm[5].y+lm[17].y)/3} : null;

  /* ---------- WebSocket ---------- */
  try{
    const ws = new WebSocket('ws://localhost:8000/ws');
    ws.onmessage = ev => {
      const d = JSON.parse(ev.data);
      if (d.gesture === "Thumb_Down") {
        if (thumbDownStart === 0) {
          thumbDownStart = Date.now();
        } else if (Date.now() - thumbDownStart >= THUMB_DOWN_TIMEOUT) {
          window.location.href = "../index.html";
        }
      } else {
        thumbDownStart = 0;
      }
      const pc = palmCenter(d.landmarks);
      if(!pc) return;
      // update calibration bounds
      calib.minX = Math.min(calib.minX,pc.x);
      calib.maxX = Math.max(calib.maxX,pc.x);
      calib.minY = Math.min(calib.minY,pc.y);
      calib.maxY = Math.max(calib.maxY,pc.y);

      const margin = 0.1; // 10 % margin reduces gain
      const rangeX = Math.max(0.0001, (calib.maxX - calib.minX)*(1+margin));
      const rangeY = Math.max(0.0001, (calib.maxY - calib.minY)*(1+margin));

      const nx = 1 - ((pc.x - calib.minX + rangeX*margin/2) / rangeX); // flip X
      const ny =     ((pc.y - calib.minY + rangeY*margin/2) / rangeY);

      const targetX = clamp(nx*innerWidth * SPEED, 0, innerWidth);
      const targetY = clamp(ny*innerHeight * SPEED, 0, innerHeight);

      // exponential smoothing
      pointer.x += (targetX - pointer.x) * SMOOTH;
      pointer.y += (targetY - pointer.y) * SMOOTH;

      pointer.grab = (d.gesture === 'Closed_Fist');
      statusEl.textContent = pointer.grab ? 'GRAB' : 'OPEN';
    };
  } catch(e){ console.warn('WS unavailable, using mouse'); }

  /* ---------- mouse fallback ---------- */
  cvs.addEventListener('pointermove',e=>{ pointer.x=e.clientX; pointer.y=e.clientY; },{passive:true});
  cvs.addEventListener('pointerdown',()=>pointer.grab=true);
  addEventListener('pointerup',()=>pointer.grab=false);

  /* ---------- game loop ---------- */
  function update(){
    // grab & drag
    for(const o of items){
      if(pointer.grab && !o.held && Math.hypot(o.x-pointer.x,o.y-pointer.y)<o.r) o.held=true;
      if(!pointer.grab) o.held=false;
      if(o.held){ o.x=pointer.x; o.y=pointer.y; }
    }

    // physics
    for(const o of items){
      if(!o.held){
        o.vy += gravity;
        o.y += o.vy;
        if(o.y > o.stopY - o.r){
          o.y = o.stopY - o.r;
          o.vy = 0;
        }
      }
    }

    // check drop zone
    const zx = fixedZone.x * innerWidth, zy = fixedZone.y * innerHeight;
    const zw = fixedZone.w * innerWidth, zh = fixedZone.h * innerHeight;
    for(let i = items.length - 1; i >= 0; i--){
      const o = items[i];
      if(!o.held && o.x > zx && o.x < zx + zw && o.y > zy && o.y < zy + zh){
        items.splice(i, 1);
      }
    }
    if(items.length === 0){
      level = (level + 1) % 3; // Cycle through 3 levels
      spawn([3, 4, 5][level]); // Spawn new trash based on level
    }
  }

  function render(){
    // Draw background
    ctx.drawImage(backgroundImg, 0, 0, innerWidth, innerHeight);

    // Draw drop zone (trash bin) at fixed position
    const zx = fixedZone.x * innerWidth;
    const zy = fixedZone.y * innerHeight;
    const zw = fixedZone.w * innerWidth;
    const zh = fixedZone.h * innerHeight;
    ctx.drawImage(trashBinImg, zx, zy, zw, zh);

    // Draw items (trash paper)
    for(const o of items){
      ctx.drawImage(trashPaperImg, o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
    }

    // Draw pointer as hand emoji
    ctx.font = '30px Arial'; // Adjust size as needed
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const emoji = pointer.grab ? '✊' : '🖐️';
    ctx.fillText(emoji, pointer.x, pointer.y);
  }
})();