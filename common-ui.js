/* ============ Hand-UI dwell-click helper ============ */
export function setupHandUI(selector, dwellMs = 1000){
    let hover = null;          // nút đang hover
    let enterT = 0;            // ms lúc bắt đầu hover
    let running = false;       // đang đếm?
    let dwell = document.getElementById("dwell");
    if(!dwell){                // tạo vòng tròn 1 lần
      dwell = document.createElement("div");
      dwell.id = "dwell";
      document.body.appendChild(dwell);
    }
  
    return function(packet){
      if(!packet.landmarks?.length) return;
  
      /* 1. Tọa độ TIP ngón trỏ */
      const tip = packet.landmarks[0];
      const x = (1-tip.x) * innerWidth;
      const y = tip.y * innerHeight;
  
      /* 2. Element dưới tay */
      const el = document.elementFromPoint(x, y);
      const btn = el?.closest(selector) || null;
  
      /* 3. Hover chuyển nút? → reset bộ đếm */
      if(btn !== hover){
        hover?.classList.remove("hover");
        hover = btn;
        if(hover){
          hover.classList.add("hover");
          enterT = performance.now();
          running = true;
          dwell.style.display = "block";
        }else{
          running = false;
          dwell.style.display = "none";
        }
      }
  
     /* 4. hiển thị progress */
    if(running && hover){
        const elapsed = performance.now() - enterT;
        const ratio   = Math.min(elapsed / dwellMs, 1);
        dwell.style.left = x + "px";
        dwell.style.top  = y + "px";
        //    <── NEW: quay vàng
        dwell.style.setProperty("--deg", ratio*360 + "deg");
    
        if(ratio >= 1){
        hover.click();
        running = false;
        dwell.style.display = "none";
        }
    }
    };
}
  