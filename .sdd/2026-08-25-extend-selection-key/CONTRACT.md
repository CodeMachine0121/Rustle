# Contract Traceability Matrix — 逐層擴大選取的快速鍵

Contract: PRD.md
Design map: ARCH.md
Implementation: `src/features/editor/ExtendSelection.ts`, `src/features/editor/MarkdownEditor.tsx`, `src-tauri/src/application_menu.rs`, `src-tauri/src/lib.rs` (`run`)
Oracle: Acceptance Criteria (29 scenarios) + Core Business Rules (7) + Non-Functional Requirements (5)

Static conformance audit: it judges each test's assertion and each code path against the spec's expected outcome. It does not run scenarios it invents. Mapped tests were run once each, only as corroboration.

Behaviour that lives in CodeMirror (`EditorState.wordAt`, `selectParentSyntax`) and in Tauri (`Menu::default`) was read from `node_modules/@codemirror/state/dist/index.js` (`wordAt`, the `\p{Alphabetic}` word categorizer), `node_modules/@codemirror/commands/dist/index.js` (`selectParentSyntax`, which never selects the Document node) and `tauri-2.12.5/src/menu/menu.rs` (`Menu::default`), and those excerpts were given to Jev with the clauses that depend on them.

## Clauses

`Test audit` / `Code audit` are Claude's shadow verdict. `Jev test` / `Jev code` are Jev's pick with its confidence. `Status` and `Route` come from `jev_audit.py` for AC rows; BR / NFR rows are Claude's verdict only.

Test files: **ES** = `src/features/editor/ExtendSelection.test.ts`, **ME** = `src/features/editor/MarkdownEditor.test.tsx`, **APP** = `src/app/App.test.tsx`, **MENU** = `src-tauri/tests/application_menu.rs`. Code: **ESC** = `src/features/editor/ExtendSelection.ts`, **AM** = `src-tauri/src/application_menu.rs`.

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Jev test | Jev code | Status | Route |
|----|--------|------------------------|------|------|------------|------------|----------|----------|--------|-------|
| AC-1 | 游標在英文字中間，第一下選起整個字 | 選取正好是 `important` | ESC:30-39 | ES:89-101 "a Latin word" | asserts-oracle | produces-oracle | asserts-oracle 0.91 | produces-oracle 0.84 | ✅ conforms | recheck |
| AC-2 | 游標在中文裡，第一下選起連續的那一整串中文 | 選取正好是「這是重點的地方」 | ESC:30-39 + `wordAt` | ES:89-101 "the whole run of Chinese" | asserts-oracle | produces-oracle | asserts-oracle 0.91 | produces-oracle 0.39 | ✅ conforms | escalate (low confidence) |
| AC-3 | 中文那一串到標點就停 | 選取正好是「這是重點」，逗號之後沒被選 | ESC:30-39 + `wordAt` | ES:89-101 "Chinese up to the punctuation" | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.69 | ✅ conforms | recheck |
| AC-4 | 空行上什麼都不做 | 仍無選取、游標原處、正文未變 | ESC:41-48 | ES:103-114 "an empty line" | asserts-oracle | produces-oracle | asserts-oracle 0.67 | produces-oracle 0.71 | ✅ conforms | recheck |
| AC-5 | 只有空白的一行，同樣什麼都不做 | 仍無選取、游標原處 | ESC:41-48 | ES:103-114 "a line of only spaces" | asserts-oracle | produces-oracle | asserts-oracle 0.84 | produces-oracle 0.84 | ✅ conforms | recheck |
| AC-6 | 游標緊鄰標點時，沒有詞可選，直接往外長一層 | 選起 `today.` 整段，句號沒有被單獨選起 | ESC:41-43 | ES:116-122 | asserts-oracle | produces-oracle | asserts-oracle 0.67 | produces-oracle 0.44 | ✅ conforms | escalate (low confidence) |
| AC-7 | 程式碼區塊裡照常選字 | 選取正好是 `const`，程式碼不變 | ESC:30-39 | ES:89-101 "a word inside a code block" | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.51 | ✅ conforms | escalate (low confidence) |
| AC-8 | 從連結文字長成整個連結 | 選起 `[今天的天氣](https://example.com)`，括號都在內 | ESC:41-43 | ES:124-146 (first row); ME:599 | asserts-oracle | produces-oracle | asserts-oracle 0.79 | produces-oracle 0.41 | ✅ conforms | escalate (low confidence) |
| AC-9 | 從整個連結長成整段話 | 選起整行 | ESC:41-43 | ES:124-146 (second row) | asserts-oracle | produces-oracle | asserts-oracle 0.83 | produces-oracle 0.33 | ✅ conforms | escalate (low confidence) |
| AC-10 | 從清單的一項長成整個清單 | 三項連同記號全被選起 | ESC:41-43 | ES:124-146 (list row) | asserts-oracle | produces-oracle | asserts-oracle 0.87 | produces-oracle 0.27 | ✅ conforms | escalate (low confidence) |
| AC-11 | 長成一段強調時，兩邊的記號一起被選進去 | 選起 `**重點**`，前後各兩星號 | ESC:41-43 | ES:124-146 (emphasis row) | asserts-oracle | produces-oracle | asserts-oracle 0.43 | produces-oracle 0.27 | ✅ conforms | escalate (low confidence) |
| AC-12 | 連按三下到得了整段 | 三下之後至少是那一整段 | ESC:24-49 | ES:148-156 | asserts-oracle | produces-oracle | asserts-oracle 0.88 | produces-oracle 0.29 | ✅ conforms | escalate (low confidence) |
| AC-13 | 滑鼠拖出來的選取，直接從那一段往外長 | 選取比「今天的天」大，且沒縮回成一個詞 | ESC:30, 41-43 | ES:158-164 | asserts-oracle | produces-oracle | asserts-oracle 0.92 | produces-oracle 0.83 | ✅ conforms | recheck |
| AC-14 | 全選之後再按，什麼都不做 | 整篇仍被選著，範圍不變 | ESC:44-48 | ES:166-174 | asserts-oracle | produces-oracle | asserts-oracle 0.76 | produces-oracle 0.60 | ✅ conforms | recheck |
| AC-15 | 短文章連按很多次，停在最外層 | 五下後是 `today` 整行，範圍不曾縮小 | ESC:24-49 | ES:176-187 | asserts-oracle | produces-oracle | asserts-oracle 0.52 | produces-oracle 0.65 | ✅ conforms | escalate (low confidence) |
| AC-16 | 用滑鼠點別的地方，層次重新從詞開始 | 選取正好是 `important` | ESC:30-39 (no stored layer) | ES:189-200 | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.25 | ✅ conforms | escalate (low confidence) |
| AC-17 | 組字中不動作 | 組字不受干擾（鍵留給輸入法），選取沒變 | ESC:25-27 | ES:267-277 | asserts-oracle | produces-oracle | asserts-oracle 0.84 | produces-oracle 0.35 | ✅ conforms | escalate (low confidence) |
| AC-18 | 焦點在文章清單時什麼都不做 | 視窗仍開著；清單選取沒變 | keymap is editor-only; AM:21-47 (no Cmd+W row) | APP:870-884; MENU:33-52 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.75 | ✅ conforms | recheck |
| AC-19 | 對話框開著時什麼都不做 | 視窗仍開著；對話框仍開著、欄位字沒變 | same | APP:886-898; MENU:33-52 | asserts-oracle | produces-oracle | asserts-oracle 0.56 | produces-oracle 0.59 | ✅ conforms | escalate (low confidence) |
| AC-20 | 焦點在預覽區時什麼都不做 | 視窗仍開著 | same | APP:900-912; MENU:33-52 | asserts-oracle | produces-oracle | asserts-oracle 0.37 | produces-oracle 0.65 | ✅ conforms | escalate (low confidence) |
| AC-21 | 不能改的文章照樣選得起來 | 選取正好是 `important`，正文未變 | ESC:24-49 (no read-only check) | ES:202-209 | asserts-oracle | produces-oracle | asserts-oracle 0.87 | produces-oracle 0.64 | ✅ conforms | recheck |
| AC-22 | 好幾個游標，寫作者所在的那個旁邊有詞 | `milk` 與 `bread` 各自被選起 | ESC:30-39 | ES:222-231 | asserts-oracle | produces-oracle | asserts-oracle 0.93 | produces-oracle 0.31 | ✅ conforms | escalate (low confidence) |
| AC-23 | 好幾個游標，寫作者所在的那個旁邊沒有詞 | 整段 `milk. and bread` 被選起，`bread` 沒被單獨選成詞 | ESC:41-43 | ES:255-265 | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.65 | ✅ conforms | recheck |
| AC-24 | 新的關視窗快速鍵有效 | 按 Shift+Command+W 後視窗關閉 | AM:51-60 (`Window::close`), AM:12-16 (`install`); `lib.rs` `run` | MENU:33-79 (row, id, accelerator only) | shallow | produces-oracle | shallow 0.56 | produces-oracle 0.81 | 🟠 mis-asserted | escalate (low confidence) |
| AC-25 | 選單上「關閉視窗」那一列標的是新的鍵 | 那一列還在檔案欄，標 Shift+Command+W | AM:21-47 | MENU:33-79 | asserts-oracle | produces-oracle | asserts-oracle 0.83 | produces-oracle 0.57 | ✅ conforms | escalate (low confidence) |
| AC-26 | 結束 App 的路徑沒有變 | 按 Command+Q 後 App 結束 | stock Quit row kept (AM:22) | MENU:33-52 (rows only) | shallow | produces-oracle | no-test 0.44 | produces-oracle 0.92 | 🟡 partial | escalate (disagree) |
| AC-27 | 標準的編輯鍵全部照舊 | 複製與貼上照常 | stock Edit rows kept | MENU:33-52 (rows only) | shallow | produces-oracle | no-test 0.17 | produces-oracle 0.75 | 🟡 partial | escalate (disagree) |
| AC-28 | 還原與重做照舊 | 還原與重做照常 | stock Undo / Redo rows kept; editor history untouched | MENU:33-52 (rows only) | shallow | produces-oracle | no-test 0.48 | produces-oracle 0.76 | 🟡 partial | escalate (disagree) |
| AC-29 | 縮放與開發者工具照舊 | 行為與改動前完全一樣 | stock Window / View rows kept | MENU:33-52 | asserts-oracle | produces-oracle | asserts-oracle 0.35 | produces-oracle 0.56 | ✅ conforms | escalate (low confidence) |
| BR-1 | 「一層」由正文自己的結構決定 | 層次就是 Markdown 語法樹 | ESC:41 (`selectParentSyntax`) | AC-8..AC-11 tests | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-2 | 「那個詞」與粗體、斜體鍵共用同一條規則 | 同一個游標位置兩把鍵得到同一個詞 | ESC:30 and `InlineEmphasis.toggle` both call `state.wordAt` | ME "finds the same word under the cursor for the extend selection key as for bold" | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-3 | 這個鍵只移動選取，永遠不改正文 | 正文不變 | ESC (selection-only dispatch) | ES:211-221, every `shown` equality | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-4 | 只有一條分岔 | 只有「無選取且有詞」特別待遇 | ESC:30 | ES (AC-4..AC-6) | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-5 | 由寫作者所在的那個游標決定 | 主游標決定選詞或往外長 | ESC:29-30 | ES:222-265 | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-6 | 層次沒有記憶 | 點別處後從詞開始 | ESC (no state field) | ES:189-200 | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-7 | Command+W 在這個 App 裡不再屬於視窗 | 任何地方按 Cmd+W 視窗都不關 | AM:12-47, `lib.rs` `run` | MENU:33-79; APP:857-912 | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| NFR-1 | 反應速度／連按不得掉鍵 | 按五下長五層（除非到頂） | ESC (synchronous dispatch) | ES:148-156, 176-187 | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| NFR-2 | 不寫入、不在還原歷史留下任何一步 | 正文不變、還原深度為 0 | ESC | ES:211-221 | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| NFR-3 | 輸入法安全 | 組字中不動作；升級前跑回歸清單 | ESC:25-27; `docs/ime-regression-checklist.md` | ES:267-277 | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| NFR-4 | 只在 macOS 裝上自己的選單 | 其他平台維持出廠選單 | `lib.rs` `run` `#[cfg(target_os = "macos")]` | — (compile-time) | no-test | produces-oracle | not run | not run | 🟡 partial | — |
| NFR-5 | 不新增追蹤事件 | 沒有任何蒐集 | nothing added | — | no-test | produces-oracle | not run | not run | 🟡 partial | — |

### Notes on the rechecks

- **AC-2, AC-13**: Jev first judged the code without CodeMirror's source (AC-2 `diverges 0.25`, AC-13 `diverges 0.21`). Both were re-audited with the `wordAt` / `selectParentSyntax` excerpts and the test helpers that build the selection; the rows above are those reruns. The mapped tests pass (`pnpm vitest run src/features/editor/ExtendSelection.test.ts`).
- **AC-26..AC-28**: re-audited with Tauri's `Menu::default` source. Jev agrees the code keeps the stock rows; the tests pin the rows, not the behaviour of pressing the keys.
- Every `escalate (low confidence)` row has agreeing Claude and Jev picks; the low confidence comes from behaviour that lives inside CodeMirror or the native menu, not in this slice's lines.

## Orphans (code with no clause)

| Code | Description | Verdict |
|------|-------------|---------|
| ESC:44-48 | Past the outermost block, a non-empty selection grows to the whole body (`selectParentSyntax` never selects the Document) | Implements the BRIEF's last layer (詞 → … → 整篇文章, PRD §1 Expected Outcome); recorded as ARCH §8 decision 1. Not out of scope |
| ESC:33 | A non-empty range keeps itself while the writer's cursor takes its word | Fills a hole in the PRD's multi-cursor edge case (it only speaks of cursors); ARCH §3 decision table. Pinned by ES:245-253 |
| AM (Window submenu) | The second stock Close Window row (Window menu) is rebound too | Needed for BR-7; ARCH §8 decision 2 |

No code implements an Out of Scope item (no shrink key, no menu translation, no new rows, no customisable key, no gestures, no selection styling, no preview selection).

## Summary

- Conforms: 35/41 clauses ✅ (85%)
- Violations: none
- Mis-asserted: AC-24 — the close path (`close_window_on_request` → `Window::close`) has no automated test: Tauri's mock runtime closes a window without any trace a test can read, and native menus cannot be pressed from a test. Kept as an explicit manual check in `docs/ime-regression-checklist.md` (Cmd+W / Shift+Cmd+W line)
- Scope note on AC-18..AC-20 and BR-7: the APP tests only prove that no JS path sends a close request on Cmd+W. Cmd+W used to close the window through a native menu accelerator, which jsdom cannot observe. The real guard against "Cmd+W closes the window" is MENU (no Cmd+W row, both Close Window rows rebound to Shift+Cmd+W) plus the manual Cmd+W / Shift+Cmd+W line in `docs/ime-regression-checklist.md`
- Partial (each an explicit, justified manual or compile-time item): AC-26, AC-27, AC-28 (the stock rows are pinned row by row against `Menu::default`; pressing Cmd+Q / copy / paste / undo / redo through the native menu is manual, same checklist line); NFR-4 (compile-time `cfg`); NFR-5 (nothing to test)
- Gaps: none
- Unclear: none
- Orphans: 3, all recorded design decisions
- Jev: ran on 29 AC clauses (AC-2, AC-13, AC-26, AC-27, AC-28 re-run with library source excerpts)
- Needs James: AC-24 (manual close check), AC-26..AC-28 (Jev and Claude disagree only on whether a row-by-row menu pin counts as a test; both say the code keeps the stock rows), and the `escalate (low confidence)` rows listed above
