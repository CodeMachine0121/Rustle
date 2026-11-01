# 寫作區的記號與強調 — Architecture Design

**Status:** Confirmed (decided autonomously; the user was away — every judgement call is listed in §8)
**Source PRD:** `.sdd/2026-08-22-editing-surface-marks-and-emphasis/PRD.md`
**Tech context:** Tauri 2 · TypeScript strict + React + CodeMirror 6 (`@codemirror/view 6.43.15`, `state 6.7.6`, `commands 6.11.1`, `language 6.13.1`, `lang-markdown 6.5.2`) · Vitest + happy-dom. Webview-only: no Rust crate, channel or setting changes.

---

## 1. Design Goal & Guiding Principle

- **In one sentence:** the writing surface colours heading text apart from the body (computed from a purple, overridable by a token), stops painting the cursor-line background while a selection exists, toggles `**bold**` / `*italic*` on Mod-B / Mod-I (word under the cursor, empty pair on nothing, never across lines, in code, in read-only, or while composing), and pins Markdown's own task-list continuation with tests.
- **Guiding principle:** *one deep value object per rule, one key owner per key.* `InlineEmphasis` holds every rule of "what does toggling emphasis do here" behind one call (`toggle(state)`); `EmphasisShortcuts` only owns the two keys (composition, read-only, history). Colours stay in CSS tokens so a later theme system overrides them without touching TypeScript.

---

## 2. Change Scope

| Area | Action | What / Why |
| :--- | :--- | :--- |
| `src/features/editor/InlineEmphasis.ts` | **Add** | Value object (`InlineEmphasis.bold`, `InlineEmphasis.italic`): `toggle(state): TransactionSpec \| null` — the whole toggle decision over the editor state and its Markdown syntax tree |
| `src/features/editor/EmphasisShortcuts.ts` | **Add** | Key owner: `Prec.high` keymap for `Mod-b` / `Mod-i`; refuses while composing, eats the key when read-only or when `toggle` has nothing to do, dispatches one isolated undo step |
| `src/features/editor/cursorLineHighlight.ts` | **Add** | `cursorLineHighlight()` extension: a line decoration (`cm-cursorLine`) on lines holding a cursor, drawn only while no selection range is non-empty |
| `src/features/editor/writingSurfaceHighlightStyle.ts` | **Add** | `HighlightStyle`: heading text → `var(--color-editor-heading, var(--color-editor-heading-fallback))`; Markdown marks (`#`, `*`, `>`: `tags.processingInstruction`) → the quiet colour `defaultHighlightStyle` already gives them, restated after the heading rule (this style is mounted after the default one, so without it the `#` of a heading would take the heading colour). Strong/emphasis get **no colour** |
| `src/features/editor/MarkdownEditor.tsx` | **Modify** | Installs the three extensions; removes `Mod-i` (`selectParentSyntax`) from the default keymap it installs |
| `src/app/app.css` | **Modify** | Light/dark `--color-editor-heading-fallback` (purple) and `--color-cursor-line`; `.cm-cursorLine` rule |
| `src/features/editor/TaskListContinuation.test.tsx` | **Add (test only)** | Pins `markdown()`'s `insertNewlineContinueMarkup` on task items next to plain and ordered lists |
| `docs/ime-regression-checklist.md` | **Modify** | Steps for Mod-B / Mod-I and Enter on a task item while composing (still 12 items) |
| Snippet menu / task-item snippet | **Not touched — does not exist on `main`** | The snippet-templates slice is not merged; see §8.1 |
| Theme system / Xcode palette | **Not touched — does not exist on `main`** | Tokens are the seam those slices plug into; see §8.2 |
| Preview, Rust crates, settings | **Not touched** | PRD §5: no setting, no I/O; preview already renders task lists |

---

## 3. New Classes / Modules

| Name | Kind | Responsibility (purpose) | Collaborators | Satisfies (PRD scenario) |
| :--- | :--- | :--- | :--- | :--- |
| `InlineEmphasis` | Value object (two instances: marker `**` / `*`, syntax node `StrongEmphasis` / `Emphasis`) | Decide what toggling this emphasis does to the main selection: `null` when nothing may change (several lines, inside code, a selection of only marks/whitespace), otherwise one transaction spec that wraps, unwraps, or drops an empty pair, maps every other range through the change | `EditorState` (`wordAt`, `doc`), `syntaxTree` | US-05 all; US-06 undo / multi-range |
| `EmphasisShortcuts` | Key owner (one per editor) | Own `Mod-b` / `Mod-i`: not claimed while composing (the input method's key); eaten without change when read-only or when `toggle` returns `null`; otherwise dispatched with `isolateHistory "full"` | `InlineEmphasis`, `CompositionState` | US-05; US-06 組字中, undo |
| `cursorLineHighlight` | Extension (`EditorView.decorations.compute` over `doc` and `selection`) | Paint the "cursor is here" background on cursor lines only while every selection range is empty | `EditorView` | US-02 all |
| `writingSurfaceHighlightStyle` | `HighlightStyle` | Heading text colour (derived purple unless a theme sets `--color-editor-heading`), the existing quiet colour kept on marks, nothing for bold/italic | CSS tokens | US-01 all |

`InlineEmphasis.toggle` decision table (main range only, offsets in its line):

| Situation | Result |
| :--- | :--- |
| Range spans two lines | `null` (nothing) |
| Either end inside `InlineCode`, `FencedCode` or `CodeBlock` | `null` |
| Empty range inside a word (`state.wordAt`, the same grouping as a double click) | treat the word as the selection |
| Empty range with no word (empty line, space, punctuation) | insert `**` `**` (or `*` `*`), cursor between |
| Non-empty range whose text is only marks/whitespace | `null` |
| Trimmed content is exactly the content of a matching emphasis node (asterisk or underscore, found in the syntax tree — so flanking rules are the parser's) | remove both mark runs |
| Trimmed content is exactly the content of one emphasis node that fills a matching node (`***x***` is italic around bold) | remove the outer node's mark runs |
| Exact `_`/`__` runs on both sides that the tree does not see as emphasis (underscores between letters, e.g. `這是__重點__的地方`), neither run touching another `_` or a Latin letter or digit | re-parse that line with every `_` read as `*`; remove both runs only when that parse pairs them around exactly this content, so a neighbouring run (`__甲__乙__丙__`) or a name (`my_var_name`) is never taken |
| Range covers a whole matching emphasis node including its marks | remove both mark runs |
| Otherwise | wrap the trimmed content (whitespace stays outside), selection keeps the content |

---

## 4. Modified Components

| Component | Current role | Change needed |
| :--- | :--- | :--- |
| `MarkdownEditor` (`editorExtensions`) | Builds the extension list | Adds `EmphasisShortcuts`, `cursorLineHighlight()`, `syntaxHighlighting(writingSurfaceHighlightStyle)`; installs `defaultKeymap` without its `Mod-i` binding |
| `app.css` | Light/dark colour tokens | Two tokens per scheme + the `.cm-cursorLine` rule |

---

## 5. Component Relationships

```mermaid
flowchart LR
  Editor[MarkdownEditor] --> ES[EmphasisShortcuts]
  ES --> IE[InlineEmphasis.bold / .italic]
  IE --> Tree[syntaxTree + wordAt]
  ES --> CS[CompositionState]
  Editor --> CLH[cursorLineHighlight]
  Editor --> HS[writingSurfaceHighlightStyle]
  HS --> Tokens[(CSS tokens in app.css)]
  Editor --> MD[markdown(): list / task continuation]
```

---

## 6. Extensibility & Handoff Notes

- **Most likely next requirement:** more inline shortcuts (inline code, strikethrough, link).
- **Where it lands:** another `InlineEmphasis` instance (marker + node name) and one more binding in `EmphasisShortcuts`; the trimming, word, code and multi-range rules are shared.
- **Theme system (next slice):** a theme sets `--color-editor-heading` to override; leaving it out falls back to `--color-editor-heading-fallback`. A theme that wants the cursor-line colour sets `--color-cursor-line`.
- **Task-item snippet:** when the snippet menu lands, a snippet declares whether it owns a whole line (R-8); the task item is `- [ ] ` with the cursor at its end. Nothing here needs to change.
- **Do not hardcode:** colours anywhere but `app.css`; precedence only in `EmphasisShortcuts.extension`.
- **Known debt:** none beyond §8.

---

## 7. Traceability

| PRD Scenario | Fulfilled by |
| :--- | :--- |
| US-01 標題文字不是正文的顏色 | `writingSurfaceHighlightStyle` (heading) |
| US-01 井號本身維持它原本的安靜顏色 | `writingSurfaceHighlightStyle` (`processingInstruction`) |
| US-01 六級標題是同一個顏色 | one rule on `tags.heading` (parent of `heading1..6`) |
| US-01 一套只交代了自己顏色的主題也拿得到標題色 | `var(--color-editor-heading, fallback)` + purple fallback token |
| US-01 粗體只是比較粗 / 斜體只是斜的 | `writingSurfaceHighlightStyle` has no colour on `strong` / `emphasis` |
| US-01 沒有記號的正文不受影響 | no rule on plain text |
| US-02 all five | `cursorLineHighlight` + CodeMirror's selection layer |
| US-03 空行上叫出一個任務項 | **deferred** to the snippet menu (§8.1) |
| US-03 打名字的開頭就縮到它 | **deferred** to the snippet menu (§8.1) |
| US-03 一行已經有字時，任務項另起一行 | **deferred** to the snippet menu (§8.1) |
| US-03 標題片段維持原本的行為 | **deferred** to the snippet menu (§8.1) |
| US-03 表格格子裡叫不出來 | **deferred** to the snippet menu (§8.1); its gate reuses `TableRow.parse` |
| US-03 程式碼區裡叫不出來 | **deferred** to the snippet menu (§8.1) |
| US-04 all eight | `markdown()` (upstream), pinned by `TaskListContinuation.test.tsx` |
| US-05 選取的字變粗體 / 選取的字變斜體 | `InlineEmphasis.toggle` (wrap) via `EmphasisShortcuts` |
| US-05 再按一次拿掉粗體 / 再按一次拿掉斜體 | `InlineEmphasis.toggle` (unwrap, syntax-tree match) |
| US-05 別人用底線寫的粗體也拿得掉 | `InlineEmphasis.toggle` (the tree node covers `__` too; between letters the line is re-read with `_` as `*`) |
| US-05 沒有選取時，加粗游標所在的那個詞 | `InlineEmphasis.toggle` (`state.wordAt`) |
| US-05 中文沒有空白分詞… | `InlineEmphasis.toggle` (`state.wordAt`, same grouping as a double click) |
| US-05 空行上按下去，落下一對空記號 / 空記號落下之後打的字就是粗體 | `InlineEmphasis.toggle` (empty pair, cursor between) |
| US-05 跨行的選取什麼都不做 | `InlineEmphasis.toggle` → `null`; `EmphasisShortcuts` eats the key, selection untouched |
| US-05 斜體的快速鍵不再把整個結構選起來 | `MarkdownEditor` drops `Mod-i` from `defaultKeymap`; `EmphasisShortcuts` at `Prec.high` |
| US-06 組字中按粗體／斜體 | `EmphasisShortcuts` composition guard + IME checklist |
| US-06 組字中在任務項上按換行鍵 | CodeMirror does not run keymaps for composing keys; pinned in `TaskListContinuation.test.tsx`; IME checklist T-6 |
| US-06 一次加粗算一步 undo | `isolateHistory "full"` |
| US-06 一次長出任務項算一步 undo | upstream; pinned by test |
| US-06 縮排鍵沒有被搶走 / 表格續列沒有被搶走 | untouched owners; existing tests + an integration test through `MarkdownEditor` |
| US-06 片段選單開著時換行鍵仍然屬於選單 | **deferred** with the snippet menu (§8.1); the menu's `Prec.highest` Enter runs before `markdown()`'s `Prec.high` continuation |
| US-06 每一套主題都還能用 / 寫作區以外的顏色沒有變 | tokens only add, nothing else in `app.css` changes |
| US-06 落下的任務項是普通 Markdown | `renderPreviewHtml` (existing) — test |

---

## 8. Risks & Open Decisions

Decisions taken without the user (also in the PR under "Assumptions"):

1. **The snippet menu does not exist on `main`.** US-03 (task-item snippet, "整行才成立的形狀另起一行") and the US-06 menu-Enter scenario cannot be built without first building the whole snippet-templates slice, which is its own branch. Deferred to that slice: the snippet is `Checkbox` → `- [ ] `, last in the menu, owns a whole line.
2. **No theme system and no Xcode palette on `main`.** The PRD's "today's quiet colour for `#`" and "the cursor-line background as before" presuppose them. On `main`, marks already have a quiet colour (`defaultHighlightStyle`'s `meta` colour), which this slice keeps; it adds the one thing missing, a cursor-line background that yields to a selection. The heading colour is `var(--color-editor-heading, var(--color-editor-heading-fallback))` — a theme overriding `--color-editor-heading` is R-1's "a theme may specify it"; the fallback is a purple chosen per scheme (R-2). When the theme slice lands it maps its own colours onto these tokens.
3. **Emphasis rules live in the syntax tree.** "Is this already bold" = a `StrongEmphasis` / `Emphasis` node whose inner content equals the trimmed selection (R-22's flanking rules come from the parser). Selecting the whole node including its marks also unwraps.
4. **A selection of only whitespace** is treated like a selection of only marks: nothing happens.
5. **While composing the keys are not claimed** (like Enter in `TableRowContinuation`), so the input method keeps them; since `Mod-i` is removed from the default keymap and `Mod-b` was never bound, nothing in the editor acts on them.
6. **`wordAt`** is used for "the word under the cursor": it is the same Word-category grouping a double click uses when the cursor is inside a word (R-13 as tightened).
- **Risks / trade-offs:** the parallel editing-surface-and-view-modes slice may also add a cursor-line highlight or palette; whichever merges second keeps `cursorLineHighlight` (it is the one that yields to a selection).
