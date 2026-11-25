# 島嶼小鎮多人測驗（p5.js 專案版）

用 VS Code Live Server 開啟 `index.html` 測試；上傳到 GitHub 後到 Settings → Pages 開啟網站。

| 要改什麼 | 改哪個檔案 |
|---|---|
| 老師伺服器網址、房間 | `config.js` |
| 6 題題目與提示角色 | `data/question.csv`（Excel 存成「CSV UTF-8」） |
| 房屋、樹、橋、地面 | `js/world.js` |
| 角色外觀 | `js/characters.js` |
| 題目圓圈位置、內建題目 | `js/quiz.js` |
| 顏色、字型、版面 | `style.css` |

`js/multiplayer.js`（多人連線）的程式碼不要刪改，只用 `MP.send` / `MP.on` 加新功能。
