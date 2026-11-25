// =====================================================================
// sketch.js：p5.js 主程式：狀態、鍵盤滑鼠、每一格畫面的更新
// =====================================================================
// ---------------- 狀態 ----------------
const target = new THREE.Vector3(0, 0, 1);                       // 攝影機跟隨的點
let moveTo = null;                                               // 點擊後要走去的位置
let nearSpot = null;                                             // 目前站在哪個集章點旁
let celebrate = 0;                                               // 全部集滿後的慶祝時間
const SCREEN_RIGHT = new THREE.Vector3(), SCREEN_UP = new THREE.Vector3(); // 畫面的右、上在世界中的方向（跟著視角變）

addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); fitCamera(); }); // 視窗改變時重新調整

// =====================================================================
// p5.js：主迴圈、輸入、介面
// =====================================================================
new p5((p) => {
  const FONT = "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"; // 中文字型與備用字型
  const labelHits = [];                                          // 這一幀畫出的標籤位置（點擊判斷用）
  const ray = new THREE.Raycaster();                             // 用來把滑鼠位置換算到地面
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.06); // 地面平面

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight).parent('hud'); // 介面畫布
    p.textFont(FONT);                                            // 套用字型
  };
  p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);

  // 把 3D 座標換算成螢幕座標
  const toScreen = (x, y, z) => {
    const v = new THREE.Vector3(x, y, z).project(camera);        // 投影到 -1～1
    return { x: (v.x + 1) / 2 * p.width, y: (1 - v.y) / 2 * p.height };
  };

  // 點擊或觸控：點標籤就走過去，點地面就走到那裡
  let downX = 0, downY = 0, dragging = false;                    // 拖曳狀態
  const onUI = e => UI.open() || (e && e.target && e.target.closest && e.target.closest('.ui'));
  let skip = false;
  p.mousePressed = (e) => { skip = onUI(e); downX = p.mouseX; downY = p.mouseY; dragging = false; if (!skip) return false; };
  p.mouseDragged = () => {                                       // 按住拖曳：旋轉攝影機
    if (skip) return;
    if (Math.hypot(p.mouseX - downX, p.mouseY - downY) > 5) dragging = true; // 移動超過 5 像素才算拖曳
    if (!dragging) return false;
    yawTarget -= (p.mouseX - p.pmouseX) * 0.008;                 // 左右拖：水平旋轉
    pitchTarget = p.constrain(pitchTarget + (p.mouseY - p.pmouseY) * 0.006, PITCH_MIN, PITCH_MAX); // 上下拖：俯角
    return false;
  };
  p.mouseReleased = () => {                                      // 放開時，沒有拖曳才算「點一下」
    if (skip) { skip = false; return; }
    if (dragging) { dragging = false; return false; }
    const hit = labelHits.find(h => p.mouseX > h.x && p.mouseX < h.x + h.w && p.mouseY > h.y && p.mouseY < h.y + h.h);
    if (hit) { moveTo = hit.spot ? { x: hit.spot.x, z: hit.spot.z } : { x: hit.helper.x + 0.9, z: hit.helper.z + 0.9 }; return false; } // 點到標籤
    ray.setFromCamera(new THREE.Vector2(p.mouseX / p.width * 2 - 1, -(p.mouseY / p.height) * 2 + 1), camera); // 滑鼠射線
    const pt = new THREE.Vector3();
    if (ray.ray.intersectPlane(groundPlane, pt) && walkable(pt.x, pt.z)) moveTo = { x: pt.x, z: pt.z }; // 點到可走的地面
    return false;                                                // 避免手機捲動
  };
  // 滾輪縮放
  p.mouseWheel = (e) => { if (onUI(e)) return; zoomTarget = p.constrain(zoomTarget + e.delta * 0.02, 8, 44); return false; }; // 滾輪：設定目標，畫面再慢慢縮放
  p.keyPressed = () => {
    if (Chat.typing()) return;                                   // 打字時不處理遊戲按鍵
    if (UI.open()) return;
    if (p.key === 'q' || p.key === 'Q') yawTarget -= Math.PI / 2;       // Q：場景往一邊轉 90 度
    if (p.key === 'e' || p.key === 'E') yawTarget += Math.PI / 2;       // E：往另一邊轉 90 度
    if (p.key === 'r' || p.key === 'R') {                               // R：回到預設
      yawTarget = YAW0 + Math.round((camYaw - YAW0) / (Math.PI * 2)) * Math.PI * 2; // 走最近的方向轉回去
      pitchTarget = PITCH0; zoomTarget = 26;
    }
    if ([32, 37, 38, 39, 40].includes(p.keyCode)) return false;  // 方向鍵不捲動網頁
  };

  // 嘗試移動，撞到東西就沿著牆滑過去
  function tryMove(ch, dx, dz) {
    const x = ch.position.x, z = ch.position.z;
    if (isFree(x + dx, z + dz)) { ch.position.x += dx; ch.position.z += dz; return true; } // 直接走
    if (isFree(x + dx, z)) { ch.position.x += dx; return true; } // 只走 x
    if (isFree(x, z + dz)) { ch.position.z += dz; return true; } // 只走 z
    return false;                                                // 完全卡住
  }

  function update(dt, t) {
    // ---- 玩家移動 ----
    let kx = 0, ky = 0;                                          // 鍵盤方向（畫面上的左右上下）
    if (p.keyIsDown(p.LEFT_ARROW) || p.keyIsDown(65)) kx -= 1;   // ← / A
    if (p.keyIsDown(p.RIGHT_ARROW) || p.keyIsDown(68)) kx += 1;  // → / D
    if (p.keyIsDown(p.UP_ARROW) || p.keyIsDown(87)) ky += 1;     // ↑ / W
    if (p.keyIsDown(p.DOWN_ARROW) || p.keyIsDown(83)) ky -= 1;   // ↓ / S
    if (!Chat.typing() && (p.keyIsDown(187) || p.keyIsDown(107) || p.keyIsDown(61))) zoomTarget = Math.max(8, zoomTarget - 18 * dt);  // + 鍵拉近
    if (!Chat.typing() && (p.keyIsDown(189) || p.keyIsDown(109) || p.keyIsDown(173))) zoomTarget = Math.min(44, zoomTarget + 18 * dt); // - 鍵拉遠
    SCREEN_RIGHT.set(Math.cos(camYaw), 0, -Math.sin(camYaw));    // 依目前視角算出畫面的右邊
    SCREEN_UP.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));      // 畫面的上方
    if (UI.open() || Chat.typing()) { kx = ky = 0; if (UI.open()) moveTo = null; }               // 作答或看提示時先停下來
    let mx = 0, mz = 0;                                          // 世界中的移動方向
    if (kx || ky) {                                              // 有按鍵就用鍵盤
      moveTo = null;                                             // 取消點擊目標
      mx = SCREEN_RIGHT.x * kx + SCREEN_UP.x * ky;               // 換算成世界方向
      mz = SCREEN_RIGHT.z * kx + SCREEN_UP.z * ky;
    } else if (moveTo) {                                         // 沒按鍵就走向點擊的位置
      mx = moveTo.x - player.position.x; mz = moveTo.z - player.position.z;
      if (Math.hypot(mx, mz) < 0.15) { moveTo = null; mx = mz = 0; } // 到了
    }
    const len = Math.hypot(mx, mz);
    if (len > 0) {                                               // 正在移動
      const step = 5 * dt;                                       // 每秒 5 單位
      const ok = tryMove(player, mx / len * step, mz / len * step);
      if (!ok) moveTo = null;                                    // 卡住就停下
      faceTo(player, mx, mz);                                    // 轉向
      animateWalk(player, 1, dt);                                // 走路動畫
    } else animateWalk(player, 0, dt);                           // 站好
    playerRing.position.set(player.position.x, 0.1, player.position.z); // 圓圈跟著玩家

    // ---- 小狗：走到主角後方 1.5 格的位置 ----
    const back = new THREE.Vector3(Math.sin(player.rotation.y), 0, Math.cos(player.rotation.y)); // 主角面向的方向
    const gx = player.position.x - back.x * 1.5, gz = player.position.z - back.z * 1.5; // 目標點
    const ddx = gx - dog.position.x, ddz = gz - dog.position.z, dd = Math.hypot(ddx, ddz);
    const du = dog.userData;
    if (dd > 0.25) {                                             // 離目標還有距離就跟上
      const sp = Math.min(6, 2 + dd * 3) * dt;                   // 越遠跑越快
      tryMove(dog, ddx / dd * Math.min(sp, dd), ddz / dd * Math.min(sp, dd)); // 一樣不能掉進水裡
      faceTo(dog, ddx, ddz);
      du.phase += dt * 14;
    }
    const run = dd > 0.25 ? 1 : 0;
    du.legs.forEach((l, i) => l.rotation.x = Math.sin(du.phase + (i % 3 ? Math.PI : 0)) * 0.6 * run); // 對角的腳一起擺
    du.tail.rotation.y = Math.sin(t * (run ? 18 : 9)) * 0.6;     // 尾巴搖
    // ---- 老師揮手 ----
    teacher.userData.armL.rotation.z = -2.5 - Math.sin(t * 7) * 0.35; // 右手舉高左右揮
    // ---- 路人 ----
    walkers.forEach(w => {
      const [tx, tz] = w.path[w.i];                              // 下一個路線點
      const dx = tx - w.ch.position.x, dz = tz - w.ch.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.1) { w.i = (w.i + 1) % w.path.length; return; }  // 到了就換下一點
      w.ch.position.x += dx / d * w.speed * dt; w.ch.position.z += dz / d * w.speed * dt; // 前進
      faceTo(w.ch, dx, dz); animateWalk(w.ch, w.speed / 2, dt);  // 轉向與擺手腳
    });

    // ---- 騎士 ----
    const [cx, cz] = cyclePath[cycleIdx];
    const cdx = cx - cyclist.position.x, cdz = cz - cyclist.position.z, cd = Math.hypot(cdx, cdz);
    if (cd < 0.1) cycleIdx = (cycleIdx + 1) % cyclePath.length;  // 到轉角換方向
    else {
      cyclist.position.x += cdx / cd * 3 * dt; cyclist.position.z += cdz / cd * 3 * dt; // 每秒 3 單位
      const want = Math.atan2(cdx, cdz);                         // 想要的方向
      let diff = want - cyclist.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // 角度差
      cyclist.rotation.y += diff * Math.min(1, dt * 6);          // 平滑轉彎
    }
    const pedal = t * 8;                                         // 踩踏板節奏
    rider.userData.legL.rotation.x = -0.9 + Math.sin(pedal) * 0.5; // 左腳踩
    rider.userData.legR.rotation.x = -0.9 - Math.sin(pedal) * 0.5; // 右腳踩

    // ---- 集章 ----
    spots.forEach(s => {
      const inside = Math.hypot(s.x - player.position.x, s.z - player.position.z) < 1.3; // 站在圓圈裡
      if (inside && !s.wasIn && s.state !== 'ok' && !UI.open()) UI.quiz(s); // 剛走進來、還沒答對 → 出題
      s.wasIn = inside;                                          // 要先走出去，才會再出題
      s.ring.scale.setScalar(s.state === 'ok' ? 1 : 1 + Math.sin(t * 3 + s.id) * 0.08); // 還沒答對的圓圈會呼吸
    });
    // ---- 提示角色：靠近就轉過來揮手，下方出現提示卡 ----
    let nearH = null;
    HELPERS.forEach(h => {
      const dx = player.position.x - h.x, dz = player.position.z - h.z, d = Math.hypot(dx, dz);
      if (d < 2.4) { nearH = h; h.ch.rotation.y += (Math.atan2(dx, dz) - h.ch.rotation.y) * Math.min(1, dt * 6); }
      if (!h.teacher) h.ch.userData.armL.rotation.z = d < 2.4 ? -2.5 - Math.sin(t * 7) * 0.35 : 0; // 靠近才揮手
    });
    UI.near(nearH);
    MP.tick(dt);

    // ---- 環境動畫 ----
    flag.rotation.y = Math.sin(t * 2) * 0.25;                    // 旗子飄動
    boats.forEach((b, i) => { b.position.y = -1 + Math.sin(t * 1.5 + i) * 0.06; b.rotation.z = Math.sin(t + i) * 0.04; }); // 船搖晃
    ripples.forEach(r => { r.position.x += dt * 0.4; if (r.position.x > 45) r.position.x = -45; r.scale.x = 0.7 + 0.3 * Math.sin(t + r.userData.phase); }); // 波紋漂動

    // ---- 攝影機跟隨 ----
    target.lerp(new THREE.Vector3(player.position.x, 0, player.position.z), 1 - Math.pow(0.02, dt)); // 平滑跟隨
    const k = 1 - Math.pow(0.004, dt);                           // 平滑程度
    camYaw += (yawTarget - camYaw) * k; camPitch += (pitchTarget - camPitch) * k; // 角度慢慢靠近目標
    viewSize += (zoomTarget - viewSize) * k; fitCamera();        // 縮放也慢慢靠近
    camera.position.set(target.x + CAM_DIST * Math.cos(camPitch) * Math.sin(camYaw), CAM_DIST * Math.sin(camPitch),
                        target.z + CAM_DIST * Math.cos(camPitch) * Math.cos(camYaw)); // 依角度放攝影機
    camera.lookAt(target);                                       // 看向玩家
    sun.position.copy(target).add(new THREE.Vector3(12, 25, 8)); // 陰影範圍跟著玩家
    sun.target.position.copy(target);
  }

  // ---------------- 介面 ----------------
  function pill(x, y, label, num, done) {                        // 白色膠囊標籤：①名稱
    p.textSize(14); p.textStyle(p.BOLD);
    const w = p.textWidth(label) + 46, h = 30;                   // 標籤寬高
    const lx = x - w / 2, ly = y - h;                            // 左上角
    p.noStroke(); p.fill(0, 0, 0, 40); p.rect(lx + 1, ly + 3, w, h, 15); // 陰影
    p.fill(255); p.rect(lx, ly, w, h, 15);                       // 白底
    p.fill(done === 'ok' ? '#5fae6e' : done === 'bad' ? '#d9483b' : hex(C.orange)); p.circle(lx + 16, ly + 15, 22); // 編號圓
    p.fill(255); p.textAlign(p.CENTER, p.CENTER); p.text(done === 'ok' ? '✓' : done === 'bad' ? '✗' : num, lx + 16, ly + 15.5);
    p.fill('#33333a'); p.textAlign(p.LEFT, p.CENTER); p.text(label, lx + 32, ly + 15.5); // 名稱
    p.stroke(255); p.strokeWeight(2); p.line(x, y, x, y + 14); p.noStroke(); // 往下指的細線
    return { x: lx, y: ly, w, h };
  }
  function areaTag(x, y, no, name) {                             // 深色區域標籤：03 交通
    p.textSize(14); p.textStyle(p.BOLD);
    const w = p.textWidth(name) + 54, h = 34;
    p.noStroke(); p.fill('#26262c'); p.rect(x - w / 2, y - h / 2, w, h, 17); // 深色底
    p.fill(hex(C.orange)); p.textAlign(p.LEFT, p.CENTER); p.textSize(11); p.text(no, x - w / 2 + 14, y + 1); // 編號
    p.fill(255); p.textSize(14); p.text(name, x - w / 2 + 36, y + 1); // 名稱
  }

  function drawHUD(t) {
    p.clear();                                                   // 清除（保持透明）
    labelHits.length = 0;
    platforms.forEach(pl => { const s = toScreen(pl.x + pl.w / 2 - 2, 0, pl.z + pl.d / 2); areaTag(s.x, s.y + 22, pl.no, pl.name); }); // 區域標籤
    spots.forEach(s => {                                         // 集章點標籤
      const sc = toScreen(s.x, 2.4, s.z);
      const r = pill(sc.x, sc.y + Math.sin(t * 2 + s.id) * 3, `第${s.id}題 ${s.name}`, String(s.id), s.state);
      labelHits.push({ ...r, spot: s });
    });
    HELPERS.forEach((h, i) => {                                  // 提示角色頭上的黃色「?」標籤
      const sc = toScreen(h.x, 2.5, h.z), y = sc.y + Math.sin(t * 3 + i) * 3;
      p.textSize(13); p.textStyle(p.BOLD);
      const w = p.textWidth(h.name) + 42, lx = sc.x - w / 2, ly = y - 28;
      p.noStroke(); p.fill(0, 0, 0, 40); p.rect(lx + 1, ly + 3, w, 28, 14);
      p.fill('#f2c230'); p.rect(lx, ly, w, 28, 14);
      p.fill('#26262c'); p.circle(lx + 15, ly + 14, 20); p.fill('#f2c230'); p.textAlign(p.CENTER, p.CENTER); p.text('?', lx + 15, ly + 14.5);
      p.fill('#26262c'); p.textAlign(p.LEFT, p.CENTER); p.text(h.name, lx + 30, ly + 14.5);
      p.fill('#f2c230'); p.triangle(sc.x - 6, ly + 27, sc.x + 6, ly + 27, sc.x, ly + 35);
      labelHits.push({ x: lx, y: ly, w, h: 28, helper: h });
    });
    MP.labels(p, toScreen);

  }

  p.draw = () => {
    const dt = Math.min(p.deltaTime / 1000, 0.05);               // 這一幀經過的秒數
    const t = p.millis() / 1000;                                 // 總時間
    update(dt, t);                                               // 更新遊戲
    renderer.render(scene, camera);                              // 畫 3D 場景
    drawHUD(t);                                                  // 畫介面
  };
});
