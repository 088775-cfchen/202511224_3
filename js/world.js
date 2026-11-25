// =====================================================================
// js/world.js：three.js 場景：顏色、攝影機、燈光、地面、平台、橋、房屋與樹
// =====================================================================
// ---------------- 調色盤（整座小鎮只用這幾個顏色） ----------------
const C = {
  sky: 0xbfe6ee,      // 背景
  water: 0x8fd3e0,    // 水面
  side: 0xb9ae9d,     // 平台側面
  dark: 0x4b4b55,     // 橋面、輪胎、燈柱
  orange: 0xe8743b,   // 重點色：巴士、屋頂、標記
  yellow: 0xf2c230,   // 欄杆、安全帽
  white: 0xf7f4ee,    // 白線、柵欄
  trunk: 0x8b6a4e,    // 樹幹
  leaves: [0x9cc77a, 0x86b86a, 0xb3d68f], // 三種樹葉綠
};
const hex = n => '#' + n.toString(16).padStart(6, '0');        // 數字顏色轉成 CSS 色碼

// ---------------- three.js 基本設定 ----------------
const renderer = new THREE.WebGLRenderer({ antialias: true });   // 建立繪圖器
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));           // 最多 2 倍解析度
renderer.setSize(innerWidth, innerHeight);                      // 鋪滿視窗
renderer.shadowMap.enabled = true;                               // 開啟陰影
renderer.shadowMap.type = THREE.PCFSoftShadowMap;                // 柔和陰影
document.body.appendChild(renderer.domElement);                  // 放進網頁

const scene = new THREE.Scene();                                 // 建立場景
scene.background = new THREE.Color(C.sky);                       // 背景色

// 正交攝影機：沒有近大遠小，看起來像桌上的模型
let viewSize = 26;                                               // 畫面上下可以看到幾個單位
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
const CAM_DIST = 52;                                             // 攝影機離目標的距離
const YAW0 = Math.PI / 4, PITCH0 = Math.atan(1 / Math.SQRT2);    // 預設：右上方 45°、俯角約 35°
let camYaw = YAW0, camPitch = PITCH0;                            // 目前的水平角度、俯角
let yawTarget = YAW0, pitchTarget = PITCH0;                      // 想要轉到的角度（平滑靠近）
let zoomTarget = 26;                                             // 想要縮放到的大小
const PITCH_MIN = 20 * Math.PI / 180, PITCH_MAX = 70 * Math.PI / 180; // 俯角範圍 20°～70°
function fitCamera() {                                           // 依視窗比例調整可視範圍
  const a = innerWidth / innerHeight;                            // 長寬比
  const v = Math.max(viewSize, viewSize * 0.75 / a);             // 手機直立時拉遠一點，左右才看得到東西
  camera.left = -v * a / 2; camera.right = v * a / 2;            // 左右範圍
  camera.top = v / 2; camera.bottom = -v / 2;                    // 上下範圍
  camera.updateProjectionMatrix();                               // 套用設定
}
fitCamera();                                                     // 先設定一次

// ---------------- 燈光 ----------------
scene.add(new THREE.HemisphereLight(0xffffff, 0x9fbfa0, 1.5));   // 天空光
const sun = new THREE.DirectionalLight(0xfff2dd, 1.7);           // 太陽光（微暖）
sun.castShadow = true;                                           // 產生陰影
sun.shadow.mapSize.set(2048, 2048);                              // 陰影解析度
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 100 }); // 陰影範圍
sun.shadow.bias = -0.0005;                                       // 避免陰影條紋
scene.add(sun, sun.target);                                      // 太陽與它照射的目標都要加入

// ---------------- 小工具 ----------------
const matCache = {};                                             // 材質快取，同顏色共用一個材質
const mat = (color) => matCache[color] ??= new THREE.MeshLambertMaterial({ color, flatShading: true });
// 建立一個方塊並放到指定位置
function box(w, h, d, color, x, y, z, parent = scene) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); // 方塊
  m.position.set(x, y, z);                                       // 位置
  m.castShadow = m.receiveShadow = true;                         // 陰影
  parent.add(m);                                                 // 加入父層
  return m;                                                      // 回傳以便再調整
}
// 建立一個圓柱
function cyl(rt, rb, h, color, x, y, z, parent = scene, seg = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color)); // 圓柱
  m.position.set(x, y, z);                                       // 位置
  m.castShadow = m.receiveShadow = true;                         // 陰影
  parent.add(m);                                                 // 加入
  return m;
}
// 建立一顆球
function ball(r, color, x, y, z, parent = scene, detail = 1) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat(color)); // 低多邊形球
  m.position.set(x, y, z);                                       // 位置
  m.castShadow = m.receiveShadow = true;                         // 陰影
  parent.add(m);
  return m;
}
// 用小畫布畫出花紋，再變成可重複的貼圖
function canvasTex(draw, rx, ry) {
  const c = document.createElement('canvas'); c.width = c.height = 128; // 128×128 畫布
  draw(c.getContext('2d'));                                      // 呼叫繪圖函式
  const t = new THREE.CanvasTexture(c);                          // 轉成貼圖
  t.wrapS = t.wrapT = THREE.RepeatWrapping;                      // 可重複
  t.repeat.set(rx, ry);                                          // 重複次數
  t.colorSpace = THREE.SRGBColorSpace;                           // 正確色彩
  t.anisotropy = 4;                                              // 斜看時比較清楚
  return t;
}

// ---------------- 可以走的範圍與障礙物 ----------------
const walkRects = [];                                            // 可以走的長方形（平台、橋）
const blockRects = [];                                           // 不能穿過的長方形（巴士、建築）
const blockCircles = [];                                         // 不能穿過的圓形（樹、燈柱）
function walkable(x, z) {                                        // 這個點在不在可走範圍內
  return walkRects.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
}
function isFree(x, z, r = 0.35) {                                // 這個點能不能站
  if (!walkable(x, z)) return false;                             // 掉到水裡不行
  if (blockCircles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + r)) return false; // 撞到圓形障礙
  return !blockRects.some(b => x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r); // 撞到長方形障礙
}

// ---------------- 水面 ----------------
const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: C.water }));
water.rotation.x = -Math.PI / 2;                                 // 躺平
water.position.y = -1.1;                                         // 比平台低
water.receiveShadow = true;                                      // 平台的影子落在水上
scene.add(water);
const ripples = [];                                              // 水面上漂動的白色波紋
for (let i = 0; i < 40; i++) {
  const r = box(1.5 + Math.random() * 2, 0.02, 0.12, 0xd8f1f5, (Math.random() - 0.5) * 90, -1.05, (Math.random() - 0.5) * 90);
  r.castShadow = false;                                          // 波紋不需要陰影
  r.userData.phase = Math.random() * 6;                          // 每條波紋的節奏不同
  ripples.push(r);
}

// ---------------- 地面花紋 ----------------
const TOPS = {
  tile: (w, d) => canvasTex(g => {                               // 灰米色地磚
    g.fillStyle = '#d9d2c5'; g.fillRect(0, 0, 128, 128);         // 底色
    g.strokeStyle = '#c4bba9'; g.lineWidth = 4;                  // 磚縫
    g.strokeRect(0, 0, 128, 128); g.strokeRect(0, 0, 64, 64); g.strokeRect(64, 64, 64, 64); // 2×2 塊
  }, w / 2, d / 2),
  grass: (w, d) => canvasTex(g => {                              // 草地
    g.fillStyle = '#a8d58a'; g.fillRect(0, 0, 128, 128);         // 底色
    g.fillStyle = '#97c779';                                     // 深一點的草點
    for (let i = 0; i < 30; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 4, 4);
  }, w / 3, d / 3),
  deck: (w, d) => canvasTex(g => {                               // 木棧道
    g.fillStyle = '#d1ab82'; g.fillRect(0, 0, 128, 128);         // 木頭色
    g.fillStyle = '#b8916a';                                     // 木板縫
    for (let y = 0; y < 128; y += 32) g.fillRect(0, y, 128, 3);
  }, w / 2, d / 2),
  sand: (w, d) => canvasTex(g => {                               // 校園的淺色鋪面
    g.fillStyle = '#ece3cf'; g.fillRect(0, 0, 128, 128);         // 底色
    g.strokeStyle = '#ddd2b9'; g.lineWidth = 3; g.strokeRect(0, 0, 128, 128); // 淡淡格線
  }, w / 3, d / 3),
};
// 黃黑相間的警示條
const stripeTex = (len) => canvasTex(g => {
  g.fillStyle = '#f2c230'; g.fillRect(0, 0, 128, 128);           // 黃色底
  g.fillStyle = '#2f2f36';                                       // 黑色斜條
  for (let x = -128; x < 256; x += 64) { g.beginPath(); g.moveTo(x, 128); g.lineTo(x + 32, 128); g.lineTo(x + 96, 0); g.lineTo(x + 64, 0); g.fill(); }
}, len / 1.2, 1);

// ---------------- 平台（浮在水上的區塊） ----------------
const platforms = [
  { no: '03', name: '交通', x: 0,   z: 0,   w: 16, d: 14, top: 'tile' },
  { no: '08', name: '公園', x: -21, z: 1,   w: 14, d: 14, top: 'grass' },
  { no: '05', name: '學校', x: 1,   z: -19, w: 16, d: 10, top: 'sand' },
  { no: '15', name: '水岸', x: 20,  z: -2,  w: 12, d: 16, top: 'deck' },
  { no: '06', name: '市場', x: 0,   z: 19,  w: 14, d: 10, top: 'tile' },   // 新增：市場
];
platforms.forEach(p => {
  box(p.w, 1.2, p.d, C.side, p.x, -0.6, p.z);                    // 平台的厚度
  const top = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.06, p.d), new THREE.MeshLambertMaterial({ map: TOPS[p.top](p.w, p.d) }));
  top.position.set(p.x, 0.03, p.z);                              // 鋪在平台上面
  top.receiveShadow = true;                                      // 接收陰影
  scene.add(top);
  const sm = new THREE.MeshLambertMaterial({ map: stripeTex(p.w) }); // 前側警示條
  const s1 = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.35, 0.03), sm);
  s1.position.set(p.x, -0.3, p.z + p.d / 2 + 0.02); scene.add(s1); // 貼在 +z 那一面
  const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.35, p.d), new THREE.MeshLambertMaterial({ map: stripeTex(p.d) }));
  s2.position.set(p.x + p.w / 2 + 0.02, -0.3, p.z); scene.add(s2); // 貼在 +x 那一面
  walkRects.push({ x0: p.x - p.w / 2 + 0.4, x1: p.x + p.w / 2 - 0.4, z0: p.z - p.d / 2 + 0.4, z1: p.z + p.d / 2 - 0.4 }); // 可走範圍
});

// ---------------- 橋 ----------------
function bridge(cx, cz, len, alongX) {
  const g = new THREE.Group();                                   // 整座橋是一個群組
  g.position.set(cx, 0, cz);                                     // 橋的中心
  if (!alongX) g.rotation.y = Math.PI / 2;                       // 南北向的橋要轉 90 度
  box(len, 0.2, 2.2, C.dark, 0, -0.02, 0, g);                    // 橋面
  for (let i = -len / 2 + 0.25; i < len / 2; i += 0.5) box(0.08, 0.01, 2.2, 0x63636e, i, 0.085, 0, g); // 木板縫
  for (const s of [-1, 1]) {                                     // 左右兩側欄杆
    box(len, 0.1, 0.1, C.yellow, 0, 0.9, s * 1.05, g);           // 扶手
    for (let i = -len / 2 + 0.3; i <= len / 2 - 0.2; i += 1.1) box(0.1, 0.9, 0.1, C.yellow, i, 0.45, s * 1.05, g); // 欄杆柱
    cyl(0.15, 0.15, 1.2, C.side, 0, -0.7, s * 0.9, g);           // 橋墩
  }
  scene.add(g);
  walkRects.push(alongX                                          // 橋面可以走
    ? { x0: cx - len / 2, x1: cx + len / 2, z0: cz - 0.85, z1: cz + 0.85 }
    : { x0: cx - 0.85, x1: cx + 0.85, z0: cz - len / 2, z1: cz + len / 2 });
}
bridge(-11, 2, 7.2, true);                                       // 交通 ↔ 公園
bridge(2, -10.5, 8, false);                                      // 交通 ↔ 學校
bridge(11, -1, 7.2, true);                                       // 交通 ↔ 水岸
bridge(4, 10.5, 8, false);                                       // 交通 ↔ 市場

// ---------------- 道具 ----------------
function tree(x, z, s = 1) {                                     // 圓球狀的低多邊形樹
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); // 位置與大小
  cyl(0.14, 0.2, 1.2, C.trunk, 0, 0.6, 0, g, 6);                 // 樹幹
  const pick = () => C.leaves[Math.floor(Math.random() * 3)];    // 隨機挑一種綠
  ball(0.8, pick(), 0, 1.7, 0, g);                               // 主樹冠
  ball(0.55, pick(), 0.45, 1.45, 0.25, g);                       // 旁邊小樹冠
  ball(0.5, pick(), -0.35, 1.55, -0.3, g);                       // 另一邊小樹冠
  g.rotation.y = Math.random() * 6;                              // 每棵樹轉個方向
  scene.add(g);
  blockCircles.push({ x, z, r: 0.35 * s });                      // 樹幹擋路
}
function sakura(x, z, s = 1) {                                   // 櫻花樹：粉紅色樹冠
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
  cyl(0.13, 0.2, 1.3, 0x7a5646, 0, 0.65, 0, g, 6);               // 深一點的樹幹
  const pinks = [0xf6b8cb, 0xf29bb5, 0xfad3df];                  // 三種粉紅
  const pick = () => pinks[Math.floor(Math.random() * 3)];
  ball(0.82, pick(), 0, 1.8, 0, g); ball(0.58, pick(), 0.5, 1.5, 0.2, g); ball(0.52, pick(), -0.4, 1.6, -0.3, g);
  g.rotation.y = Math.random() * 6; scene.add(g);
  blockCircles.push({ x, z, r: 0.35 * s });                      // 樹幹一樣擋路
}
function pine(x, z, s = 1) {                                     // 松樹：三層圓錐
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
  cyl(0.12, 0.16, 0.8, C.trunk, 0, 0.4, 0, g, 6);                // 樹幹
  [[0.95, 1.0, 1.05], [0.75, 0.9, 1.65], [0.5, 0.8, 2.2]].forEach(([r, h, y], i) =>
    cyl(0.02, r, h, [0x5f9a5a, 0x6fae66, 0x82bf74][i], 0, y, 0, g, 7)); // 由下往上越來越小
  scene.add(g);
  blockCircles.push({ x, z, r: 0.35 * s });
}
function bush(x, z, color) {                                     // 小花叢
  ball(0.35, C.leaves[0], x, 0.25, z, scene, 0);                 // 綠色底
  ball(0.12, color, x + 0.15, 0.55, z + 0.1, scene, 0);          // 花
  ball(0.1, color, x - 0.15, 0.5, z - 0.05, scene, 0);           // 花
}
function bench(x, z, rotY = 0) {                                 // 長椅
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
  box(1.6, 0.1, 0.5, 0xb07d52, 0, 0.45, 0, g);                   // 椅面
  box(1.6, 0.4, 0.08, 0xb07d52, 0, 0.75, -0.22, g);              // 椅背
  for (const s of [-0.65, 0.65]) box(0.08, 0.45, 0.45, C.dark, s, 0.22, 0, g); // 椅腳
  scene.add(g);
}
const lampHeads = [];                                            // 路燈燈頭（晚上會亮可以延伸）
function lamp(x, z) {                                            // 路燈
  cyl(0.06, 0.08, 2.4, C.dark, x, 1.2, z, scene, 6);             // 燈柱
  lampHeads.push(box(0.35, 0.2, 0.35, 0xfff1b8, x, 2.45, z));    // 燈頭
  blockCircles.push({ x, z, r: 0.15 });                          // 燈柱擋路
}
function cone(x, z) {                                            // 三角錐
  cyl(0.02, 0.22, 0.6, C.orange, x, 0.3, z, scene, 8);           // 錐身
  cyl(0.13, 0.15, 0.08, C.white, x, 0.33, z, scene, 8);          // 白色反光條
}
function bike(color) {                                           // 腳踏車（回傳群組，方便給騎士用）
  const g = new THREE.Group();
  for (const s of [-0.55, 0.55]) {                               // 前後輪
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.05, 6, 16), mat(C.dark)); // 輪胎
    w.position.set(0, 0.36, s); w.rotation.y = Math.PI / 2; w.castShadow = true; g.add(w);
  }
  box(0.06, 0.06, 1.1, color, 0, 0.62, 0, g);                    // 車架橫桿
  box(0.06, 0.45, 0.06, color, 0, 0.6, -0.15, g);                // 座管
  box(0.2, 0.06, 0.3, 0x333333, 0, 0.84, -0.15, g);              // 座墊
  box(0.5, 0.05, 0.05, C.dark, 0, 0.95, 0.5, g);                 // 把手
  box(0.05, 0.4, 0.05, color, 0, 0.75, 0.5, g);                  // 前叉
  return g;
}
function bus(x, z) {                                             // 巴士
  const g = new THREE.Group(); g.position.set(x, 0, z);
  box(5, 1.9, 2.1, C.orange, 0, 1.25, 0, g);                     // 車身
  box(5.05, 0.2, 2.15, C.white, 0, 2.25, 0, g);                  // 車頂白邊
  for (let i = -1.8; i <= 1.8; i += 0.9) box(0.7, 0.6, 2.15, 0x9fd1e0, i, 1.55, 0, g); // 車窗
  box(0.05, 0.7, 1.6, 0x9fd1e0, 2.5, 1.5, 0, g);                 // 擋風玻璃
  for (const wx of [-1.6, 1.6]) for (const wz of [-1, 1]) {      // 四個輪子
    const w = cyl(0.42, 0.42, 0.3, C.dark, wx, 0.42, wz, g, 12); w.rotation.x = Math.PI / 2;
  }
  scene.add(g);
  blockRects.push({ x0: x - 2.5, x1: x + 2.5, z0: z - 1.05, z1: z + 1.05 }); // 巴士擋路
}

// ---- 交通區 ----
bus(-2.5, -4.6);                                                 // 停在站牌旁的巴士
const shelter = new THREE.Group(); shelter.position.set(-2.5, 0, -2.4); // 候車亭
box(3, 0.12, 1.2, C.orange, 0, 2.2, 0, shelter);                 // 亭頂
for (const s of [-1.3, 1.3]) box(0.1, 2.2, 0.1, C.dark, s, 1.1, -0.4, shelter); // 柱子
box(2.6, 1.2, 0.05, 0xcfe8ee, 0, 1.2, -0.45, shelter);           // 透明背板
scene.add(shelter);
for (let i = 0; i < 6; i++) box(0.5, 0.02, 2.4, C.white, -5 + i * 0.85, 0.07, 4.2); // 斑馬線
for (let i = 0; i < 4; i++) { const b = bike(C.orange); b.position.set(3.4 + i * 0.75, 0.05, -3.2); scene.add(b); } // 共享單車
box(3.4, 0.12, 0.12, C.dark, 4.5, 0.6, -4.1);                    // 停車架
blockRects.push({ x0: 3, x1: 6.2, z0: -4.2, z1: -2.5 });         // 單車區擋路
lamp(-7.2, 0.5); lamp(7.2, 0.5); lamp(-7.2, -6.4);               // 路燈
cone(-6, 2.6); cone(-6.6, 3.2); cone(1, 2.6);                    // 三角錐
tree(-6.6, 6.2); tree(7, -6.3, 0.9); tree(6.8, 6.1, 1.1);        // 樹
bench(4.5, 3.6, Math.PI);                                        // 長椅

// ---- 公園區 ----
const court = box(8, 0.05, 5, 0x4f7a55, -21, 0.07, 1);           // 球場
court.castShadow = false;
box(8, 0.02, 0.08, C.white, -21, 0.11, -1.4); box(8, 0.02, 0.08, C.white, -21, 0.11, 3.4); // 邊線
box(0.08, 0.02, 4.9, C.white, -21, 0.11, 1);                     // 中線
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.04, 4, 32), mat(C.white)); // 中圈
ring.rotation.x = Math.PI / 2; ring.position.set(-21, 0.11, 1); scene.add(ring);
for (const gx of [-25, -17]) {                                   // 兩邊球門
  box(0.08, 1, 0.08, C.white, gx, 0.5, 0); box(0.08, 1, 0.08, C.white, gx, 0.5, 2); box(0.08, 0.08, 2, C.white, gx, 1, 1);
}
[[-26.5, -4.5], [-26.6, 6.6], [-15.6, -4.6], [-23.5, -4.9], [-18.2, 6.9], [-26.8, 1.5], [-15.5, 7]].forEach(([x, z]) => sakura(x, z, 0.85 + Math.random() * 0.4)); // 公園：櫻花樹
bench(-21, 6.4, Math.PI); bench(-21, -4.6);                      // 長椅
[[-24.5, 6.8, 0xf28fad], [-17, -5, 0xf2c230], [-27, -1.8, 0xf28fad], [-15.4, 3.5, 0xffffff]].forEach(([x, z, c]) => bush(x, z, c)); // 花叢

// ---- 學校區 ----
const school = new THREE.Group(); school.position.set(1, 0, -21.6); // 校舍
box(9, 3.4, 3, 0xf1e6cf, 0, 1.7, 0, school);                     // 牆
box(9.6, 0.4, 3.6, C.orange, 0, 3.6, 0, school);                 // 屋頂
for (let i = -3.5; i <= 3.5; i += 1.4) { box(0.8, 0.7, 0.05, 0x9fd1e0, i, 2.5, 1.52, school); box(0.8, 0.7, 0.05, 0x9fd1e0, i, 1.2, 1.52, school); } // 兩層窗戶
box(1.4, 1.6, 0.06, 0x8b6a4e, 0, 0.8, 1.53, school);             // 大門
box(3, 0.6, 0.1, C.white, 0, 3.05, 1.55, school);                // 校名牌
scene.add(school);
blockRects.push({ x0: -3.5, x1: 5.5, z0: -23.1, z1: -20.1 });    // 校舍擋路
cyl(0.05, 0.05, 4, C.white, -5, 2, -18.5, scene, 6);             // 旗桿
blockCircles.push({ x: -5, z: -18.5, r: 0.15 });
const flag = box(1.1, 0.7, 0.03, C.orange, -4.45, 3.6, -18.5);   // 旗子（會飄）
tree(7.6, -22.8); tree(-5.6, -23); tree(7.8, -15.5, 0.85);       // 樹
for (let i = 0; i < 5; i++) box(0.12, 0.6, 0.12, C.white, -1.2 + i * 0.6, 0.3, -16); // 校門柵欄（左右各留通道）
bush(-6, -15.2, 0xf2c230); bush(8, -19, 0xf28fad);               // 花叢

// ---- 水岸區 ----
for (let z = -9.5; z <= 5.5; z += 1) box(0.1, 0.8, 0.1, C.white, 25.7, 0.4, z); // 臨水欄杆柱
box(0.08, 0.08, 15.2, C.white, 25.7, 0.8, -2);                   // 臨水扶手
bench(24.4, -5, -Math.PI / 2); bench(24.4, 0, -Math.PI / 2);     // 面向水的長椅
lamp(24.8, -7.5); lamp(24.8, 3);                                 // 路燈
pine(15.6, -8.6, 1.1); pine(15.8, 4.8, 1.25); pine(18.5, -9, 0.85); pine(17.2, 5.4, 0.8); // 水岸：松樹
const boats = [];                                                // 小船（會隨波搖晃）
[[31, -4, 0], [28, 10, 1.2], [-31, -8, 2.2]].forEach(([x, z, r]) => {
  const g = new THREE.Group(); g.position.set(x, -1, z); g.rotation.y = r;
  box(3, 0.6, 1.3, C.white, 0, 0.1, 0, g);                       // 船身
  box(3.05, 0.15, 1.35, C.orange, 0, -0.15, 0, g);               // 船底色帶
  box(1, 0.7, 0.9, 0x9fd1e0, -0.3, 0.75, 0, g);                  // 船艙
  scene.add(g); boats.push(g);
});

// ---- 市場區 ----
const awningTex = canvasTex(g => {                               // 紅白條紋遮雨棚
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#d9483b'; g.fillRect(i * 16, 0, 16, 128); }
}, 1, 1);
function stall(x, z, goods) {                                    // 攤位
  const g = new THREE.Group(); g.position.set(x, 0, z);
  box(1.8, 0.8, 0.9, 0xb07d52, 0, 0.4, 0, g);                    // 桌子
  for (const sx of [-0.85, 0.85]) for (const sz of [-0.4, 0.4]) box(0.07, 2, 0.07, C.dark, sx, 1, sz, g); // 四根柱子
  const aw = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 1.3), new THREE.MeshLambertMaterial({ map: awningTex }));
  aw.position.set(0, 2.05, 0.1); aw.rotation.x = 0.18; aw.castShadow = true; g.add(aw); // 斜斜的遮雨棚
  for (let i = 0; i < 5; i++) ball(0.13, goods[i % goods.length], -0.6 + i * 0.3, 0.92, 0.15, g, 0); // 水果
  scene.add(g);
  blockRects.push({ x0: x - 0.95, x1: x + 0.95, z0: z - 0.5, z1: z + 0.5 });
}
function house(x, z, wall, roof) {                               // 三角形屋頂的小房子
  const g = new THREE.Group(); g.position.set(x, 0, z);
  box(2.6, 2, 2.2, wall, 0, 1, 0, g);                            // 牆
  const rg = new THREE.CylinderGeometry(1.5, 1.5, 3, 3); rg.rotateY(Math.PI / 2); rg.rotateZ(Math.PI / 2); // 三角柱橫躺、尖端朝上
  const r = new THREE.Mesh(rg, mat(roof)); r.scale.set(1, 0.6, 1); r.position.y = 2.45; r.castShadow = true; g.add(r);
  box(0.6, 1, 0.05, 0x8b6a4e, 0.5, 0.5, 1.11, g);                // 門
  box(0.6, 0.5, 0.05, 0x9fd1e0, -0.6, 1.2, 1.11, g);             // 窗
  scene.add(g);
  blockRects.push({ x0: x - 1.3, x1: x + 1.3, z0: z - 1.1, z1: z + 1.1 });
}
house(-4.6, 21.4, 0xf6e7c8, 0xd9483b); house(-1.4, 21.6, 0xdcecf0, C.orange); // 兩棟小房子
stall(0.4, 19, [0xd9483b, 0xf2c230]);
stall(3.2, 19, [0x86b86a, 0xf29bb5]);
stall(6.0, 19, [0xf2a33a, 0xd9483b]);
sakura(-6, 15.4, 0.8); lamp(6.3, 14.6);                         // 角落的櫻花樹和路燈
