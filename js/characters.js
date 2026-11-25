// =====================================================================
// js/characters.js：公仔角色：主角、小狗、老師、路人、騎車的人
// =====================================================================
// ---------------- 公仔角色 ----------------
// 用球和膠囊拼成大頭小身體的公仔：頭身比約 1:1.5
function makeChibi({ skin = 0xf3cba5, shirt = 0x5b8def, pants = 0x4a5370, hair = 0x3b2a20, helmet = null, bag = null, ponytail = null, glasses = false } = {}) {
  const g = new THREE.Group();                                   // 整個公仔
  const limb = (r, len, color, x, y) => {                        // 做一隻可擺動的手或腳
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0); // 關節（轉動的中心）
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 8), mat(color)); // 膠囊形手腳
    m.position.y = -len / 2 - r * 0.5; m.castShadow = true;      // 往下掛在關節上
    pivot.add(m); g.add(pivot);
    return pivot;
  };
  const legL = limb(0.11, 0.3, pants, -0.13, 0.5);               // 左腳
  const legR = limb(0.11, 0.3, pants, 0.13, 0.5);                // 右腳
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.3, 4, 10), mat(shirt)); // 身體
  body.position.y = 0.8; body.castShadow = true; g.add(body);
  const armL = limb(0.08, 0.28, shirt, -0.36, 1.0);              // 左手
  const armR = limb(0.08, 0.28, shirt, 0.36, 1.0);               // 右手
  const head = new THREE.Group(); head.position.y = 1.45; g.add(head); // 頭部群組
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), mat(skin)); // 臉
  face.castShadow = true; head.add(face);
  for (const s of [-0.13, 0.13]) {                               // 兩顆眼睛
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(0x2b2b30));
    eye.position.set(s, 0.02, 0.35); head.add(eye);
  }
  if (helmet) {                                                  // 戴安全帽
    const hm = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(helmet));
    hm.position.y = 0.04; hm.castShadow = true; head.add(hm);
    const brim = box(0.5, 0.05, 0.2, helmet, 0, 0.06, 0.4, head); // 帽緣
  } else {                                                       // 一般頭髮
    const hr = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), mat(hair));
    hr.position.set(0, 0.03, -0.03); hr.rotation.x = -0.25; hr.castShadow = true; head.add(hr);
  }
  if (bag) box(0.4, 0.45, 0.2, bag, 0, 0.85, -0.3, g);           // 背包
  let tail = null;
  if (ponytail) {                                                // 馬尾：掛在後腦的小關節，走路會甩
    tail = new THREE.Group(); tail.position.set(0, 0.05, -0.36); head.add(tail);
    ball(0.13, ponytail, 0, 0, -0.06, tail);                     // 綁頭髮的地方
    ball(0.15, ponytail, 0, -0.2, -0.12, tail);                  // 馬尾
    ball(0.1, ponytail, 0, -0.38, -0.12, tail);                  // 髮尾
    box(0.2, 0.06, 0.06, 0xd9483b, 0, 0.02, -0.02, tail);        // 髮圈
  }
  if (glasses) for (const s of [-0.13, 0.13]) {                  // 眼鏡：兩個細圓框
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 4, 12), mat(0x2b2b30));
    r.position.set(s, 0.02, 0.37); head.add(r);
  }
  g.userData = { legL, legR, armL, armR, body, head, tail, phase: Math.random() * 6 }; // 記住關節，動畫要用
  scene.add(g);
  return g;
}
// 走路動畫：手腳前後擺、身體上下起伏
function animateWalk(ch, amount, dt) {
  const u = ch.userData;                                         // 取出關節
  u.phase += dt * 10 * amount;                                   // 走得越快擺得越快
  const sw = Math.sin(u.phase) * 0.7 * amount;                   // 擺動角度
  u.legL.rotation.x = sw; u.legR.rotation.x = -sw;               // 雙腳交替
  u.armL.rotation.x = -sw; u.armR.rotation.x = sw;               // 雙手和腳相反
  const bob = Math.abs(Math.sin(u.phase)) * 0.06 * amount;       // 上下起伏
  u.body.position.y = 0.8 + bob; u.head.position.y = 1.45 + bob; // 身體和頭一起動
  if (u.tail) u.tail.rotation.z = Math.sin(u.phase) * 0.35 * amount; // 馬尾左右甩
}
// 讓公仔面向移動方向（公仔正面朝 +z）
const faceTo = (ch, dx, dz) => { ch.rotation.y = Math.atan2(dx, dz); };

// ---- 玩家 ----
const player = makeChibi({ shirt: 0x5fae6e, pants: 0x2f3a5c, hair: 0x2b1d14, helmet: 0xd9483b, bag: C.yellow, ponytail: 0x2b1d14 }); // 綁馬尾的女生：綠上衣、紅安全帽、黃背包
player.position.set(0, 0.06, 1);                                 // 起點
const playerRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 24), new THREE.MeshBasicMaterial({ color: C.orange, transparent: true, opacity: 0.8 }));
playerRing.rotation.x = -Math.PI / 2; scene.add(playerRing);     // 腳下的橘色圓圈，讓玩家好找

// ---- 小狗：跟在主角後面 ----
function makeDog() {
  const g = new THREE.Group();
  const fur = 0xd9a066, dark = 0x8b5a33;
  box(0.34, 0.3, 0.62, fur, 0, 0.48, 0, g);                      // 身體
  const head = new THREE.Group(); head.position.set(0, 0.74, 0.36); g.add(head);
  box(0.32, 0.3, 0.3, fur, 0, 0, 0, head);                       // 頭
  box(0.16, 0.12, 0.14, 0xf0d2a8, 0, -0.06, 0.2, head);          // 嘴巴
  box(0.07, 0.06, 0.05, 0x2b2b30, 0, -0.02, 0.28, head);         // 鼻子
  for (const s of [-1, 1]) {
    box(0.09, 0.16, 0.06, dark, s * 0.13, 0.17, -0.04, head);    // 耳朵
    box(0.05, 0.05, 0.03, 0x2b2b30, s * 0.08, 0.05, 0.16, head); // 眼睛
  }
  const legs = [];
  for (const [x, z] of [[-0.11, 0.2], [0.11, 0.2], [-0.11, -0.2], [0.11, -0.2]]) { // 四隻腳掛在關節上
    const pv = new THREE.Group(); pv.position.set(x, 0.36, z); g.add(pv);
    box(0.09, 0.32, 0.09, fur, 0, -0.16, 0, pv); legs.push(pv);
  }
  const tail = new THREE.Group(); tail.position.set(0, 0.58, -0.3); g.add(tail); // 尾巴關節
  const tm = box(0.06, 0.06, 0.28, dark, 0, 0.08, -0.12, tail); tm.rotation.x = -0.6;
  g.userData = { legs, tail, head, phase: 0 };
  scene.add(g);
  return g;
}
const dog = makeDog();
dog.position.set(0, 0.06, 2.5);                                  // 一開始在主角後面

// ---- 校門口的老師：一直揮手 ----
const teacher = makeChibi({ shirt: 0xffffff, pants: 0x8a8a92, hair: 0x4a3a30, glasses: true }); // 白襯衫、灰褲子、眼鏡
teacher.position.set(-2.3, 0.06, -16.7);                         // 站在校門口旁邊
teacher.rotation.y = 0.4;                                        // 面向來的人
blockCircles.push({ x: -2.3, z: -16.7, r: 0.35 });               // 老師也擋路

// ---- 路人：沿著路線來回走 ----
const walkers = [
  { look: { shirt: 0x7ab07a, hair: 0x6b4a2b }, path: [[-24, -2.5], [-18, -2.5], [-18, 4.5], [-24, 4.5]], speed: 1.6 }, // 公園繞球場
  { look: { shirt: 0xd9d9d9, hair: 0xdddddd, pants: 0x777777 }, path: [[23, -8], [23, 4]], speed: 0.9 },          // 水岸散步的長輩
  { look: { shirt: 0xf2a6b8, helmet: C.yellow, bag: C.orange }, path: [[-1, -17.5], [5, -17.5]], speed: 1.4 },    // 校門口的學生
  { look: { shirt: 0x5b8def, helmet: C.yellow, bag: 0x7ab07a }, path: [[2, -13], [2, -8], [2, -13]], speed: 1.2 },// 過橋上學的學生
].map(w => ({ ...w, ch: makeChibi(w.look), i: 0 }));
walkers.forEach(w => w.ch.position.set(w.path[0][0], 0.06, w.path[0][1])); // 放到起點

// ---- 騎腳踏車的人：在交通區繞圈 ----
const cyclist = new THREE.Group(); scene.add(cyclist);           // 騎士 + 腳踏車
const cycleBike = bike(0x5b8def); cyclist.add(cycleBike);        // 藍色腳踏車
const rider = makeChibi({ shirt: 0x7ab07a, helmet: C.yellow });  // 戴黃色安全帽
scene.remove(rider); cyclist.add(rider);                         // 改掛在腳踏車群組底下
rider.position.set(0, 0.35, -0.15);                              // 坐在座墊上
rider.userData.armL.rotation.x = rider.userData.armR.rotation.x = -1.1; // 雙手往前握把手
const cyclePath = [[0, 1.4], [6.3, 1.4], [6.3, 5.6], [0, 5.6]];  // 繞圈路線
let cycleIdx = 0;                                                // 目前要騎向第幾個點
cyclist.position.set(cyclePath[0][0], 0.06, cyclePath[0][1]);    // 起點
