# Contract Traceability Matrix — Vim 模式下 Tab 永遠是縮排

Contract: PRD.md
Design map: ARCH.md
Implementation: `src/features/editor/TabIndentation.ts` (`escapeRouteClosed`, `TabKeyListener`), `src/features/vim/VimEditing.ts` (`#vimBand` contributes the facet)
Oracle: Acceptance Criteria (9 scenarios) + Core Business Rules (5) + NFR (3) = 17 clauses

Static conformance audit: test assertions and code paths are judged against the spec's expected outcome; no invented scenario was executed. Focus actually moving cannot be observed in happy-dom, so "focus leaves / stays" is bridged (ARCH §8) to "the Tab keydown is / is not `preventDefault`ed and is stopped before any editor binding".

## Clauses

`Test audit` / `Code audit` are Claude's shadow verdict, recorded before Jev ran. `Jev test` / `Jev code`, `Status` and `Route` are as returned by `jev_audit.py`.

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Jev test | Jev code | Status | Route |
|----|--------|------------------------|------|------|------------|------------|----------|----------|--------|-------|
| AC-1 | US-01 常態模式按過 Esc 之後，Tab 仍然縮排 | 那一行縮排了，焦點仍在寫作區 | TabIndentation.ts:159, VimEditing.ts:137 | VimEditing.test.tsx:399, App.test.tsx:2144 | asserts-oracle | produces-oracle | asserts-oracle 0.81 | produces-oracle 0.75 | ✅ conforms | recheck |
| AC-2 | US-01 從輸入模式退出來之後，Tab 仍然縮排 | 那一行縮排了 | TabIndentation.ts:159, VimEditing.ts:137 | VimEditing.test.tsx:410 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.32 | ✅ conforms | escalate (low confidence) |
| AC-3 | US-01 沒按過 Esc 時，Tab 照樣縮排 | 那一行縮排了 | TabIndentation.ts:168-180 | VimEditing.test.tsx:422 | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.81 | ✅ conforms | recheck |
| AC-4 | US-02 沒人要的 Esc 之後，Tab 移動焦點 | 焦點離開寫作區，那一行沒有縮排 | TabIndentation.ts:159-170 | VimEditing.test.tsx:431, App.test.tsx:2155, TabIndentation.test.ts:375 | asserts-oracle | produces-oracle | asserts-oracle 0.57 | produces-oracle 0.55 | ✅ conforms | escalate (low confidence) |
| AC-5 | US-02 中間按了別的鍵就解除 | 那一行縮排了 | TabIndentation.ts:146-148 | VimEditing.test.tsx:441, TabIndentation.test.ts:420 | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.45 | ✅ conforms | escalate (low confidence) |
| AC-6 | US-03 片語選單照樣關得掉 | 片語選單關掉了 | SnippetExpansion.ts:31, TabIndentation.ts:157 | VimEditing.test.tsx:349, App.test.tsx:2047 | asserts-oracle | produces-oracle | asserts-oracle 0.93 | produces-oracle 0.68 | ✅ conforms | recheck |
| AC-7 | US-03 填空照樣停得掉 | 填空停止了 | SnippetExpansion.ts:31, TabIndentation.ts:157 | VimEditing.test.tsx:361 | asserts-oracle | produces-oracle | asserts-oracle 0.89 | produces-oracle 0.32 | ✅ conforms | escalate (low confidence) |
| AC-8 | US-03 專注模式照樣不受 Esc 影響 | 專注模式仍然開著 | no Esc listener in `WritingLayout`; TabIndentation.ts:153-163 never prevents an unclaimed Esc | App.test.tsx:2047 | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.47 | ✅ conforms | escalate (low confidence) |
| AC-9 | US-03 輸入模式照樣退得回常態模式 | 寫作者在常態模式 | Vim's own Esc (`Prec.low(vim())`, VimEditing.ts:140); TabIndentation.ts:157 does not prevent it | VimEditing.test.tsx:410, App.test.tsx:2047 | asserts-oracle | produces-oracle | asserts-oracle 0.81 | unclear 0.25 | ❔ unclear | escalate (disagree) |
| BR-01 | Vim 開著時，沒人接手的 Esc 由編輯器留下，不交出去武裝焦點移動 | Esc 之後的 Tab 不移動焦點 | TabIndentation.ts:159, VimEditing.ts:137 | TabIndentation.test.ts:494-522, VimEditing.test.tsx:399 | asserts-oracle | produces-oracle | asserts-oracle 0.68 | produces-oracle 0.84 | ✅ conforms | recheck |
| BR-02 | Vim 開著時，Tab 永遠縮排 | 任何情況下 Tab 都縮排 | TabIndentation.ts:159-180 | VimEditing.test.tsx:399-430 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.55 | ✅ conforms | escalate (low confidence) |
| BR-03 | Vim 關著時，行為一個字都沒變 | 沒人要的 Esc 之後兩秒內、一次按鍵寬的 Tab 移動焦點；其他鍵、滑鼠、失焦、逾時都回到縮排 | TabIndentation.ts:115-180 | TabIndentation.test.ts:374-492 | asserts-oracle | produces-oracle | asserts-oracle 0.77 | produces-oracle 0.39 | ✅ conforms | escalate (low confidence) |
| BR-04 | Esc 不因為這個切片多做任何事 | 沒人接手的 Esc 不被編輯器吃掉 | TabIndentation.ts:153-163 | TabIndentation.test.ts:485, :515, App.test.tsx:2166 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.87 | ✅ conforms | accept |
| BR-05 | 組字中的 Esc 照舊屬於輸入法 | 組字中的 Esc 不開路、不影響輸入法 | TabIndentation.ts:153-156 | TabIndentation.test.ts:584, :596, VimEditing.test.tsx:387 | asserts-oracle | produces-oracle | asserts-oracle 0.87 | produces-oracle 0.97 | ✅ conforms | accept |
| NFR-01 | 不重建編輯器，跟著 Vim 開關區塊換進換出 | Vim 一開一關，路立刻跟著關、開，編輯器不重建 | VimEditing.ts:88-95, :137 | VimEditing.test.tsx:452, :463 | asserts-oracle | produces-oracle | asserts-oracle 0.91 | produces-oracle 0.96 | ✅ conforms | accept |
| NFR-02 | 不新增第三方依賴 | 依賴清單不變 | `package.json`, `pnpm-lock.yaml`, `Cargo.*` untouched (`git diff origin/main` empty) | — (build-level, verified by diff) | n/a | produces-oracle | not run | not run | ✅ conforms (by diff) | — |
| NFR-03 | 不新增任何設定項 | 設定不變 | `crates/`, `src/ipc/settings.ts`, `src/features/settings/` untouched | — (verified by diff) | n/a | produces-oracle | not run | not run | ✅ conforms (by diff) | — |

### Notes on rechecks and escalations

- **AC-4**: a first Jev run, given the bridge "Tab not prevented so the browser moves focus", returned `violation` (`asserts-oracle 0.44`, `diverges 0.31`, disagree). Re-read the path: the escaping Tab is `stopPropagation`ed in the capture phase on the editor root (no editor binding sees it) and not `preventDefault`ed, so the browser's default focus move runs; the app-level test pins this in the real app wiring. The rerun with the precise bridge (adding "stopped before any editor binding; focus movement itself is not observable in happy-dom") returned the row above. Real focus movement is a manual item in `docs/ime-regression-checklist.md` (snippet item 5).
- **AC-9**: the outcome comes from the Vim library's own Esc, which this slice does not touch; Jev could not see library code. Two tests assert the reported mode is Normal after Esc from Insert (`VimEditing.test.tsx:410`, `App.test.tsx:2047`), and `TabIndentation` never prevents an unclaimed Esc, so Vim still receives it. Kept as returned (`unclear`), justified here.
- **Low-confidence `conforms` (AC-2, AC-5, AC-7, AC-8, BR-02, BR-03)**: shadow and Jev agree; Jev's code confidence is low because part of the path is the Vim engine or the snippet claims outside the refs. Each mapped test was run and is green; mutations of the facet contribution, the facet check, the disarm on another key, the two-second lapse, the mouse/focus disarm and the composing guard each turned the corresponding test red.

## Orphans (code with no clause)

| Code | Description | Verdict |
|------|-------------|---------|
| TabIndentation.ts:124-135 | A mouse press in the editor or the editor losing focus disarms the way out | undocumented in this PRD; restores the route exactly as it was before the Vim slice removed it (tab-indentation slice), which BR-03 asks to keep "照舊" |
| TabIndentation.ts:143 | Bare modifier keys (Shift, …) do not disarm, so Esc → Shift+Tab escapes backwards | same: part of the restored route |

## Summary

- Conforms: 16/17 clauses ✅ (94%)
- Violations: none
- Mis-asserted: none
- Partial: none
- Gaps: none
- Unclear: AC-9 (library behaviour, justified above)
- Orphans: 2 (restored pre-existing route details, not out-of-scope)
- Jev: ran on 15 clauses (NFR-02/03 are build-level, verified by diff)
- Needs James: AC-9 (disagree: library Esc not visible to Jev); AC-2, AC-4, AC-5, AC-7, AC-8, BR-02, BR-03 (low confidence, agree)
