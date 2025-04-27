import {setupHandUI} from "./common-ui.js";

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

/* vẽ khung xương tay */
function updateHand(lm){
  if(!lm?.length) return;
  let k=0,a=attr.array;
  for(const [i,j] of EDGES){
    const p=lm[i], q=lm[j];
    a[k++]=p.x-.5; a[k++]=-(p.y-.5); a[k++]=-p.z;
    a[k++]=q.x-.5; a[k++]=-(q.y-.5); a[k++]=-q.z;
  }
  attr.needsUpdate=true;
}

/* hộp debug */
function updateInfo(p){
  const info=document.getElementById("info");
  info.textContent=
`Gesture : ${p.gesture} (${p.fingerCount})
Conf    : ${p.gestureConfidence.toFixed(2)}`;
}


/* ---------- logic bài tập ---------- */
let phase="A", fist=0, next=1, prev="";

function updateExercise(p){
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
         phase="Done";
         document.getElementById("phase").textContent="🎉 Hoàn thành!";
       }else{
         document.getElementById("phase").textContent =
           `Pha B – Đếm ngón: ${next}`;
       }
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
