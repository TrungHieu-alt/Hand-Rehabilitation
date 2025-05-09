import {setupHandUI} from "../common-ui.js";

/* -------------- cấu hình -------------- */
const WS_URL="ws://localhost:8000/ws";
const EDGES=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
             [0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],
             [0,17],[17,18],[18,19],[19,20]];

/* -------------- Three.js -------------- */
let scene,camera,renderer,attr;
initThree(); animate();

function initThree(){
  const cvs=document.getElementById("hand-canvas");
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(70,1,0.01,10);
  camera.position.set(0,0,1.5);

  renderer=new THREE.WebGLRenderer({canvas:cvs,alpha:true,antialias:true});
  renderer.setSize(380,380,false);

  const geom=new THREE.BufferGeometry();
  attr=new THREE.BufferAttribute(new Float32Array(EDGES.length*2*3),3);
  geom.setAttribute("position",attr);
  const line=new THREE.LineSegments(geom,new THREE.LineBasicMaterial({color:0xffffff}));
  line.position.set(0,-0.15,0); line.scale.set(1.2,1.2,1.2);
  scene.add(line);
}
function animate(){ requestAnimationFrame(animate); renderer.render(scene,camera);}

/* vẽ khung xương tay – lật X để khớp gương */
function updateHand(lm){
  if(!lm?.length) return;
  let k = 0, a = attr.array;

  for (const [i, j] of EDGES){
    const p = lm[i], q = lm[j];

    /* điểm p */
    a[k++] = 0.5 - p.x;          //  ← X lật
    a[k++] = -(p.y - 0.5);       //    Y giữ như cũ
    a[k++] = -p.z;

    /* điểm q */
    a[k++] = 0.5 - q.x;          //  ← X lật
    a[k++] = -(q.y - 0.5);
    a[k++] = -q.z;
  }
  attr.needsUpdate = true;
}

/* hộp debug */
function updateInfo(p){
  const info=document.getElementById("info");
  info.textContent=
`Gesture : ${p.gesture} (${p.fingerCount})
Conf    : ${p.gestureConfidence.toFixed(2)}`;
}

/* ---------- logic bài tập ---------- */
let phase="A", fist=0, next=1, prev="", touchFinger=0, touchStart=0;
const TOUCH_THRESHOLD = 0.34; // ngưỡng khoảng cách để coi là chạm
const HOLD_TIME = 2000; // 2 giây

// Biến theo dõi Thumb_Down
let thumbDownStart = 0;
const THUMB_DOWN_TIMEOUT = 2000; // 2 giây

function distance(lm1, lm2){
  return Math.sqrt((lm1.x - lm2.x)**2 + (lm1.y - lm2.y)**2 + (lm1.z - lm2.z)**2);
}

function updateExercise(p){
  // Kiểm tra Thumb_Down
  if(p.gesture === "Thumb_Down"){
    if(thumbDownStart === 0){
      thumbDownStart = Date.now();
    }else if(Date.now() - thumbDownStart >= THUMB_DOWN_TIMEOUT){
      window.location.href = "../index.html";
    }
  }else{
    thumbDownStart = 0;
  }

  if(phase==="A"){
    if(p.gesture==="Closed_Fist" && prev!=="Closed_Fist"){
      fist++;
      document.getElementById("phase").textContent =
        `Pha A – Nắm tay: ${fist}/5`;
      if(fist>=5){
        phase="B";
        document.getElementById("phase").textContent =
          "Pha B – Đếm ngón: 1";
      }
    }
    prev=p.gesture;
  }else if(phase==="B"){
    if(p.fingerCount===next){
      next++;
      if(next>5){
        phase="C";
        touchFinger=0;
        document.getElementById("phase").textContent=
          "Pha C – Chạm ngón cái với ngón trỏ";
      }else{
        document.getElementById("phase").textContent =
          `Pha B – Đếm ngón: ${next}`;
      }
    }
  }else if(phase==="C"){
    const thumbTip = p.landmarks[4];
    const targetTips = [8,12,16,20]; // ngón trỏ, giữa, áp út, út
    const currentTarget = targetTips[touchFinger];

    if(distance(thumbTip, p.landmarks[currentTarget]) < TOUCH_THRESHOLD){
      if(touchStart===0){
        touchStart = Date.now();
      }else if(Date.now() - touchStart >= HOLD_TIME){
        touchFinger++;
        touchStart = 0;
        if(touchFinger >= 4){
          phase="Done";
          document.getElementById("phase").textContent="🎉 Hoàn thành!";
        }else{
          const nextFinger = ["ngón trỏ","ngón giữa","ngón áp út","ngón út"][touchFinger];
          document.getElementById("phase").textContent=
            `Pha C – Chạm ngón cái với ${nextFinger}`;
        }
      }
    }else{
      touchStart = 0;
    }
  }
}

/* ---------- WebSocket ---------- */
const ws=new WebSocket(WS_URL);
const handUI = setupHandUI("#back");   // chỉ bắt nút Back
ws.onmessage=e=>{
  const d=JSON.parse(e.data);
  updateHand(d.landmarks);
  updateInfo(d);
  updateExercise(d);
  handUI(d);
};