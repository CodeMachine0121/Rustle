# Vim 模式 — Architecture Design

**Status:** Confirmed (decided autonomously; the user was away — every judgement call is listed in §8)
**Source PRD:** `.sdd/2026-08-26-vim-mode/PRD.md`
**Tech context:** Tauri 2 · Rust workspace (`rustle-domain` settings only) · TypeScript strict + React 19 + CodeMirror 6 (`@codemirror/view 6.43.15`, `state 6.7.6`, `commands 6.11.1`, `lang-markdown 6.5.2`) · new: `@replit/codemirror-vim 6.4.0` (+ its peer `@codemirror/search 6.7.2`), both pinned exactly · Vitest + happy-dom. No channel, command, capability or crate added.

---

## 1. Design Goal & Guiding Principle

- **In one sentence:** a per-vault `vimMode` setting (absent = off) turns the existing single `EditorView` into a modal editor driven by `@replit/codemirror-vim`; the current mode (`NORMAL` / `INSERT` / `VISUAL`) is published to the middle of the save status line without re-rendering the editor; every key Rustle owns keeps running **before** Vim, the editor's stock keymap (and Markdown's) runs **after** Vim and only in Insert mode; Esc becomes one ladder (snippet menu → fields → back to Normal → leave Zen), and the old "Esc then Tab leaves the editor" route is removed.
- **Guiding principle:** *one ordering, decided in one place.* Key precedence is the whole risk of this slice (PRD §7). Instead of listing exceptions key by key, the design fixes three bands and puts each binding in exactly one:

  | Band | Who | How it is ordered |
  | :--- | :--- | :--- |
  | 1. Rustle's keys | Tab/Shift+Tab and the snippet Esc claims (`TabIndentation`, capture listener), snippet menu (`Prec.highest`), table Enter, Mod-b/i, Mod-w (`Prec.high`), undo/redo (`historyKeymap`) | the editor's normal keymap handler, untouched |
  | 2. Vim | `vim()` (its own Esc: Insert/Visual → Normal; Normal leaves Esc alone) | installed at `Prec.low`, so its keydown handler runs after band 1 |
  | 3. Typing keys | `defaultKeymap` (minus `Mod-i`) and `markdownKeymap` | with Vim on they move to a private keymap *scope* run by a `Prec.lowest` handler: Insert mode runs them exactly as before, Normal/Visual swallow them so nothing falls through to an edit (PRD §4 rule 4) |

  With Vim off, band 3 is the very same `keymap.of(...)` at its old position, so the editor is identical to today.

---

## 2. Change Scope

| Area | Action | What / Why |
| :--- | :--- | :--- |
| `package.json` / `pnpm-lock.yaml` | **Modify** | `@replit/codemirror-vim 6.4.0`, `@codemirror/search 6.7.2` (peer), exact pins (`dependencyPins.test.ts` already enforces) |
| `crates/domain/src/settings.rs` + `settings/stored_settings.rs` | **Modify** | `Settings.vim_mode: bool` (default `false`, serialised as `vimMode` only when `true`); stored shape `Tolerant<bool>` so any non-boolean reads as off |
| `src/ipc/settings.ts` | **Modify** | `vimMode?: boolean` |
| `src/features/vim/VimModeSession.ts` | **Add** | App-wide owner of "is Vim on" (read from / written to `SettingsSession`) and "which mode is the editor in" (reported by the editor); subscribable |
| `src/features/vim/VimEditing.ts` | **Add** | The CodeMirror side: installs Vim and the three bands, reports mode changes, holds the Insert→Visual rule and keeps keys the input method owns in Insert mode away from Vim, reconfigures in place when the setting flips |
| `src/features/vim/VimModeLabel.tsx` | **Add** | `NORMAL` / `INSERT` / `VISUAL` (never translated); renders nothing when Vim is off |
| `src/features/vim/VimModeSetting.tsx` | **Add** | The settings row: a `role="switch"` button under 語言 and 主題 |
| `src/features/editor/MarkdownEditor.tsx` | **Modify** | Props `vimEnabled?`, `onVimModeChange?`; builds one `VimEditing` per editor; `markdown({ addKeymap: false })` and both stock keymaps go through `vimEditing.typingKeys(...)`; flipping `vimEnabled` dispatches `vimEditing.switchTo(...)` (no new state, undo kept) |
| `src/features/editor/TabIndentation.ts` | **Modify** | Esc only asks the `indentationKeyClaims`; the "Esc then Tab within two seconds lets focus leave" route is deleted (PRD US-06). Tab is always indentation |
| `src/features/autosave/AutosavedEditor.tsx`, `SaveStatusLine.tsx`, `src/features/vault/EditorColumn.tsx` | **Modify** | Thread an optional `vimModes: VimModeSession`; the status line gets a middle slot for `VimModeLabel` |
| `src/features/writingLayout/WritingLayout.ts`, `useWritingLayout.ts` | **Modify** | `leaveZen()`; a window **bubble-phase** Esc listener that leaves Zen only when nobody earlier took the key (`defaultPrevented`) and no input method owns it |
| `src/features/interfaceLanguage/SettingsDialog.tsx`, `SettingsEntry.tsx`, `messages.ts` | **Modify** | One more `settings-item` section; copy `vimMode` (「Vim 模式」/ "Vim Mode") |
| `src/app/App.tsx`, `src/app/app.css` | **Modify** | Build one `VimModeSession`; pass it to the editor column and the settings; middle-slot CSS (label never shrinks, the workspace part of the path shrinks first) |
| `docs/ime-regression-checklist.md` | **Modify** | The Vim steps join existing items (Esc while composing in Insert, typing Chinese in Insert) — the item count the test pins does not change |
| `.sdd/PROJECT.md` | **Modify** | New dependency and the Vim seam |
| Preview, finders, sidebar, dialogs, Rust commands/channels | **Not touched** | Vim lives only in the writing surface (PRD out of scope); every dialog already `preventDefault`s its own Esc, so the Zen rung never steals it |
| Vim's command line `:` and search `/ n N` | **Not touched** | Out of scope. Vim's `:` opens nothing visible beyond the library's own panel; no ex commands are registered |

---

## 3. New Classes / Modules

| Name | Kind | Responsibility (purpose) | Collaborators | Satisfies (PRD scenario) |
| :--- | :--- | :--- | :--- | :--- |
| `VimModeSession` | Session (one per app, like `ThemeSession`) | Own "Vim on/off" as the settings say (`settings.vimMode === true`) and the last reported mode; `setEnabled(on)` writes through `SettingsSession.change`; `mode` is `null` while off, and is reset to `normal` whenever Vim turns on | `SettingsSession` | US-01 all, US-03 標籤 |
| `VimEditing` | Editor integration (one per `MarkdownEditor`) | Turn the Vim setting into extensions: band 2 (`Prec.low(vim())`), band 3 slots (`typingKeys(bindings)` → a compartment per binding list), the mode tracker (`reportModesTo`), the Insert→Visual rule and the input-method guard; `switchTo(enabled)` → reconfigure effects | `@replit/codemirror-vim` (`vim`, `getCM`, `Vim`), `CompositionState` | US-01 立即生效, US-02 all, US-04 all, US-05 rung 3 |
| `VimModeLabel` | Component | Show the session's mode in upper case; nothing when off | `VimModeSession` | US-03 all |
| `VimModeSetting` | Component | The switch in the settings dialog | `VimModeSession`, `useMessages` | US-01 打開／關掉 |

`VimEditing` decisions:

| Situation | Behaviour |
| :--- | :--- |
| Vim on, Esc, Insert or Visual (after the snippet menu and fields: their claims `preventDefault`, so Vim never sees that Esc) | Vim's own Esc → Normal (Visual drops its selection); key taken |
| Vim on, Esc, Normal | Vim does not take it and band 3 drops its Esc binding, so it reaches the Zen rung |
| A key the input method owns (composing, `isComposing`, key code 229) while in Insert mode | stopped at the editor root (capture) before Vim and the keymaps see it; `TabIndentation`, on the same root, still keeps Tab |
| Insert mode and a user selection appears (`select*` user event, non-empty main range: mouse, Mod-w, Shift+arrows) | leave Insert without moving the cursor and enter Visual over that selection |
| Visual and the selection becomes empty (click, Esc) | Normal (library behaviour) |
| Arrow keys in Visual | move the selection's head, stay Visual (library) |
| A band-3 key in Normal/Visual that Vim did not take (e.g. Shift+Cmd+K, Alt+↑, Cmd+/, Cmd+Enter, Ctrl+H/D, Cmd+A) | swallowed: no edit, no browser default |
| A band-3 key in Insert | runs exactly as the stock binding (incl. its `preventDefault`) |
| `vimEnabled` flips | one transaction reconfigures every slot; the new Vim starts in Normal; text, cursor and undo stay |
| A new document (another article) | the new state is built with Vim on → Normal |
| Vim mode `replace` / visual line / block | reported as `insert` / `visual` / `visual` |

---

## 4. Modified Components

| Component | Current role | Change needed |
| :--- | :--- | :--- |
| `MarkdownEditor` | One `EditorView`, extensions built per document | Holds a `VimEditing`; puts band 3 through `typingKeys` (`historyKeymap` stays in band 1); adds the Vim slot; an effect dispatches `switchTo` when `vimEnabled` changes, another hands it `onVimModeChange` |
| `TabIndentation` | Tab/Shift+Tab, Esc claims, Esc→Tab escape route | Esc → claims only; route and its timers/listeners removed |
| `SaveStatusLine` | path · failure/warning · indicator | Optional middle `modeLabel` node between them |
| `WritingLayout` / `useWritingLayout` | Arrangement + preview shortcut | `leaveZen()` + Esc listener (bubble, honours `defaultPrevented` and composition) |
| `SettingsDialog` / `SettingsEntry` | Language + theme sections | + `VimModeSetting` section |
| `Settings` (Rust) | Per-vault settings | + `vim_mode` |

---

## 5. Component Relationships

```mermaid
flowchart TD
    Settings[(settings.json vimMode)] --> SS[SettingsSession]
    SS --> VMS[VimModeSession]
    VMS -->|isEnabled| AE[AutosavedEditor]
    AE -->|vimEnabled, onVimModeChange = VMS.report| ME[MarkdownEditor]
    ME --> VE[VimEditing]
    VE --> Lib[@replit/codemirror-vim]
    TI[TabIndentation capture listener] --> Claims[indentationKeyClaims: snippet menu, fields]
    VMS -->|mode| Label[VimModeLabel in SaveStatusLine]
    VMS --> Setting[VimModeSetting in SettingsDialog]
    Esc[Esc nobody took] --> WL[WritingLayout.leaveZen]
```

Key order inside the editor (top runs first): the input-method guard and `TabIndentation` (capture listeners on the editor root: Tab, Esc rungs 1–2) → keymap handler (band 1) → Vim (band 2, Esc rung 3) → typing-keys scope (band 3) → browser default. The window bubble listener (rung 4) sees the key last.

---

## 6. Extensibility & Handoff Notes

- **Most likely next requirement:** more Rustle keys that must beat Vim (a keymap overview, a new shortcut), or a key that Vim must stop eating (the later "Tab always indents in Vim" request), or sharing Vim's registers with the system clipboard.
- **Where it lands:** a new Rustle key is an ordinary `keymap.of` at default or higher precedence — it is in band 1 automatically and beats Vim with no Vim-specific code. Something that must take Esc before Vim registers an `indentationKeyClaims` entry. Clipboard integration is `Vim.defineRegister` inside `VimEditing`.
- **How to add it:** never touch the band order; never add a binding to `typingKeys` unless it is "what the editor does while typing".
- **Patterns applied & why:** a session object for app-wide state (as `ThemeSession`, `WritingLayout`), compartments for in-place reconfiguration (as indentation), keymap *scopes* for the "after Vim, Insert only" band — the one CodeMirror mechanism that orders a keymap relative to a non-keymap handler without listing keys.
- **Do not hardcode:** mode names come from one table (`VIM_MODE_LABELS`); never compare Vim's internal mode strings outside `VimEditing`.
- **Known debt / deferred:** Vim's `:` / `/` panels exist in the library but are not styled or advertised (out of scope). Pending-operator Esc (e.g. `d` then Esc in Normal while in Zen) both cancels the operator and leaves Zen — see §8.

---

## 7. Traceability

| PRD Scenario | Fulfilled by |
| :--- | :--- |
| US-01 從來沒動過這個設定的人，什麼都不會發現 | `Settings.vim_mode` default; `VimModeSession.mode === null`; `VimModeLabel` renders nothing |
| US-01 打開的當下立刻生效，並且當場進入 Normal | `VimModeSetting` → `VimModeSession.setEnabled` → `MarkdownEditor` `switchTo(true)`; session mode `normal` |
| US-01 關掉的當下立刻生效 | `switchTo(false)` restores band 3 at its old place; label gone |
| US-01 這個選擇跨重啟被記住 | `SettingsSession.change` → `writeSettings`; Rust `vim_mode` round trip |
| US-01 每個 Vault 各記一份 | settings live in `<vault>/.rustle/settings.json` (existing) |
| US-01 設定檔被人手改成看不懂的值 | `StoredSettings.vim_mode: Tolerant<bool>` |
| US-02 從 Normal 進入 Insert | library (`i`) + mode tracker |
| US-02 從 Insert 回到 Normal | band 2 (Vim's Esc) |
| US-02 Normal 下拖出選取 → Visual | library external-selection rule + tracker |
| US-02 Insert 下拖出選取 → Visual | `VimEditing` Insert→Visual rule |
| US-02 選取消失就離開 Visual | library |
| US-02 方向鍵在 Visual 移動選取的那一端 | library |
| US-02 按 ESC 讓選取消失 | band 2 (Vim's Esc) |
| US-02 切換到另一篇文章時回到 Normal | `MarkdownEditor` new state → new Vim → tracker reports `normal` |
| US-03 模式標籤住在那條線的中間 | `SaveStatusLine` middle slot + `VimModeLabel` |
| US-03 兩種介面語言都不翻譯 | `VIM_MODE_LABELS` outside the message catalogs |
| US-03 Vim 關著時那一格整格不存在 | `VimModeLabel` returns `null` |
| US-03 只有預覽時整條狀態列不畫 | existing `hidden` editor region |
| US-03 視窗很窄時先收掉 workspace | CSS: `.vim-mode-label { flex: none }`, workspace part keeps its ellipsis |
| US-04 Normal 下逐層擴大選取 → Visual | band 1 `ExtendSelection` + library external selection |
| US-04 Insert 下逐層擴大選取 → Visual | band 1 + Insert→Visual rule |
| US-04 Visual 下再按一次往外長一層 | band 1 (`ExtendSelection` grows the non-empty selection) |
| US-04 Normal 下 Tab 仍然是縮排 | `TabIndentation` (capture, before everything) |
| US-04 Normal 下表格行 Enter 多一列 | band 1 `TableRowContinuation` |
| US-04 Normal 下非表格行 Enter 走 Vim | band 2 (`<CR>`) |
| US-04 Normal 下編輯器那些改動文章的鍵不改動文章 | band 3 swallow |
| US-04 Insert 下那些鍵與今天相同 | band 3 Insert pass-through |
| US-04 Normal 下退格鍵只移游標 / 刪除鍵刪一字 | band 2 (`<BS>` → `h`, `<Del>` → `x`) before band 3 |
| US-04 Insert 下退格與刪除照舊 | band 3 Insert pass-through |
| US-04 Normal 下粗體 | band 1 `EmphasisShortcuts` |
| US-04 Visual 下預覽開關 | window capture listener in `useWritingLayout` (unchanged) |
| US-04 任何模式下字體放回預設 | `EditingSurfaceFontSizes` window listener (unchanged) |
| US-04 Vim 關著時這些鍵與今天完全相同 | `typingKeys` with Vim off = the original `keymap.of` |
| US-05 片語選單開著時只關選單 | snippet claim `preventDefault`s, so Vim never sees that Esc |
| US-05 填空中只停止填空 | same |
| US-05 選單與填空都沒有時回到 Normal | band 2 (Vim's Esc) |
| US-05 Visual 按 ESC 回 Normal 並取消選取 | band 2 (Vim's Esc) |
| US-05 已經在 Normal 且不在專注模式，ESC 什麼都不做 | no rung takes it; `leaveZen` not applicable |
| US-05 已經在 Normal 且在專注模式，ESC 離開專注模式 | `useWritingLayout` Esc listener → `leaveZen` |
| US-05 三層都有事時要按三次 | each rung `preventDefault`s, so the next rung waits for the next press |
| US-05 Vim 關著時少了回到 Normal 那一層 | no band 2 |
| US-05 Vim 關著且選單開著時先關選單 | snippet claim `preventDefault` → Zen listener skips |
| US-05 Vim 關著、什麼都沒開時什麼都不做 | nothing takes it |
| US-05 輸入法組字中按 ESC | `VimEditing` input-method guard (Insert mode); `TabIndentation` skips claims while composing; Zen listener checks `ownsKey` |
| US-06 ESC 之後按 Tab 不再跳出寫作區 | escape route removed from `TabIndentation` |

---

## 8. Risks & Open Decisions

Decisions taken without the user (recorded in the PR as Assumptions):

1. **Library:** `@replit/codemirror-vim 6.4.0` (released 2026-07-29, the current release, built on CodeMirror 6). It needs `@codemirror/search` as a peer; pinned `6.7.2`. Its engine ships as `@replit/codemirror-vim-core`, pinned by the lockfile.
2. **"Enter that Vim enters with"** (US-02) is read as every Vim way into Insert (`i a I A o O s S c…`); tests use `i`.
3. **Enter in Normal off a table row** goes to the first non-blank character of the next line (Vim's `<CR>` = `j^`); for an unindented line that is the line start the PRD names.
4. **Replace mode** (`R`) is shown as `INSERT`, visual line/block as `VISUAL` — the PRD has three labels only.
5. **Esc with a pending Vim operator in Normal** (`d` then Esc): the library cancels it without taking the key, so in Zen that Esc also leaves Zen. The pending operator is invisible, so this does not break "every Esc does one visible thing".
6. **Esc with Vim off and a selection**: CodeMirror's stock Esc (`simplifySelection`) still collapses the selection before Zen sees Esc — that is today's behaviour, which the PRD requires unchanged with Vim off.
7. **Leaving Zen with Esc also works when the keyboard is outside the editor** (e.g. the preview) as long as nothing else took the key; every dialog and finder already takes its own Esc.
8. **Input method in Normal mode:** Normal mode never inserts text, so a letter typed with an input method switched on is read as the Vim command it names (the library ends that composition). In Insert mode the input method owns every key while composing, Esc included.
9. **Shift+arrows in Normal:** the library maps them to its own motions; the PRD's acceptance criteria do not pin them. A Shift+arrow selection made in **Insert** mode goes to Visual (Insert→Visual rule).
10. **The settings value** is written as `"vimMode": true`, and omitted when off (absent = off), matching the other "absent until chosen" fields.

- **Risk:** the library hides the native selection and draws its own cursor; its colours are its own `baseTheme`. Accepted: the cursor and selection use the theme's tokens through `xcodeTheme` where the library exposes class names (`.cm-fat-cursor`).
- **Risk:** the input-method guard stops IME-owned keys in Insert mode before CodeMirror's own keydown bookkeeping too (CodeMirror itself ignores keys while it counts a composition, so the difference is the key that starts one). Only with Vim on.
- **Built differently from the first draft:** the draft had a Vim `indentationKeyClaims` entry for Esc; Vim's own Esc already does exactly that rung after the snippet claims, so the claim was dead code and was removed.
- **Risk:** band 3 swallowing means `Cmd+A` does nothing in Normal/Visual — accepted by the PRD (§4 已知代價).
