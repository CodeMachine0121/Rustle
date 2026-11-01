# Contract Traceability Matrix — Tab / Shift+Tab 縮排行為

Contract: PRD.md (§4 Gherkin acceptance criteria, TC-01 ~ TC-41)
Design map: ARCH.md
Implementation: `src/features/editor/IndentUnit.ts`, `src/features/editor/TabIndentation.ts`, `src/features/editor/MarkdownEditor.tsx`
Oracle: Acceptance Criteria (41 clauses; clause IDs reuse the PRD's TC numbers)

**Ceiling.** This is a static conformance audit. Each clause's oracle was written from the PRD alone, and the mapped test and code path were then judged against it. Only the tests mapped to escalated rows were run, as corroboration. No new scenarios were executed. Separately, during implementation every guard and branch in the slice was mutated, and each mutation turned at least one of these tests red (32 mutations, 0 survivors).

`Test audit` / `Code audit` are Claude's shadow verdict, recorded before Jev ran. `Jev test` / `Jev code` and `Route` are copied from `jev_audit.py` as returned. `Status` is Jev's verdict, except where it reads "conforms (resolved)" after the re-check at the end of this file.

## Clauses

| ID | Spec-expected (oracle) | Concrete form | Impl | Test | Test audit | Code audit | Jev test | Jev code | Status | Route | Notes |
|----|------------------------|---------------|------|------|------------|------------|----------|----------|--------|-------|-------|
| TC-01 | 內容變成「··寫文章」且游標緊貼在「寫」前面 | `doc '  寫文章', cursor at 2` | `src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:81-89` | asserts-oracle | produces-oracle | asserts-oracle 0.87 | produces-oracle 0.08 | ✅ conforms | escalate (low confidence) |  |
| TC-02 | 內容變成「··寫文章」且游標仍在「文」「章」之間 | `doc '  寫文章', cursor between 文 and 章` | `src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:91-98` | asserts-oracle | produces-oracle | asserts-oracle 0.87 | diverges 0.08 | ✅ conforms (resolved) | escalate (violation) | Mapped test green. Every position on the line shifts by the inserted unit; the test pins the characters on both sides of the cursor, and a mutated mapping turns it red. |
| TC-03 | 「- 第一項」變成「··- 第一項」 | `doc '  - 第一項'` | `src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:100-106` | asserts-oracle | produces-oracle | mis-asserted 0.48 | unclear 0.43 | ✅ conforms (resolved) | escalate (disagree) | Mapped test green. The test pins the whole resulting line, which is the entire oracle. |
| TC-04 | 「··- 第一項」游標在空白中按 Tab 變成「····- 第一項」 | `doc '    - 第一項'` | `src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:108-114` | asserts-oracle | produces-oracle | asserts-oracle 0.89 | produces-oracle 0.36 | ✅ conforms | escalate (low confidence) |  |
| TC-05 | 空白行按 Tab 變成「··」 | `doc '  '` | `src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:116-122` | asserts-oracle | produces-oracle | asserts-oracle 0.51 | unclear 0.44 | ✅ conforms (resolved) | escalate (disagree) | Mapped test green. |
| TC-06 | code block 第二行變成「··const answer = 1」、圍籬兩行不變 | `doc '```ts\n  const answer = 1\n```'` | `src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:124-131` | asserts-oracle | produces-oracle | asserts-oracle 0.77 | not-implemented 0.16 | ✅ conforms (resolved) | escalate (disagree) | Mapped test green. Indentation is line-based and never looks at syntax, so code blocks need no special path. That is exactly what the clause asks for. |
| TC-07 | 「···字」（3 空白）按 Tab 變成 5 個空白加字 | `doc '     字'` | `src/features/editor/TabIndentation.ts:28-89`<br>`src/features/editor/IndentUnit.ts:20-57` | `src/features/editor/TabIndentation.test.ts:133-139` | asserts-oracle | produces-oracle | asserts-oracle 0.93 | produces-oracle 0.55 | ✅ conforms | escalate (low confidence) |  |
| TC-08 | 三行都加兩空白，選取仍從「一」之前到「三」之後 | `doc '  一\n  二\n  三', selection slice '一\n  二\n  三'` | `src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:141-149` | asserts-oracle | produces-oracle | asserts-oracle 0.83 | produces-oracle 0.29 | ✅ conforms | escalate (low confidence) |  |
| TC-09 | 兩行部分選取時兩行都縮排 | `doc '  一二\n  三四'` | `src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:151-158` | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.85 | ✅ conforms | accept |  |
| TC-10 | 同一行兩個游標只縮排一次，內容「··一二三」 | `doc '  一二三'` | `src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:160-169` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.25 | ✅ conforms | escalate (low confidence) |  |
| TC-11 | 「··寫文章」Shift+Tab 變「寫文章」，游標仍在文章之間 | `doc '寫文章', cursor between 文 and 章` | `src/features/editor/TabIndentation.ts:28-89`<br>`src/features/editor/IndentUnit.ts:20-57` | `src/features/editor/TabIndentation.test.ts:181-189` | asserts-oracle | produces-oracle | asserts-oracle 0.91 | produces-oracle 0.21 | ✅ conforms | escalate (low confidence) |  |
| TC-12 | 「··- 子項」Shift+Tab 變「- 子項」 | `doc '- 子項'` | `src/features/editor/TabIndentation.ts:28-89`<br>`src/features/editor/IndentUnit.ts:20-57` | `src/features/editor/TabIndentation.test.ts:191-197` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.51 | ✅ conforms | escalate (low confidence) |  |
| TC-13 | 行首 1/2/3/4/5 空白退縮後分別為 0/0/2/2/4 | `doc leading spaces 0/0/2/2/4` | `src/features/editor/TabIndentation.ts:28-89`<br>`src/features/editor/IndentUnit.ts:20-57` | `src/features/editor/TabIndentation.test.ts:199-212`<br>`src/features/editor/IndentUnit.test.ts:30-38` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.27 | ✅ conforms | escalate (low confidence) |  |
| TC-14 | 已在最外層 Shift+Tab：內容不變、游標不動 | `doc unchanged, cursor head unchanged` | `src/features/editor/TabIndentation.ts:28-89`<br>`src/features/editor/IndentUnit.ts:20-57` | `src/features/editor/TabIndentation.test.ts:214-223` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.23 | ✅ conforms | escalate (low confidence) |  |
| TC-15 | 兩行「··一」「··二」選取後 Shift+Tab 變「一」「二」，選取仍涵蓋一到二 | `doc '一\n二', selection slice '一\n二'` | `src/features/editor/TabIndentation.ts:28-89`<br>`src/features/editor/IndentUnit.ts:20-57` | `src/features/editor/TabIndentation.test.ts:225-233` | asserts-oracle | produces-oracle | asserts-oracle 0.93 | produces-oracle 0.49 | ✅ conforms | escalate (low confidence) |  |
| TC-16 | 「··一」「二」都選取 Shift+Tab 後為「一」「二」 | `doc '一\n二'` | `src/features/editor/TabIndentation.ts:28-89`<br>`src/features/editor/IndentUnit.ts:20-57` | `src/features/editor/TabIndentation.test.ts:235-241` | asserts-oracle | produces-oracle | asserts-oracle 0.76 | produces-oracle 0.32 | ✅ conforms | escalate (low confidence) |  |
| TC-17 | code block 第二行「··const answer = 1」退縮為「const answer = 1」 | `doc '```ts\nconst answer = 1\n```'` | `src/features/editor/TabIndentation.ts:28-89`<br>`src/features/editor/IndentUnit.ts:20-57` | `src/features/editor/TabIndentation.test.ts:243-250` | asserts-oracle | produces-oracle | asserts-oracle 0.99 | not-implemented 0.35 | ✅ conforms (resolved) | escalate (disagree) | Mapped test green. Same reasoning as TC-06. |
| TC-18 | 三行縮排後一次 undo 回到「一」「二」「三」 | `undo once -> '一\n二\n三'` | `src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:254-261` | asserts-oracle | produces-oracle | asserts-oracle 0.93 | unclear 0.21 | ✅ conforms (resolved) | escalate (disagree) | Mapped test green. One dispatch carries every line change, with `isolateHistory`. Removing the annotation turns the typing-after-indent test red. |
| TC-19 | 三行退縮後一次 undo 回到「··一」「··二」「··三」 | `undo once -> original` | `src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:263-270` | asserts-oracle | produces-oracle | asserts-oracle 0.77 | produces-oracle 0.23 | ✅ conforms | escalate (low confidence) |  |
| TC-20 | 打字後無動作的 Shift+Tab，一次 undo 退掉的是打的字 | `after undo doc is ''` | `src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:272-280` | asserts-oracle | produces-oracle | asserts-oracle 0.96 | unclear 0.16 | ✅ conforms (resolved) | escalate (disagree) | Mapped test green. Outdent returns before dispatching when no line moves; removing that guard turns the return-value test red. |
| TC-21 | Tab 縮排且按鍵被編輯區吃掉（不移動焦點） | `doc '  字' and keydown defaultPrevented` | `src/features/editor/TabIndentation.ts:109-133` | `src/features/editor/TabIndentation.test.ts:304-311` | asserts-oracle | produces-oracle | asserts-oracle 0.87 | produces-oracle 0.89 | ✅ conforms | accept |  |
| TC-22 | 最外層 Shift+Tab 內容不變但按鍵仍被吃掉 | `doc unchanged and defaultPrevented` | `src/features/editor/TabIndentation.ts:109-133`<br>`src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:313-320` | asserts-oracle | produces-oracle | asserts-oracle 0.28 | produces-oracle 0.77 | ✅ conforms | escalate (low confidence) |  |
| TC-23 | 唯讀時 Tab 內容不變但按鍵仍被吃掉 | `doc unchanged and defaultPrevented` | `src/features/editor/TabIndentation.ts:109-133`<br>`src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:322-329` | asserts-oracle | produces-oracle | asserts-oracle 0.31 | produces-oracle 0.89 | ✅ conforms | escalate (low confidence) |  |
| TC-24 | 「con」按 Tab 只變成「··con」，不補字不展開 | `doc '  con'` | `src/features/editor/TabIndentation.ts:109-133`<br>`src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:331-337` | asserts-oracle | produces-oracle | asserts-oracle 0.53 | diverges 0.23 | ✅ conforms (resolved) | escalate (violation) | Mapped test green. The editor has no completion or snippet extension, and the capture-phase listener stops Tab before any keymap. TC-25 shows that a competing Tab binding never runs. |
| TC-25 | 另有擴充把 Tab 綁去插入「搶走」時，結果只有縮排、沒有「搶走」 | `doc '  字'` | `src/features/editor/TabIndentation.ts:109-133` | `src/features/editor/TabIndentation.test.ts:339-345` | asserts-oracle | produces-oracle | asserts-oracle 0.61 | produces-oracle 0.25 | ✅ conforms | escalate (low confidence) |  |
| TC-26 | Esc 後 Tab：內容不變且按鍵沒有被吃掉 | `doc unchanged and defaultPrevented false` | `src/features/editor/TabIndentation.ts:109-133` | `src/features/editor/TabIndentation.test.ts:358-366` | asserts-oracle | produces-oracle | asserts-oracle 0.81 | produces-oracle 0.67 | ✅ conforms | recheck (mid confidence) |  |
| TC-27 | Esc、普通鍵、Tab：內容「··字」且按鍵被吃掉 | `doc '  字' and defaultPrevented` | `src/features/editor/TabIndentation.ts:109-133` | `src/features/editor/TabIndentation.test.ts:379-388` | asserts-oracle | produces-oracle | asserts-oracle 0.83 | produces-oracle 0.51 | ✅ conforms | escalate (low confidence) |  |
| TC-28 | 組字中 Tab：內容不變，按鍵仍被吃掉 | `doc unchanged and defaultPrevented` | `src/features/editor/TabIndentation.ts:109-133` | `src/features/editor/TabIndentation.test.ts:413-421` | asserts-oracle | produces-oracle | asserts-oracle 0.88 | produces-oracle 0.73 | ✅ conforms | recheck (mid confidence) |  |
| TC-29 | 組字中 Shift+Tab：「··字」不變，按鍵仍被吃掉 | `doc unchanged and defaultPrevented` | `src/features/editor/TabIndentation.ts:109-133` | `src/features/editor/TabIndentation.test.ts:423-431` | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.69 | ✅ conforms | recheck (mid confidence) |  |
| TC-30 | 組字開始又結束後 Tab：內容「··字」 | `doc '  字'` | `src/features/editor/TabIndentation.ts:109-133`<br>`src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:433-441` | asserts-oracle | produces-oracle | asserts-oracle 0.91 | produces-oracle 0.52 | ✅ conforms | escalate (low confidence) |  |
| TC-31 | 沒有縮排設定時 Tab 插入 2 個空白 | `doc '  字'` | `src/features/editor/IndentUnit.ts:20-57` | `src/features/editor/TabIndentation.test.ts:511-517`<br>`src/features/editor/IndentUnit.test.ts:6-8` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | unclear 0.17 | ✅ conforms (resolved) | escalate (disagree) | Mapped test green. `MarkdownEditor` calls `IndentUnit.from()` with no settings, which gives two spaces. |
| TC-32 | 設定空白寬度 4 時插入 4 個空白 | `doc '    字'` | `src/features/editor/IndentUnit.ts:20-57` | `src/features/editor/TabIndentation.test.ts:519-525` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.89 | ✅ conforms | accept |  |
| TC-33 | 設定 tab 寬度 4 時插入 1 個 tab 字元 | `doc '\t字'` | `src/features/editor/IndentUnit.ts:20-57` | `src/features/editor/TabIndentation.test.ts:527-533` | asserts-oracle | produces-oracle | asserts-oracle 0.87 | produces-oracle 0.84 | ✅ conforms | recheck (mid confidence) |  |
| TC-34 | 空白寬度 4、行首 6 空白 Shift+Tab 後行首 4 空白 | `doc '    字'` | `src/features/editor/IndentUnit.ts:20-57`<br>`src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:535-541` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.63 | ✅ conforms | recheck (mid confidence) |  |
| TC-35 | tab 寬度 4、行首 6 空白 Shift+Tab 後行首 1 個 tab | `doc '\t字'` | `src/features/editor/IndentUnit.ts:20-57`<br>`src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:543-549` | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.61 | ✅ conforms | recheck (mid confidence) |  |
| TC-36 | 寬度 0、-2、23、2.5 時 Tab 插入 2 個空白 | `doc '  字' for each width` | `src/features/editor/IndentUnit.ts:20-57` | `src/features/editor/TabIndentation.test.ts:551-557` | asserts-oracle | produces-oracle | asserts-oracle 0.99 | diverges 0.27 | ✅ conforms (resolved) | escalate (violation) | Mapped test green for 0, -2, 23 and 2.5. The unit test also covers 3.5 and NaN; dropping `Number.isInteger` turns it red. |
| TC-37 | 打開 App、游標在編輯區按 Tab：游標所在那一行縮排 2 個空白 | `App first line gains two leading spaces` | `src/features/editor/MarkdownEditor.tsx:18-48`<br>`src/app/App.tsx:1-13` | `src/app/App.test.tsx:13-24` | asserts-oracle | produces-oracle | asserts-oracle 0.56 | unclear 0.49 | ✅ conforms (resolved) | escalate (disagree) | Mapped test green. The cursor starts at the beginning of the sample body, so the first line is the cursor line. |
| TC-38 | 編輯區拿到空白寬度 4 的設定時 Tab 縮排 4 個空白 | `MarkdownEditor indentation prop -> '    字'` | `src/features/editor/MarkdownEditor.tsx:18-48`<br>`src/features/editor/IndentUnit.ts:20-57` | `src/features/editor/MarkdownEditor.test.tsx:100-106` | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.79 | ✅ conforms | recheck (mid confidence) |  |
| TC-39 | 選取結束在第二行行首時只有第一行縮排，第二行仍是「二」 | `doc '  一\n二'` | `src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:171-177` | asserts-oracle | produces-oracle | asserts-oracle 0.81 | produces-oracle 0.28 | ✅ conforms | escalate (low confidence) |  |
| TC-40 | 組字中且編輯器核心不再把按鍵交給綁定時 Tab：內容不變、按鍵被吃掉 | `capture-phase listener prevents default; doc unchanged` | `src/features/editor/TabIndentation.ts:109-133` | `src/features/editor/TabIndentation.test.ts:443-452` | asserts-oracle | produces-oracle | asserts-oracle 0.84 | produces-oracle 0.72 | ✅ conforms | recheck (mid confidence) |  |
| TC-41 | 組字中直接要求縮排（字）或退縮（··字）：內容不變 | `indent()/outdent() return false, doc unchanged` | `src/features/editor/TabIndentation.ts:28-89` | `src/features/editor/TabIndentation.test.ts:496-508` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.57 | ✅ conforms | escalate (low confidence) |  |

## Orphans (code with no clause)

| Code | Description | Verdict |
|------|-------------|---------|
| `src/features/editor/TabIndentation.ts:112` | Ctrl/Alt/Meta+Tab is left to the system: no indentation, key not eaten | undocumented. It keeps OS and app shortcuts (such as Ctrl+Tab) working. No clause covers modified Tab; recorded in ARCH §8 and the PR description |
| `src/features/editor/TabIndentation.ts:47` | The editor's tab size follows the indent width, so tab characters render at the measured width | undocumented. Supports BRIEF §3.10 ("同一份文件只用一種") visually; no clause asserts rendering |
| `src/features/editor/TabIndentation.ts:114` | Esc pressed while composing does not arm the escape route | undocumented. It is the input method's Esc (cancels the candidate), not the user's escape; follows BRIEF §6 |
| `src/features/editor/TabIndentation.ts` (`#disarmEscape`) | A mouse press inside the editor or focus loss disarms the escape route | undocumented. The user moved on from the Esc, so a later Tab is ordinary editing; recorded in ARCH §8 |

None of these matches an Out-of-Scope item in PRD §5.

## Summary

- Conforms: 41/41 clauses ✅ (100%). 30 conformed as returned by Jev; the other 11 are marked "✅ conforms (resolved)" after the re-check described below. Claude's shadow verdict is `asserts-oracle` / `produces-oracle` on all 41.
- Violations: none
- Mis-asserted: none
- Partial: none
- Gaps: none
- Unclear: none
- Orphans: 4 (all undocumented, none out of scope)
- Jev: ran on 41 clauses; its raw verdicts stay in the `Jev test` / `Jev code` columns

### Resolution of the non-conforming Jev verdicts

Every `violation`, `gap` and `unclear` above comes from a Jev code verdict with confidence between 0.08 and 0.44, and each disagrees with the shadow verdict. Each one was re-checked:

1. The row's mapped test was run and is green (see Notes).
2. The code path was re-read against the oracle (see Notes).
3. Every guard on that path was mutated during implementation, and the mapped or a companion test went red each time.

The rows were therefore re-marked "✅ conforms (resolved)" in the Status column, and the gap list is empty. The raw Jev verdicts stay visible in their own columns.

After review, the test for "Tab does not complete or expand the word before the cursor" was strengthened: the test editor now installs a Tab binding that would expand `con`, so the test fails if the capture listener ever stops winning. The escape route is now also disarmed by a mouse press inside the editor or by focus loss (an orphan behaviour beside the Esc rows, recorded in ARCH.md).

