// =====================================================================
// js/quiz.js：集章點、內建題目、提示角色、讀取 data/question.csv
// =====================================================================
// ---------------- 集章點 ----------------
const spots = [
  { id: 1, name: '通學區',     x: -2.5, z: 6,    info: '過斑馬線前先停下來，左右看清楚再走。' },
  { id: 2, name: '共享單車站', x: 4.6,  z: -1.6, info: '借車前檢查煞車和輪胎，騎完記得還車。' },
  { id: 3, name: '公園球場',   x: -21,  z: 4.6,  info: '一起玩之前先說好規則，輪流上場。' },
  { id: 4, name: '河濱步道',   x: 21,   z: 2,    info: '靠近水邊不跨欄杆，坐在長椅上看風景。' },
  { id: 5, name: '校門口',     x: 1,    z: -17,  info: '早上跟警衛伯伯打聲招呼，準時進教室。' },
  { id: 6, name: '市場攤位',   x: 3,    z: 16.2, info: '買東西要排隊，拿到東西記得說謝謝。' },
];
spots.forEach(s => {
  const r = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 32), new THREE.MeshBasicMaterial({ color: C.orange, transparent: true, opacity: 0.9 }));
  r.rotation.x = -Math.PI / 2; r.position.set(s.x, 0.09, s.z);   // 地上的圓圈
  scene.add(r);
  s.ring = r; s.done = false;                                    // 記住圓圈、還沒蓋章
});

// ---------------- 測驗：題目（第一個選項是正確答案，出題時會打亂） ----------------
const QUIZ = {
  1: { q: '用 VS Code 的 Live Server 開啟作品後，瀏覽器的網址開頭通常是什麼？',
       opts: ['127.0.0.1:5500', 'file:///C:/Users/…/index.html', 'github.com/你的帳號', 'www.google.com'],
       exp: 'Live Server 會在自己的電腦開一個小網站，網址是 127.0.0.1:5500，存檔後還會自動重新整理。' },
  2: { q: '下面哪一個「不是」好指令的四個部分？',
       opts: ['把程式碼一行一行寫給 AI', '附上完整的 index.html', '用看得到的樣子描述要改什麼', '說明哪些地方不要改'],
       exp: '四個部分是：附上檔案、描述看得到的樣子、說明哪些不要改、要求回傳完整檔案。不需要自己寫程式。' },
  3: { q: '存檔之後畫面變成一片白，最好的下一步是？',
       opts: ['按 F12，把 Console 的紅字複製給 AI，並說「只修正這個錯誤」', '請 AI 把整個作品重寫一次', '重新安裝 VS Code', '關掉瀏覽器，明天再試'],
       exp: '錯誤訊息是最好的線索。加上「只修正這個錯誤，其他都不要改」，AI 才不會順手改壞別的地方。' },
  4: { q: '請 AI 把公園的樹換成櫻花樹時，加哪一句可以避免角色穿過新的樹？',
       opts: ['樹幹一樣會擋路', '顏色用粉紅色', '大小隨機一點', '樹要漂亮一點'],
       exp: '新加的東西要說清楚「會擋路」，改完再實際走一遍確認不會穿過去、也不會掉進水裡。' },
  5: { q: '加上 Q / E 旋轉場景時，為什麼要寫「方向鍵要跟著目前的視角換算方向」？',
       opts: ['場景轉過之後，按 → 角色仍然往畫面右邊走', '讓縮放變得比較平滑', '讓攝影機不會轉到地面底下', '讓滑鼠點一下就能走過去'],
       exp: '場景轉了 90 度以後，如果方向鍵沒有跟著換算，按 → 角色就會往奇怪的方向走。' },
  6: { q: '照影片的做法開啟 GitHub Pages 時，Branch 和資料夾要怎麼選？',
       opts: ['main，/ (root)', 'None，/ (root)', 'main，/docs', 'gh-pages，/src'],
       exp: 'Settings → Pages → Branch 選 main、資料夾選 / (root) → Save，等 1～2 分鐘就會出現網址。' },
};
// ---------------- 六位提示角色（站在各題附近） ----------------
const HELPERS = [
  { name: 'Live 小哥', role: 'Live Server 達人', q: 1, x: -4.4, z: 6.2, color: '#2f6fb0', look: { shirt: 0x2f6fb0, hair: 0x2b1d14, pants: 0x3f4a66 },
    tips: ['用 VS Code「開啟資料夾」，再按右下角的 Go Live', '網址會是 127.0.0.1:5500，代表用網站的方式在自己電腦開啟', '存檔 Ctrl+S 會自動重新整理；沒變就按 Ctrl+F5'] },
  { name: '指令姐姐', role: '提示詞教練', q: 2, x: 6.3, z: -0.9, color: '#c2577a', look: { shirt: 0xf29bb5, hair: 0x5a3a2a, pants: 0x4a5370, ponytail: 0x5a3a2a },
    tips: ['好指令四部分：附上檔案、描述看得到的樣子、說明不要改、要完整檔案', '用顏色、髮型、動作來描述，不用自己寫程式', '最後加一句「其他都不要改」'] },
  { name: '除錯博士', role: 'F12 偵探', q: 3, x: -18.6, z: 5.8, color: '#6b6b75', look: { shirt: 0xf4f4f4, hair: 0x9a9a9a, pants: 0x4b4b55, glasses: true },
    tips: ['畫面一片白？先按 F12，打開 Console', '把紅色的錯誤訊息整段複製給 AI', '加一句「只修正這個錯誤，其他都不要改」', '改得太亂就回到備份檔'] },
  { name: '造景阿伯', role: '場景設計師', q: 4, x: 19.2, z: 3.6, color: '#5f8f4f', look: { shirt: 0x7ab07a, hair: 0xdddddd, pants: 0x777777, helmet: 0xf2c230 },
    tips: ['用區域名稱和方向說位置：「公園」、「交通區下方」', '新的樹、房子、攤位都要說「會擋路」', '改完一定要實際走一遍：過橋、碰撞、集章'] },
  { name: '攝影機老師', role: '鏡頭專家', q: 5, teacher: true, color: '#26262c',
    tips: ['功能多就編號，一條一條列出來', '說清楚範圍，例如俯角 20°～70°', '要寫「方向鍵跟著目前視角換算」和「點一下還是要走過去」'] },
  { name: 'GitHub 店長', role: '上線顧問', q: 6, x: 5.6, z: 16.0, color: '#24292f', look: { shirt: 0x24292f, hair: 0x3b2a20, pants: 0x3f4a66, bag: 0x5fae6e },
    tips: ['主頁檔名一定是 index.html', 'Settings → Pages → Branch 選 main、資料夾 / (root) → Save', '網址是「帳號.github.io/儲存庫名稱/」，更新就上傳同名檔案覆蓋'] },
];
// ---------------- 從 question.csv 讀入題目與提示角色（沒有這個檔案就用上面內建的題目） ----------------
// 欄位：題號,題目,正確答案,錯誤選項1,錯誤選項2,錯誤選項3,解說,角色名字,角色職稱,提示1,提示2,提示3
// 可以用 Excel 編輯後「另存新檔 → CSV UTF-8（逗號分隔）」；空白的欄位會沿用內建內容
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');                                // 去掉 Excel 的 BOM
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }   // "" 代表一個雙引號
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(c => c.trim())).filter(r => r.some(c => c));
}
async function loadQuestionCSV() {
  try {
    let res = await fetch('data/question.csv', { cache: 'no-store' });     // 每次都讀最新的檔案
    if (!res.ok) res = await fetch('question.csv', { cache: 'no-store' });  // 也接受放在最外層
    if (!res.ok) { console.info('沒有 data/question.csv，使用內建題目'); return; }
    let n = 0;
    for (const r of parseCSV(await res.text())) {
      const id = parseInt(r[0], 10);
      if (!(id >= 1 && id <= 6)) continue;                            // 跳過標題列與不合法的題號
      const [, q, right, w1, w2, w3, exp, name, role, t1, t2, t3] = r;
      const wrong = [w1, w2, w3].filter(Boolean);
      if (q && right && wrong.length) { QUIZ[id] = { q, opts: [right, ...wrong], exp: exp || QUIZ[id].exp }; n++; }
      const h = HELPERS.find(x => x.q === id);
      if (h) {
        if (name) h.name = name;
        if (role) h.role = role;
        const tips = [t1, t2, t3].filter(Boolean);
        if (tips.length) h.tips = tips;
      }
    }
    console.info(`已從 data/question.csv 讀入 ${n} 題`);
  } catch (e) { console.warn('question.csv 讀取失敗，使用內建題目：', e); }
}
loadQuestionCSV();                                                 // 開始讀檔（讀完會自動替換題目）
HELPERS.forEach(h => {
  if (h.teacher) { h.ch = teacher; h.x = teacher.position.x; h.z = teacher.position.z; return; } // 校門口的老師兼任
  h.ch = makeChibi(h.look); h.ch.position.set(h.x, 0.06, h.z); h.ch.rotation.y = Math.random() * 6;
  blockCircles.push({ x: h.x, z: h.z, r: 0.35 });                // 提示角色也會擋路
});
const stOf = id => spots.find(s => s.id === id);
spots.forEach(s => { s.state = null; s.first = null; s.wasIn = false; }); // null 未答、'ok' 答對、'bad' 答錯待重答
