# Contract Traceability Matrix — 寫作區與預覽區各自的字體大小

Contract: PRD.md
Design map: ARCH.md
Implementation: `src/features/fontSize/`, `src/features/editor/MarkdownEditor.tsx`, `src/features/preview/PreviewPanel.tsx`, `src/app/AppLayout.tsx`, `src/app/App.tsx`, `src/app/app.css`, `crates/domain/src/settings*`
Oracle: Acceptance Criteria (30 scenarios, AC-1…AC-30 in PRD order) plus the core business rules and NFRs that are not already a scenario

Static conformance audit: tests and code paths were judged against the PRD's expected outcome, not by running the suite. `Test audit` / `Code audit` are Claude's shadow verdict (recorded before Jev); `Jev test` / `Jev code`, `Status` and `Route` are as returned by `jev_audit.py`. Abbreviations: `O` = `src/features/fontSize/EditingSurfaceFontSizes.ts`, `OT` = its test, `FS` = `FontSize`, `ZG` = `ZoomGesture`.

## Clauses

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Jev test | Jev code | Status | Route |
|----|--------|------------------------|------|------|------------|------------|----------|----------|--------|-------|
| AC-1 | US-01 放大寫作區 | 寫作區變大一級；預覽區不變 | O:62-69, O:116-125 | OT "zooms the editor under the pointer…" | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.48 | ✅ conforms | escalate (low confidence) |
| AC-2 | US-01 放大預覽區 | 預覽區變大一級；寫作區不變 | O:62-69 | OT "zooms the preview under the pointer…" | asserts-oracle | produces-oracle | asserts-oracle 0.92 | unclear 0.56 | ❔ unclear | escalate (disagree) |
| AC-3 | US-01 兩塊各自記著自己的大小 | 預覽區縮小；寫作區仍是放大後的大小 | O:112-125 | OT "keeps each surface's own size" | asserts-oracle | produces-oracle | asserts-oracle 0.95 | unclear 0.43 | ❔ unclear | escalate (disagree) |
| AC-4 | US-01 手勢落在別的欄位上 | 兩塊都不變；整個畫面不縮放 | O:62-84, O:157-163 | OT "zooms nothing, not even the page, over the sidebar" | asserts-oracle | produces-oracle | asserts-oracle 0.31 | produces-oracle 0.47 | ✅ conforms | escalate (low confidence) |
| AC-5 | US-02 滑鼠滾一格 | 寫作區明顯變大一點 | ZG:23-28 | ZG "makes a mouse notch about two thirds larger"; OT AC-1 test | asserts-oracle | produces-oracle | asserts-oracle 0.57 | unclear 0.52 | ❔ unclear | escalate (disagree) |
| AC-6 | US-02 觸控板捏一次 | 每個事件都讓字變大、無跳格；一次捏合 ≈ 一格滑鼠的量級 | ZG:23-48, O:75-78 | ZG pinch tests; OT "grows with every event of a pinch, not in jumps" | asserts-oracle | produces-oracle | asserts-oracle 0.67 | produces-oracle 0.64 | ✅ conforms | recheck |
| AC-7 | US-02 往回做一次就回到原點 | 回到原本大小 | FS:32-35 | FS "comes back to where it started…"; OT "comes back to the starting size…" | asserts-oracle | produces-oracle | shallow 0.24 | produces-oracle 0.33 | 🟠 mis-asserted | escalate (disagree) |
| AC-8 | US-02 頂到邊界之後往回做 | 不回到推之前的大小 | FS:20-35 | FS "spends the travel pushed against the maximum" | asserts-oracle | produces-oracle | asserts-oracle 0.84 | produces-oracle 0.83 | ✅ conforms | recheck |
| AC-9 | US-02 沒按 Cmd 或 Ctrl 就滾滾輪 | 字體大小不變；照常捲動 | ZG:23-28, O:62-66 | ZG "leaves a wheel without Cmd or Ctrl…"; OT "leaves a plain wheel to scrolling" | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.97 | ✅ conforms | accept |
| AC-10 | US-02 整個畫面不跟著縮放 | 只有寫作區的字變大；側欄、按鈕、欄寬不變 | O:62-69, AppLayout.tsx:108 | OT "keeps the page from zooming…"; App "zooms only the preview article…"; AppLayout "marks the editor and the preview…" | asserts-oracle | produces-oracle | mis-asserted 0.28 | produces-oracle 0.35 | 🟠 mis-asserted | escalate (disagree) |
| AC-11 | US-03 已經最小還繼續縮 | 仍是最小，不繞回最大 | FS:20-35 | FS "stays at the minimum…"; OT "stays at the smallest and the largest size" | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.77 | ✅ conforms | recheck |
| AC-12 | US-03 已經最大還繼續放 | 仍是最大 | FS:20-35 | FS "stays at the maximum…"; OT same | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.68 | ✅ conforms | recheck |
| AC-13 | US-03 設定檔裡手寫了一個荒謬的大數字 | 開在最大值，與一路放到底相同 | FS:20-25, O:112-114, stored_settings.rs | FS "opens a hand-written absurd size…"; OT "opens with the remembered sizes, clamped…"; Rust `reads_the_written_font_sizes_as_written` | asserts-oracle | produces-oracle | asserts-oracle 0.93 | produces-oracle 0.64 | ✅ conforms | recheck |
| AC-14 | US-03 設定檔裡手寫的不是數字 | 開在預設字體大小 | stored_settings.rs (`Tolerant<f64>` → `None`), FS:20-25 | Rust `reads_a_font_size_that_is_not_a_number_as_no_opinion`; OT "opens at the default…" | asserts-oracle | produces-oracle | asserts-oracle 0.39 | produces-oracle 0.48 | ✅ conforms | escalate (low confidence) |
| AC-15 | US-04 放回預設 | 寫作區回到預設 | O:86-93, O:127-133 | OT "puts the editor back with Ctrl+0 too", "puts the hovered surface back…" | asserts-oracle | produces-oracle | asserts-oracle 0.53 | produces-oracle 0.76 | ✅ conforms | escalate (low confidence) |
| AC-16 | US-04 只放回指標所在的那一塊 | 預覽區回預設；寫作區維持 | O:86-93, O:127-133 | OT "puts the hovered surface back…"; App "opens the preview at its remembered size and puts it back…" | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.47 | ✅ conforms | escalate (low confidence) |
| AC-17 | US-04 已經是預設值 | 什麼都沒變 | O:127-133 | OT "does nothing on Cmd+0 when the surface is already at the default" | asserts-oracle | produces-oracle | asserts-oracle 0.89 | produces-oracle 0.96 | ✅ conforms | accept |
| AC-18 | US-04 組字中的那一次按鍵屬於輸入法 | 大小不變；按鍵留給輸入法 | O:86-93 (`ownsKey`) | OT "leaves Cmd+0 to the input method while it composes" | asserts-oracle | produces-oracle | asserts-oracle 0.87 | produces-oracle 0.75 | ✅ conforms | recheck |
| AC-19 | US-05 跨重啟記住 | 重開後仍是放大兩級的大小 | O:140-155, O:112-114; Rust settings round trip | OT "writes a gesture once it is over…"; infra `reads_back_what_it_wrote`; App remembered-size test | asserts-oracle | produces-oracle | asserts-oracle 0.61 | produces-oracle 0.52 | ✅ conforms | escalate (low confidence) |
| AC-20 | US-05 兩塊各自被記住 | 預覽區縮小一級；寫作區預設 | O:140-155; settings.rs `FontSizeSettings` | OT "opens with the remembered sizes…", "opens at the default…"; Rust `writes_only_the_font_sizes_it_has` | asserts-oracle | produces-oracle | asserts-oracle 0.88 | produces-oracle 0.67 | ✅ conforms | recheck |
| AC-21 | US-05 設定檔完全讀不到 | 兩塊預設；放大生效；不寫檔（活不過重啟） | O:112-125; SettingsSession `#wasRead` | OT "keeps the zoom on screen when the settings could not be read…" | asserts-oracle | produces-oracle | asserts-oracle 0.27 | produces-oracle 0.48 | ✅ conforms | escalate (low confidence) |
| AC-22 | US-05 設定檔寫不進去 | 字照樣變大 | O:116-125 | OT "keeps the zoom on screen when the settings cannot be written" | asserts-oracle | produces-oracle | asserts-oracle 0.64 | produces-oracle 0.91 | ✅ conforms | recheck |
| AC-23 | US-05 不順手改掉別的偏好 | 分隔線、預覽開關、上次開的文章都沒變 | O:140-155 | OT "writes a gesture once it is over… keeping every other setting", "puts the hovered surface back…" (whole written settings compared) | asserts-oracle | produces-oracle | asserts-oracle 0.40 | produces-oracle 0.59 | ✅ conforms | escalate (low confidence) |
| AC-24 | US-06 標題跟著基準字體走 | 三者等比例變大；h1 > h2 > 內文 | app.css:403-426, PreviewPanel.tsx:62 | appStyles "sizes the preview's %s relative to the article…", "keeps the preview's headings larger…" | asserts-oracle | produces-oracle | shallow 0.25 | produces-oracle 0.80 | 🟠 mis-asserted | escalate (disagree) |
| AC-25 | US-06 引言、程式碼與表格也跟著 | 三者都變大，沒有一塊留在原地 | app.css (`code` 0.9em, `table` 1em, blockquote inherits) | appStyles same tests, "never fixes … px/rem inside .preview-content" | asserts-oracle | produces-oracle | asserts-oracle 0.40 | produces-oracle 0.13 | ✅ conforms | escalate (low confidence) |
| AC-26 | US-06 只有預覽區 | 側欄與文章清單完全不變 | PreviewPanel.tsx:62 | App "zooms only the preview article, never the sidebar, the article list or the page" | asserts-oracle | produces-oracle | asserts-oracle 0.77 | produces-oracle 0.60 | ✅ conforms | recheck |
| AC-27 | US-07 打到一半的東西不受影響 | 字一個沒少；游標原處；復原可退回 | MarkdownEditor.tsx:99-106 | MarkdownEditor "resizes in place, keeping unsaved text, the cursor and the undo history" | asserts-oracle | produces-oracle | asserts-oracle 0.92 | unclear 0.24 | ❔ unclear | escalate (disagree) |
| AC-28 | US-07 字變大之後游標與捲動仍然對得上 | 游標與捲動無錯位 | MarkdownEditor.tsx:105 (`requestMeasure`) | MarkdownEditor same test (spies the re-measure) | shallow | produces-oracle | asserts-oracle 0.73 | produces-oracle 0.88 | ✅ conforms | escalate (disagree) |
| AC-29 | US-07 兩邊字體大小不同時捲動同步照舊 | 另一邊跟到對應的那一行 | ScrollSynchronizer / panes (untouched, line based) | — | no-test | produces-oracle | no-test 1.00 | produces-oracle 0.84 | 🟡 partial | recheck |
| AC-30 | US-07 組字中的手勢不屬於輸入法 | 字體變大；組字不被打斷 | O:75-78 (no composition check) | OT "zooms while the input method is composing…"; MarkdownEditor "resizes while the input method is composing" | asserts-oracle | produces-oracle | asserts-oracle 0.96 | unclear 0.45 | ❔ unclear | escalate (disagree) |
| BR-1 | 預設 15px，範圍 10–28px，兩塊共用 | 15 / 10 / 28 for both | FS:9-11 | FS "is fifteen pixels by default, between ten and twenty-eight" | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-2 | 夾住的規則只有一個地方在管 | gesture, settings and reset all through one rule | FS:20-35 (Rust does no arithmetic) | FS "opens a hand-written absurd size…" | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-3 | 字體大小精細到十分之一像素；捨入只在寫檔時 | stored 17.34 → 17.3; live value unrounded | FS:37-39, O:140-155 | FS "is kept in the settings to a tenth of a pixel"; OT write test | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| BR-4 | 放回預設用寫死的 Cmd/Ctrl+0 | Cmd+0 and Ctrl+0 only | O:86-93 | OT Cmd+0 / Ctrl+0 tests, "…0 alone without Cmd or Ctrl" | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| NFR-1 | 連續的手勢不得每一步都寫檔——一次手勢一次寫檔 | 30 events → one write after the gesture | O:116-125 | OT "writes a gesture once it is over…" (`toHaveBeenCalledTimes(1)`) | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |
| NFR-2 | 縮放不得重建寫作區 | same `EditorView` before and after | MarkdownEditor.tsx:99-106 | MarkdownEditor "resizes in place…" (`findFromDOM` is the same view) | asserts-oracle | produces-oracle | not run | not run | ✅ conforms | — |

### Notes on the escalated rows

- **AC-2, AC-3, AC-5, AC-27, AC-30 (Jev code `unclear`, < 0.6)** — re-read: each path is a direct call chain (`onWheel`/`onPinchChange` → `#scale` → `FontSize.scaledBy` → listeners; the font size effect only touches `view.dom.style` and `requestMeasure`). The mapped tests were run and pass. Kept as the script set them; the shadow verdict is `produces-oracle`.
- **AC-7** — the tests assert the return within 1e-10 px (`toBeCloseTo`), which is "exactly" for a size shown in pixels; floating point cannot promise bit equality for an arbitrary ratio and its reciprocal.
- **AC-10, AC-24, AC-26** — strengthened during this run: an App test now pins that a zoom is `preventDefault`ed and that only the editor root and the preview article ever carry a font size (AC-10, AC-26). AC-24 is pinned at the stylesheet level (headings in decreasing `em` above 1, nothing in `px`/`rem` under `.preview-content`); the test environments (happy-dom / jsdom) do no layout, so computed pixel sizes cannot be asserted. Manual check: release checklist.
- **AC-28** — the cursor and scroll positions are layout results; the test pins the cause (re-measure on every size change, the editor kept). Manual check: release checklist.
- **AC-29 (assumption)** — no automated test: the scroll sync maps body lines and takes no font size input, and the preview pane re-measures its blocks on every call; asserting it needs a real layout engine. Manual check: release checklist.

## Orphans (code with no clause)

| Code | Description | Verdict |
|------|-------------|---------|
| `ZoomGesture` `deltaMode` lines/pages | a wheel reported in lines or pages is converted to pixels | undocumented, supports US-02 on devices that do not report pixels |
| `EditingSurfaceFontSizes.dispose` | writes a gesture still waiting when the app unmounts | undocumented, supports US-05 |

No orphan implements an Out of Scope item (no settings field for a number, no interface zoom, no font family, no per-article size).

## Summary

- Conforms: 26/36 clauses ✅ (72%) — 21 of the 30 scenarios plus all 6 rules/NFRs
- Violations: none
- Mis-asserted: AC-7, AC-10, AC-24 (Jev, low confidence; see notes — assertions are at the limit of a layout-free test environment)
- Partial: AC-29 (justified assumption, manual check)
- Gaps: none
- Unclear: AC-2, AC-3, AC-5, AC-27, AC-30 (Jev code `unclear`; re-read and mapped tests run green)
- Orphans: 2 (benign)
- Jev: ran on 30 scenarios (AC-10, AC-24, AC-26 re-run after the strengthening test)
- Needs James: AC-1, AC-4, AC-14, AC-15, AC-16, AC-19, AC-21, AC-23, AC-25 (low confidence); AC-2, AC-3, AC-5, AC-7, AC-10, AC-24, AC-27, AC-28, AC-30 (disagree)
