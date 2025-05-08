/*  Grasp‑n‑Drop – v0.6  (analysis‑driven fix)

   Problem observed: pointer jumped too fast → loss of precision.
   Root causes:
     1. Dynamic mapping stretches limited hand motion to full screen ⇒ high gain.
     2. Extra SPEED multiplier (1.5) amplifies movement even more.
     3. No temporal smoothing ⇒ every tiny tremor moves the cursor.

   Fixes implemented:
     ✔ Remove extra SPEED gain (set to 1.0).
     ✔ Add exponential smoothing (SMOOTH = 0.25).
     ✔ Keep calibration but add 10 % safety margin so mapping is
       slightly less aggressive (reduces gain, preserves reach).
     ✔ "c" resets calibration as before.
*/
(() => {
  /* ---------- canvas & HUD setup ---------- */
  const cvs      = document.getElementById("game");
  const ctx      = cvs.getContext("2d");
  const statusEl = document.getElementById("status");
  const DPR      = window.devicePixelRatio || 1;

  const SPEED  = 1.0;   // gain after mapping
  const SMOOTH = 0.25;  // 0‑1, higher = snappier, lower = smoother

  /* ---------- fit canvas ---------- */
  function fit(){
    cvs.width  = innerWidth  * DPR;
    cvs.height = innerHeight * DPR;
    cvs.style.width  = innerWidth + 'px';
    cvs.style.height = innerHeight + 'px';
    ctx.reset?.();
    ctx.scale(DPR, DPR);
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
  const rounds=[{zone:{x:.70,y:.45,w:.20,h:.30},objects:3},{zone:{x:.10,y:.10,w:.20,h:.25},objects:4},{zone:{x:.40,y:.60,w:.15,h:.20},objects:5}];
  let level=0; const items=[]; const pointer={x:innerWidth/2,y:innerHeight/2,grab:false};
  function spawn(n){
    items.length=0;
    for(let i=0;i<n;i++) items.push({x:Math.random()*innerWidth*0.5+40,y:Math.random()*innerHeight*0.5+40,r:28,held:false});
  }
  spawn(rounds[level].objects);

  /* ---------- helpers ---------- */
  const clamp=(v,min,max)=>Math.min(Math.max(v,min),max);
  const palmCenter=lm=>lm&&lm.length>=18?{x:(lm[0].x+lm[5].x+lm[17].x)/3,y:(lm[0].y+lm[5].y+lm[17].y)/3}:null;

  /* ---------- WebSocket ---------- */
  try{
    const ws=new WebSocket('ws://localhost:8000/ws');
    ws.onmessage=ev=>{
      const d=JSON.parse(ev.data);
      if (d.gesture === "Thumb_Down") {
        if (thumbDownStart === 0) {
          thumbDownStart = Date.now();
        } else if (Date.now() - thumbDownStart >= THUMB_DOWN_TIMEOUT) {
          window.location.href = "../index.html";
        }
      } else {
        thumbDownStart = 0;
      }      
      const pc=palmCenter(d.landmarks);
      if(!pc) return;
      // update calibration bounds
      calib.minX=Math.min(calib.minX,pc.x);
      calib.maxX=Math.max(calib.maxX,pc.x);
      calib.minY=Math.min(calib.minY,pc.y);
      calib.maxY=Math.max(calib.maxY,pc.y);

      const margin = 0.1; // 10 % margin reduces gain
      const rangeX = Math.max(0.0001, (calib.maxX - calib.minX)*(1+margin));
      const rangeY = Math.max(0.0001, (calib.maxY - calib.minY)*(1+margin));

      const nx = 1 - ((pc.x - calib.minX + rangeX*margin/2) / rangeX); // flip X
      const ny =     ((pc.y - calib.minY + rangeY*margin/2) / rangeY);

      const targetX = clamp(nx*innerWidth * SPEED, 0, innerWidth);
      const targetY = clamp(ny*innerHeight* SPEED, 0, innerHeight);

      // exponential smoothing
      pointer.x += (targetX - pointer.x) * SMOOTH;
      pointer.y += (targetY - pointer.y) * SMOOTH;

      pointer.grab = (d.gesture === 'Closed_Fist') ;
      statusEl.textContent = pointer.grab ? 'GRAB' : 'OPEN';
    };
  }catch(e){ console.warn('WS unavailable, using mouse'); }

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

    // check drop zone
    const z=rounds[level].zone; const zx=z.x*innerWidth, zy=z.y*innerHeight, zw=z.w*innerWidth, zh=z.h*innerHeight;
    for(let i=items.length-1;i>=0;i--){ const o=items[i]; if(o.x>zx&&o.x<zx+zw&&o.y>zy&&o.y<zy+zh){ items.splice(i,1);} }
    if(items.length===0){ level=(level+1)%rounds.length; spawn(rounds[level].objects);} }

  function render(){
    ctx.clearRect(0,0,innerWidth,innerHeight);

    // zone
    const z=rounds[level].zone; ctx.strokeStyle='#0f0'; ctx.lineWidth=3; ctx.setLineDash([10,6]);
    ctx.strokeRect(z.x*innerWidth,z.y*innerHeight,z.w*innerWidth,z.h*innerHeight); ctx.setLineDash([]);

    // items
    ctx.fillStyle='#ff0'; for(const o of items){ ctx.beginPath(); ctx.arc(o.x,o.y,o.r,0,Math.PI*2); ctx.fill(); }

    // pointer
    ctx.fillStyle=pointer.grab?'#f55':'#09f'; ctx.beginPath(); ctx.arc(pointer.x,pointer.y,10,0,Math.PI*2); ctx.fill();
  }

  (function loop(){ update(); render(); requestAnimationFrame(loop); })();
})();
