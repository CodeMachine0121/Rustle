# Contract Traceability Matrix — 主題

Contract: PRD.md
Design map: ARCH.md
Implementation: `src/features/theme/`, `src/features/interfaceLanguage/SettingsDialog.tsx`, `src/app/` (App, main, app.css), `crates/domain/src/settings*`
Oracle: Acceptance Criteria (22 scenarios) + core business rules + non-functional requirements

Ceiling: a static conformance audit. Each oracle was written from the PRD before reading code; tests and code were then judged against it independently. Only the tests mapped to a clause were run as corroboration.

`Test audit` / `Code audit` are Claude's shadow verdict. `Jev test` / `Jev code` are Jev's pick with its confidence. `Status` and `Route` are as `jev_audit.py` returned. Where a clause was re-audited after a test was added or the references were completed, the row shows the final run and Notes says so.

## Clauses

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Jev test | Jev code | Status | Route |
|----|--------|------------------------|------|------|------------|------------|----------|----------|--------|-------|
| AC-1 | 打開主題選單 | The menu lists 跟隨系統, 淡色, 暗色, 森林 top to bottom; 跟隨系統 is marked in use | ThemeSetting.tsx:14-36 | SettingsDialog.test.tsx:111 | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.52 | ✅ conforms | escalate (low confidence) |
| AC-2 | 選了另一套主題，整個畫面當場換色 | Every region, and the settings panel itself, takes Forest's colours at once, no restart | ThemeSession.ts:49-104, Theme.ts:141 | App.test.tsx:1670 | asserts-oracle | produces-oracle | asserts-oracle 0.83 | produces-oracle 0.89 | ✅ conforms | recheck |
| AC-3 | 主題管到寫作區的語法上色 | Bold text and code in the editor take Forest's colours | Theme.ts:35-64 | Theme.test.ts:72 | asserts-oracle | produces-oracle | asserts-oracle 0.71 | produces-oracle 0.76 | ✅ conforms | recheck |
| AC-4 | 主題管到預覽區的引言與程式碼區 | Preview quote text and code block background take Forest's colours | Theme.ts:35-64, app.css (`.preview-content blockquote`, `pre`) | Theme.test.ts:72, :100 | asserts-oracle | produces-oracle | asserts-oracle 0.80 | produces-oracle 0.39 | ✅ conforms | escalate (low confidence) |
| AC-5 | 主題管到對話框背後那層壓暗 | The dimming behind the delete confirmation is Forest's colour | app.css:535-543 | appStyles.test.ts:83, App.test.tsx:1670 (`shade`) | asserts-oracle | produces-oracle | asserts-oracle 0.75 | produces-oracle 0.67 | ✅ conforms | recheck |
| AC-6 | 選了目前已經在用的那一套 | No colour changes | ThemeSession.ts:86-96 | ThemeSession.test.ts:137 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.84 | ✅ conforms | recheck |
| AC-7 | 主題只換顏色，不換內容 | Title, tag and body text unchanged | Theme.ts:141-145 (only `<html>` style changes) | App.test.tsx:1670 | asserts-oracle | produces-oracle | asserts-oracle 0.77 | produces-oracle 0.92 | ✅ conforms | recheck |
| AC-8 | 按 Esc 離開設定畫面，主題不變 | Settings close; theme still 跟隨系統 | SettingsDialog.tsx | SettingsDialog.test.tsx:92, :102; App.test.tsx:1789 | asserts-oracle | produces-oracle | asserts-oracle 0.35 | produces-oracle 0.44 | ✅ conforms | escalate (low confidence) |
| AC-9 | 點背後壓暗處離開設定畫面，主題不變 | Settings close; theme still 跟隨系統 | SettingsDialog.tsx | SettingsDialog.test.tsx:154 | asserts-oracle | produces-oracle | asserts-oracle 0.57 | produces-oracle 0.63 | ✅ conforms | escalate (low confidence) |
| AC-10 | 跟隨系統時，系統切暗色畫面就變暗 | Whole screen takes the dark colours | ThemeSession.ts:49-62, ThemeCatalog.ts:39 | App.test.tsx:1655, ThemeSession.test.ts:165 | asserts-oracle | produces-oracle | asserts-oracle 0.61 | produces-oracle 0.72 | ✅ conforms | recheck |
| AC-11 | 選定一套主題之後，系統的深淡色不再有發言權 | No colour changes | ThemeCatalog.ts:34-44 | ThemeSession.test.ts:175, App.test.tsx:1691 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.63 | ✅ conforms | recheck |
| AC-12 | 從來沒選過主題 | Follow System, and exactly the colours from before this feature | ThemeCatalog.ts:34-44, themes/01-light.json, 02-dark.json | Theme.test.ts:9-63, App.test.tsx:1655 | asserts-oracle | produces-oracle | asserts-oracle 0.39 | produces-oracle 0.12 | ✅ conforms | escalate (low confidence) |
| AC-13 | 記住的主題是一套 App 不認得的名字 | App starts; Follow System | ThemeCatalog.ts:34 | App.test.tsx:1710 | asserts-oracle | produces-oracle | asserts-oracle 0.89 | produces-oracle 0.88 | ✅ conforms | accept |
| AC-14 | 一套主題少說了必填的基礎色 | App starts; Forest absent from the menu; Follow System | Theme.ts:109-134, ThemeCatalog.ts:15 | ThemeCatalog.test.ts:36, Theme.test.ts:129 | asserts-oracle | produces-oracle | asserts-oracle 0.89 | produces-oracle 0.77 | ✅ conforms | recheck |
| AC-15 | 主題跨重啟記住 | After restart Forest is in use and the first frame is Forest | ThemeSession.ts:31-35, main.tsx:14, settings.rs (`theme`) | App.test.tsx:1670, :1701; settings/tests.rs:365 | asserts-oracle | produces-oracle | asserts-oracle 0.80 | produces-oracle 0.85 | ✅ conforms | recheck |
| AC-16 | 設定寫不進去，畫面照樣立刻改變 | Screen becomes Forest at once; no failure sentence | SettingsSession.ts:46-54 | App.test.tsx:1719, ThemeSession.test.ts:126 | asserts-oracle | produces-oracle | asserts-oracle 0.61 | produces-oracle 0.88 | ✅ conforms | recheck |
| AC-17 | 開啟 vault 沒有跑到最後 | The next settings write still remembers Forest | SettingsSession.ts:37-54 | App.test.tsx:1756 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.48 | ✅ conforms | escalate (low confidence) |
| AC-18 | 設定寫不進去，這次調的活不過重啟 | After restart the theme is Follow System | ThemeSession.ts:49-62 | ThemeSession.test.ts:96 | asserts-oracle | produces-oracle | asserts-oracle 0.92 | produces-oracle 0.35 | ✅ conforms | escalate (low confidence) |
| AC-19 | 專注模式下沒有齒輪 | No gear in Zen; back at the sidebar bottom afterwards | AppLayout.tsx:47-49 | App.test.tsx:1774 | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.43 | ✅ conforms | escalate (low confidence) |
| AC-20 | 每一套主題各自一份，形狀相同 | Same required base colours and optional overrides; no file depends on another | themeTemplate.json, themes/*.json | Theme.test.ts:183-205 | asserts-oracle | produces-oracle | asserts-oracle 0.36 | produces-oracle 0.55 | ✅ conforms | escalate (low confidence) |
| AC-21 | 只說基礎色的一套主題就能用 | Every colour has a value; nothing blank or carried over | Theme.ts:35-64, :109-145 | Theme.test.ts:65, :157 | asserts-oracle | produces-oracle | asserts-oracle 0.93 | produces-oracle 0.87 | ✅ conforms | accept |
| AC-22 | 加一套主題不必改動既有的四套 | Existing themes' colours unchanged; a fifth row appears | ThemeCatalog.ts:15-31 | ThemeCatalog.test.ts:43 | asserts-oracle | produces-oracle | asserts-oracle 0.32 | produces-oracle 0.87 | ✅ conforms | escalate (low confidence) |
| BR-1 | 主題是唯一的顏色來源 | No part of the app keeps its own colours | app.css (no literal colour), xcodeTheme.ts | appStyles.test.ts:68-85, xcodeTheme.test.tsx | asserts-oracle | produces-oracle | asserts-oracle 0.93 | produces-oracle 0.19 | ✅ conforms | escalate (low confidence) |
| BR-2 | 「跟隨系統」是一個持續狀態 | Every OS switch repaints while following | ThemeSession.ts:49-62 | ThemeSession.test.ts:165-184 | asserts-oracle | produces-oracle | asserts-oracle 0.91 | produces-oracle 0.51 | ✅ conforms | escalate (low confidence) |
| BR-3 | 一套主題必須說齊十四項基礎色 | Missing any → unusable, not in menu, remembered → Follow System | Theme.ts:109-134 | Theme.test.ts:129, ThemeCatalog.test.ts:36 | asserts-oracle | produces-oracle | asserts-oracle 0.11 | produces-oracle 0.57 | ✅ conforms | escalate (low confidence) |
| BR-4 | 基礎色以外可逐項覆寫，其餘由唯一一份推導規則接手 | Override wins; else the shared derivation | Theme.ts:35-64, :124-131 | Theme.test.ts:100-127 | asserts-oracle | produces-oracle | asserts-oracle 0.91 | unclear 0.49 | ❔ unclear | escalate (disagree) |
| BR-5 | 四根欄位一律不透明 | No column is transparent | app.css (no transparency) | — (nothing to build) | no-test | produces-oracle | not run | not run | 🟡 partial | — |
| BR-6 | 畫面先變、設定後寫 | An unwritable file still changes the screen | SettingsSession.ts:46-54, ThemeSession.ts:86-96 | ThemeSession.test.ts:110-135 | asserts-oracle | produces-oracle | asserts-oracle 0.91 | unclear 0.49 | ❔ unclear | escalate (disagree) |
| BR-7 | 主題只換顏色，不換內容 | = AC-7 | see AC-7 | see AC-7 | asserts-oracle | produces-oracle | see AC-7 | see AC-7 | ✅ conforms | recheck |
| NFR-1 | 輸入法 | A theme change never interrupts composition nor rebuilds the editor | Theme.ts:141-145 | App.test.tsx:1731 | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.95 | ✅ conforms | accept |
| NFR-2 | 資料安全 | No unsaved change lost; only the settings file written | ThemeSession.ts (writes only through `SettingsSession`) | App.test.tsx:1731 | asserts-oracle | produces-oracle | not run | not run | ✅ conforms (shadow) | — |
| NFR-3 | 離線 | All themes built in; nothing fetched | ThemeCatalog.ts:29 (`import.meta.glob`, eager) | ThemeCatalog.test.ts:18 | asserts-oracle | produces-oracle | not run | not run | ✅ conforms (shadow) | — |
| NFR-4 | 啟動 | No colour flash; first frame from the cache | main.tsx:14, ThemeSession.ts:31-35 | ThemeSession.test.ts:57-72, App.test.tsx:1701 | asserts-oracle | produces-oracle | asserts-oracle 0.89 | produces-oracle 0.83 | ✅ conforms | recheck |
| NFR-5 | 一致性 | One colour, one value everywhere | app.css (one token per colour) | appStyles.test.ts:68 | asserts-oracle | produces-oracle | not run | not run | ✅ conforms (shadow) | — |
| NFR-6 | 可及性 | Theme menu keyboard operable and named | ThemeSetting.tsx:14-36 | SettingsDialog.test.tsx:111-146 | asserts-oracle | produces-oracle | asserts-oracle 0.48 | produces-oracle 0.71 | ✅ conforms | escalate (low confidence) |

### Notes on rechecks and re-runs

- **AC-20, AC-21** — the first Jev run had AC-20 `unclear` (the code reference pointed at the template only) and AC-21 `shallow` ("nothing carried over" was not pinned). A test was added (`Theme.test.ts:157`, "replaces every colour of the previous theme…") and both were re-run with complete references; the rows show the second run.
- **NFR-6** — first run `shallow` (keyboard operability not pinned). A test was added (`SettingsDialog.test.tsx:135`) and re-run.
- **AC-17, AC-19, NFR-1** — no test asserted these oracles before the audit; tests were added (`App.test.tsx:1731`, `:1756`, `:1774`) before Jev ran.
- **BR-4, BR-6 (`unclear` by Jev)** — the code references passed were the derivation table / session only, not the override branch (`Theme.ts:124-131`) nor `SettingsSession.change` (replace, then write). Rechecked by reading: both paths produce the oracle, and each was falsified during implementation (the override mutant and the "repaint without write" mutant each turned a test red). Status left as the script set it.
- **Low-confidence rows** — Jev's code confidence is low where the behaviour spans several files (CSS + JSON + TS). Each was re-read; no divergence found.

## Orphans (code with no clause)

| Code | Description | Verdict |
|------|-------------|---------|
| `themes/*.json` `name: { zh, en }` | Theme names live in the theme file, not the copy catalog | undocumented in PRD (§8.5 lists the names, not where they live) — ARCH §8 decision 4 |
| `ThemeCatalog` drops a second theme with a taken id, and an id equal to `followSystem` | Guards against a broken fifth file | undocumented — robustness of the template (US-04) |
| `--color-panel`, `--color-article-list`, `--color-shade` | New tokens so a theme can reach panels, the article list and the backdrop | supports BR-1 / AC-5 |

No code implements an Out of Scope item (no reader-made themes, no transparency, no network, no preview grid).

## Accepted deviations (explicit assumptions, see ARCH §8)

- Light / Dark use today's colours, not PRD §8.3's table (§8.3 itself says today's screen is the source and must not change).
- Follow System is a menu choice resolving to the `light` / `dark` files, not a fourth file.
- No colour library: CSS `color-mix(in oklab, …)` does the mixing and darkening (PRD §7).
- PRD §8.2's status-mark and tag colours have no coloured surface in today's app; no token was added for them (they would change today's look).
- The gear stays at the sidebar bottom, per AC-1 / AC-19; PRD §5's title-bar strip belonged to the retired transparency half.
- BR-5 (no transparency) needs no code: nothing transparent was built.

## Summary

- Conforms: 32/35 clauses ✅ (91%)
- Violations: none
- Mis-asserted: none
- Partial: BR-5 (a non-feature: nothing transparent exists to test)
- Gaps: none
- Unclear: BR-4, BR-6 (Jev's `unclear` from narrow references; read and falsified as producing the oracle)
- Orphans: 3 (all supporting decisions recorded in ARCH)
- Jev: ran on 31 clauses; not run on NFR-2, NFR-3, NFR-5, BR-5, BR-7 (BR-7 duplicates AC-7; the others are structural and judged by reading)
- Needs James: BR-4, BR-6 (Jev disagreed, see notes); low-confidence escalations AC-1, AC-4, AC-8, AC-9, AC-12, AC-17, AC-18, AC-19, AC-20, AC-22, BR-1, BR-2, BR-3, NFR-6 (agreed verdicts, low Jev code confidence on multi-file paths)
