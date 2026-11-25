// =====================================================================
// js/multiplayer.js：多人連線（socket.io）：登入、同步位置、聊天、排行榜
// =====================================================================
// 連線網址寫在 config.js
const LOOKS = [
  { name: '馬尾女孩', look: { shirt: 0x5fae6e, pants: 0x2f3a5c, hair: 0x2b1d14, helmet: 0xd9483b, bag: C.yellow, ponytail: 0x2b1d14 } },
  { name: '藍帽男孩', look: { shirt: 0xe8743b, pants: 0x3f4a66, hair: 0x2b1d14, helmet: 0x2f6fb0, bag: 0x5b8def } },
  { name: '粉紅背包', look: { shirt: 0xf29bb5, pants: 0x4a5370, hair: 0x6b4a2b, bag: 0xf2c230, ponytail: 0x6b4a2b } },
  { name: '黃帽小隊', look: { shirt: 0x5b8def, pants: 0x3f4a66, hair: 0x2b1d14, helmet: C.yellow, bag: 0x7ab07a } },
  { name: '紫衣學長', look: { shirt: 0x8e6cc4, pants: 0x2f2f36, hair: 0x1d1d22, bag: 0xe8743b } },
  { name: '白衣學霸', look: { shirt: 0xf7f4ee, pants: 0x2f6fb0, hair: 0x3b2a20, glasses: true, bag: 0xd9483b } },
];
const lookColor = i => hex(LOOKS[i].look.shirt);
const clampLook = v => Math.max(0, Math.min(LOOKS.length - 1, Math.floor(Number(v)) || 0));
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
const mmss = ms => { const t = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
function dressPlayer(i) {                                        // 換主角的造型：做一個新公仔，把零件搬過來
  const c = makeChibi(LOOKS[i].look); scene.remove(c);
  player.clear(); while (c.children.length) player.add(c.children[0]);
  player.userData = c.userData;
}
function toast(msg) { const t = $('toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(() => t.style.display = 'none', 3500); }

const MP = {
  socket: null, myId: null, look: 0, joined: false, startedAt: null, finishedAt: null,
  others: new Map(), rank: [], sendAt: 0, lastSent: '',
  teacherKey: new URLSearchParams(location.search).get('teacher'),   // 網址加 ?teacher=密碼 才看得到「開新一局」

  init() {                                                        // 從伺服器載入 socket.io 的程式再連線
    const sc = document.createElement('script');
    sc.src = (SERVER_URL || '') + '/socket.io/socket.io.min.js';
    sc.onload = () => MP.connect();
    sc.onerror = () => MP.offline();
    document.head.appendChild(sc);
    setTimeout(() => { if (!MP.socket || !MP.socket.connected) MP.offline(); }, 6000);
    if (MP.teacherKey) $('resetBtn').style.display = '';
  },
  connect() {
    const io = window.io;
    MP.socket = SERVER_URL ? io(SERVER_URL) : io();
    MP.socket.on('connect', () => { $('mpNote').textContent = '✅ 已連上伺服器，輸入暱稱就可以加入。'; $('online').textContent = '已連線';
      if (MP.joined) MP.socket.emit('join', { name: MP.name, look: MP.look, room: ROOM || new URLSearchParams(location.search).get('room') || '' }); });   // 斷線重連後重新加入
    MP.socket.on('disconnect', () => { $('online').textContent = '連線中斷…'; });
    MP.socket.on('welcome', d => {
      const first = !MP.myId;
      MP.myId = d.id; MP.name = String(d.name || MP.name); $('roomName').textContent = String(d.room || '').slice(0, 40);
      if (first && typeof d.x === 'number' && typeof d.z === 'number') { player.position.set(d.x, 0.06, d.z); moveTo = null; } // 伺服器安排的出生點
      $('chatLog').textContent = ''; (Array.isArray(d.history) ? d.history : []).forEach(m => Chat.add(m, false));
      MP.sendProgress();
    });
    MP.socket.on('chat', m => Chat.add(m, true));
    MP.roster = new Map();
    MP.socket.on('roster', list => { MP.roster = new Map((Array.isArray(list) ? list : []).map(q => [q[0], { id: q[1], name: q[2], look: q[3] }])); });
    MP.socket.on('p', arr => { if (!Array.isArray(arr)) return; MP.onPlayers(arr.map(q => { const who = MP.roster.get(q[0]) || {}; return { id: who.id, name: who.name, look: who.look, x: q[1], z: q[2], r: q[3], n: q[4], done: !!q[5] }; }).filter(q => q.id)); });
    MP.socket.on('custom', m => { if (!m || typeof m.type !== 'string') return; (MP.handlers[m.type] || []).forEach(fn => { try { fn(m.data, m.from || {}); } catch (e) { console.error(e); } }); });
    MP.socket.on('players', list => MP.onPlayers(list));
    MP.socket.on('rank', list => { MP.rank = Array.isArray(list) ? list : []; MP.renderBoard(); });
    MP.socket.on('newRound', () => MP.newRound());
    MP.socket.on('notice', m => toast(String(m).slice(0, 60)));
  },
  offline() {
    if (MP.socket && MP.socket.connected) return;
    $('mpNote').textContent = '⚠️ 連不上伺服器，可以先單人遊玩（不會出現在排行榜）。';
    $('online').textContent = '單人模式'; $('boardList').textContent = '沒有連上伺服器';
  },
  join() {
    MP.name = ($('nick').value.trim() || '玩家').slice(0, 12);
    try { localStorage.setItem('island-nick', MP.name); } catch (e) {}
    MP.joined = true; dressPlayer(MP.look); $('chat').classList.add('on');
    MP.startedAt = Date.now(); MP.finishedAt = null;
    if (MP.socket && MP.socket.connected) MP.socket.emit('join', { name: MP.name, look: MP.look, room: ROOM || new URLSearchParams(location.search).get('room') || '' });
  },
  sendProgress() {
    if (!MP.socket || !MP.joined) return;
    MP.socket.emit('progress', { n: spots.filter(sp => sp.state === 'ok').length, firstTry: spots.filter(sp => sp.first === true).length });
  },
  onAnswer() {
    if (!MP.finishedAt && spots.every(sp => sp.state === 'ok')) MP.finishedAt = Date.now();
    MP.sendProgress();
  },
  newRound() {                                                    // 老師開新一局
    spots.forEach(sp => { sp.state = null; sp.first = null; });
    MP.startedAt = Date.now(); MP.finishedAt = null;
    player.position.set(0, 0.06, 1); moveTo = null; UI.refresh();
    ['mQuiz', 'mEnd', 'mHelp'].forEach(id => $(id).classList.remove('on'));
    toast('老師開了新的一局！重新開始計時');
  },
  onPlayers(list) {                                               // 其他玩家：新增、更新、離開
    if (!Array.isArray(list)) return;
    const seen = new Set();
    list.forEach(q => {
      if (!q || q.id === MP.myId) return;
      seen.add(q.id);
      const look = clampLook(q.look);
      let o = MP.others.get(q.id);
      if (!o || o.look !== look) {
        if (o) scene.remove(o.ch);
        const ch = makeChibi(LOOKS[look].look); ch.position.set(num(q.x), 0.06, num(q.z));
        o = { ch, look }; MP.others.set(q.id, o);
      }
      o.tx = num(q.x); o.tz = num(q.z); o.ry = num(q.r); o.n = Math.min(6, num(q.n)); o.done = !!q.done;
      o.name = String(q.name || '玩家').slice(0, 12);
    });
    MP.others.forEach((o, id) => { if (!seen.has(id)) { scene.remove(o.ch); MP.others.delete(id); } });
    $('online').textContent = `線上 ${list.length} 人`;
  },
  renderBoard() {
    const list = $('boardList'); list.textContent = '';
    if (!MP.rank.length) { list.textContent = '還沒有人加入，搶第一名吧！'; return; }
    MP.rank.forEach((r, i) => {
      const row = document.createElement('div'); row.className = 'br' + (r.id === MP.myId ? ' me' : '');
      const rk = document.createElement('span'); rk.className = 'rk' + (r.done && i < 3 ? ' g' : ''); rk.textContent = r.done ? (['🥇', '🥈', '🥉'][i] || i + 1) : '–';
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = lookColor(clampLook(r.look));
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = String(r.name || '玩家').slice(0, 12) + (r.id === MP.myId ? '（你）' : '');
      const sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = r.done ? `✅ ${mmss(num(r.used))}・一次對 ${num(r.firstTry)}` : `${num(r.n)} / 6 進行中`;
      row.append(rk, dot, nm, sc); list.append(row);
    });
  },
  myRank() { const r = MP.rank.find(x => x.id === MP.myId && x.done); return r ? r.rank : null; },
  reset() {
    if (Date.now() - (MP.resetArm || 0) > 4000) { MP.resetArm = Date.now(); $('resetBtn').classList.add('warn'); $('resetBtn').textContent = '確定開新一局？再按一次';
      setTimeout(() => { $('resetBtn').classList.remove('warn'); $('resetBtn').textContent = '🔄 開新一局（清空排行榜）'; }, 4000); return; }
    MP.resetArm = 0; $('resetBtn').classList.remove('warn'); $('resetBtn').textContent = '🔄 開新一局（清空排行榜）';
    if (MP.socket) MP.socket.emit('reset', MP.teacherKey);
  },
  tick(dt) {
    MP.others.forEach(o => {
      const dx = o.tx - o.ch.position.x, dz = o.tz - o.ch.position.z, d = Math.hypot(dx, dz);
      if (d > 8) o.ch.position.set(o.tx, 0.06, o.tz);
      else { const k = 1 - Math.pow(0.0005, dt); o.ch.position.x += dx * k; o.ch.position.z += dz * k; }
      let diff = o.ry - o.ch.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); o.ch.rotation.y += diff * Math.min(1, dt * 10);
      animateWalk(o.ch, d > 0.03 ? 1 : 0, dt);
      o.ch.userData.armL.rotation.z = o.waveUntil > Date.now() ? -2.5 - Math.sin(Date.now() / 140) * 0.35 : 0; // 別人揮手
    });
    if (player.userData.armL) player.userData.armL.rotation.z = MP.myWave > Date.now() ? -2.5 - Math.sin(Date.now() / 140) * 0.35 : 0; // 自己揮手
    if (MP.socket && MP.socket.connected && MP.joined) {         // 自己的位置：有變化才送，最多每 0.1 秒一次
      const now = performance.now();
      const st = { x: Math.round(player.position.x * 100) / 100, z: Math.round(player.position.z * 100) / 100, r: Math.round(player.rotation.y * 100) / 100 };
      const key = JSON.stringify(st);
      if (key !== MP.lastSent && now - MP.sendAt > 100) { MP.lastSent = key; MP.sendAt = now; MP.socket.emit('move', st); }
    }
    if (MP.joined && MP.startedAt) $('timer').textContent = '用時 ' + mmss((MP.finishedAt || Date.now()) - MP.startedAt);
  },
  labels(p, toScreen) {                                           // 其他玩家頭上的名字與對話泡泡
    const now = Date.now();
    const bubble = (x, y, text) => {                              // 白色對話框，太長就截短
      p.textSize(13); p.textStyle(p.NORMAL);
      let t = text; while (p.textWidth(t) > 220 && t.length > 4) t = t.slice(0, -2);
      if (t !== text) t += '…';
      const w = p.textWidth(t) + 20, h = 28, bx = x - w / 2, by = y - h - 10;
      p.noStroke(); p.fill(0, 0, 0, 30); p.rect(bx + 1, by + 3, w, h, 12);
      p.fill(255); p.rect(bx, by, w, h, 12); p.triangle(x - 6, by + h - 1, x + 6, by + h - 1, x, by + h + 7);
      p.fill(38, 38, 44); p.textAlign(p.CENTER, p.CENTER); p.text(t, x, by + h / 2 + 0.5);
    };
    MP.others.forEach(o => {
      const sc = toScreen(o.ch.position.x, 2.3, o.ch.position.z);
      const label = o.name + (o.done ? ' 🏁' : ` ${o.n}/6`);
      p.textSize(12); p.textStyle(p.BOLD);
      const w = p.textWidth(label) + 26;
      p.noStroke(); p.fill(38, 38, 44, 200); p.rect(sc.x - w / 2, sc.y - 22, w, 22, 11);
      p.fill(lookColor(o.look)); p.circle(sc.x - w / 2 + 11, sc.y - 11, 10);
      p.fill(255); p.textAlign(p.LEFT, p.CENTER); p.text(label, sc.x - w / 2 + 19, sc.y - 10.5);
      if (o.say && now < o.sayUntil) bubble(sc.x, sc.y - 24, o.say);
    });
    if (MP.mySay && now < MP.mySayUntil) { const sc = toScreen(player.position.x, 2.1, player.position.z); bubble(sc.x, sc.y, MP.mySay); }
  },
};
// 選角色按鈕
$('looks').innerHTML = LOOKS.map((L, i) => `<button class="lk${i === 0 ? ' on' : ''}" data-i="${i}"><i style="background:${lookColor(i)}"></i>${L.name}</button>`).join('');
$('looks').querySelectorAll('.lk').forEach(bt => bt.onclick = () => {
  MP.look = +bt.dataset.i; $('looks').querySelectorAll('.lk').forEach(x => x.classList.toggle('on', x === bt)); dressPlayer(MP.look);
});
$('boardHead').onclick = () => { const b = $('board'); if (innerWidth <= 800) b.classList.toggle('open'); else b.classList.toggle('min'); };
$('resetBtn').onclick = () => MP.reset();
try { $('nick').value = localStorage.getItem('island-nick') || ''; } catch (e) {}
const Chat = {
  add(m, live) {                                                  // 加一則訊息到聊天紀錄
    if (!m || typeof m.text !== 'string') return;
    const log = $('chatLog'), row = document.createElement('div');
    if (m.sys) { row.className = 'cm sys'; row.textContent = m.text.slice(0, 120); if (live) toast(m.text.slice(0, 60)); }
    else {
      row.className = 'cm' + (m.id === MP.myId ? ' me' : '');
      const who = document.createElement('b'); who.textContent = String(m.name || '玩家').slice(0, 12) + '：';
      who.style.color = m.id === MP.myId ? '' : lookColor(clampLook(m.look));
      row.append(who, document.createTextNode(m.text.slice(0, 80)));
      if (live) {                                                 // 說話的人頭上冒泡泡 5 秒
        if (m.id === MP.myId) { MP.mySay = m.text; MP.mySayUntil = Date.now() + 5000; }
        else { const o = MP.others.get(m.id); if (o) { o.say = m.text; o.sayUntil = Date.now() + 5000; } }
        if ($('chat').classList.contains('min')) $('chatHint').textContent = '有新訊息';
      }
    }
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 30;
    log.append(row); while (log.children.length > 80) log.firstChild.remove();
    if (atBottom || !live || m.id === MP.myId) log.scrollTop = log.scrollHeight;
  },
  typing: () => document.activeElement === $('chatIn'),
};
$('chatForm').onsubmit = e => {
  e.preventDefault();
  const t = $('chatIn').value.trim();
  if (t && MP.socket && MP.socket.connected && MP.joined) MP.socket.emit('chat', t);
  else if (t && !(MP.socket && MP.socket.connected)) toast('沒有連上伺服器，訊息送不出去');
  $('chatIn').value = '';
};
$('chatIn').addEventListener('keydown', e => { if (e.key === 'Escape') $('chatIn').blur(); e.stopPropagation(); });
$('chatHead').onclick = () => { $('chat').classList.toggle('min'); $('chatHint').textContent = 'Enter 開始打字'; };
// ===================== 學生可以用的「自訂多人訊息」 =====================
// 老師的伺服器不用改，就能做新的多人功能：
//   送出：MP.send('種類', 資料)            → 同房間的其他人都會收到（資料最多 2 KB，每秒最多 20 則）
//   接收：MP.on('種類', (資料, 送的人) => { ... })   送的人 = { id, name }
// 下面的「揮手」就是範例：按 G 或 👋，自己和別人畫面上的你都會揮手
MP.handlers = {};
MP.send = (type, data) => { if (MP.socket && MP.socket.connected && MP.joined) MP.socket.emit('custom', { type, data }); };
MP.on = (type, fn) => { (MP.handlers[type] = MP.handlers[type] || []).push(fn); };

MP.wave = () => { MP.myWave = Date.now() + 2000; MP.send('wave', {}); };
MP.on('wave', (data, from) => { const o = MP.others.get(from.id); if (o) o.waveUntil = Date.now() + 2000; });
$('waveBtn').onclick = () => MP.wave();
addEventListener('keydown', e => { if ((e.key === 'g' || e.key === 'G') && !Chat.typing() && !UI.open() && MP.joined) MP.wave(); });
// ======================================================================
MP.init();
