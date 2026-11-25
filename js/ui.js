// =====================================================================
// js/ui.js：測驗視窗、HELP 視窗、結束畫面（HTML 介面）
// =====================================================================
// ---------------- 測驗介面（HTML） ----------------
const $ = id => document.getElementById(id);
const UI = {
  open: () => document.querySelector('.mask.on') !== null,        // 有對話框開著就暫停走路
  cur: null,                                                      // 目前作答的題目
  refresh() {
    const answered = spots.filter(s => s.first !== null).length, firstOk = spots.filter(s => s.first === true).length;
    $('stat').textContent = `答題 ${answered} / 6　第一次就答對 ${firstOk} 題`;
    $('dots').innerHTML = spots.map(s => `<span class="${s.state || ''}">${s.state === 'ok' ? '✓' : s.state === 'bad' ? '✗' : s.id}</span>`).join('');
    spots.forEach(s => s.ring.material.color.set(s.state === 'ok' ? 0x5fae6e : s.state === 'bad' ? 0xd9483b : C.orange));
  },
  quiz(s) {
    const Q = QUIZ[s.id]; UI.cur = s;
    const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);  // 打亂選項
    $('quizCard').innerHTML = `<span class="tag">第 ${s.id} 題・${s.name}</span>${s.state === 'bad' ? ' <span class="tag" style="background:#d9483b">再試一次</span>' : ''}
      <h2>${Q.q}</h2>${order.map((o, i) => `<button class="opt" data-o="${o}"><i>${i + 1}</i><span>${Q.opts[o]}</span></button>`).join('')}
      <div class="fb" id="fb"></div><button class="btn" id="qClose">稍後再答</button>`;
    $('quizCard').querySelectorAll('.opt').forEach(b => b.onclick = () => UI.answer(+b.dataset.o));
    $('qClose').onclick = () => UI.close('mQuiz');
    $('mQuiz').classList.add('on');
  },
  answer(o) {
    const s = UI.cur, Q = QUIZ[s.id], ok = o === 0, h = HELPERS.find(x => x.q === s.id);
    if (!s.quizBusy) {
      s.quizBusy = true;
      if (s.first === null) s.first = ok;                          // 計分只看第一次
      s.state = ok ? 'ok' : 'bad';
      $('quizCard').querySelectorAll('.opt').forEach(b => { b.disabled = true; const v = +b.dataset.o; if (ok && v === 0) b.classList.add('ok'); else if (!ok && v === o) b.classList.add('bad'); });
      const fb = $('fb'); fb.className = 'fb ' + (ok ? 'ok' : 'bad');
      fb.innerHTML = ok ? `✅ <b>答對了！</b>${Q.exp}` : `🤔 <b>差一點！</b>可以去找附近的 💡<b>${h.name}</b>（${h.role}）聽重點，再回來重新作答。`;
      $('qClose').textContent = '繼續'; s.quizBusy = false; UI.cur = ok ? null : s; s.answeredNow = true;
      UI.refresh(); MP.onAnswer();
    }
  },
  close(id) {
    $(id).classList.remove('on');
    if (id === 'mQuiz' && spots.every(s => s.state === 'ok')) setTimeout(UI.end, 400); // 全部答對
  },
  help() {
    $('helpCard').innerHTML = `<span class="tag" style="background:#f2c230;color:#26262c">💡 HELP</span><h2>提示角色</h2>` +
      HELPERS.map((h, i) => { const s = stOf(h.q); return `<div class="hcard"><div class="av" style="background:${h.color}">${h.name[0]}</div>
        <div><b>${h.name}</b> <em>${h.role}</em><small>在「${s.name}」旁邊・負責第 ${h.q} 題 ${s.state === 'ok' ? '✓' : s.state === 'bad' ? '（還沒答對）' : ''}</small>
        <ul>${h.tips.map(t => `<li>${t}</li>`).join('')}</ul></div><button class="go" data-i="${i}">帶我去</button></div>`; }).join('') +
      `<button class="btn" id="hClose">關閉</button>`;
    $('helpCard').querySelectorAll('.go').forEach(b => b.onclick = () => { const h = HELPERS[+b.dataset.i]; moveTo = { x: h.x + 0.9, z: h.z + 0.9 }; UI.close('mHelp'); });
    $('hClose').onclick = () => UI.close('mHelp');
    $('mHelp').classList.add('on');
  },
  near(h) {                                                      // 下方提示卡
    const el = $('near'), show = h && !UI.open();
    el.style.display = show ? 'block' : 'none'; $('tipline').style.display = show ? 'none' : '';
    if (!show || el.dataset.h === h.name) return;
    el.dataset.h = h.name;
    el.innerHTML = `<div class="who"><div class="av" style="background:${h.color}">${h.name[0]}</div><b>${h.name}</b><em>${h.role}</em>
      <span style="margin-left:auto;font-size:12px;color:#7b7b86">第 ${h.q} 題的提示</span></div><ul>${h.tips.map(t => `<li>${t}</li>`).join('')}</ul>`;
  },
  end() {
    const firstOk = spots.filter(s => s.first === true).length;
    $('endCard').innerHTML = `<span class="tag">完成！</span><h2>六個題目都答對了 🎉</h2>
      <div style="font-size:14px;color:#6b6b75">第一次就答對</div><div class="big">${firstOk} / 6</div>` +
      spots.map(s => `<div class="row"><span>第 ${s.id} 題・${s.name}</span><span>${s.first ? '✅ 一次答對' : '🔁 看提示後答對'}</span></div>`).join('') +
      `<div class="row" style="border:0;font-weight:700"><span>用時</span><span>${mmss((MP.finishedAt || Date.now()) - MP.startedAt)}</span></div>` +
      `<div style="font-size:15px;margin-top:8px">🏆 你是第 <b id="myRank">${MP.myRank() || '…'}</b> 位六題全對的人！右上角看排行榜。</div>` +
      `<button class="btn" id="again">關閉</button>`;
    $('again').onclick = () => UI.close('mEnd');
    setTimeout(() => { const el = $('myRank'); if (el && MP.myRank()) el.textContent = MP.myRank(); }, 800);
    $('mEnd').classList.add('on');
  },
};
$('startBtn').onclick = () => { UI.close('mIntro'); MP.join(); };
$('helpBtn').onclick = () => UI.help();
addEventListener('keydown', e => {  
  if (Chat.typing()) return;                                     // 正在聊天室打字
  if (e.key === 'Enter' && $('chat').classList.contains('on') && !UI.open()) { e.preventDefault(); $('chatIn').focus(); return; } // Enter 開始打字                             // 鍵盤：1～4 作答、Enter 繼續、H 提示、Esc 關閉
  if ($('mQuiz').classList.contains('on')) {
    const n = +e.key; const btns = [...$('quizCard').querySelectorAll('.opt')];
    if (n >= 1 && n <= 4 && btns[n - 1] && !btns[n - 1].disabled) btns[n - 1].click();
    if (e.key === 'Enter' || e.key === 'Escape') $('qClose').click();
    return;
  }
  if (e.key === 'Enter' && $('mIntro').classList.contains('on')) $('startBtn').click();
  if (e.key === 'Escape') ['mHelp', 'mIntro'].forEach(id => UI.close(id));
  if ((e.key === 'h' || e.key === 'H') && !UI.open()) UI.help();
});
UI.refresh();
