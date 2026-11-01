# Contract Traceability Matrix — Vim 與系統剪貼簿相通

Contract: PRD.md
Design map: ARCH.md
Implementation: `src/features/vim/SystemClipboardRegister.ts`, `src/features/vim/VimEditing.ts`, `src/app/App.tsx` (+ `EditorColumn`, `AutosavedEditor`, `MarkdownEditor` props), `src/ipc/channels.ts`, `crates/domain/src/clipboard.rs`, `crates/application/src/{read,write}_clipboard_text.rs`, `crates/infrastructure/src/system_clipboard.rs`, `src-tauri/src/commands/{read,write}_clipboard_text.rs`
Oracle: Acceptance Criteria (26 scenarios) + Core Business Rules (10) + NFR (5)

Abbreviations for paths: **R** = `src/features/vim/SystemClipboardRegister.ts`, **T** = `src/features/vim/SystemClipboardRegister.test.tsx`, **V** = `src/features/vim/VimEditing.ts`, **A** = `src/app/App.test.tsx`, **E** = the Vim engine `@replit/codemirror-vim-core/vim.js` (third party; `RegisterController.pushText` 1472–1521, `actions.paste`/`continuePaste` 3249–3400).

`Test audit` / `Code audit` are Claude's shadow verdict, recorded before Jev ran. `Jev test` / `Jev code` / `Status` / `Route` are copied as `jev_audit.py` returned them. Where the engine does the work (deciding linewise/blockwise insertion, skipping `"_`, reading named registers), Jev only saw excerpts and answered with low confidence; every such clause was re-checked by running its mapped test (all green) and, during implementation, by mutating the production line it depends on and watching that test go red (see Notes).

## Clauses

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Jev test | Jev code | Status | Route |
|----|--------|------------------------|------|------|------------|------------|----------|----------|--------|-------|
| AC-1 | 複製一段文字，其他 App 貼得到 | 反白「台積電」按 `y` → 系統剪貼簿是「台積電」 | R:51–56, R:124–129 | T:101 | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.96 | ✅ conforms | accept |
| AC-2 | 複製一整行，換行一起帶走 | `yy` → 剪貼簿是「今日盤後觀察」+ 換行 | R:51–56, E:1472 | T:111 | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.45 | ✅ conforms | escalate (low confidence) |
| AC-3 | 刪掉一整行也算剪下 | `dd` → 剪貼簿是該行 + 換行，該行消失 | R:51–56, E:1472 | T:120 | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.48 | ✅ conforms | escalate (low confidence) |
| AC-4 | 刪掉單一個字元也算剪下 | 游標在「電」按 `x` → 剪貼簿是「電」 | R:51–56 | T:130 | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.44 | ✅ conforms | escalate (low confidence) |
| AC-5 | 改寫一段文字，被換掉的原文帶得走 | 反白「聯電」按 `c` 輸入「台積電」→ 剪貼簿「聯電」，文章變「台積電」 | R:51–56 | T:140 | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.37 | ✅ conforms | escalate (low confidence) |
| AC-6 | 存進具名暫存格的文字也送出去 | `"ay` → 剪貼簿「聯電」，暫存格 a 也是「聯電」 | E:1504–1520 → R:51–56 | T:152 | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.28 | ✅ conforms | escalate (low confidence) |
| AC-7 | 垃圾桶暫存格什麼都不留，連現有的都不動 | `"_dd` → 剪貼簿仍是原網址，該行消失 | E:1474 (returns before any register) | T:163 | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.33 | ✅ conforms | escalate (low confidence) |
| AC-8 | Vim 內部歸零暫存格時，系統剪貼簿原封不動 | 歸零後剪貼簿仍是「昨天複製的東西」 | R:51–56, R:71–75 | T:174 | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.89 | ✅ conforms | accept |
| AC-9 | Vim 模式關著時，本規則完全不適用 | Vim 關著，選取後退格 → 剪貼簿不變 | V:107–111 (register only in the Vim band) | T:371 | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.25 | ✅ conforms | escalate (low confidence) |
| AC-10 | 其他 App 複製的文字，Vim 的貼上鍵貼得進來 | 剪貼簿「營收成長」，按 `p` → 文章出現「營收成長」 | R:82–100 | T:212, A ("pastes what the system clipboard holds…") | asserts-oracle | produces-oracle | asserts-oracle 0.75 | produces-oracle 0.40 | ✅ conforms | escalate (low confidence) |
| AC-11 | 最後一次複製的贏 | 先 `y`「台積電」再外部複製「營收成長」→ `p` 出現「營收成長」 | R:82–122 | T:220 | asserts-oracle | produces-oracle | asserts-oracle 0.88 | produces-oracle 0.32 | ✅ conforms | escalate (low confidence) |
| AC-12 | 具名暫存格不讀系統剪貼簿 | a=「聯電」、剪貼簿「營收成長」→ `"ap` 出現「聯電」 | E:3249–3260, E:1527 | T:248 | asserts-oracle | produces-oracle | asserts-oracle 0.87 | unclear 0.11 | ❔ unclear | escalate (disagree) |
| AC-13 | 以換行結尾的文字用整行的方式貼 | 剪貼簿「今日盤後觀察\n」，行中 `p` → 成為下方獨立一行，原行不斷 | R:96–98, E:3299–3320 | T:262 | asserts-oracle | produces-oracle | asserts-oracle 0.67 | produces-oracle 0.15 | ✅ conforms | escalate (low confidence) |
| AC-14 | 不以換行結尾的文字用一段的方式貼 | 剪貼簿「營收成長」，行中 `p` → 插在行內 | R:96–98 | T:271 | asserts-oracle | produces-oracle | asserts-oracle 0.88 | produces-oracle 0.25 | ✅ conforms | escalate (low confidence) |
| AC-15 | 系統剪貼簿是空的，什麼都不做 | 剪貼簿空 → `p` 文章不變 | R:91–93, E:3264 | T:280 | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.63 | ✅ conforms | recheck (mid confidence) |
| AC-16 | 系統剪貼簿只有圖片沒有文字，什麼都不做 | 只有圖片 → `p` 文章不變 | `system_clipboard.rs:34–44` (`has(Text)`), R:91–93 | T:280, T:292 | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.75 | ✅ conforms | recheck (mid confidence) |
| AC-17 | 方塊選取取走的文字，貼回來仍是方塊 | 方塊取走兩行開頭那欄，行尾 `p` → 兩行各接一個字元 | V:108–109, R:94–95, E:3368–3384 | T:315 | asserts-oracle | produces-oracle | asserts-oracle 0.89 | diverges 0.27 | 🔴 violation | escalate (violation) |
| AC-18 | 從其他 App 來的多行文字，貼回來不是方塊 | 外部多行 → `p` 以一般方式貼入 | R:96–98 | T:327, T:335 | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.28 | ✅ conforms | escalate (low confidence) |
| AC-19 | 剛自己複製的東西，立刻貼得回來 | `y` 後立刻 `p` → 出現「台積電」 | R:124–129, R:82–88 | T:347 | asserts-oracle | produces-oracle | asserts-oracle 0.87 | produces-oracle 0.35 | ✅ conforms | escalate (low confidence) |
| AC-20 | Vim 模式開著時貼上圖片也照舊 | Vim 開，標準貼上圖片 → 存進 workspace 並插入圖片語法 | `ImagePaste.ts:82–130` (untouched) | A ("still saves a pasted image… with Vim on") | asserts-oracle | produces-oracle | asserts-oracle 0.96 | unclear 0.55 | ❔ unclear | escalate (disagree) |
| AC-21 | 當場關掉 Vim 模式，相通行為當場消失 | 關掉後選取退格 → 剪貼簿不變 | R:115–119 | T:396 | asserts-oracle | produces-oracle | asserts-oracle 0.93 | produces-oracle 0.20 | ✅ conforms | escalate (low confidence) |
| AC-22 | 當場打開 Vim 模式，相通行為當場生效 | 打開後反白「台積電」按 `y` → 剪貼簿「台積電」 | V:44–62, R:103–113 | T:410 | asserts-oracle | produces-oracle | asserts-oracle 0.97 | unclear 0.53 | ❔ unclear | escalate (disagree) |
| AC-23 | 標準的複製、剪下、貼上照舊 | Vim 關著，標準複製剪下貼上與交付前相同 | no keymap or handler added; R listeners exist only in the Vim band | T:383 | shallow | produces-oracle | shallow 0.68 | diverges 0.21 | 🔴 violation | escalate (violation) |
| AC-24 | Vim 模式關著時貼上圖片照舊 | Vim 關，貼上圖片 → 存進 workspace 並插入圖片語法 | `ImagePaste.ts:82–130` (untouched) | A:352 (existing) | asserts-oracle | produces-oracle | asserts-oracle 0.81 | unclear 0.47 | ❔ unclear | escalate (disagree) |
| AC-25 | 設定畫面沒有多出任何一項 | 設定畫面項目與交付前相同 | no settings change | `SettingsDialog.test.tsx:47` (existing: exactly 語言 / 主題 / Vim 模式) | asserts-oracle | produces-oracle | mis-asserted 0.56 | unclear 0.41 | ❔ unclear | escalate (disagree) |
| AC-26 | 在開著 Vim 模式的 Vault 裡，相通行為在 | Vault Vim 開，反白按 `y` → 剪貼簿是反白文字 | `App.tsx` builds the register; V:107–111 | A ("pastes what the system clipboard holds and yanks onto it…") | asserts-oracle | produces-oracle | mis-asserted 0.43 | unclear 0.56 | ❔ unclear | escalate (disagree) |
| BR-1 | 出去全送，進來只有預設那一格 | 具名暫存格的複製也更新剪貼簿；只有預設暫存格的貼上讀剪貼簿 | R:51–56, E:1504–1520, E:3249 | T:152, T:248 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | diverges 0.21 | 🔴 violation | escalate (violation) |
| BR-2 | 垃圾桶暫存格是唯一的例外 | `"_` 刪除時剪貼簿原封不動 | E:1474 | T:163 | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.60 | ✅ conforms | recheck (mid confidence) |
| BR-3 | 刪除就是剪下 | dd / x / c 拿走的文字都進剪貼簿 | see AC-3, AC-4, AC-5 | T:120, T:130, T:140 | asserts-oracle | produces-oracle | not run (judged through AC-3/4/5) | not run | ✅ conforms | — |
| BR-4 | 最後一次複製的贏，不分是誰複製的 | 後寫的覆蓋前寫的（含其他 App、標準複製） | R:82–122 | T:220, T:234 | asserts-oracle | produces-oracle | asserts-oracle 0.92 | produces-oracle 0.77 | ✅ conforms | recheck (mid confidence) |
| BR-5 | 「整行還是一段」由換行結尾決定 | 以換行結尾 → 整行；否則一段 | R:96–98 | T:262, T:271 | asserts-oracle | produces-oracle | not run (judged through AC-13/14) | not run | ✅ conforms | — |
| BR-6 | 沒有文字就什麼都不做，而且是安靜的 | 空或只有圖片 → 文章不變、無提示 | R:91–93 | T:280, T:292, T:305 | shallow | produces-oracle | asserts-oracle 0.43 | produces-oracle 0.28 | ✅ conforms | escalate (disagree) |
| BR-6a | 方塊只屬於這個 App 自己複製出來的那一份 | 這裡取走的方塊貼回仍是方塊；別處來的永遠不是 | R:94–98 | T:315, T:327, T:335 | asserts-oracle | produces-oracle | not run (judged through AC-17/18) | not run | ✅ conforms | — |
| BR-6b | Vim 內部歸零暫存格不清空剪貼簿 | 歸零後剪貼簿原封不動 | R:51–56, R:71–75 | T:174 | asserts-oracle | produces-oracle | not run (judged through AC-8) | not run | ✅ conforms | — |
| BR-7 | 相通行為的存在與否等於 Vim 模式開關 | 無第二個設定；Vim 關則全部不適用 | V:107–111 | T:371, T:383, T:396, T:410 | asserts-oracle | produces-oracle | not run (judged through AC-9/21/22/26) | not run | ✅ conforms | — |
| BR-8 | 圖片一律不經過這條路 | Vim 的 `p` 只看文字；圖片由既有貼上處理 | `system_clipboard.rs:34–44`, ImagePaste untouched | T:280, A (image paste, Vim on) | asserts-oracle | produces-oracle | not run (judged through AC-16/20/24) | not run | ✅ conforms | — |
| NFR-1 | 即時性 | `p` 不等待讀剪貼簿 | R:77–100 (synchronous `toString` over a local copy) | T:347 | asserts-oracle | produces-oracle | asserts-oracle 0.83 | produces-oracle 0.77 | ✅ conforms | recheck (mid confidence) |
| NFR-2 | 不絆住編輯 | 寫剪貼簿永不延後或阻擋編輯 | R:124–129 (fire and forget) | T:198 | asserts-oracle | produces-oracle | asserts-oracle 0.92 | produces-oracle 0.96 | ✅ conforms | accept |
| NFR-3 | 失敗不外溢 | 讀失敗視為沒有文字；寫失敗編輯照常 | R:89–93, R:124–129 | T:198, T:305 | asserts-oracle | produces-oracle | asserts-oracle 0.93 | produces-oracle 0.76 | ✅ conforms | recheck (mid confidence) |
| NFR-4 | 不打開的人零成本 | Vim 關著時沒有持續進行的工作 | R:103–122 (listeners only while installed) | T:383, T:396, A ("never touches the system clipboard while Vim is off") | asserts-oracle | produces-oracle | asserts-oracle 0.93 | produces-oracle 0.71 | ✅ conforms | recheck (mid confidence) |
| NFR-5 | 相容性：三平台一致，不加特例 | macOS/Windows/Linux 行為一致 | `system_clipboard.rs:34–50` (only `clipboard-rs`' cross-platform `has`/`get_text`/`set_text`, no `cfg`) | — | no-test | produces-oracle | not run | not run | 🟡 partial | — |

### Notes on the escalated rows (rechecked by Claude)

- **Corroboration:** every mapped test above was run on its own (`pnpm vitest run src/features/vim/SystemClipboardRegister.test.tsx`: 29/29; the App tests by name: green). During implementation each production line these rows depend on was mutated (empty-text guard, stale-answer guard, own-kind round trip, linewise rule, focus/copy listeners and their removal, read-failure mapping, empty-clipboard reset, write call) and the mapped test went red each time; the block row was confirmed red without `allowMultipleSelections`.
- **AC-17 / BR-1 (Jev "diverges", 0.27 / 0.21):** low-confidence picks on code Jev only saw in part; the engine excerpt shows `"ap` reads register a and named yanks copy into `"`. The end-to-end tests drive the real engine and assert the oracle exactly ("ba\ndc", "聯電聯電"). No change needed.
- **AC-23 (shallow):** a native copy/cut/paste with Vim off is the webview's own behaviour and cannot be driven in happy-dom. This slice adds no keymap and no handler that runs while Vim is off (the only listeners live inside the Vim band and are removed with it; pinned by T:383 and the App "Vim is off" test). Accepted as a justified assumption, listed in the PR.
- **AC-20 / AC-24 / AC-25 (unclear / mis-asserted):** behaviour lives in code this slice does not touch (`ImagePaste`, `SettingsDialog`); the tests assert exactly the oracle (image saved and syntax inserted; the dialog's sections are exactly the three it had before).
- **AC-12 / AC-22 / AC-26 (unclear):** Jev could not see the engine / React wiring end to end; the tests drive the real app and engine.
- **NFR-5:** no automated cross-platform run exists in this project; the implementation has no platform branch.

## Orphans (code with no clause)

| Code | Description | Verdict |
|------|-------------|---------|
| V:108–109 `EditorState.allowMultipleSelections` while Vim is on | Visual block mode now acts on every line it covers (it collapsed to one line before) | Required by AC-17 / BR-6a ("not a regression of the delivered block paste"); not out of scope |
| R:59–61 `pushText`, R:63–69 `pushInsertModeChanges` / `pushSearchQuery`, `keyBuffer` | Engine register contract: a macro recorded into `"` | Undocumented engine-contract behaviour; keys a macro records go out to the clipboard like any text Vim takes (T:187) |
| Document `copy`/`cut` refresh (R:111–112) | A standard copy made inside Rustle while Vim is on is what the next `p` pastes | Serves BR-4 ("不分是誰複製的") |

## Summary

- Conforms: 31/41 clauses ✅ (76%)
- Violations: AC-17, AC-23, BR-1 (Jev's low-confidence picks; rechecked: tests assert the oracle and pass, see Notes; AC-23 is a justified assumption)
- Mis-asserted: none
- Partial: NFR-5 (no cross-platform automation)
- Gaps: none
- Unclear: AC-12, AC-20, AC-22, AC-24, AC-25, AC-26 (Jev could not judge by reading; dynamically corroborated)
- Orphans: 3 (all explained above; none in Out of Scope)
- Jev: ran on 34 clauses (composite rules BR-3, BR-5, BR-6a, BR-6b, BR-7, BR-8 judged through their scenarios; NFR-5 not auditable statically)
- Needs James: AC-17, AC-23, BR-1 (violation route), AC-12, AC-20, AC-22, AC-24, AC-25, AC-26 (disagree), AC-2–AC-7, AC-9–AC-11, AC-13, AC-14, AC-18, AC-19, AC-21, BR-6 (low confidence) — each rechecked above; Claude found no remaining behaviour gap

Ceiling: static conformance audit against the PRD's acceptance criteria, corroborated only by running the tests already mapped to each clause. It does not execute invented scenarios; the real system clipboard was never touched by an automated test.
