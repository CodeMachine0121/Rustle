# Contract Traceability Matrix — 表格續列

Contract: PRD.md
Design map: ARCH.md
Implementation: `src/features/editor/TableRow.ts`, `src/features/editor/TableRowContinuation.ts`, `src/features/editor/MarkdownEditor.tsx` (wiring)
Oracle: Acceptance Criteria (15 scenarios) + core rules (§4, incl. the boundary table) + non-functional requirements (§6) — 27 clauses

Static conformance audit: the verdicts compare test assertions and code paths with the oracle written from the PRD. Only the tests mapped to a clause were run, as corroboration (all green).

Abbreviations: `T` = `src/features/editor/TableRowContinuation.test.ts`, `TR` = `src/features/editor/TableRow.test.ts`, `M` = `src/features/editor/MarkdownEditor.test.tsx`, `P` = `src/features/preview/renderPreviewHtml.test.ts`, `C` = `src/features/editor/TableRowContinuation.ts`, `R` = `src/features/editor/TableRow.ts`. `‸` marks the cursor.

## Clauses

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Jev test | Jev code | Status | Route |
|----|--------|------------------------|------|------|------------|------------|----------|----------|--------|-------|
| AC-1 | 兩欄的表格續下一列 | `\| 甲 \| 乙 \|` 下一行是 `\|  \|  \|`，游標在第一格 | R:42-53, C:23-42, MarkdownEditor.tsx:147 | T:77-98 "two columns"; M:357 | asserts-oracle | produces-oracle | asserts-oracle 0.93 | produces-oracle 0.47 | ✅ conforms | escalate (low confidence) |
| AC-2 | 三欄的表格續下一列 | 下一行是 `\|  \|  \|  \|` | R:50 | T:77-98 "three columns" | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.39 | ✅ conforms | escalate (low confidence) |
| AC-3 | 破折號那一列也是表格列 | `\| --- \| --- \|` 下一行是 `\|  \|  \|` | R:23-33 | T "the dashes row"; TR:29-39 | asserts-oracle | produces-oracle | asserts-oracle 0.92 | produces-oracle 0.35 | ✅ conforms | escalate (low confidence) |
| AC-4 | 整列縮排的表格，下一列跟著縮排 | `  \| 甲 \| 乙 \|` 下一行是 `  \|  \|  \|` | R:1, R:50 | T "an indented row" | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.45 | ✅ conforms | escalate (low confidence) |
| AC-5 | 引言裡的表格，下一列保留引言符號 | `> \| 甲 \| 乙 \|` 下一行是 `> \|  \|  \|` | R:1, R:50; MarkdownEditor.tsx:147 (before `markdown()`) | T "inside a quote"; M:365 | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.36 | ✅ conforms | escalate (low confidence) |
| AC-6 | 游標在列中間時 Enter 沒有變 | 那一列在游標處被切成兩行，與上線前一樣，沒有補列 | R:47-49 | T:125-139 (compared with the editor without the feature) | asserts-oracle | produces-oracle | asserts-oracle 0.89 | produces-oracle 0.61 | ✅ conforms | recheck |
| AC-7 | 一行普通文字的 Enter 沒有變 | `最近在選桌面框架` 後多出一個空行，沒有表格列 | R:23-27, C:30-33 | T:125-139; M:392 | asserts-oracle | produces-oracle | asserts-oracle 0.84 | diverges 0.15 | 🔴 violation | escalate (violation) |
| AC-8 | 空的表格列上按 Enter 就離開 | `\|  \|  \|` 整列消失，游標在表格下方的空行 | R:43-46 | T:100-113 | asserts-oracle | produces-oracle | asserts-oracle 0.65 | diverges 0.16 | 🔴 violation | escalate (violation) |
| AC-9 | 補一列，不填，再按一次就出來了 | 正文只剩 `\| 甲 \| 乙 \|` 與下方一個空行，游標在空行 | R:43-53 | T:115-122; M:373-390 | asserts-oracle | produces-oracle | asserts-oracle 0.93 | produces-oracle 0.41 | ✅ conforms | escalate (low confidence) |
| AC-10 | 只有一格空著不算寫完 | `\| 甲 \|  \|` 後補 `\|  \|  \|`，原列不消失 | R:43 | T "a row with one empty cell"; TR:29-39 | asserts-oracle | produces-oracle | asserts-oracle 0.89 | produces-oracle 0.33 | ✅ conforms | escalate (low confidence) |
| AC-11 | 組字中的 Enter 屬於輸入法 | 不補列，正文一個字元都沒變 | C:26, C:51 | T:182-216; IME checklist T-6 | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.68 | ✅ conforms | recheck |
| AC-12 | 片段選單與表格續列不可能同時發生 | 表格列末尾打 `/` 不會出現片段選單 | — (snippet menu not on `main`) | — | no-test | not-implemented | no-test 1.00 | not-implemented 1.00 | ❌ gap | accept |
| AC-13 | 片段選單開著時 Enter 仍然屬於選單 | Enter 讓片段落進正文，不補列 | C:45 (`Prec.high`) | T:218-226 (stand-in `Prec.highest` Enter owner) | asserts-oracle | produces-oracle | asserts-oracle 0.84 | produces-oracle 0.32 | ✅ conforms | escalate (low confidence) |
| AC-14 | 一次補列算一步 undo | 一次 undo 那一列消失，正文回到按 Enter 之前 | C:37 | T:228-266 | asserts-oracle | produces-oracle | asserts-oracle 0.77 | produces-oracle 0.33 | ✅ conforms | escalate (low confidence) |
| AC-15 | 補出來的是普通 Markdown | 補兩列並填完，預覽渲染成一張表 | C:34-40 (plain text insert); `renderPreviewHtml` | M:373-390 (body text); P:56-62 (that text renders as one table) | asserts-oracle | produces-oracle | asserts-oracle 0.88 | produces-oracle 0.51 | ✅ conforms | escalate (low confidence) |
| BR-1 | R-1 只有游標在表格列的末尾時才作用 | 列中間、非表格列的 Enter 與原本相同 | R:47-49 | T:125-180; TR:51-56 | asserts-oracle | produces-oracle | asserts-oracle 0.73 | produces-oracle 0.87 | ✅ conforms | recheck |
| BR-2 | R-2 表格列＝行首（空白與 `>`）後第一個字元是 `\|` | `\| a \|`、`  \| a \|`、`> \| a \|` 是；`- \| a \|`、`甲 \| 乙` 不是 | R:1, R:23-27 | TR:17-27 | asserts-oracle | produces-oracle | asserts-oracle 0.57 | produces-oracle 0.71 | ✅ conforms | escalate (low confidence) |
| BR-3 | R-3 欄數相同、每格空、保留行首 | 新列欄數同當前列，格皆空，縮排與引言符號保留 | R:28-32, R:50 | TR:29-39; T:77-98 | asserts-oracle | produces-oracle | asserts-oracle 0.80 | diverges 0.31 | 🔴 violation | escalate (violation) |
| BR-4 | R-4 每一格都空時移除整列並離開 | 該列移除，游標離開表格 | R:43-46 | TR:41-49; T:100-123 | asserts-oracle | produces-oracle | asserts-oracle 0.89 | produces-oracle 0.39 | ✅ conforms | escalate (low confidence) |
| BR-5 | R-5 組字中一律不作用 | 組字中不補列、不動文件 | C:26, C:51 | T:182-216 | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.89 | ✅ conforms | accept |
| BR-6 | R-6 片段選單開著時 Enter 屬於選單 | 較高優先權的 Enter 擁有者先拿到 Enter | C:45 | T:218-226 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.24 | ✅ conforms | escalate (low confidence) |
| BR-7 | R-7 一次補列或一次移除算一步 undo | 各一次 undo 復原 | C:37 | T:228-266 | asserts-oracle | produces-oracle | asserts-oracle 0.81 | produces-oracle 0.37 | ✅ conforms | escalate (low confidence) |
| BR-8 | §4 邊界：有選取範圍 → 原本的 Enter；表格列在最後一行照樣補列；只有一個 `\|` → 補 `\|  \|` | 選取被取代如前；最後一行照補；`\|` → `\|\n\|  \|` | C:26; R:30-31 | T:77-98 "a lone pipe", T:141-157; TR:29-39 | asserts-oracle | produces-oracle | asserts-oracle 0.81 | diverges 0.48 | 🔴 violation | escalate (violation) |
| NFR-1 | 輸入法：組字中按 Enter 不得動文件 | 組字中正文不變 | C:26, C:51 | T:182-216; IME checklist T-6 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.87 | ✅ conforms | accept |
| NFR-2 | undo 完整性：補列、移除各一步 | 各一次 undo | C:37 | T:228-266 | asserts-oracle | produces-oracle | asserts-oracle 0.83 | produces-oracle 0.19 | ✅ conforms | escalate (low confidence) |
| NFR-3 | 不倒退：非表格列末尾的 Enter 逐項相同 | 與無此功能的編輯器相同（含修飾鍵、選取、多游標、唯讀） | C:26, C:49-51; R:47-49 | T:61-75, T:125-180; M:392 | asserts-oracle | produces-oracle | asserts-oracle 0.88 | produces-oracle 0.79 | ✅ conforms | recheck |
| NFR-4 | 反應速度：只讀當前一行 | 判斷只用當前一行的文字 | C:29-30 (`lineAt`, `TableRow.parse(line.text)`) | — | no-test | produces-oracle | no-test 1.00 | produces-oracle 0.83 | 🟡 partial | recheck |

### Rechecks and escalations (what was found on re-reading)

- **AC-7, AC-8, BR-3, BR-8 (Jev "diverges" at 0.15 / 0.16 / 0.31 / 0.48).** Re-traced by hand and corroborated by running the mapped tests (green):
  - AC-7: `TableRow.parse("最近在選桌面框架")` → `null` (R:25), `continueRow` returns `false` (C:31), the default Enter inserts the line break. The test compares with the editor without the feature and with `M:392` (`"最近在選桌面框架\n"`).
  - AC-8: `|  |  |` has closed cells that are all whitespace (R:43), the cursor is past the first pipe, so the line is replaced by its prefix (`""`) and the cursor stays on it (R:45) — the line directly under the table, now empty. Asserted as `"| 甲 | 乙 |\n‸"`.
  - BR-3: the next row is `prefix + "|" + "  |" × cells` (R:50), with cells counted on unescaped pipes and a trailing pipe closing the last cell (R:29-31). Asserted for two/three columns, indentation, quotes, a missing closing pipe and an escaped pipe.
  - BR-8: a selection or several cursors are refused before anything else (C:26), every single-line test row is also the last line, and `|` → `|\n| ‸ |` is asserted in both T and TR.
  The shadow verdict for each is `asserts-oracle, produces-oracle`. Status is kept as the script returned it; these are listed under **Needs James**.
- **Low-confidence escalations** (AC-1…5, 9, 10, 13–15, BR-2, 4, 6, 7, NFR-2): Jev agreed with the shadow verdict on every one; only its code confidence was low. No finding on re-reading.
- **NFR-4** has no behavioural test on purpose: "only reads the current line" is a structural property (`TableRow.parse` takes one line's text and nothing else; no syntax tree, no file). A timing test would be flaky and prove nothing more.

## Orphans (code with no clause)

| Code | Description | Verdict |
|------|-------------|---------|
| C:49-50 | Only a **plain** Enter is claimed; Shift/Ctrl/Alt/Meta+Enter keep their meaning | undocumented — follows NFR "不倒退" (ARCH §8.4) |
| C:26 | Read-only editor and several cursors → default Enter | undocumented — follows NFR "不倒退" (ARCH §8.5) |
| R:2 | An escaped pipe `\|` does not split a cell | undocumented — GFM's own rule for counting columns (ARCH §8.6) |
| R:44 | On a blank row, Enter anywhere after the first pipe leaves the table (not only at the line end) | undocumented — needed by AC-9, whose second Enter is pressed with the cursor in the first cell (ARCH §8.8) |
| R:45 | Leaving keeps the row's indentation / `>` prefix on the now-empty line | undocumented — the PRD's examples are unindented; in a quote the writer stays in the quote (ARCH §8.2) |
| C:39 | `scrollIntoView` on both edits | undocumented — the same as the default Enter, keeps the cursor visible |

None of these touches an Out of Scope item (column alignment, the dashes row, Tab in tables, row deletion/moving/sorting, list/quote continuation).

## Summary

- Conforms: 21/27 clauses ✅ (78%)
- Violations: AC-7, AC-8, BR-3, BR-8 — Jev-only, low confidence; the shadow audit, a hand re-trace and the green mapped tests all show `produces-oracle` (see Rechecks)
- Mis-asserted: none
- Partial: NFR-4 (structural property, justified above)
- Gaps: AC-12 — the snippet menu does not exist on `main`; "no menu inside a table row" belongs to the snippet-templates slice, which must reuse `TableRow.parse` (recorded in PROJECT.md and ARCH §6/§8.1)
- Unclear: none
- Orphans: 6, all undocumented decisions recorded in ARCH §8, none out of scope
- Jev: ran on 27 clauses
- Needs James: AC-7, AC-8, BR-3, BR-8 (Jev "violation" at low confidence, contradicted by the re-trace); AC-12 (gap owned by the snippet-menu slice); the low-confidence escalations listed above (Jev agreed)
