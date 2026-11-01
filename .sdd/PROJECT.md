# Rustle — Project Map

## Vision

A local, offline Markdown writing app for someone who writes in Chinese every day. Articles are plain `.md` files in a vault folder; typing with an input method must never break.

## Tech stack (exact versions; pinned in `Cargo.lock` / `pnpm-lock.yaml`)

| Area | Choice |
| :--- | :--- |
| Shell | Tauri `2.12.5` (`tauri-build 2.7.4`, `wry 0.57.1`), `@tauri-apps/cli` / `@tauri-apps/api` `2.12.4`, `tauri-plugin-opener 2.7.2` (Rust side only) |
| Rust | stable `1.95` (MSRV 1.90), edition 2024; `serde 1.0.229`, `serde_json 1.0.154`, `thiserror 2.0.21`, `url 2.5.8`, `tempfile 3.27.0`, `yaml-rust2 0.13.0` (domain: front matter parsing only) |
| Rust tests | built-in harness, `rstest 0.28.0`, `tempfile`, `mockall 0.15.0` (domain `mocks` feature, e.g. `MockClock`), Tauri `test` feature (mock runtime) |
| Frontend | TypeScript `6.0.3` (strict), React `19.3.1`, Vite `8.3.5`, CodeMirror 6 (`@codemirror/view 6.43.15`, `state 6.7.6`, `lang-markdown 6.5.2`, `language 6.13.1`, `commands 6.11.1`) |
| Preview rendering | `markdown-it 14.3.3`, `highlight.js 11.12.0` (`lib/common`), `dompurify 3.4.17` |
| Frontend tests / lint | Vitest `5.0.5` + happy-dom `21.0.4` (jsdom `30.1.2` for files that run DOMPurify: `// @vitest-environment jsdom`, because happy-dom reports an empty node name to it) + Testing Library; ESLint `9.39.5` + typescript-eslint `8.72.1` (`no-explicit-any` is an error) |
| Package manager | pnpm `11.3.0` |

Upgrading Tauri or CodeMirror requires re-running `docs/ime-regression-checklist.md` first.

## Layout

```
Cargo.toml                    workspace + [workspace.dependencies] (versions pinned with =)
crates/domain/                rustle-domain: names, VaultScope, VaultEntry, WorkspaceNameRequest, Settings, ArticleDocument, ArticleFileNameSlug, UtcTimestamp, repository traits, Clock. No I/O
crates/application/           rustle-application: use cases (one struct per use case): ReadArticleBody, SaveArticleBody, ListWorkspaces, ListArticles, CreateWorkspace, ReadSettings, WriteSettings
crates/infrastructure/        rustle-infrastructure: ResolvedVaultScope, FileSystemSettingsRepository, FileSystemArticleRepository, FileSystemWorkspaceRepository, SystemClock, write_atomically
src-tauri/                    assembly root: channels, commands, CSP, navigation guard, custom schemes, window
  src/channel.rs              the channel contract (one line per channel)
  src/channels.rs             the channel registration list (one line per channel)
  src/commands/<channel>.rs   one Tauri command per channel
  src/protocols.rs            the custom scheme registration list
  tauri.conf.json             CSP (pinned by a test), no windows (created in code)
  capabilities/main-window.json  no permissions at all
src/                          webview (React + CodeMirror)
  app/                        App shell (AppLayout: four columns) and global CSS with light/dark color tokens
  ipc/                        callChannel (the only invoke), channels (typed wrappers), ChannelResult
  shared/composition/         CompositionState, CompositionProvider/useCompositionState, CompositionAwareDebouncer
  features/<feature>/         one folder per feature (editor/, vault/, autosave/, settings/, preview/)
docs/ime-regression-checklist.md  manual IME runbook + release checklist
```

## Layer map

```
src/ (webview) ──invoke──▶ src-tauri ──▶ rustle-application ──▶ rustle-domain ◀── rustle-infrastructure
```

- The webview has **no** Tauri permissions; it can only call registered channels through `src/ipc/channels.ts`.
- The webview sends **names** (workspace, file name), never paths. Commands parse them into `WorkspaceName` / `ArticleFileName` / `ImageFileName` and get paths only from `ResolvedVaultScope` (lexical check + symlink resolution).
- Default vault: `~/Rustle` (`VaultScope::at_default_location`). Settings: `<vault>/.rustle/settings.json`.

## Shared seams — how a slice plugs in

**Implement an existing channel** (e.g. `readBody`):
1. Replace the body (and signature) of `src-tauri/src/commands/read_body.rs`. Put the use case in `rustle-application`, the I/O in `rustle-infrastructure`.
2. Update the one line for `readBody` in `src/ipc/channels.ts` with the real arguments and payload type.

**Add a new channel**: add one line to the `channels!` table in `src-tauri/src/channel.rs`, one file under `src-tauri/src/commands/`, one `pub mod` line in `src-tauri/src/commands.rs`, one line in `src-tauri/src/channels.rs`, one line in `src/ipc/channels.ts` (and the `COMMAND_NAMES` table in its test). The registry refuses to start if a channel has no handler or two.

**Errors across the boundary**: library crates define `thiserror` enums. Convert them into `CommandError` with a `From` impl (`src-tauri/src/command_error.rs`). The webview always receives `ChannelResult<T>` = `{ ok: true, payload } | { ok: false, reason, message }` with `reason` in `notImplemented | outsideVault | unknownChannel | unexpected`. A new reason = one `FailureReason` variant + the same string in `src/ipc/channelResult.ts`.

**Front matter**: never touch YAML outside `rustle_domain::ArticleDocument`. `ArticleDocument::parse(text)` → `body()`, `metadata(&file_name)` (tolerant; `has_incomplete_metadata` when the title fell back to the file name), `with_body(..)`, `with_metadata(&MetadataUpdate::default().updated_at(..))`, `to_text()`. Untouched bytes are written back as they were; a broken block is never rewritten. New file names: `ArticleFileNameSlug::from_title(title).available_file_name(existing)`.

**Articles on disk**: `rustle_domain::ArticleRepository` has `read` and a guarded `write(workspace, article, text, expected_modified_at) -> ArticleWrite::{Written { modified_at }, ModifiedElsewhere}`; there is no unguarded write — read first if you need the current modification time. `FileSystemArticleRepository` is managed Tauri state built in `configure(builder, vault_scope)`; a command takes it as `State<'_, FileSystemArticleRepository>` and hands it to its use case. `readBody(workspace, fileName)` → `ArticleBody { workspace, fileName, body, lastKnownModifiedAt }` (ISO 8601 UTC, `UtcTimestamp`). `saveBody({ workspace, fileName, body, lastKnownModifiedAt, overwrite })` → `SavedBody` (`outcome: "saved" | "modifiedElsewhere"`).

**Time**: take `rustle_domain::Clock` (`SystemClock` in production, `MockClock` in tests) and format with `UtcTimestamp`; never call `SystemTime::now()` in a use case.

**Opening / leaving an article (webview)**: the app owns one `AutosaveSession` (`src/features/autosave/`) and hands it to `VaultSession` as its `ArticleHolder`. Change the open article only through `await session.openArticle({ article: ArticleBody, title })` or `session.closeArticle()`, and act only when the answer is `"switched"` (`blockedByUnansweredWarning` / `blockedByFailedSave` mean the title bar is already explaining why); `VaultSession` already does this for every click and keeps the previous selection when refused. The editor body follows `session.document` (`AutosavedEditor` inside `EditorColumn`); do not remount the editor yourself. Anything that writes the open article from elsewhere: leave through `closeArticle`, write, then `openArticle` with the fresh `ArticleBody`.

**Window close**: the backend holds `CloseRequested` and asks the webview over `watchCloseRequests`; the webview answers with `answerCloseRequest(close)`. Something else that must run before closing belongs in `AutosaveSession.prepareToCloseWindow` (or next to it in `watchWindowCloseRequests`), not in a second listener.

**Settings**: `rustle_domain::Settings` has `indentation`, `previewPanel { isOpen, widthRatio, toggleShortcut? }`, `lastOpened { workspace, article }` and no vault path. A new field = one field on `Settings` + one on the private tolerant shape in `settings/stored_settings.rs` (a wrong type or out-of-range value falls back to that field's default). `FileSystemSettingsRepository` keeps unknown keys, writes atomically and checks the location against the vault on every call. `readSettings` (a broken file reads as defaults) and `writeSettings(settings)` are wired; the webview type is `src/ipc/settings.ts`. In the webview, **only `SettingsSession`** (`src/features/settings/`) holds the settings: read them with `useSettings(session)` and change them with `session.change((settings) => ({ ...settings, … }))`, which writes the whole latest settings (only when they were read). The app builds one and hands it to `VaultSession` and the preview; never keep a second copy.

**Vault listing**: `WorkspaceRepository` (`vault_entries`, `workspace_entries`, `create`) answers raw `VaultEntry { name, kind: Folder | File | Unreachable }` lists, links already resolved and confined. What counts is decided only on `VaultEntry` (`as_workspace`, `as_article`, `compare_names`, `clashes_with`) and `WorkspaceNameRequest::judge`. A new listing rule is one method there. Channels: `listWorkspaces()`, `listArticles(workspace)`, `createWorkspace(name)` → `{ outcome: "created", workspace } | { outcome: "rejected", reason }` (a rejection is a value, not a failure).

**Selection (webview)**: `src/features/vault/VaultSession.ts` is the single owner of the selected workspace/article, the lists, the body and the per-column failure lines; every click goes through `selectWorkspace` / `selectArticle`, a late answer to an older click is dropped, and each selection is written to `lastOpened`. Leaving the open article asks the `ArticleHolder` (autosave) first; clicking the open article again does nothing. Create-article and filtering plug in there. Bind with `useVaultSnapshot(session)`.

**Layout**: `AppLayout({ workspaces, articles, editor, preview? })` where `preview = { isOpen, content, onOpen, onClose }`: open → the `PREVIEW` region with a close button; folded → a `開啟預覽` handle at the edge and the editor takes the width. Width is still `flex: 1` (divider slice: `previewPanel.widthRatio`).

**Preview**: the only way from a body to HTML is `renderPreviewHtml(body)` (`src/features/preview/`): markdown-it → DOMPurify → `recheckPreviewHtml`, all held to `PreviewHtmlPolicy` (allowed tags/attributes; `a[href]` relative/http/https/mailto, `img[src]` relative/`rustle:`). A new allowed tag, attribute or scheme is one line in the policy. Every block element carries its zero-based body line in `SOURCE_LINE_ATTRIBUTE` (`data-source-line`) — scroll sync reads that constant. Relative image sources are kept as written; the image slice rewrites them to `rustle:` (a markdown-it `image` rule in `renderMarkdown.ts`). What the preview shows comes from `PreviewedBody` (over `AutosaveSession.document` / `.body`): immediate on open, 150 ms after typing stops, never while composing. The toggle shortcut (`previewPanel.toggleShortcut`, default `Mod+Shift+P`, `Mod` = Cmd or Ctrl) is parsed by `KeyboardShortcut`.

**No article open**: editor and preview both render `NoArticleState` (`src/features/vault/`); change the wording there only.

**Editor body**: `MarkdownEditor` takes `body` and keeps one `EditorView` for the app's lifetime: a new body replaces the state in place (fresh undo history), waits while composing (latest wins), and the same body again is ignored. Leaving the editor ends a composition whose end event never came.

**Atomic writes**: use `rustle_infrastructure::write_atomically` (temp file `.{name}.{random}.rustle-temporary` in the same folder → fsync → rename). Article files go through `ArticleRepository::write`, which adds the modification-time check before and right before the rename.

**Custom scheme `rustle:`**: implement `VaultAssetScheme::respond` in `src-tauri/src/vault_asset_scheme.rs`. It is already registered and allowed in `img-src`. Another scheme = one `SchemeHandler` + one line in `src-tauri/src/protocols.rs`.

**Composition-aware timing**: get the shared state with `useCompositionState()` and create a `CompositionAwareDebouncer(state, delayMilliseconds)`; call `schedule`, `cancel`, `dispose`. Do not read composition from props or a second source. A text field reports its own composition to the shared state (`start` / `end`, and `end` on blur) and asks `state.ownsKey(event)` before acting on Enter or Tab — see `NewWorkspaceField`.

**Editor indentation**: `MarkdownEditor` takes `indentation?: { style: "spaces" | "tab"; width }` (`src/features/editor/IndentUnit.ts`); missing or unreasonable values fall back to 2 spaces. The settings slice passes the stored value straight through. Tab / Shift+Tab are owned by `TabIndentation` (capture-phase listener on the editor root): do not bind Tab in another extension; the instance is private to `MarkdownEditor` today, so a future toolbar must first expose `indent()` / `outdent()` through a `MarkdownEditor` handle (React `ref`) rather than build its own.

**Frontend features**: put them in `src/features/<feature>/`; call the backend only through `channels`.

**Security**: change the CSP only in `src-tauri/src/content_security_policy.rs` *and* `tauri.conf.json` (a test keeps them identical). The navigation guard (`NavigationPolicy`) keeps the window on its own page; http(s) links open in the system browser.

## Checks (all must pass before every commit)

```
export CARGO_TARGET_DIR=…            # optional shared target dir
pnpm check                           # = everything below
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
pnpm typecheck && pnpm lint && pnpm test
```

Run the app: `pnpm tauri dev`. Build: `pnpm tauri build`. Rust checks work without a frontend build (`src-tauri/build.rs` creates `dist/`).
