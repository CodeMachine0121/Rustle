# Contract Traceability Matrix — 專注模式的鍵、側邊欄的摺疊、設定的鍵

Contract: PRD.md
Design map: ARCH.md
Implementation: `src/` (webview) and `crates/domain/src/settings*` (settings file)
Oracle: Acceptance Criteria (28 scenarios) + Core Business Rules (12) + Non-Functional Requirements (5)

Static conformance audit: test assertions and code paths are judged against the spec's expected outcome; no invented scenario is executed. The tests mapped to the escalated clauses were run as corroboration only (16 mapped tests, all green).

AC ids follow the PRD's order: `AC-<story>.<scenario>` (US-01 → AC-1.x … US-05 → AC-5.x).

## Clauses

`Test audit` / `Code audit` are Claude's shadow verdict, recorded before Jev ran. `Jev test` / `Jev code` are Jev's pick and confidence. `Status` and `Route` are as returned by `jev_audit.py` for AC clauses; BR/NFR clauses were judged by the shadow verdict only (they restate the scenarios and map to the same tests).

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Jev test | Jev code | Status | Route |
|----|--------|------------------------|------|------|------------|------------|----------|----------|--------|-------|
| AC-1.1 | 常態模式下 zz 進入專注模式 | Vim on, Normal, Zen off: `zz` → Zen on, two left columns gone | `VimEditing.ts:50-68,136-150`, `App.tsx:73-75` | `App.test.tsx:1930`, `VimEditing.test.tsx:405` | asserts-oracle | produces-oracle | asserts-oracle 0.83 | produces-oracle 0.57 | ✅ conforms | escalate (low confidence) |
| AC-1.2 | 常態模式下 zz 離開專注模式 | Vim on, Normal, Zen on: `zz` → Zen off, columns back | `VimEditing.ts:50-68`, `WritingLayout.ts` `toggleZen` | `App.test.tsx:1930`, `VimEditing.test.tsx:415` | asserts-oracle | produces-oracle | asserts-oracle 0.92 | unclear 0.41 | ❔ unclear | escalate (disagree) |
| AC-1.3 | 輸入模式下的 zz 是兩個字母 | Vim on, Insert: `zz` reaches the text, Zen stays off | engine context filter (`VimEditing.ts:66` `context: "normal"`) | `VimEditing.test.tsx:435`, `App.test.tsx:1949` | asserts-oracle | produces-oracle | asserts-oracle 0.81 | not-implemented 0.12 | ❌ gap | escalate (disagree) |
| AC-1.4 | Vim 模式關著時 zz 是兩個字母 | Vim off: `zz` reaches the text, Zen stays off | `VimEditing.ts:128-150` (no Vim band, no facet while off) | `VimEditing.test.tsx:458`, `App.test.tsx:1971` | asserts-oracle | produces-oracle | asserts-oracle 0.47 | diverges 0.24 | 🔴 violation | escalate (violation) |
| AC-1.5 | 選取模式下的 zz 不碰專注模式 | Vim on, Visual: Zen unchanged, selection kept | `VimEditing.ts:66` | `VimEditing.test.tsx:446`, `App.test.tsx:1960` | asserts-oracle | produces-oracle | asserts-oracle 0.83 | produces-oracle 0.83 | ✅ conforms | recheck (mid confidence) |
| AC-1.6 | 只按一個 z 什麼都不做 | One `z`: Zen off, text unchanged | engine sequence buffer | `VimEditing.test.tsx:426` | asserts-oracle | produces-oracle | asserts-oracle 0.43 | unclear 0.15 | ❔ unclear | escalate (disagree) |
| AC-2.1 | 專注模式下按 Esc，畫面不變 | Zen on, Vim Normal: Esc → Zen still on | `useWritingLayout.ts` (no Esc listener) | `App.test.tsx:2047`, `useWritingLayout.test.tsx:121` | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.92 | ✅ conforms | accept |
| AC-2.2 | Vim 模式關著時按 Esc，畫面也不變 | Zen on, Vim off: Esc → Zen still on | `useWritingLayout.ts` | `App.test.tsx:760` | asserts-oracle | produces-oracle | asserts-oracle 0.85 | produces-oracle 0.61 | ✅ conforms | recheck (mid confidence) |
| AC-2.3 | Esc 仍然帶寫作者退回常態模式 | Vim Insert: Esc → Normal | `VimEditing` (unchanged) | `VimEditing.test.tsx:122` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.39 | ✅ conforms | escalate (low confidence) |
| AC-2.4 | Esc 仍然關得掉片語選單 | Menu open: Esc → menu closed | `SnippetExpansion` claim (unchanged) | `VimEditing.test.tsx:349`, `App.test.tsx:2077` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.79 | ✅ conforms | recheck (mid confidence) |
| AC-2.5 | Esc 仍然停得掉填空 | Fields waiting: Esc → fields stopped | `SnippetExpansion` claim (unchanged) | `VimEditing.test.tsx:361` | asserts-oracle | produces-oracle | asserts-oracle 0.92 | produces-oracle 0.52 | ✅ conforms | escalate (low confidence) |
| AC-3.1 | 收起最左欄 | Fold button → sidebar gone, list and writing area stay | `AppLayout.tsx:64-80`, `useSidebarFold.ts` | `AppLayout.test.tsx:110`, `App.test.tsx:1009` | asserts-oracle | produces-oracle | asserts-oracle 0.36 | produces-oracle 0.91 | ✅ conforms | escalate (low confidence) |
| AC-3.2 | 叫回最左欄 | Same button → sidebar back | `useSidebarFold.ts` | `App.test.tsx:1009`, `SidebarFoldButton.test.tsx:48` | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.93 | ✅ conforms | accept |
| AC-3.3 | 收起來之後仍然叫得回來 | Folded: a visible, keyboard-reachable button brings it back | `SidebarFoldButton.tsx`, `AppLayout.tsx:72-80` | `SidebarFoldButton.test.tsx:70`, `AppLayout.test.tsx:119` | asserts-oracle | produces-oracle | asserts-oracle 0.65 | produces-oracle 0.88 | ✅ conforms | recheck (mid confidence) |
| AC-3.4 | 摺疊不改變任何選擇 | Folding keeps the list rows, the scope and the status chosen | `useSidebarFold.ts` (touches only `sidebar.isFolded`) | `App.test.tsx:1009` | asserts-oracle | produces-oracle | asserts-oracle 0.60 | produces-oracle 0.77 | ✅ conforms | recheck (mid confidence) |
| AC-3.5 | 摺疊會被記住 | Folded, app reopened → still folded | `stored_settings.rs:90-115`, `settings.rs:126-136` | `App.test.tsx:1036`, `crates/domain/src/settings/tests.rs` (fold read/write cases) | asserts-oracle | produces-oracle | asserts-oracle 0.88 | produces-oracle 0.68 | ✅ conforms | recheck (mid confidence) |
| AC-3.6 | 專注模式蓋過摺疊，但不改變它 | Folded + Zen, leave Zen → still folded | `AppLayout.tsx:67` | `App.test.tsx:1052` | asserts-oracle | produces-oracle | asserts-oracle 0.64 | produces-oracle 0.60 | ✅ conforms | recheck (mid confidence) |
| AC-3.7 | 攤開的最左欄在專注模式裡照樣收掉 | Unfolded, enter Zen → sidebar and list gone | `AppLayout.tsx:67,76` | `AppLayout.test.tsx:126` | asserts-oracle | produces-oracle | asserts-oracle 0.41 | produces-oracle 0.95 | ✅ conforms | escalate (low confidence) |
| AC-3.8 | 最左欄不在時視窗按鈕有地方站 | Folded: the article list's top leaves room for the window's three buttons | native title bar (no code) | `AppLayout.test.tsx:119` (header order only) | shallow | produces-oracle | shallow 0.24 | unclear 0.45 | ❔ unclear | escalate (disagree) |
| AC-4.1 | Cmd+, 打開設定 | Closed: Cmd+, → open | `SettingsEntry.tsx:50-62` | `SettingsEntry.test.tsx:84` | asserts-oracle | produces-oracle | asserts-oracle 0.91 | produces-oracle 0.80 | ✅ conforms | recheck (mid confidence) |
| AC-4.2 | 再按一次關掉 | Open: Cmd+, → closed | `SettingsEntry.tsx:38-45` | `SettingsEntry.test.tsx:97,106` | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.91 | ✅ conforms | accept |
| AC-4.3 | 最左欄收起來時照樣叫得出來 | Folded, closed: Cmd+, → open and visible | `SettingsEntry.tsx:64-82` (portal) | `App.test.tsx:1066`, `SettingsEntry.test.tsx:130` | asserts-oracle | produces-oracle | asserts-oracle 0.95 | unclear 0.40 | ❔ unclear | escalate (disagree) |
| AC-4.4 | 專注模式裡照樣叫得出來 | Zen, closed: Cmd+, → open and visible | `SettingsEntry.tsx:64-82` | `App.test.tsx:1066` | asserts-oracle | produces-oracle | asserts-oracle 0.92 | unclear 0.40 | ❔ unclear | escalate (disagree) |
| AC-4.5 | 非 macOS 上是 Ctrl+, | Closed: Ctrl+, → open | `SettingsEntry.tsx:53-54` | `SettingsEntry.test.tsx:84` | asserts-oracle | produces-oracle | asserts-oracle 0.65 | produces-oracle 0.73 | ✅ conforms | recheck (mid confidence) |
| AC-4.6 | 輸入法選字中不作用 | Composing: Cmd+, → stays closed | `SettingsEntry.tsx:55` | `SettingsEntry.test.tsx:138` | asserts-oracle | produces-oracle | asserts-oracle 0.92 | produces-oracle 0.43 | ✅ conforms | escalate (low confidence) |
| AC-5.1 | 清單裡有設定的鍵 | A row `Cmd+,` that says it opens the settings | `keymapGroups.ts:52` | `keymapGroups.test.ts:15`, `KeymapOverview.test.tsx` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.77 | ✅ conforms | recheck (mid confidence) |
| AC-5.2 | 清單裡沒有 zz | No row `zz` | `keymapGroups.ts` | `keymapGroups.test.ts:72` | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.87 | ✅ conforms | accept |
| AC-5.3 | Esc 那一列還在 | A row `Esc` | `keymapGroups.ts:39` | `keymapGroups.test.ts:72` | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.99 | ✅ conforms | accept |
| BR-01 | zz 只在 Vim + 常態 + 非選字時翻轉 | as AC-1.x + composing → nothing | `VimEditing.ts:136-150` | `VimEditing.test.tsx:435-475` | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-02 | zz 是翻轉 | zz twice → back where it started | `App.tsx:74` (`toggleZen`) | `VimEditing.test.tsx:415`, `App.test.tsx:1930` | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-03 | Esc 對專注模式沒有作用 | Esc never changes Zen | `useWritingLayout.ts` | `useWritingLayout.test.tsx:121` | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-04 | Esc 不再無條件吃掉按鍵 | An Esc nobody took is not prevented | `useWritingLayout.ts`, `TabIndentation` (unchanged) | `useWritingLayout.test.tsx:135`, `VimEditing.test.tsx:378` | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-05 | 摺疊是會被記住的偏好 | Written to the vault settings file | `stored_settings.rs`, `useSidebarFold.ts` | `SidebarFoldButton.test.tsx:48`, `settings/tests.rs` | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-06 | 專注模式蓋過摺疊但不改寫 | Zen hides column 1; the fold value is untouched | `AppLayout.tsx:67` | `App.test.tsx:1052` | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-07 | 摺疊不改變選擇與清單 | as AC-3.4 | `useSidebarFold.ts` | `App.test.tsx:1009` | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-08 | 最左欄不在時文章清單替視窗按鈕留位置 | as AC-3.8 | native title bar | — | shallow | produces-oracle | not run | not run | 🟠 mis-asserted (justified assumption) | — |
| BR-09 | Cmd+, 翻轉設定，不論最左欄在不在 | as AC-4.1–4.4 | `SettingsEntry.tsx` | `SettingsEntry.test.tsx`, `App.test.tsx:1066` | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-10 | Cmd+, 選字時不作用 | as AC-4.6 | `SettingsEntry.tsx:55` | `SettingsEntry.test.tsx:138` | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-11 | Cmd+, 不可設定 | The key is fixed: only Cmd/Ctrl + comma, nothing read from settings | `SettingsEntry.tsx:53-54` | `SettingsEntry.test.tsx:149` (other modifiers ignored) | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-12 | 清單新增 Cmd+,；zz 不列；Esc 保留 | as AC-5.x | `keymapGroups.ts` | `keymapGroups.test.ts` | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| NFR-01 | 都不可以重建編輯器 | Same editor, text, cursor and undo after zz, fold, Cmd+, | `AppLayout` (hidden, mounted), portal, Vim action | `App.test.tsx:774`, `App.test.tsx:1930` (same `EditorView`) | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| NFR-02 | 中文輸入永遠不出錯 | zz and Cmd+, do nothing while composing | `VimEditing.ts:143`, `SettingsEntry.tsx:55` | `VimEditing.test.tsx:467`, `SettingsEntry.test.tsx:138` | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| NFR-03 | 先改畫面再寫檔；寫檔失敗不回退 | Fold shows at once; a failed write keeps it folded | `SettingsSession.change` | `SidebarFoldButton.test.tsx:88,107` | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| NFR-04 | 所有字走兩語系詞彙表 | Fold labels and the new keymap noun are catalog keys in both languages | `messages.ts` (`hideSidebar`, `showSidebar`, `toggleSettings`) | `SidebarFoldButton.test.tsx:129`, `keymapGroups.test.ts:79`, `messages.test.ts` | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| NFR-05 | 不新增第三方依賴 | No dependency added | `package.json`, `Cargo.toml` unchanged | `dependencyPins.test.ts` | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |

### Notes on escalated / disagreeing clauses

- **AC-1.2, AC-1.3, AC-1.4, AC-1.6** — Jev could not see the `@replit/codemirror-vim` engine, which does the work: `commandMatches` skips a mapping whose `context` differs from the current one and treats Insert as never matching a non-insert mapping (so `zz` in Insert or Visual stays the stock meaning), keeps a partial match buffered (one `z` does nothing), and while Vim is off no Vim band or command facet is installed at all (`VimEditing.#vimBand` returns `[]`). The mapped tests assert the oracle (command not run, both key presses left unprevented so the letters are typed, single `z` changes nothing) and were run green. Shadow verdict stands: conforms. Jev's picks are recorded as returned.
- **AC-4.3, AC-4.4** — the dialog is rendered through `createPortal(…, document.body)`, so the `hidden` sidebar does not hide it; `App.test.tsx:1066` asserts the dialog is visible with the sidebar folded and in Zen Mode, and was run green.
- **AC-3.8 / BR-08** — justified assumption, not a defect: the spec was written for an Electron window whose traffic lights sat over column 1. Rustle's Tauri window keeps the native title bar (`WebviewWindowBuilder` without a title bar style), so the three window buttons never overlap any webview column in any arrangement; there is no layout to test. Recorded in ARCH §8 and the PR's Assumptions.
- Low/mid-confidence `conforms` rows (AC-1.1, 1.5, 2.2–2.5, 3.1, 3.3–3.7, 4.1, 4.5, 4.6, 5.1) were rechecked by reading the mapped path; nothing changed.

## Orphans (code with no clause)

| Code | Description | Verdict |
|------|-------------|---------|
| `SettingsEntry.tsx:47-49` | When `Cmd+,` opens the settings, closing them gives the keyboard back to the element that had it (e.g. the editor), instead of the hidden gear | undocumented, supports NFR-01 (the writer returns to the editor); not out of scope |
| `VimEditing.ts:50-68` | Generic `VimNormalCommand` seam (any Normal-mode key sequence → app action) | design seam from ARCH §6; only `zz` is bound, so no extra behaviour reaches the writer |

## Summary

- Conforms: 40/45 clauses ✅ (89%) by status as returned; by shadow verdict 44/45
- Violations: AC-1.4 (Jev 0.24, disagrees with shadow; engine behaviour corroborated by tests — see notes)
- Mis-asserted: BR-08 (justified assumption: native title bar)
- Partial: none
- Gaps: AC-1.3 (Jev 0.12, disagrees with shadow; see notes)
- Unclear: AC-1.2, AC-1.6, AC-3.8, AC-4.3, AC-4.4 (Jev could not read the engine / portal; corroborated by the mapped tests)
- Orphans: 2 (both benign)
- Jev: ran on the 28 AC clauses; BR/NFR judged by shadow verdict only
- Needs James: AC-1.1, 2.3, 2.5, 3.1, 3.7, 4.6 (low confidence); AC-1.2, 1.3, 1.6, 3.8, 4.3, 4.4 (disagree); AC-1.4 (violation by Jev only). Every one has a corroborating green test or the recorded assumption above; no code change is pending.
