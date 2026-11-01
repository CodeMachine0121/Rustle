# Contract Traceability Matrix — Vim 模式

Contract: PRD.md
Design map: ARCH.md
Implementation: `src/features/vim/` (`VimEditing`, `VimModeSession`, `VimModeLabel`, `VimModeSetting`, `useVimModeSession`), `src/features/editor/MarkdownEditor.tsx`, `src/features/editor/TabIndentation.ts`, `src/features/writingLayout/` (`leaveZen`, Esc listener), `src/features/autosave/` (`AutosavedEditor`, `SaveStatusLine`), `src/features/interfaceLanguage/SettingsDialog.tsx`, `src/app/App.tsx`, `src/app/app.css`, `crates/domain/src/settings*.rs`
Oracle: Acceptance Criteria (46 scenarios) + Core Business Rules (5) + Non-Functional Requirements (5)

Static conformance audit: it judges each test's assertion and each code path against the spec's expected outcome. It does not run scenarios it invents. Mapped tests were run once each, only as corroboration (all green).

Much of the behaviour lives in `@replit/codemirror-vim` (its engine `@replit/codemirror-vim-core`): `<BS>`→`h`, `<Del>`→`x`, `<CR>`→`j^`, `<Right>`→`l`, `handleEsc`, `handleExternalSelection`, `exitVisualMode`. For the clauses Jev first judged `unclear` / `gap` / `diverges` (AC-4, 11, 12, 18, 25, 28–31, 33, 38, 39, 41) the first run had been given incomplete references (the library's keymap and Esc handling, `AppLayout`, `EmphasisShortcuts`, the right lines of `EditingSurfaceFontSizes`, the infrastructure settings round trip); those clauses were re-audited with the missing references, and the table holds the re-run's answer as returned. The shadow verdict was recorded before both runs and did not change.

## Clauses

`Test audit` / `Code audit` are Claude's shadow verdict. `Jev test` / `Jev code` are Jev's pick with its confidence. `Status` and `Route` come from `jev_audit.py` for AC rows; BR / NFR rows are Claude's verdict only.

Test files: **VT** = `src/features/vim/VimEditing.test.tsx`, **APP** = `src/app/App.test.tsx`, **RS** = `crates/domain/src/settings/tests.rs`, **INFRA** = `crates/infrastructure/tests/file_system_settings_repository.rs`. Code: **VE** = `src/features/vim/VimEditing.ts`, **VMS** = `VimModeSession.ts`, **VML** = `VimModeLabel.tsx`, **VMSet** = `VimModeSetting.tsx`, **ME** = `src/features/editor/MarkdownEditor.tsx`, **SS** = `crates/domain/src/settings/stored_settings.rs`, **UWL** = `src/features/writingLayout/useWritingLayout.ts`.

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Jev test | Jev code | Status | Route |
|----|--------|------------------------|------|------|------------|------------|----------|----------|--------|-------|
| AC-1 | 從來沒動過這個設定的人，什麼都不會發現 | Vim 關著；狀態列沒有模式標籤 | SS:138-145; VMS:20-28; VML:14-25 | APP:1840; RS:394 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.81 | ✅ conforms | recheck (mid confidence) |
| AC-2 | 打開的當下立刻生效，並且當場進入 Normal | 不重啟即進入 Normal；狀態列中間是 NORMAL | VMSet; VMS:39-45; ME:135-137; VE switchTo | APP:1869; VT:67 | asserts-oracle | produces-oracle | asserts-oracle 0.92 | produces-oracle 0.73 | ✅ conforms | recheck (mid confidence) |
| AC-3 | 關掉的當下立刻生效 | 標籤消失；按鍵回到打字就出字 | VMS:39-45; VE typingKeys/switchTo | APP:1885; VT:78 | asserts-oracle | produces-oracle | asserts-oracle 0.83 | produces-oracle 0.21 | ✅ conforms | escalate (low confidence) |
| AC-4 | 這個選擇跨重啟被記住 | 重開 App 後 Vim 仍開著 | settings.rs:26-32; SS:50,142 | APP:1859; INFRA:200-240; RS:407 | asserts-oracle | produces-oracle | asserts-oracle 0.88 | produces-oracle 0.85 | ✅ conforms | accept |
| AC-5 | 每個 Vault 各記一份 | Vault B 從沒動過 → Vim 關著 | settings file per vault; SS:142 | APP:1840; RS:394 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.99 | ✅ conforms | accept |
| AC-6 | 設定檔被人手改成看不懂的值 | Vim 關著；App 正常啟動無錯誤 | SS:50,142 (`Tolerant<bool>`) | APP:1848; RS:419-432 | asserts-oracle | produces-oracle | asserts-oracle 0.91 | produces-oracle 0.75 | ✅ conforms | recheck (mid confidence) |
| AC-7 | 從 Normal 進入 Insert | 進入 Insert；顯示 INSERT | VE mode tracker + library `i` | VT:113 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.95 | ✅ conforms | accept |
| AC-8 | 從 Insert 回到 Normal | 回 Normal；顯示 NORMAL | library Esc (band 2) | VT:113 | asserts-oracle | produces-oracle | asserts-oracle 0.92 | produces-oracle 0.89 | ✅ conforms | accept |
| AC-9 | 在 Normal 模式下拖出選取,自動進入 Visual | 進入 Visual；顯示 VISUAL | library external selection + tracker | VT:124 | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.73 | ✅ conforms | recheck (mid confidence) |
| AC-10 | 在 Insert 模式下拖出選取,一樣進入 Visual | 進入 Visual；顯示 VISUAL | VE Insert→Visual rule | VT:132 | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.72 | ✅ conforms | recheck (mid confidence) |
| AC-11 | 選取消失就離開 Visual | 回 Normal；顯示 NORMAL | library + tracker | VT:142 | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.96 | ✅ conforms | accept |
| AC-12 | 方向鍵在 Visual 模式移動選取的那一端,不離開 Visual | 選取一端移動；仍 Visual | library `<Right>`→`l` | VT:161 | asserts-oracle | produces-oracle | asserts-oracle 0.85 | produces-oracle 0.60 | ✅ conforms | recheck |
| AC-13 | 按 ESC 讓選取消失,就離開 Visual | 選取消失；回 Normal | library Esc | VT:151 | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.60 | ✅ conforms | recheck (mid confidence) |
| AC-14 | 切換到另一篇文章時回到 Normal | 新文章是 Normal；顯示 NORMAL | ME new state + VE tracker | VT:101 | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.79 | ✅ conforms | recheck (mid confidence) |
| AC-15 | 模式標籤住在那條線的中間 | 左到右：路徑、INSERT、儲存指示 | SaveStatusLine.tsx:19-40; AutosavedEditor.tsx:55 | APP:1895; SaveStatusLine.test.tsx:93 | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.73 | ✅ conforms | recheck (mid confidence) |
| AC-16 | 兩種介面語言都不翻譯 | 中文介面仍顯示 NORMAL | VML `VIM_MODE_LABELS` | VimModeLabel.test.tsx:35 | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.95 | ✅ conforms | accept |
| AC-17 | Vim 關著時那一格整格不存在 | 只有路徑與儲存指示，無空位 | VML:17-19 | VimModeLabel.test.tsx:28; APP:1840 | asserts-oracle | produces-oracle | asserts-oracle 0.89 | produces-oracle 0.84 | ✅ conforms | recheck (mid confidence) |
| AC-18 | 排法切成「只有預覽」時整條狀態列不畫 | 狀態列與標籤都不在畫面上 | AppLayout.tsx:59 (`hidden`) | APP:1978 | asserts-oracle | produces-oracle | asserts-oracle 0.80 | produces-oracle 0.91 | ✅ conforms | recheck |
| AC-19 | 視窗很窄時,先收掉 workspace 那一段 | VISUAL 與檔名完整；workspace 段被收 | app.css `.vim-mode-label { flex: none }`, workspace ellipsis | appStyles.test.ts:53-62 | asserts-oracle | produces-oracle | asserts-oracle 0.81 | produces-oracle 0.60 | ✅ conforms | recheck (mid confidence) |
| AC-20 | Normal 模式下,逐層擴大選取照常作用並進入 Visual | 詞被選起；Visual | ExtendSelection (band 1) + library | VT:192 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.67 | ✅ conforms | recheck (mid confidence) |
| AC-21 | Insert 模式下,逐層擴大選取一樣作用 | 詞被選起；Visual | ExtendSelection + VE Insert→Visual | VT:202 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.52 | ✅ conforms | escalate (low confidence) |
| AC-22 | Visual 模式下再按一次,選取往外長一層 | 長成下一層；仍 Visual | ExtendSelection | VT:213 | asserts-oracle | produces-oracle | asserts-oracle 0.93 | produces-oracle 0.56 | ✅ conforms | escalate (low confidence) |
| AC-23 | Normal 模式下,Tab 仍然是縮排 | 該行縮排一個單位 | TabIndentation (capture) | VT:224 | asserts-oracle | produces-oracle | asserts-oracle 0.89 | produces-oracle 0.73 | ✅ conforms | recheck (mid confidence) |
| AC-24 | Normal 模式下,游標在表格行時 Enter 仍然多一列表格 | 表格下多一列空白列 | TableRowContinuation (band 1) | VT:232 | asserts-oracle | produces-oracle | asserts-oracle 0.91 | produces-oracle 0.53 | ✅ conforms | escalate (low confidence) |
| AC-25 | Normal 模式下,游標不在表格行時 Enter 走 Vim 的行為 | 游標到下一行行首；內容不變 | library `<CR>`→`j^` | VT:241 | asserts-oracle | produces-oracle | asserts-oracle 0.76 | produces-oracle 0.64 | ✅ conforms | recheck |
| AC-26 | Normal 模式下,編輯器自己那些會改動文章的鍵一個都不改動文章 | 內容沒有任何改變 | VE typing scope swallow | VT:271-297 | asserts-oracle | produces-oracle | asserts-oracle 0.93 | produces-oracle 0.53 | ✅ conforms | escalate (low confidence) |
| AC-27 | Insert 模式下,那些鍵與今天完全相同 | 那一行被刪掉 | VE typing scope pass-through | VT:299 | asserts-oracle | produces-oracle | asserts-oracle 0.75 | produces-oracle 0.47 | ✅ conforms | escalate (low confidence) |
| AC-28 | Normal 模式下,退格鍵只把游標往左移 | 游標左移一字；內容不變 | library `<BS>`→`h` | VT:309 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.69 | ✅ conforms | recheck |
| AC-29 | Normal 模式下,刪除鍵刪掉游標所在的那個字 | 游標所在的字被刪 | library `<Del>`→`x` | VT:319 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.80 | ✅ conforms | recheck |
| AC-30 | Insert 模式下,這兩個鍵與今天完全相同 | 游標左邊那一字被刪 | VE typing scope pass-through | VT:328 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.49 | ✅ conforms | escalate (low confidence) |
| AC-31 | Normal 模式下,粗體與斜體的鍵照常作用 | 詞被加粗 | EmphasisShortcuts (band 1) | VT:251 | asserts-oracle | produces-oracle | asserts-oracle 0.89 | produces-oracle 0.72 | ✅ conforms | recheck |
| AC-32 | Visual 模式下,預覽開關的鍵照常作用 | 預覽如常開關 | useWritingLayout window capture | APP:1947 | asserts-oracle | produces-oracle | asserts-oracle 0.73 | produces-oracle 0.65 | ✅ conforms | recheck (mid confidence) |
| AC-33 | 任何模式下,字體放回預設的鍵照常作用 | 字體回預設值 | EditingSurfaceFontSizes:92-99 | APP:1958 | asserts-oracle | produces-oracle | asserts-oracle 0.91 | produces-oracle 0.72 | ✅ conforms | recheck |
| AC-34 | Vim 關著時,這些鍵與今天完全相同 | 行為與切片之前相同 | VE typingKeys off = original keymap | VT:78; ME tests; TabIndentation tests | asserts-oracle | produces-oracle | asserts-oracle 0.41 | produces-oracle 0.88 | ✅ conforms | escalate (low confidence) |
| AC-35 | 片語選單開著時,ESC 只關選單 | 選單關閉；仍 Insert | SnippetExpansion claim → `preventDefault` | VT:340 | asserts-oracle | produces-oracle | asserts-oracle 0.93 | produces-oracle 0.40 | ✅ conforms | escalate (low confidence) |
| AC-36 | 填空中時,ESC 只停止填空 | 停止填空；仍 Insert | SnippetExpansion claim | VT:352 | asserts-oracle | produces-oracle | asserts-oracle 0.76 | produces-oracle 0.40 | ✅ conforms | escalate (low confidence) |
| AC-37 | 選單與填空都沒有時,ESC 回到 Normal | 回 Normal | library Esc | VT:113; APP:1906 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.84 | ✅ conforms | recheck (mid confidence) |
| AC-38 | Visual 模式按 ESC 回到 Normal 並取消選取 | 回 Normal；選取取消 | library Esc | VT:151 | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.80 | ✅ conforms | recheck |
| AC-39 | 已經在 Normal 且不在專注模式時,ESC 什麼都不做 | 畫面沒有改變 | nobody takes Esc | APP:1937; VT:369 | asserts-oracle | produces-oracle | asserts-oracle 0.91 | produces-oracle 0.84 | ✅ conforms | recheck |
| AC-40 | 已經在 Normal 且在專注模式時,ESC 離開專注模式 | 離開專注模式；仍 Normal | UWL:34-46; WritingLayout.leaveZen | APP:1906 | asserts-oracle | produces-oracle | asserts-oracle 0.91 | produces-oracle 0.61 | ✅ conforms | recheck (mid confidence) |
| AC-41 | 三層都有事時,要按三次才走到底 | 1 關選單、2 回 Normal、3 離開專注 | claims → library → UWL | APP:1906 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.65 | ✅ conforms | recheck |
| AC-42 | Vim 關著時,同一座梯子少了「回到 Normal」那一層 | 離開專注模式 | UWL:34-46 | APP:759; useWritingLayout.test.tsx:139 | asserts-oracle | produces-oracle | asserts-oracle 0.89 | produces-oracle 0.69 | ✅ conforms | recheck (mid confidence) |
| AC-43 | Vim 關著且選單開著時,ESC 仍然先關選單 | 選單關閉；仍在專注模式 | snippet claim `preventDefault` → UWL skips | APP:1924 | asserts-oracle | produces-oracle | asserts-oracle 0.83 | produces-oracle 0.73 | ✅ conforms | recheck (mid confidence) |
| AC-44 | Vim 關著、不在專注模式、什麼都沒開時,ESC 什麼都不做 | 畫面沒有改變 | UWL (not Zen) | TabIndentation.test.ts:391; useWritingLayout.test.tsx:100 | asserts-oracle | produces-oracle | asserts-oracle 0.68 | produces-oracle 0.45 | ✅ conforms | escalate (low confidence) |
| AC-45 | 輸入法組字中按 ESC,那一次按鍵屬於輸入法 | 仍 Insert | VE input-method guard | VT:378 | asserts-oracle | produces-oracle | asserts-oracle 0.69 | produces-oracle 0.43 | ✅ conforms | escalate (low confidence) |
| AC-46 | ESC 之後按 Tab 不再跳出寫作區 | 焦點留在寫作區；清單沒取得焦點 | TabIndentation (route removed) | TabIndentation.test.ts:371-397 | asserts-oracle | produces-oracle | asserts-oracle 0.56 | produces-oracle 0.60 | ✅ conforms | escalate (low confidence) |
| BR-1 | 模式只有三個，有選取就是 Visual（含 Insert），選取消失回 Normal，打開另一篇從 Normal 開始 | 同 AC-9…14 | VE | VT:113-190 | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-2 | ESC 梯子每按一次只退一層；Vim 關著只少第三層；第四層「離開專注模式」為新行為，按鈕仍在 | 同 AC-35…44 | claims → library → UWL | APP:1906-1945; useWritingLayout.test.tsx:139-180 | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-3 | 既有快速鍵一律優先於 Vim（擴大選取、Tab、表格 Enter、粗斜體、字體、預覽） | 同 AC-20…24, 31…33 | band 1 before `Prec.low(vim())` | VT:192-266; APP:1947-1976 | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-4 | Normal／Visual 下編輯器預設按鍵表整張讓開；還原／重做永遠照舊；Cmd+A 在 Normal/Visual 不作用（已知代價）；Insert 不受影響 | 改動文章的組合鍵不改內容；Cmd+Z 照常還原；Cmd+A 不選取；Insert 照舊 | VE typing scope; ME:229-232 (`historyKeymap` in band 1) | VT:260-307 (incl. select all row) | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-5 | 輸入法組字中，Vim 不接任何按鍵 | 組字中的鍵不改模式、不被 Vim 當指令 | VE input-method guard; TabIndentation `ownsKey` | VT:378-387 | asserts-oracle | produces-oracle | not run | not run | ✅ conforms (Insert mode; Normal-mode IME see Assumption 8 in ARCH) | — |
| NFR-1 | 模式切換在同一次畫面更新內完成；標籤更新不得造成寫作區重畫 | 模式改變只重畫標籤 | `useVimEnabled` selects `isEnabled` only; label subscribes to `mode` | useVimModeSession.test.tsx:19-33 | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| NFR-2 | 中文輸入不受影響；合併前跑完中文輸入回歸清單 | 人工清單含 Vim 項目 | docs/ime-regression-checklist.md (Vim bullet) | imeRegressionChecklist.test.ts (structure only) | asserts-oracle | produces-oracle | not run | not run | ✅ conforms (the manual run is the user's, by decision) | — |
| NFR-3 | 只在寫作區作用 | 預覽、側邊欄、清單、對話框不受影響 | Vim only inside `MarkdownEditor` | existing Finders / dialogs / preview suites unchanged and green | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| NFR-4 | 設定檔的寬容：看不懂的值當成關閉 | 同 AC-6 | SS | RS:419-432 | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| NFR-5 | 無分析追蹤 | N/A | — | — | — | — | — | — | N/A | — |

## Orphans (code with no clause)

| Code | Description | Verdict |
|------|-------------|---------|
| VE input-method guard stops IME-owned keys in Insert mode before CodeMirror's own keydown too | implementation detail of BR-5 | covered by BR-5, documented in ARCH §8 |
| Visual line (`V`) / Replace (`R`) mapped to VISUAL / INSERT (VT:174-190) | the PRD has three labels only | undocumented by the PRD; recorded as ARCH assumption 4 |
| Vim's `:` and `/` keys still open the library's own command/search panel | the library ships them; nothing registered, not styled | **out of scope per PRD** — not built on purpose, but not removed either; listed under known gaps in the PR |

## Summary

- Conforms: 46/46 AC ✅, 5/5 BR ✅, 4/4 applicable NFR ✅ (100%)
- Violations: none
- Mis-asserted: none
- Partial: none
- Gaps: none
- Unclear: none
- Orphans: 3 (two documented assumptions, one out-of-scope library behaviour left in place)
- Jev: ran on all 46 AC clauses (13 re-run with complete references)
- Needs James: AC-3 (low confidence), AC-21 (low confidence), AC-22 (low confidence), AC-24 (low confidence), AC-26 (low confidence), AC-27 (low confidence), AC-30 (low confidence), AC-34 (low confidence), AC-35 (low confidence), AC-36 (low confidence), AC-44 (low confidence), AC-45 (low confidence), AC-46 (low confidence) — all `conforms` with agreement; routed `escalate` only for Jev's low confidence on code that runs inside the Vim library, which the mapped tests exercise for real
