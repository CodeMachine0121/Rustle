# Contract Traceability Matrix — 寫作區的記號與強調

Contract: PRD.md
Design map: ARCH.md
Implementation: `src/features/editor/` (`InlineEmphasis.ts`, `EmphasisShortcuts.ts`, `cursorLineHighlight.ts`, `xcodeTheme.ts` (from `main`), `MarkdownEditor.tsx`), `src/app/app.css`
Oracle: Acceptance Criteria (48 scenarios) + Core Business Rules (R-1 … R-25) + NFRs

Ceiling: static conformance audit. Oracles were written from the PRD before reading code; tests and code were judged against them independently. Only the tests mapped to a clause were run as corroboration (all green). Nothing here executes invented scenarios; the real input method and the painted selection are on the manual checklist (`docs/ime-regression-checklist.md`).

`Test audit` / `Code audit` are Claude's shadow verdict, recorded before Jev ran. `Jev test` / `Jev code` / `Status` / `Route` are copied from `jev_audit.py` as returned when Jev ran; otherwise Status comes from the shadow verdict.

Paths below are relative to `src/features/editor/` unless they start with `src/` or `docs/`.

## Clauses — Acceptance Criteria

### US-01 標題看得出是標題

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Jev test | Jev code | Status | Route |
|----|--------|------------------------|------|------|------------|------------|----------|----------|--------|-------|
| AC-1 | 標題文字不是正文的顏色 | 「今天」與正文是兩個不同顏色 | xcodeTheme.ts:13 | xcodeTheme.test.tsx:123 | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.83 | ✅ conforms | recheck (rechecked: test reads the mounted stylesheets) |
| AC-2 | 井號本身維持它原本的安靜顏色 | 「#」≠ 標題色、≠ 正文色、= 粗體記號與引言符號的顏色 | xcodeTheme.ts:13,20-23 | xcodeTheme.test.tsx:130 | asserts-oracle | produces-oracle | asserts-oracle 0.92 | diverges 0.40 | 🔴 violation | escalate (violation) — see Needs James |
| AC-3 | 六級標題是同一個顏色 | 六行標題文字同色 | xcodeTheme.ts:13 (`tags.heading` covers `heading1…6`) | xcodeTheme.test.tsx:138 | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.97 | ✅ conforms | accept |
| AC-4 | 一套只交代了自己顏色的主題也拿得到標題色 | 沒指定時，標題色 ≠ 正文，且與連結、引言、程式碼、記號都不同 | xcodeTheme.ts:13; src/app/app.css (`--color-editor-heading`, both schemes) | xcodeTheme.test.tsx:61 | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.88 | ✅ conforms | accept |
| AC-5 | 粗體只是比較粗，顏色沒有變 | 「重點」與正文同色且較粗 | xcodeTheme.ts:14 (no `strong` colour, `font-weight: bold`) | xcodeTheme.test.tsx:147 | asserts-oracle | produces-oracle | asserts-oracle 0.87 | diverges 0.17 | 🔴 violation | escalate (violation) — see Needs James |
| AC-6 | 斜體只是斜的，顏色沒有變 | 「重點」與正文同色且是斜的 | as AC-5 (`font-style: italic`) | xcodeTheme.test.tsx:154 | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.69 | ✅ conforms | recheck (rechecked) |
| AC-7 | 沒有記號的正文不受影響 | 純正文的顏色與上線前逐字相同 | no rule matches plain text | xcodeTheme.test.tsx:123 (body line has no colour) | asserts-oracle | produces-oracle | asserts-oracle 0.53 | produces-oracle 0.80 | ✅ conforms | escalate (low confidence) |

### US-02 選取範圍一定看得見

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Jev test | Jev code | Status | Route |
|----|--------|------------------------|------|------|------------|------------|----------|----------|--------|-------|
| AC-8 | 同一行裡選幾個字看得見 | 「重點」底下有與其他字不同的底色 | cursorLineHighlight.ts:12-24 (+ native selection) | cursorLineHighlight.test.ts:37 | asserts-oracle | produces-oracle | asserts-oracle 0.89 | produces-oracle 0.97 | ✅ conforms | accept |
| AC-9 | 有選取時「游標在這一行」的底色讓位 | 該行不再整行鋪底色 | cursorLineHighlight.ts:18-20 | cursorLineHighlight.test.ts:37; MarkdownEditor.test.tsx:494 | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.96 | ✅ conforms | accept |
| AC-10 | 沒有選取時「游標在這一行」的底色照舊 | 游標行整行鋪底色 | cursorLineHighlight.ts:21-23 | cursorLineHighlight.test.ts:31 | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.65 | ✅ conforms | recheck (rechecked) |
| AC-11 | 取消選取之後那片底色回來 | 取消選取後游標行又鋪底色 | cursorLineHighlight.ts:13 (recomputed on selection) | cursorLineHighlight.test.ts:49 | asserts-oracle | produces-oracle | asserts-oracle 0.60 | produces-oracle 0.76 | ✅ conforms | recheck (rechecked) |
| AC-12 | 跨行的選取每一行都不缺 | 三行被選到的部分都有底色 | cursorLineHighlight.ts:18-20 | cursorLineHighlight.test.ts:43 | asserts-oracle | produces-oracle | mis-asserted 0.71 | diverges 0.64 | 🔴 violation | escalate (violation) — see Needs James |

### US-03 任務項叫得出來 — deferred (no snippet menu on `main`, ARCH §8.1)

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Jev test | Jev code | Status | Route |
|----|--------|------------------------|------|------|------------|------------|----------|----------|--------|-------|
| AC-13 | 空行上叫出一個任務項 | 該行成為 `- [ ] `，游標在框右邊 | — | — | no-test | not-implemented | not run | not run | ❌ gap (assumption) | deferred |
| AC-14 | 打名字的開頭就縮到它 | 選單只剩任務項 | — | — | no-test | not-implemented | not run | not run | ❌ gap (assumption) | deferred |
| AC-15 | 一行已經有字時，任務項另起一行 | 原行不動，任務項在下一行，游標在框右邊 | — | — | no-test | not-implemented | not run | not run | ❌ gap (assumption) | deferred |
| AC-16 | 標題片段維持原本的行為 | 標題記號緊接原文，不另起一行 | — | — | no-test | not-implemented | not run | not run | ❌ gap (assumption) | deferred |
| AC-17 | 表格格子裡叫不出來 | 選單不出現 | — | — | no-test | not-implemented | not run | not run | ❌ gap (assumption) | deferred |
| AC-18 | 程式碼區裡叫不出來 | 選單不出現 | — | — | no-test | not-implemented | not run | not run | ❌ gap (assumption) | deferred |

### US-04 任務清單接得下去，也收得掉 — upstream (`markdown()`), pinned by tests

The code path for every row is `@codemirror/lang-markdown`'s `insertNewlineContinueMarkup`, installed by `markdown()` in `MarkdownEditor.tsx` (editorExtensions). Tests drive the real `MarkdownEditor`. Jev saw only the extension list, so it reports `not-implemented`; that is the PRD's own decision ("不新增產品程式碼").

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Jev test | Jev code | Status | Route |
|----|--------|------------------------|------|------|------------|------------|----------|----------|--------|-------|
| AC-19 | 行尾換行長出下一個任務項 | 下一行 `- [ ] `，游標在框右邊 | upstream via MarkdownEditor.tsx | TaskListContinuation.test.tsx:60 | asserts-oracle | produces-oracle | asserts-oracle 0.93 | not-implemented 0.59 | ❌ gap | escalate (disagree) |
| AC-20 | 打勾不繼承給下一項 | 下一項 `- [ ] ` | upstream | TaskListContinuation.test.tsx:64 | asserts-oracle | produces-oracle | asserts-oracle 0.99 | not-implemented 0.43 | ❌ gap | escalate (disagree) |
| AC-21 | 只有框沒有字的那一項收掉清單 | 那一項整行消失，游標在空行 | upstream | TaskListContinuation.test.tsx:68,72 | asserts-oracle | produces-oracle | asserts-oracle 0.88 | not-implemented 0.80 | ❌ gap | escalate (disagree) |
| AC-22 | 清單第二項是空的時候，換行鍵開一個空行而不是離開 | 項、空行、空任務項；普通與編號清單同形 | upstream | TaskListContinuation.test.tsx:84 | asserts-oracle | produces-oracle | asserts-oracle 0.89 | not-implemented 0.47 | ❌ gap | escalate (disagree) |
| AC-23 | 縮排的任務項，下一項對齊同一層 | 下一項同縮排 | upstream | TaskListContinuation.test.tsx:76 | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.72 | ✅ conforms | recheck (rechecked) |
| AC-24 | 縮排的空任務項退一層，而不是離開清單 | 退到外層；普通清單同形 | upstream | TaskListContinuation.test.tsx:92 | asserts-oracle | produces-oracle | asserts-oracle 0.97 | not-implemented 0.75 | ❌ gap | escalate (disagree) |
| AC-25 | 游標在字中間時不長出新的方框 | 切成兩行、記號隨字到下一行、沒有多出一個空的方框項；普通清單同形 | upstream | TaskListContinuation.test.tsx:99 | asserts-oracle | produces-oracle | asserts-oracle 0.91 | unclear 0.36 | ❔ unclear | escalate (disagree) |
| AC-26 | 普通清單與編號清單的行為一個字都沒有變 | `- 買牛奶\n- `、`1. 買牛奶\n2. ` | upstream | TaskListContinuation.test.tsx:104 | asserts-oracle | produces-oracle | asserts-oracle 0.99 | not-implemented 0.63 | ❌ gap | escalate (disagree) |

### US-05 粗體與斜體有快速鍵

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Jev test | Jev code | Status | Route |
|----|--------|------------------------|------|------|------------|------------|----------|----------|--------|-------|
| AC-27 | 選取的字變粗體 | `這是**重點**的地方` | InlineEmphasis.ts:70-76; EmphasisShortcuts.ts:20-43 | EmphasisShortcuts.test.ts:87; MarkdownEditor.test.tsx:477 | asserts-oracle | produces-oracle | asserts-oracle 0.84 | produces-oracle 0.29 | ✅ conforms | escalate (low confidence) |
| AC-28 | 再按一次拿掉粗體 | `這是重點的地方` | InlineEmphasis.ts:66-69, #marksAround | EmphasisShortcuts.test.ts:88 | asserts-oracle | produces-oracle | asserts-oracle 0.55 | produces-oracle 0.48 | ✅ conforms | escalate (low confidence) |
| AC-29 | 選取的字變斜體 | `這是*重點*的地方` | InlineEmphasis.ts:70-76 | EmphasisShortcuts.test.ts:199 | asserts-oracle | produces-oracle | asserts-oracle 0.88 | unclear 0.32 | ❔ unclear | escalate (disagree) |
| AC-30 | 再按一次拿掉斜體 | `這是重點的地方` | InlineEmphasis.ts:66-69 | EmphasisShortcuts.test.ts:200 | asserts-oracle | produces-oracle | asserts-oracle 0.61 | produces-oracle 0.41 | ✅ conforms | escalate (low confidence) |
| AC-31 | 別人用底線寫的粗體也拿得掉 | `這是重點的地方` | InlineEmphasis.ts #marksAround (underscore runs) | EmphasisShortcuts.test.ts:89-92 | asserts-oracle | produces-oracle | asserts-oracle 0.64 | produces-oracle 0.72 | ✅ conforms | recheck (rechecked) |
| AC-32 | 沒有選取時，加粗游標所在的那個詞 | `the **important** part` | InlineEmphasis.ts:44 (`wordAt`) | EmphasisShortcuts.test.ts:96-97 | asserts-oracle | produces-oracle | asserts-oracle 0.87 | produces-oracle 0.52 | ✅ conforms | escalate (low confidence) |
| AC-33 | 中文沒有空白分詞，所以加粗的是連點兩下會選到的那一段 | 星號包住的範圍 = 同位置連點兩下的範圍（整串中文到標點） | InlineEmphasis.ts:44 | EmphasisShortcuts.test.ts:98 | asserts-oracle | produces-oracle | asserts-oracle 0.55 | produces-oracle 0.52 | ✅ conforms | escalate (low confidence) |
| AC-34 | 空行上按下去，落下一對空記號 | 四個星號，游標在第二、三個之間 | InlineEmphasis.ts:45-50 | EmphasisShortcuts.test.ts:100 | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.65 | ✅ conforms | recheck (rechecked) |
| AC-35 | 空記號落下之後打的字就是粗體 | `**重點**`，游標在「點」後 | InlineEmphasis.ts:45-50 | EmphasisShortcuts.test.ts:115 | asserts-oracle | produces-oracle | asserts-oracle 0.83 | produces-oracle 0.43 | ✅ conforms | escalate (low confidence) |
| AC-36 | 跨行的選取什麼都不做 | 兩行不變、選取在原處 | InlineEmphasis.ts:41-43; EmphasisShortcuts.ts:25-34 | EmphasisShortcuts.test.ts:125 | asserts-oracle | produces-oracle | asserts-oracle 0.87 | produces-oracle 0.80 | ✅ conforms | recheck (rechecked) |
| AC-37 | 斜體的快速鍵不再把整個結構選起來 | 那個詞被星號包起來、沒有東西被選起來 | MarkdownEditor.tsx (`editorDefaultKeymap`); InlineEmphasis.ts:57-65 | EmphasisShortcuts.test.ts:203; MarkdownEditor.test.tsx:485 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.65 | ✅ conforms | recheck (rechecked) |

### US-06 不弄壞既有的任何一件事

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Jev test | Jev code | Status | Route |
|----|--------|------------------------|------|------|------------|------------|----------|----------|--------|-------|
| AC-38 | 組字中按粗體的快速鍵不動文件 | 正文不變、候選視窗還開著 | EmphasisShortcuts.ts:20-23 | EmphasisShortcuts.test.ts:150 (+ checklist) | asserts-oracle | produces-oracle | asserts-oracle 0.57 | produces-oracle 0.81 | ✅ conforms | escalate (low confidence) |
| AC-39 | 組字中按斜體的快速鍵不動文件 | 正文不變、候選視窗還開著 | EmphasisShortcuts.ts:20-23; MarkdownEditor.tsx (Mod-i removed) | EmphasisShortcuts.test.ts:216; MarkdownEditor.test.tsx:512 | asserts-oracle | produces-oracle | asserts-oracle 0.81 | produces-oracle 0.88 | ✅ conforms | recheck (rechecked) |
| AC-40 | 組字中在任務項上按換行鍵不動文件 | 沒有長出任務項、正文不變 | CodeMirror ignores keys while its composition is active (`ignoreDuringComposition`) | docs/ime-regression-checklist.md T-6 (manual) | no-test | produces-oracle | not run | not run | 🟡 partial (assumption) | manual — a synthetic composition cannot make CodeMirror's composition active |
| AC-41 | 一次加粗算一步 undo | 一次 undo 兩對星號一起消失 | EmphasisShortcuts.ts:26-31 (`isolateHistory`) | EmphasisShortcuts.test.ts:160,171 | asserts-oracle | produces-oracle | asserts-oracle 0.43 | produces-oracle 0.28 | ✅ conforms | escalate (low confidence) |
| AC-42 | 一次長出任務項算一步 undo | 一次 undo 那一項消失 | upstream | TaskListContinuation.test.tsx:109 | asserts-oracle | produces-oracle | asserts-oracle 0.85 | not-implemented 0.47 | ❌ gap | escalate (disagree) |
| AC-43 | 縮排鍵沒有被搶走 | 該行縮進一級 | TabIndentation (untouched) | MarkdownEditor.test.tsx:504 | asserts-oracle | produces-oracle | asserts-oracle 0.93 | not-implemented 0.68 | ❌ gap | escalate (disagree) |
| AC-44 | 片段選單開著時換行鍵仍然屬於選單 | 片段落進正文、沒有任務項 | — (no menu on `main`) | — | no-test | not-implemented | not run | not run | ❌ gap (assumption) | deferred |
| AC-45 | 表格續列沒有被搶走 | 下一列直線自動出現 | TableRowContinuation (untouched, before `markdown()`) | TaskListContinuation.test.tsx:119 | asserts-oracle | produces-oracle | asserts-oracle 0.89 | not-implemented 0.89 | ❌ gap | escalate (disagree) |
| AC-46 | 每一套主題都還能用 | 每套畫得出畫面且標題色 ≠ 正文 | app.css light/dark tokens | xcodeTheme.test.tsx:61 | shallow (no theme system: the two colour schemes stand in) | produces-oracle | not run | not run | 🟠 mis-asserted (assumption) | no theme system on `main` |
| AC-47 | 寫作區以外的顏色沒有變 | 側邊欄、清單、預覽每個顏色不變 | app.css only adds tokens and one `.markdown-editor` rule | — (diff review) | no-test | produces-oracle | not run | not run | 🟡 partial | diff-only change; no before/after colour test exists in the project |
| AC-48 | 落下的任務項是普通 Markdown | 預覽渲染出帶勾選框的任務清單 | src/features/preview/renderMarkdown.ts (existing) | TaskListContinuation.test.tsx:123 | asserts-oracle | produces-oracle | asserts-oracle 0.71 | unclear 0.45 | ❔ unclear | escalate (disagree) |

## Clauses — Core Business Rules (shadow verdict; each is covered by the AC rows above or the cited test)

| ID | Rule (short) | Impl | Test | Status |
|----|--------------|------|------|--------|
| BR-1 | 標題色是算出來的，不是必填 | `var(--color-editor-heading, fallback)` | AC-4 | ✅ |
| BR-2 | 從紫色算出 | `--color-editor-heading` per scheme (Xcode palette) | xcodeTheme.test.tsx:61 | ✅ |
| BR-3 | `#` 不屬於標題文字 | mark rule restated after heading | AC-2 | ✅ (Jev escalated AC-2) |
| BR-4 | 六級共用一色 | `tags.heading` | AC-3 | ✅ |
| BR-5 | 粗體斜體維持正文色 | no colour rule | AC-5, AC-6 | ✅ |
| BR-6 | 有選取時不畫游標行底色 | cursorLineHighlight | AC-8…12 | ✅ |
| BR-7, BR-8, BR-21 | 任務項片段 | — | — | ❌ deferred (assumption) |
| BR-9, BR-10 | 任務清單斷行一致、勾不繼承 | upstream | AC-19…26 | ✅ (pinned) |
| BR-11 | 切換式 | InlineEmphasis | AC-28, AC-30 | ✅ |
| BR-12 | 寫星號，拿掉認得底線 | InlineEmphasis | AC-27, AC-31 | ✅ |
| BR-13 | 游標所在的詞 = 連點兩下的範圍 | `wordAt` | AC-32, AC-33 | ✅ |
| BR-14 | 沒有詞時落下空記號 | InlineEmphasis:45-50 | AC-34; EmphasisShortcuts.test.ts:101 (next to a space) | ✅ |
| BR-15 | 跨行什麼都不做 | InlineEmphasis:41 | AC-36 | ✅ |
| BR-16 | 組字中一律不作用 | EmphasisShortcuts:21 | AC-38, AC-39, AC-40 | ✅ / manual |
| BR-17 | 各算一步 undo | `isolateHistory` | AC-41, AC-42; EmphasisShortcuts.test.ts:171 | ✅ |
| BR-18 | 斜體鍵的舊行為退場 | `editorDefaultKeymap` | AC-37; MarkdownEditor.test.tsx:512 | ✅ |
| BR-19 | 唯讀時吃掉按鍵、不動文件 | EmphasisShortcuts:25 | EmphasisShortcuts.test.ts:141 | ✅ |
| BR-20, BR-25 | 只改主要範圍，其餘游標隨改動平移 | `#withMainRange` | EmphasisShortcuts.test.ts:181 | ✅ |
| BR-22 | 旁邊那一段的記號不是這一段的 | syntax tree; underscore runs exact | EmphasisShortcuts.test.ts:91-92,102-106 | ✅ |
| BR-23 | 只有記號的選取什麼都不做 | `ONLY_MARKS_OR_SPACE` | EmphasisShortcuts.test.ts:126-127 | ✅ |
| BR-24 | 程式碼裡兩顆鍵都不作用 | `isInCode` | EmphasisShortcuts.test.ts:129-131 | ✅ |
| Edge: 首尾空白留在星號外 | trim | EmphasisShortcuts.test.ts:94 | ✅ |
| Edge: 一部分是粗體 → 整段包起來 | wrap branch | EmphasisShortcuts.test.ts:95 | ✅ |
| Edge: 任務項在最後一行 | upstream | TaskListContinuation.test.tsx:80 | ✅ |

## Clauses — Non-Functional Requirements

| ID | Requirement | Evidence | Status |
|----|-------------|----------|--------|
| NFR-1 | 組字中換行、粗體、斜體都不得動文件 | AC-38, AC-39 automated; Enter + candidate window on checklist T-6 and the Cmd+B/Cmd+I bullet | 🟡 partial (manual part by decision) |
| NFR-2 | 不倒退（按鍵） | AC-43, AC-45, AC-26; existing TabIndentation / TableRowContinuation suites unchanged and green | ✅ |
| NFR-3 | 不倒退（顏色） | marks keep the default style's colour (AC-2), only heading changes | 🟡 partial (AC-47) |
| NFR-4 | 不倒退（主題） | no theme system on `main` | assumption |
| NFR-5 | 主題作者的負擔 | AC-4 | ✅ |
| NFR-6 | undo 完整性 | AC-41, AC-42 | ✅ |
| NFR-7 | 反應速度 | `ensureSyntaxTree(…, 50 ms)` up to the selection only; decorations recomputed from the selection only | ✅ (by reading) |

## Orphans (code with no clause)

| Code | Description | Verdict |
|------|-------------|---------|
| InlineEmphasis.ts #marksAround (`isWhole`) | Selecting a whole emphasis including its marks unwraps it | undocumented — ARCH §8.3 decision; keeps `**重點**` from becoming `****重點****` |
| InlineEmphasis.ts:57-65 | A cursor (no selection) stays a cursor on the same letter after toggling the word | undocumented — needed by AC-37 ("沒有任何東西被選起來"), applied to bold too |
| EmphasisShortcuts.test.ts:128 | A selection of only spaces does nothing | undocumented — ARCH §8.4, same reading as R-23 |

None of these touches an Out of Scope item.

## Summary

- Conforms (status as returned): 23/48 AC ✅ (48%). By the shadow verdict, every implemented AC conforms; the difference is Jev's escalations below.
- Violations (Jev): AC-2, AC-5, AC-12 — shadow verdict conforms; see Needs James.
- Mis-asserted: AC-46 (no theme system; the two colour schemes stand in).
- Partial: AC-40 (manual by decision), AC-47 (diff-only).
- Gaps: AC-13…18, AC-44 — deferred with the snippet menu (explicit assumption, ARCH §8.1). AC-19…22, 24, 26, 42, 43, 45 are Jev "not-implemented" for behaviour provided upstream or by untouched owners; tests drive the real editor.
- Unclear (Jev): AC-25, AC-29, AC-48.
- Orphans: 3 (all documented decisions).
- Jev: ran on 41 clauses (AC-2, 5, 6, 39 re-run after the fixes below); not run on deferred and manual clauses.
- Fixed during this contract run: marks kept the default style's quiet colour instead of a new one (the heading rule had been winning on `#` in the real stylesheet order); bold/italic tests now assert weight and slant; the italic composing test asserts the key is left to the input method.
- Needs James:
  - AC-2 / AC-5 (Jev `diverges` at 0.40 / 0.17): the tests read the stylesheets actually mounted by CodeMirror and fail when the mark rule is removed (falsified); Jev cannot see the default style's rules.
  - AC-12 (Jev `mis-asserted` 0.71): the selection is painted by the browser (no `drawSelection`), which a DOM test cannot observe; the test pins the only thing this code controls — no cursor-line background over a selected line.
  - AC-19…26, 42, 43, 45, 48 (Jev `not-implemented` / `unclear`): behaviour owned by `markdown()`, `TabIndentation`, `TableRowContinuation` and the preview, by the PRD's own decision; the tests run the real `MarkdownEditor`.
  - AC-7, 27, 28, 30, 32, 33, 35, 38, 41 (low confidence, agree).

## After merging `main`

The Xcode theme reached `main` first and now owns the colour rules (ARCH §8 item 7): `writingSurfaceHighlightStyle` and its heading fallback were removed, and the US-01 colour checks run against `xcodeTheme()` in `xcodeTheme.test.tsx`. Review follow-ups: italic now toggles off on bold-italic text, and the underscore fallback no longer takes the underscores of a name or of a neighbouring run (ARCH §8 item 8).
