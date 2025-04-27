import {setupHandUI} from "./common-ui.js";

const WS_URL = "ws://localhost:8000/ws";
const info   = document.getElementById("info");
const cursor = document.getElementById("cursor");
const handUI = setupHandUI(".btn");          // 5 nút trên trang chủ

/* ---------- WebSocket ---------- */
const ws = new WebSocket(WS_URL);
ws.onmessage = e=>{
  const p = JSON.parse(e.data);
  updateCursor(p);
  updateInfo(p);
  handUI(p);
};

/* con trỏ ở TIP ngón trỏ */
function updateCursor(p){
  if(!p.landmarks?.length){ cursor.style.display="none"; return; }
  const t = p.landmarks[0];
  cursor.style.left = t.x*innerWidth+"px";
  cursor.style.top  = t.y*innerHeight+"px";
  cursor.style.display = "block";
}

/* hộp debug */
function updateInfo(p){
  info.textContent =
`Gesture : ${p.gesture} (${p.fingerCount})
Conf    : ${p.gestureConfidence.toFixed(2)}`;
}
