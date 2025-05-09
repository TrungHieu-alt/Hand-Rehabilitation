export function setupHandUI(selector, dwellMs = 3000) {
  let hover = null;
  let enterT = 0;
  let running = false;
  let dwell = document.getElementById("dwell");
  if (!dwell) {
    dwell = document.createElement("div");
    dwell.id = "dwell";
    document.body.appendChild(dwell);
  }

  return function (packet) {
    if (!packet.landmarks?.length) return;

    const tip = packet.landmarks[0];
    const x = (1 - tip.x) * innerWidth;
    const y = tip.y * innerHeight;

    const el = document.elementFromPoint(x, y);
    const btn = el?.closest(selector) || null;

    if (btn !== hover) {
      if (hover) {
        hover.classList.remove("hover");
        hover.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
      }
      hover = btn;
      if (hover) {
        hover.classList.add("hover");
        hover.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        enterT = performance.now();
        running = true;
        dwell.style.display = "block";
      } else {
        running = false;
        dwell.style.display = "none";
      }
    }

    if (running && hover) {
      const elapsed = performance.now() - enterT;
      const ratio = Math.min(elapsed / dwellMs, 1);
      dwell.style.left = x + "px";
      dwell.style.top = y + "px";
      dwell.style.setProperty("--deg", ratio * 360 + "deg");

      if (ratio >= 1) {
        const link = hover.querySelector("a");
        if (link) link.click();
        running = false;
        dwell.style.display = "none";
      }
    }
  };
}