# Rustle — Project Map

## Vision

A local, offline Markdown writing app for someone who writes in Chinese every day. Articles are plain `.md` files in a vault folder; typing with an input method must never break.

## Tech stack (exact versions; pinned in `Cargo.lock` / `pnpm-lock.yaml`)

| Area | Choice |
| :--- | :--- |
| Shell | Tauri `2.12.5` (`tauri-build 2.7.4`, `wry 0.57.1`), `@tauri-apps/cli` / `@tauri-apps/api` `2.12.4`, `tauri-plugin-opener 2.7.2` (Rust side only) |
| Rust | stable `1.95` (MSRV 1.90), edition 2024; `serde 1.0.229`, `serde_json 1.0.154`, `thiserror 2.0.21`, `url 2.5.8`, `tempfile 3.27.0`, `yaml-rust2 0.13.0` (domain: front matter parsing only) |
| Rust tests | built-in harness, `rstest 0.28.0`, `tempfile`, Tauri `test` feature (mock runtime) |
| Frontend | TypeScript `6.0.3` (strict), React `19.3.1`, Vite `8.3.5`, CodeMirror 6 (`@codemirror/view 6.43.15`, `state 6.7.6`, `lang-markdown 6.5.2`, `language 6.13.1`, `commands 6.11.1`) |
| Frontend tests / lint | Vitest `5.0.5` + happy-dom `21.0.4` + Testing Library; ESLint `9.39.5` + typescript-eslint `8.72.1` (`no-explicit-any` is an error) |
| Package manager | pnpm `11.3.0` |

Upgrading Tauri or CodeMirror requires re-running `docs/ime-regression-checklist.md` first.

## Layout

```
Cargo.toml                    workspace + [workspace.dependencies] (versions pinned with =)
crates/domain/                rustle-domain: names, VaultScope, Settings, ArticleDocument, ArticleFileNameSlug, repository traits. No I/O
crates/application/           rustle-application: use cases (one struct per use case): ReadArticleBody
crates/infrastructure/        rustle-infrastructure: ResolvedVaultScope, FileSystemSettingsRepository, FileSystemArticleRepository, write_atomically
src-tauri/                    assembly root: channels, commands, CSP, navigation guard, custom schemes, window
  src/channel.rs              the channel contract (one line per channel)
  src/channels.rs             the channel registration list (one line per channel)
  src/commands/<channel>.rs   one Tauri command per channel
  src/protocols.rs            the custom scheme registration list
  tauri.conf.json             CSP (pinned by a test), no windows (created in code)
  capabilities/main-window.json  no permissions at all
src/                          webview (React + CodeMirror)
  app/                        App shell and global CSS
  ipc/                        callChannel (the only invoke), channels (typed wrappers), ChannelResult
  shared/composition/         CompositionState, CompositionProvider/useCompositionState, CompositionAwareDebouncer
  features/<feature>/         one folder per feature (editor/ today)
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

**Articles on disk**: `rustle_domain::ArticleRepository` (today `read`; autosave adds `write` with `write_atomically`). `FileSystemArticleRepository` is managed Tauri state built in `configure(builder, vault_scope)`; a command takes it as `State<'_, FileSystemArticleRepository>` and hands it to its use case. `readBody` is implemented: `channels.readBody(workspace, fileName)` → `ArticleBody { workspace, fileName, body, lastKnownModifiedAt }` (ISO 8601 UTC).

**Settings**: add fields to `rustle_domain::Settings` (serde, camelCase, defaulted). `FileSystemSettingsRepository` keeps unknown keys and writes atomically. `readSettings` / `writeSettings` are wired by the vault slice.

**Atomic writes**: use `rustle_infrastructure::write_atomically` (temp file in the same folder → fsync → rename).

**Custom scheme `rustle:`**: implement `VaultAssetScheme::respond` in `src-tauri/src/vault_asset_scheme.rs`. It is already registered and allowed in `img-src`. Another scheme = one `SchemeHandler` + one line in `src-tauri/src/protocols.rs`.

**Composition-aware timing**: get the shared state with `useCompositionState()` and create a `CompositionAwareDebouncer(state, delayMilliseconds)`; call `schedule`, `cancel`, `dispose`. Do not read composition from props or a second source.

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
