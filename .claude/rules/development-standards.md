# 開發規範

分支怎麼開、commit 怎麼切、訊息怎麼寫、怎麼合回主線。流程階段見 [workflow.md](workflow.md)。

## 0. 分支策略：feature branch workflow

```
main ──●─────────────────●───────────────▶  唯一長期分支，永遠可用
        \               / merge commit
         ●──●──●──●────╯                    feature/xxx（開 PR → review → merge）
```

| 規則 | 說明 |
| :--- | :--- |
| `main` | **唯一**長期分支，永遠保持可編譯、測試全綠。不直接在 `main` 上 commit |
| `feature/*` | 所有開發都在 feature branch 上進行，從最新的 `main` 開出 |
| 合併路徑 | feature branch → GitHub PR → code review 通過 → merge 回 `main`。**沒有 review 過的東西不進 `main`** |
| merge 方式 | GitHub 的 **Create a merge commit**（一般 merge，等同 `git merge --no-ff`） |

merge 方式選一般 merge 的理由：`main` 上要同時看得到**一顆 merge commit**（哪個 PR、什麼時候合進來）與**這個 PR 底下的每一顆 commit**（一個 TDD cycle 一顆的完整開發軌跡）。

- ❌ **Squash and merge**——會把整條 feature branch 壓成一顆，第 2 節辛苦切出來的 cycle 節奏全部消失。
- ❌ **Rebase and merge**——commit 保住了，但沒有 merge commit，看不出這批 commit 屬於同一個 PR。

主線有新東西時，用 merge 把 `main` 併進 feature branch 來更新（不改寫已推出去的歷史）。

## 1. 分支一律 `feature/` 前綴

```
feature/<用途簡述>
```

| 規則 | 說明 |
| :--- | :--- |
| 前綴 | 一律 `feature/`，不用 `feat/`、`fix/`、個人名字或日期 |
| 用途簡述 | 英文、小寫、以 `-` 連字，描述**做什麼**而不是**改哪個檔** |
| 一分支一切片 | 一個功能切片一條分支，從最新主線開出 |

```
✅ feature/split-preview-panel
✅ feature/paste-image-to-workspace
❌ split-preview-panel          ← 沒前綴
❌ feature/TC-03                ← 出現文件代號
❌ feature/james-0820           ← 看不出在做什麼
❌ feature/修正預覽面板          ← 用中文
```

## 2. Commit 節奏：一步一 commit

| 情況 | commit |
| :--- | :--- |
| 一個可獨立說明的實作步驟（含它的測試）做完 | 一個 commit |
| 把新東西接進 App（組裝根／路由／DI／啟動流程／設定） | 另一個 commit |
| 純重構、純文件、純測試補強 | 各自一個 commit |

- **不要**把好幾個步驟累積成一顆大 commit——review 的人無從逐步理解。
- **不要**留下紅燈的 commit。
- 每顆 commit 都必須是**可編譯、測試全綠**的狀態；commit 前先跑過 build 與測試。

## 3. Commit message：Conventional Commits，英文

```
<type>(<scope>): <subject>

<body：選填，說明「為什麼」而不是「做了什麼」>

<footer：選填，BREAKING CHANGE / 關聯 issue>
```

| type | 用在 |
| :--- | :--- |
| `feat` | 新增對使用者可見的行為 |
| `fix` | 修正錯誤行為 |
| `refactor` | 不改行為的結構調整 |
| `test` | 只動測試 |
| `docs` | 只動文件 |
| `chore` | 建置、依賴、工具設定 |
| `perf` | 效能改善 |

**subject 規則**：全英文、小寫開頭、祈使句（`add` 不是 `added`／`adds`）、句尾不加句號、盡量在 72 字元內、描述行為而非檔案。
**scope**：填模組或功能名稱（小寫連字），不確定就省略。

```
✅ feat(preview): render body markdown in split panel
✅ fix(editor): keep undo boundary intact during IME composition
✅ refactor(vault): move front matter parsing into article model
✅ test(article): cover empty title rejection
❌ 新增預覽面板                      ← 不是英文
❌ feat: added preview panel.        ← 過去式＋句號
❌ update files                      ← 沒有 type、看不出做了什麼
❌ feat(preview): TC-05              ← 出現文件代號
```

## 4. 不出現 SDD 代號

分支名、commit message、程式碼、註解、測試名稱**一律不得出現 SDD 文件內的代號**——test case 編號、User Story 編號、驗收標準編號、切片資料夾名。

- **為什麼**：代號只在 `.sdd/` 文件內有意義，離開文件就是雜訊。讀 `git log` 或讀測試名稱的人不該為了看懂一行字去翻文件。
- **怎麼做**：把代號換成它所描述的**行為**。

```
✅ test: reject article without title
❌ test: TC-04

✅ feat(images): save pasted image into workspace images folder
❌ feat: implement US-2 / AC-3
```

文件與程式碼的對應關係，靠 `/contract` 的追溯矩陣維護，不靠把代號抄進程式碼。

## 5. 作者身分

所有 commit 的作者一律是 `CodeMachine <CodeMachine0121@gmail.com>`（repo 的 `git config user.name/user.email` 已設定）。
