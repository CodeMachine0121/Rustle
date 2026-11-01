# Contract Traceability Matrix — 快捷鍵總覽

Contract: PRD.md
Design map: ARCH.md
Implementation: `src/features/keymap/`, `src/features/interfaceLanguage/SettingsDialog.tsx` / `SettingsEntry.tsx`, `src/features/preview/KeyboardShortcut.ts` / `usePreviewToggleShortcut.ts`, `src/app/App.tsx`, `src/app/app.css`
Oracle: Acceptance Criteria (17 scenarios) + Core Business Rules (5) + NFR (2) = 24 clauses

Static conformance audit: test assertions and code paths were judged against the spec's expected outcome. Every mapped test was also run, and each core behaviour was mutated once (dropped modifier, swapped modifier order, hard-coded preview key, extra undo row, wrong focus target, back closing the dialog, hook ignoring the setting, an extra character in a description). The mapped tests failed on every mutation.

## Clauses

`Test audit` / `Code audit` are Claude's shadow verdict. `Jev test` / `Jev code` are Jev's pick with its confidence. `Status` and `Route` come from `jev_audit.py` as returned.

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Jev test | Jev code | Status | Route |
|----|--------|------------------------|------|------|------------|------------|----------|----------|--------|-------|
| AC-1 | 設定裡有這顆按鈕 | 語言、主題、Vim 模式底下有「快捷鍵」按鈕 | SettingsDialog.tsx:100 | SettingsDialog.test.tsx:212, :220 | asserts-oracle | produces-oracle | asserts-oracle 0.87 | produces-oracle 0.75 | ✅ conforms | recheck |
| AC-2 | 按下去,對話框的內容換成清單 | 同一對話框顯示清單,三項設定不在畫面上 | SettingsDialog.tsx:72-73 | SettingsDialog.test.tsx:226 | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.88 | ✅ conforms | accept |
| AC-3 | 返回,回到設定而且什麼都沒被改動 | 三項回到畫面,值與進入前相同 | SettingsDialog.tsx:37-48, :73 | SettingsDialog.test.tsx:237 | asserts-oracle | produces-oracle | asserts-oracle 0.91 | produces-oracle 0.91 | ✅ conforms | accept |
| AC-4 | 在清單上按 ESC,整個對話框關閉 | 對話框關閉;下一次打開是設定 | SettingsDialog.tsx:50-55, :70 | SettingsDialog.test.tsx:255; SettingsEntry.test.tsx:56 | asserts-oracle | produces-oracle | asserts-oracle 0.92 | produces-oracle 0.89 | ✅ conforms | accept |
| AC-5 | 關掉再打開,回到設定那一面 | 再按齒輪打開的是設定 | SettingsDialog.tsx:37; SettingsEntry.tsx (unmount on close) | SettingsEntry.test.tsx:56 | asserts-oracle | produces-oracle | asserts-oracle 0.92 | produces-oracle 0.69 | ✅ conforms | recheck |
| AC-6 | 被改掉的那個鍵找得到 | 「擴大選取」一列,鍵 Cmd+W | keymapGroups.ts:36 | keymapGroups.test.ts:15; KeymapOverview.test.tsx:37 | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.99 | ✅ conforms | accept |
| AC-7 | 讓位之後的關閉視窗也找得到 | 「關閉視窗」一列,鍵 Shift+Cmd+W | keymapGroups.ts:49 | keymapGroups.test.ts:15; KeymapOverview.test.tsx:37 | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.80 | ✅ conforms | recheck |
| AC-8 | 原生的鍵不在清單裡 | 沒有「還原」「重做」兩列 | keymapGroups.ts:25-56 | keymapGroups.test.ts:57; KeymapOverview.test.tsx:70 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.89 | ✅ conforms | accept |
| AC-9 | Vim 開著也不會多出任何一列 | Vim 開或關,每一列相同 | keymapGroups.ts:25 (no Vim input) | SettingsDialog.test.tsx:264 | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.68 | ✅ conforms | recheck |
| AC-10 | 三組,由上到下 | 寫作、畫面、視窗依序 | keymapGroups.ts:27-50 | keymapGroups.test.ts:15; KeymapOverview.test.tsx:25 | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.93 | ✅ conforms | accept |
| AC-11 | 說明跟著介面語言 | 中文介面時粗體那一列說明是中文 | KeymapOverview.tsx:38; messages.ts | KeymapOverview.test.tsx:37 | asserts-oracle | produces-oracle | asserts-oracle 0.41 | produces-oracle 0.73 | ✅ conforms | escalate (low confidence) |
| AC-12 | 鍵名不跟著介面語言 | 英文介面時仍是 Cmd+B | keymapGroups.ts:34; KeymapOverview.tsx:40 | KeymapOverview.test.tsx:46 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.65 | ✅ conforms | recheck |
| AC-13 | 鍵寫成鍵上印的字 | 縮排那一列是 Tab,不是 ⇥ | keymapGroups.ts:30 | KeymapOverview.test.tsx:37; keymapGroups.test.ts:15 | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.89 | ✅ conforms | accept |
| AC-14 | 每一列只寫那個鍵做什麼 | 每一條說明都是名詞,不是句子 | messages.ts (row nouns) | keymapGroups.test.ts:66 | asserts-oracle | produces-oracle | asserts-oracle 0.37 | produces-oracle 0.33 | ✅ conforms | escalate (low confidence) |
| AC-15 | 沒改過設定的人看到預設值 | 開關預覽那一列 Shift+Cmd+P | usePreviewToggleShortcut.ts; KeyboardShortcut.ts label; keymapGroups.ts:43 | usePreviewToggleShortcut.test.tsx:20; keymapGroups.test.ts:15 | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.37 | ✅ conforms | escalate (low confidence) |
| AC-16 | 改過設定的人看到自己改的值 | 設定 Cmd+Alt+K → 顯示 Option+Cmd+K | KeyboardShortcut.ts parse (Cmd = Mod) + label | KeymapOverview.test.tsx:54; KeyboardShortcut.test.ts:34, :56 | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.49 | ✅ conforms | escalate (low confidence) |
| AC-17 | 設定寫了讀不懂的值 | 顯示 Shift+Cmd+P | KeyboardShortcut.fromSetting | usePreviewToggleShortcut.test.tsx:20; KeyboardShortcut.test.ts:56 | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.71 | ✅ conforms | recheck |
| BR-1 | 列進這張表的判準是「這是 Rustle 教給寫作者的嗎」 | PRD 表格的十一列都在;原生鍵、對話框 Enter、Vim 鍵都不在 | keymapGroups.ts:25-56 | keymapGroups.test.ts:15, :57 | asserts-oracle | produces-oracle | mis-asserted 0.44 | produces-oracle 0.69 | 🟠 mis-asserted | escalate (disagree) |
| BR-2 | 這張表的內容不隨模式改變 | Vim 開或關,每一列相同 | keymapGroups.ts:25 | SettingsDialog.test.tsx:264 | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.79 | ✅ conforms | recheck |
| BR-3 | 鍵用符號,說明用語言 | 兩種語言的鍵名相同,說明翻譯 | KeymapOverview.tsx:38-40 | KeymapOverview.test.tsx:37, :45 | asserts-oracle | produces-oracle | asserts-oracle 0.71 | produces-oracle 0.64 | ✅ conforms | recheck |
| BR-4 | 可設定的那一列問設定,不問常數 | 那一列顯示設定的鍵;讀不懂時顯示 App 實際回應的鍵,與綁定同一個解析 | usePreviewToggleShortcut.ts (used by useWritingLayout.ts and App.tsx:71) | usePreviewToggleShortcut.test.tsx:20, :32 | asserts-oracle | produces-oracle | asserts-oracle 0.60 | produces-oracle 0.40 | ✅ conforms | escalate (low confidence) |
| BR-5 | 一列只寫那個鍵做什麼,寫完就停 | 說明都是名詞;Tab 與 Shift+Tab 兩列 | keymapGroups.ts:30-31; messages.ts | keymapGroups.test.ts:15, :66 | asserts-oracle | produces-oracle | asserts-oracle 0.61 | unclear 0.07 | ❔ unclear | escalate (disagree) |
| NFR-1 | 顏色一律取自當前主題 | 清單沒有自帶顏色 | app.css `.keymap-overview*` | appStyles.test.ts:72 | asserts-oracle | produces-oracle | asserts-oracle 0.77 | produces-oracle 0.88 | ✅ conforms | recheck |
| NFR-2 | 每一個讀者看得到的字都來自介面文案表,符號除外 | 除了鍵名,清單上的字都在文案表裡 | KeymapOverview.tsx:16-49 | KeymapOverview.test.tsx:60, :77 | asserts-oracle | produces-oracle | shallow 0.32 | produces-oracle 0.69 | 🟠 mis-asserted | escalate (disagree) |

### Notes on rechecks and escalations

- **First-pass reference errors, re-run.** AC-3, AC-7, AC-11, AC-14 and BR-4 were first sent to Jev with line ranges that missed the relevant code (the dialog's back path, the window row, the catalog, App's hook call). They were re-run with corrected ranges. The table shows the re-run results.
- **BR-1 (Jev: mis-asserted 0.44).** The test asserts the PRD's eleven rows *plus* the 尋找 group. That group comes from the finding slice's own acceptance criteria (its PRD US-07: 「多一組尋找,放在既有三組之後」). That slice is already on `main` and shipped `FINDING_SHORTCUTS` for this list. This is a deliberate, recorded assumption (ARCH §8.2), not a wrong assertion. The PRD's rows and order are asserted exactly.
- **BR-5 (Jev: code unclear 0.07).** The two-row split is literal in `keymapGroups.ts:30-31`. The noun rule is the same check as AC-14. Jev's code pick is near chance (0.30 / 0.26 / 0.30 across the three options).
- **NFR-2 (Jev: shallow 0.32).** The test checks every heading and description against the catalog's values and every key name against a key-name shape. Adding a single extra character to a description turned it red. The back button's readable name is asserted from the catalog at :77.
- **Low-confidence agreements** (AC-11, AC-14, AC-15, AC-16, BR-4): Jev and the shadow verdict agree. Each mapped test was run green and was killed by its mutation.

## Orphans (code with no clause)

| Code | Description | Verdict |
|------|-------------|---------|
| keymapGroups.ts:51-54 | 尋找 group (Cmd+T, Shift+Cmd+F, Cmd+P) | undocumented here; specified by the finding slice's PRD, recorded as an assumption |
| KeyboardShortcut.ts parse | `Cmd` accepted as another name for `Mod` | serves AC-16 literally (ARCH §8.4). Not out of scope: the preview-panel contract never lists `Cmd` as invalid |
| SettingsDialog.tsx:39-43, KeymapOverview.tsx:20-22 | focus moves to the back button on entering and to 快捷鍵 on return | UX detail from PRD §5 (keyboard path), not an AC |
| app.css `.keymap-overview` max-height / overflow | the list scrolls inside the dialog | PRD §4 edge case 「清單很長裝不下」 |

No orphan implements an Out of Scope item: no key editing, no Vim table, no gestures, no search, no other platforms.

## Summary

- Conforms: 21/24 clauses ✅ (87.5%)
- Violations: none
- Mis-asserted: BR-1 (justified assumption: the 尋找 group), NFR-2 (Jev low confidence, test strengthened and falsified)
- Partial: none
- Gaps: none
- Unclear: BR-5 (Jev near chance; the behaviour is literal in the table)
- Orphans: 4 (all explained above)
- Jev: ran on 24 clauses
- Needs James: BR-1 (disagree: finding group assumption), BR-5 (disagree), NFR-2 (disagree), AC-11 / AC-14 / AC-15 / AC-16 / BR-4 (low confidence, agreeing)
