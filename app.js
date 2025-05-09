import { setupHandUI } from "./common-ui.js";

const WS_URL = "ws://localhost:8000/ws";
const info = document.getElementById("info");
const cursor = document.getElementById("cursor");
const handUI = setupHandUI(".game-card", 3000);

const ws = new WebSocket(WS_URL);
ws.onmessage = (e) => {
  const p = JSON.parse(e.data);
  updateCursor(p);
  updateInfo(p);
  handUI(p);
};

function updateCursor(p) {
  if (!p.landmarks?.length) {
    cursor.style.display = "none";
    return;
  }
  const t = p.landmarks[0];
  cursor.style.left = (1 - t.x) * innerWidth + "px";
  cursor.style.top = t.y * innerHeight + "px";
  cursor.style.display = "block";

  if (p.gesture === "Closed_Fist") {
    cursor.innerHTML = "✊";
  } else if (p.gesture === "Open_Palm") {
    cursor.innerHTML = "🖐️";
  } else {
    cursor.innerHTML = "🖐️";
  }
}

function updateInfo(p) {
  info.textContent = `Gesture : ${p.gesture} (${p.fingerCount})
Conf    : ${p.gestureConfidence.toFixed(2)}`;
}