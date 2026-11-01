# Contract Traceability Matrix — create-article-dialog

Contract: `PRD.md` (§4 Gherkin acceptance criteria, TC-01 … TC-64)
Design map: `ARCH.md` §7
Implementation: `crates/` (domain, application, infrastructure), `src-tauri/`, `src/`
Oracle: Acceptance Criteria (64 clauses). `AC-nn` = PRD scenario `TC-nn`.

**Ceiling:** static conformance audit. Each oracle was written from the PRD alone; the test and the code path were then judged against it independently. No invented scenarios were executed. Jev (`jev-latest`) audited every clause after the shadow verdict was recorded.

## Oracle decisions where the PRD contradicts itself

| Clause | Conflict | Oracle used | Why |
| :--- | :--- | :--- | :--- |
| AC-46 | TC-46 shows `created_at: "2026-08-20T14:32:05.000Z"`; TC-63 and BRIEF §8 R-2 (a later review ruling) require the writer's local offset and "not ending in Z" | Front matter is exactly title, created_at, updated_at, category list, tags list, no body; both times are the creation instant, **in the R-2 form** (`2026-08-20T14:32:05+08:00`, seconds) | R-2 is the later decision and TC-63 is its scenario. Following TC-46 literally would break TC-63 |
| AC-12 | TC-12 says typing 「技」 offers both 「技術筆記」 and 「桌面開發」. That contradicts TC-14 / BRIEF §5.4 / PRD §3.2 (case-insensitive substring) | The candidates come from the workspace's categories, each once. 「技」 offers 「技術筆記」 only; the vocabulary holds both | Three other passages define substring matching; TC-12's point is "deduplicated, from this workspace" |
| AC-60 | "被要求以帶有 / 或 .. 的檔名建立" | Such a name can never reach the create step: `ArticleFileName::parse` rejects it as outside the vault, and `ArticleRepository::create` only takes a parsed name | The channel takes no file name at all; the name is derived from the title |

## Clauses

`Test audit` / `Code audit` = Claude's shadow verdict (recorded before Jev). `Jev test` / `Jev code` = Jev's pick and confidence. `Status` and `Route` are as returned by `jev_audit.py`. "re-run": the first Jev pass got line ranges that were too narrow or cut short (and, for AC-01/34/36/52, a test that was then strengthened); the clause was re-audited with full ranges. The table shows the final run.

| ID | PRD | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Jev test | Jev code | Status | Route |
|----|-----|------------------------|------|------|------------|------------|----------|----------|--------|-------|
| AC-01 | TC-01 | 對話框有一個 Title 單行文字欄位、一個 Category 多值欄位、一個 Tags 多值欄位 | `CreateArticleDialog.tsx:77-115` | `CreateArticleDialog.test.tsx:51-58` | asserts-oracle | produces-oracle | asserts-oracle 0.79 | produces-oracle 0.99 | ✅ conforms | recheck (mid confidence) · re-run |
| AC-02 | TC-02 | 開啟對話框時畫面出現「建立於 2026-08-20 14:32」，且沒有任何可填的時間欄位 | `CreateArticleDialog.tsx:117-122`<br>`CreateArticleDialog.tsx:146-150`<br>`App.tsx:45-70` | `CreateArticleDialog.test.tsx:60-65` | asserts-oracle | produces-oracle | asserts-oracle 0.49 | produces-oracle 0.48 | ✅ conforms | escalate (low confidence) |
| AC-03 | TC-03 | 開啟對話框時焦點在 Title 欄位 | `CreateArticleDialog.tsx:38-40` | `CreateArticleDialog.test.tsx:67-71` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.95 | ✅ conforms | accept |
| AC-04 | TC-04 | 在 Category 打「技術筆記」按 Enter → 出現該 chip 且輸入框清空 | `ChipInput.tsx:36-54`<br>`chipValues.ts:1-8` | `ChipInput.test.tsx:51-60` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.67 | ✅ conforms | recheck (mid confidence) |
| AC-05 | TC-05 | 在 Tags 打「electron」按「,」→ 出現 chip 且輸入框清空 | `ChipInput.tsx:6-6`<br>`ChipInput.tsx:36-54` | `ChipInput.test.tsx:62-70` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.79 | ✅ conforms | recheck (mid confidence) |
| AC-06 | TC-06 | Tags 有 tauri、electron，輸入框空，按 Backspace → 只剩 tauri | `ChipInput.tsx:40-54` | `ChipInput.test.tsx:72-78` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.96 | ✅ conforms | accept |
| AC-07 | TC-07 | Tags 有 tauri，輸入框有 elec，按 Backspace → tauri 還在 | `ChipInput.tsx:40-54` | `ChipInput.test.tsx:80-87` | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.76 | ✅ conforms | recheck (mid confidence) · re-run |
| AC-08 | TC-08 | 點「技術筆記」的移除鈕 → 只剩「桌面開發」 | `ChipInput.tsx:58-70` | `ChipInput.test.tsx:89-95` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.96 | ✅ conforms | accept |
| AC-09 | TC-09 | 打「  技術筆記  」按 Enter → chip 是「技術筆記」；只打空白按 Enter → chip 數量不變 | `chipValues.ts:1-8`<br>`ChipInput.tsx:40-54` | `ChipInput.test.tsx:97-106`<br>`chipValues.test.ts:6-17` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.72 | ✅ conforms | recheck (mid confidence) |
| AC-10 | TC-10 | 已有 electron 再打 electron 按 Enter → 還是只有一個，輸入框清空 | `chipValues.ts:1-8`<br>`ChipInput.tsx:36-48` | `ChipInput.test.tsx:108-116` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.63 | ✅ conforms | recheck (mid confidence) |
| AC-11 | TC-11 | Category 建立「技術筆記」、Tags 建立「electron」→ 各自只有自己的值 | `CreateArticleDialog.tsx:100-115` | `CreateArticleDialog.test.tsx:192-204` | asserts-oracle | produces-oracle | asserts-oracle 0.87 | produces-oracle 0.68 | ✅ conforms | recheck (mid confidence) · re-run |
| AC-12 | TC-12 | workspace 用過分類 技術筆記(兩次)、桌面開發；在 Category 打「技」→ 候選來自這些分類、每個只出現一次（依 BRIEF §5.4 子字串規則：技 → 技術筆記） | `articleVocabulary.ts:1-11`<br>`chipValues.ts:10-21` | `articleVocabulary.test.ts:11-19`<br>`chipValues.test.ts:22-33` | asserts-oracle | produces-oracle | asserts-oracle 0.84 | produces-oracle 0.65 | ✅ conforms | recheck (mid confidence) |
| AC-13 | TC-13 | workspace 用了標籤 electron 與 tauri；在 Tags 打 e → 候選是 electron | `articleVocabulary.ts:1-11`<br>`chipValues.ts:10-21`<br>`CreateArticleDialog.tsx:108-115` | `CreateArticleDialog.test.tsx:206-218`<br>`articleVocabulary.test.ts:11-19` | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.73 | ✅ conforms | recheck (mid confidence) |
| AC-14 | TC-14 | 用了標籤 Electron；打 elec → 候選是 Electron（不分大小寫） | `chipValues.ts:10-21` | `ChipInput.test.tsx:118-127`<br>`chipValues.test.ts:22-33` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.87 | ✅ conforms | accept |
| AC-15 | TC-15 | 已把技術筆記變成 chip，在 Category 打「技」→ 沒有候選 | `chipValues.ts:10-21`<br>`ChipInput.tsx:82-93` | `ChipInput.test.tsx:143-149` | asserts-oracle | produces-oracle | asserts-oracle 0.89 | produces-oracle 0.56 | ✅ conforms | escalate (low confidence) |
| AC-16 | TC-16 | 打「技」後點候選「技術筆記」→ 出現該 chip 且輸入框清空 | `ChipInput.tsx:82-93`<br>`ChipInput.tsx:36-39` | `ChipInput.test.tsx:151-159` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.92 | ✅ conforms | accept |
| AC-17 | TC-17 | 還沒打字 → 畫面上沒有候選 | `chipValues.ts:10-21` | `ChipInput.test.tsx:129-133` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 1.00 | ✅ conforms | accept |
| AC-18 | TC-18 | workspace 沒有任何分類與標籤，打「技」→ 沒有候選 | `chipValues.ts:10-21` | `ChipInput.test.tsx:135-141`<br>`chipValues.test.ts:35-37` | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.91 | ✅ conforms | accept |
| AC-19 | TC-19 | 開啟對話框 → 建立停用且畫面說標題是必填的 | `CreateArticleDialog.tsx:123-127`<br>`CreateArticleDialog.tsx:136-139` | `CreateArticleDialog.test.tsx:73-78` | asserts-oracle | produces-oracle | asserts-oracle 0.75 | produces-oracle 0.84 | ✅ conforms | recheck (mid confidence) |
| AC-20 | TC-20 | Title 打「   」→ 建立仍停用 | `CreateArticleDialog.tsx:36-36`<br>`CreateArticleDialog.tsx:136-139` | `CreateArticleDialog.test.tsx:80-86` | asserts-oracle | produces-oracle | asserts-oracle 0.91 | produces-oracle 0.87 | ✅ conforms | accept |
| AC-21 | TC-21 | Title 打 Zen of Writing → 建立可按、不再說必填 | `CreateArticleDialog.tsx:123-127`<br>`CreateArticleDialog.tsx:136-139` | `CreateArticleDialog.test.tsx:88-95` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.85 | ✅ conforms | accept · re-run |
| AC-22 | TC-22 | 填了標題按 Esc → 對話框關閉，且沒有任何建立請求送出 | `CreateArticleDialog.tsx:63-68` | `CreateArticleDialog.test.tsx:97-105`<br>`App.test.tsx:305-315` | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.61 | ✅ conforms | recheck (mid confidence) |
| AC-23 | TC-23 | 填了標題按取消 → 對話框關閉，且沒有任何建立請求送出 | `CreateArticleDialog.tsx:131-134` | `CreateArticleDialog.test.tsx:107-115` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.97 | ✅ conforms | accept · re-run |
| AC-24 | TC-24 | Title 組字中按 Esc → 對話框沒有關閉 | `CreateArticleDialog.tsx:63-68` | `CreateArticleDialog.test.tsx:117-124` | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.89 | ✅ conforms | accept |
| AC-25 | TC-25 | Blog 有 zen-of-writing.md；檔案層收到標題只有空白的建立請求 → 請求失敗，資料夾裡還是只有 zen-of-writing.md | `article_draft.rs:28-42`<br>`create_article.rs:46-65` | `create_article.rs:237-253`<br>`vault_channels.rs:279-299` | asserts-oracle | produces-oracle | asserts-oracle 0.67 | produces-oracle 0.97 | ✅ conforms | recheck (mid confidence) |
| AC-26 | TC-26 | Title 組字中（ㄊㄞˊ）按 Enter → 沒有建立請求 | `CreateArticleDialog.tsx:70-75` | `CreateArticleDialog.test.tsx:126-134` | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.84 | ✅ conforms | recheck (mid confidence) |
| AC-27 | TC-27 | 選字後欄位是「台灣」按 Enter → 送出一個標題台灣的建立請求，只送一次 | `CreateArticleDialog.tsx:42-61`<br>`CreateArticleDialog.tsx:70-75` | `CreateArticleDialog.test.tsx:136-149` | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.80 | ✅ conforms | recheck (mid confidence) |
| AC-28 | TC-28 | Tags 組字中按 Enter → 沒有 chip | `ChipInput.tsx:40-44` | `ChipInput.test.tsx:161-170` | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.83 | ✅ conforms | recheck (mid confidence) · re-run |
| AC-29 | TC-29 | Tags 選字後是台灣按 Enter → 出現 chip 台灣，且沒有建立請求 | `ChipInput.tsx:40-54` | `ChipInput.test.tsx:172-182`<br>`CreateArticleDialog.test.tsx:160-171` | asserts-oracle | produces-oracle | asserts-oracle 0.87 | produces-oracle 0.68 | ✅ conforms | recheck (mid confidence) · re-run |
| AC-30 | TC-30 | 按鍵事件帶「正在組字」的 Enter：Title 不送出、Tags 不出 chip | `CreateArticleDialog.tsx:70-75`<br>`ChipInput.tsx:40-44` | `CreateArticleDialog.test.tsx:151-158`<br>`ChipInput.test.tsx:184-192` | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.75 | ✅ conforms | recheck (mid confidence) |
| AC-31 | TC-31 | 任一欄位開始組字 → 共用狀態是正在組字；結束 → 沒有在組字 | `CreateArticleDialog.tsx:96-99`<br>`ChipInput.tsx:76-80` | `CreateArticleDialog.test.tsx:173-184`<br>`ChipInput.test.tsx:203-211` | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.96 | ✅ conforms | accept |
| AC-32 | TC-32 | Title 組字中焦點離開且沒有組字結束事件 → 共用狀態是沒有在組字 | `CreateArticleDialog.tsx:96-99`<br>`ChipInput.tsx:76-80` | `CreateArticleDialog.test.tsx:173-184`<br>`ChipInput.test.tsx:213-219` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.95 | ✅ conforms | accept |
| AC-33 | TC-33 | 開啟對話框 → 對話框裡沒有任何表單元素 | `CreateArticleDialog.tsx:77-142` | `CreateArticleDialog.test.tsx:186-190` | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.71 | ✅ conforms | recheck (mid confidence) · re-run |
| AC-34 | TC-34 | 選了 workspace Blog → 欄 2 有「＋ 新文章」按鈕 | `ArticleColumn.tsx:12-23` | `ArticleColumn.test.tsx:92-98` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 1.00 | ✅ conforms | accept · re-run |
| AC-35 | TC-35 | 沒選 workspace → 沒有「＋ 新文章」 | `ArticleColumn.tsx:12-16` | `ArticleColumn.test.tsx:100-104` | asserts-oracle | produces-oracle | asserts-oracle 0.47 | produces-oracle 0.92 | ✅ conforms | escalate (low confidence) |
| AC-36 | TC-36 | Work 有 0 篇 → 空狀態有「建立第一篇文章」按鈕，按下開啟對話框 | `ArticleColumn.tsx:25-40`<br>`App.tsx:52-58` | `ArticleColumn.test.tsx:84-90` | asserts-oracle | produces-oracle | asserts-oracle 0.75 | produces-oracle 0.79 | ✅ conforms | recheck (mid confidence) · re-run |
| AC-37 | TC-37 | 選了 Blog → 沒有對話框；按「＋ 新文章」→ 對話框出現 | `App.tsx:52-70` | `App.test.tsx:279-290` | asserts-oracle | produces-oracle | asserts-oracle 0.72 | produces-oracle 0.89 | ✅ conforms | recheck (mid confidence) |
| AC-38 | TC-38 | 填了標題，按建立且檔案層說建立好了 → 對話框關閉 | `CreateArticleDialog.tsx:42-61` | `CreateArticleDialog.test.tsx:252-259`<br>`App.test.tsx:279-303` | asserts-oracle | produces-oracle | asserts-oracle 0.89 | produces-oracle 0.88 | ✅ conforms | accept |
| AC-39 | TC-39 | 按建立而檔案層答不出來（磁碟已滿）→ 對話框還在，畫面出現磁碟已滿 | `CreateArticleDialog.tsx:42-61`<br>`CreateArticleDialog.tsx:128-132`<br>`VaultSession.ts:162-172` | `CreateArticleDialog.test.tsx:261-273`<br>`VaultSession.test.ts:533-543` | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.85 | ✅ conforms | accept |
| AC-40 | TC-40 | 在 Blog 填標題「  Zen of Writing  」、分類技術筆記、標籤electron按建立 → 請求是 Blog、Zen of Writing、[技術筆記]、[electron] | `CreateArticleDialog.tsx:42-55`<br>`VaultSession.ts:162-170` | `CreateArticleDialog.test.tsx:220-235`<br>`VaultSession.test.ts:456-465` | asserts-oracle | produces-oracle | asserts-oracle 0.75 | produces-oracle 0.49 | ✅ conforms | escalate (low confidence) · re-run |
| AC-41 | TC-41 | Tags 打 electron 沒按 Enter 就按建立 → 請求的標籤是 [electron] | `CreateArticleDialog.tsx:50-54` | `CreateArticleDialog.test.tsx:237-250` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.67 | ✅ conforms | recheck (mid confidence) · re-run |
| AC-42 | TC-42 | 沒有 workspace 被選取時要求建立 → 沒有建立請求 | `VaultSession.ts:162-166` | `VaultSession.test.ts:467-475` | asserts-oracle | produces-oracle | asserts-oracle 0.75 | produces-oracle 0.71 | ✅ conforms | recheck (mid confidence) |
| AC-43 | TC-43 | Blog 是空的，用標題「Tauri 與 Electron 的取捨」建立 → 出現檔案 tauri-與-electron-的取捨.md | `article_draft.rs:56-61`<br>`create_article.rs:46-65` | `create_article.rs:101-125`<br>`article_draft.rs:186-205` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.33 | ✅ conforms | escalate (low confidence) |
| AC-44 | TC-44 | 已有 zen-of-writing.md，用 Zen of Writing 建立 → 出現 zen-of-writing-2.md，原檔不變 | `article_draft.rs:56-61`<br>`create_article.rs:46-65` | `create_article.rs:214-225` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.52 | ✅ conforms | escalate (low confidence) |
| AC-45 | TC-45 | 有一個叫 notes.md 的資料夾，用 Notes 建立 → 新檔叫 notes-2.md | `article_draft.rs:56-61` | `create_article.rs:227-235`<br>`article_draft.rs:186-205` | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.41 | ✅ conforms | escalate (low confidence) |
| AC-46 | TC-46 | 用標題、兩個分類、兩個標籤建立 → 檔案剛好是一個 front matter（title、created_at、updated_at、category list、tags list），沒有正文；created_at 與 updated_at 都是建立那一刻（時間形式依 TC-63/BRIEF R-2：帶當地位移） | `article_draft.rs:63-74`<br>`create_article.rs:46-65`<br>`local_timestamp.rs:25-45` | `create_article.rs:101-125`<br>`article_draft.rs:136-157` | asserts-oracle | produces-oracle | asserts-oracle 0.41 | produces-oracle 0.61 | ✅ conforms | escalate (low confidence) |
| AC-47 | TC-47 | 沒有分類也沒有標籤建立 → 檔頭只有 title、created_at、updated_at | `article_draft.rs:63-74` | `create_article.rs:156-168`<br>`article_draft.rs:159-170` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.68 | ✅ conforms | recheck (mid confidence) · re-run |
| AC-48 | TC-48 | 分類 ["  技術筆記  ", "", "技術筆記", "桌面開發"] → 檔頭 category 是 [技術筆記, 桌面開發] | `article_draft.rs:76-84` | `create_article.rs:171-185`<br>`article_draft.rs:126-134` | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.72 | ✅ conforms | recheck (mid confidence) |
| AC-49 | TC-49 | 在 Blog 用 Zen of Writing 建立 → 回覆那一列指向 Blog 的 zen-of-writing.md，標題 Zen of Writing，建立與更新時間都是建立那一刻，沒有標記 metadata 不完整 | `create_article.rs:46-65` | `create_article.rs:187-212`<br>`vault_channels.rs:244-278` | asserts-oracle | produces-oracle | asserts-oracle 0.91 | produces-oracle 0.48 | ✅ conforms | escalate (low confidence) · re-run |
| AC-50 | TC-50 | 已有 zen-of-writing.md 內容「別人的文章」，被要求以該檔名建立 → 失敗，內容不變 | `file_system_article_repository.rs:28-40`<br>`file_system_article_repository.rs:93-110` | `file_system_article_repository.rs:397-418` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.96 | ✅ conforms | accept |
| AC-51 | TC-51 | 建立完成 → 欄 2 出現 Zen of Writing 那一列且被選取 | `VaultSession.ts:162-190` | `VaultSession.test.ts:477-488`<br>`App.test.tsx:279-303` | asserts-oracle | produces-oracle | asserts-oracle 0.72 | produces-oracle 0.35 | ✅ conforms | escalate (low confidence) |
| AC-52 | TC-52 | 欄 1 顯示 Blog 有 1 篇；建立一篇 → 顯示 2 篇 | `VaultSession.ts:162-175` | `VaultSession.test.ts:477-488`<br>`App.test.tsx:279-303` | asserts-oracle | produces-oracle | asserts-oracle 0.79 | produces-oracle 0.84 | ✅ conforms | recheck (mid confidence) · re-run |
| AC-53 | TC-53 | 建立完成 → 編輯區是那篇空正文，設定檔記住 Blog 的 zen-of-writing.md | `VaultSession.ts:178-190` | `VaultSession.test.ts:490-505`<br>`App.test.tsx:279-303` | asserts-oracle | produces-oracle | asserts-oracle 0.44 | produces-oracle 0.43 | ✅ conforms | escalate (low confidence) |
| AC-54 | TC-54 | 焦點在對話框上，建立完成 → 焦點在編輯區可編輯區域，游標在第一行第一個字 | `MarkdownEditor.tsx:80-100`<br>`VaultSession.ts:178-182` | `App.test.tsx:279-303`<br>`MarkdownEditor.test.tsx:277-285` | asserts-oracle | produces-oracle | asserts-oracle 0.91 | produces-oracle 0.33 | ✅ conforms | escalate (low confidence) |
| AC-55 | TC-55 | 編輯區是另一篇、焦點在別處；剛建立的那一篇換進編輯區 → 焦點回到編輯區，游標在開頭 | `MarkdownEditor.tsx:80-100` | `MarkdownEditor.test.tsx:277-285` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.57 | ✅ conforms | escalate (low confidence) |
| AC-56 | TC-56 | 編輯區是一篇空文章、焦點在別處；另一篇剛建立的空文章換進來 → 焦點回到編輯區 | `MarkdownEditor.tsx:80-100` | `MarkdownEditor.test.tsx:287-294` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.97 | ✅ conforms | accept · re-run |
| AC-57 | TC-57 | Escape 是指向 vault 外的連結，在其中建立 → 被拒絕（逃出 vault），vault 外沒有多出檔案 | `resolved_vault_scope.rs:58-90`<br>`file_system_article_repository.rs:93-110` | `create_article.rs:255-274`<br>`file_system_article_repository.rs:454-470`<br>`vault_channels.rs:301-317` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.47 | ✅ conforms | escalate (low confidence) |
| AC-58 | TC-58 | Mirror 指向 vault 內的 Blog，在 Mirror 建立 → Blog 裡出現 zen-of-writing.md | `resolved_vault_scope.rs:58-90`<br>`file_system_article_repository.rs:93-110` | `create_article.rs:276-288`<br>`file_system_article_repository.rs:472-483` | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.55 | ✅ conforms | escalate (low confidence) · re-run |
| AC-59 | TC-59 | vault 路徑本身經過符號連結，在 workspace 建立 → 成功 | `resolved_vault_scope.rs:58-90` | `create_article.rs:290-302`<br>`file_system_article_repository.rs:485-496` | asserts-oracle | produces-oracle | asserts-oracle 0.68 | produces-oracle 0.67 | ✅ conforms | recheck (mid confidence) |
| AC-60 | TC-60 | 以帶有 / 或 .. 的檔名建立 → 被拒絕，理由是逃出 vault | `vault_name.rs:14-35` | `vault_name.rs:136-150` | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.68 | ✅ conforms | recheck (mid confidence) |
| AC-61 | TC-61 | 焦點在欄 2 某一列，啟動那一列 → 正文出現在編輯區，焦點還在那一列 | `MarkdownEditor.tsx:80-100`<br>`VaultSession.ts:162-190` | `MarkdownEditor.test.tsx:296-303`<br>`VaultSession.test.ts:213-230` | asserts-oracle | produces-oracle | asserts-oracle 0.37 | produces-oracle 0.40 | ✅ conforms | escalate (low confidence) · re-run |
| AC-62 | TC-62 | 第一篇改了一個字，換進正文相同的第二篇，按 undo → 內容不會變成第一篇的舊文字 | `MarkdownEditor.tsx:80-100` | `MarkdownEditor.test.tsx:315-328` | asserts-oracle | produces-oracle | asserts-oracle 0.80 | produces-oracle 0.77 | ✅ conforms | recheck (mid confidence) |
| AC-63 | TC-63 | 當地 2026-08-20 00:30 建立 → created_at 是 2026-08-20T00:30:00+08:00 形式，不以 Z 結尾；欄 2 顯示日期 2026-08-20 | `local_timestamp.rs:25-45`<br>`create_article.rs:55-60` | `create_article.rs:134-154`<br>`local_timestamp.rs:56-70`<br>`ArticleColumn.test.tsx:45-55` | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.35 | ✅ conforms | escalate (low confidence) |
| AC-64 | TC-64 | 檔名算好後名字被佔用 → 建立被拒絕、既有檔案不變、說出來的話指名哪一篇擋著、沒有 vault 絕對路徑 | `file_system_article_repository.rs:93-110` | `file_system_article_repository.rs:397-418` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.85 | ✅ conforms | accept |

## Fixed during this verification

| Clause | Finding | Fix |
| :--- | :--- | :--- |
| AC-49 | The reply row carried no update time, so it could not say "created and updated at the creation moment" (code diverged) | `ArticleSummary.updatedAt` added (Rust + webview type); tests assert `updatedAt == createdAt == clock instant` |
| AC-01 | The test did not show that Category/Tags hold several values | Test adds two chips to each |
| AC-36 | Only the column's callback was tested, not that the app opens the dialog | App test: empty workspace → 「建立第一篇文章」 → dialog |
| AC-52 | The count was asserted only after creation | App test asserts 2 篇 before and 3 篇 after |
| AC-34 | The button's presence was only implied by clicking it | Explicit visibility assertion |

## Orphans (code with no clause)

| Code | Description | Verdict |
| :--- | :--- | :--- |
| `file_system_article_repository.rs` `create` | Removes a half-written new file when writing or flushing fails | Undocumented; supports BRIEF §5.5 ("can try again"): a retry is not pushed to `-2` by a leftover. Not testable without fault injection (the only uncovered changed Rust lines) |
| `VaultSession.createArticle` | Drops the post-creation open when another selection happened meanwhile | Undocumented; same "latest click wins" rule as every other selection |
| `CreateArticleDialog` | Disables 「建立」 while a request is in flight | Supports AC-27's "只送出一次" |
| `ArticleSummary.updatedAt` in `listArticles` | Every listed row now also carries `updatedAt` | Added for AC-49; additive, nothing renders it yet |

None matches an Out-of-Scope item (PRD §5).

## Summary

- Conforms: 64/64 clauses ✅ (100%)
- Violations: none
- Mis-asserted: none
- Partial: none
- Gaps: none
- Unclear: none
- Orphans: 4 (all undocumented supporting behavior, none out of scope)
- Jev: ran on 64 clauses (18 re-run with corrected ranges)
- Needs James (route `escalate`, all for Jev's low confidence on long UI/IO code paths; shadow and Jev agree on every one): AC-02 (low confidence), AC-15 (low confidence), AC-35 (low confidence), AC-40 (low confidence), AC-43 (low confidence), AC-44 (low confidence), AC-45 (low confidence), AC-46 (low confidence), AC-49 (low confidence), AC-51 (low confidence), AC-53 (low confidence), AC-54 (low confidence), AC-55 (low confidence), AC-57 (low confidence), AC-58 (low confidence), AC-61 (low confidence), AC-63 (low confidence)
- Manual only: the real input-method candidate window (T-9) stays on `docs/ime-regression-checklist.md`, now runnable against the dialog
