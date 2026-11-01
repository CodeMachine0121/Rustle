# App Foundation & IME Harness — Architecture Design

**Status:** Confirmed (decided autonomously; the user was away — every judgement call is listed in §8)
**Source PRD:** `.sdd/2026-08-20-app-foundation-and-ime-harness/PRD.md`
**Tech context:** Tauri 2 · Rust Cargo workspace (`rustle-domain` / `rustle-application` / `rustle-infrastructure` / `src-tauri`) · TypeScript strict + React + CodeMirror 6 · pnpm · Vite · Vitest

---

## 1. Design Goal & Guiding Principle

- **In one sentence:** stand up a runnable Tauri window with a CodeMirror Markdown editor, draw the security boundary (vault-scoped paths, strict CSP, navigation lock, no filesystem capability in the webview), and ship every shared seam the eleven later slices plug into.
- **Guiding principle:** *every later slice is add-only.* A new channel is one enum variant, one command file, one registration line and one typed wrapper line; a vault path can only be obtained through `VaultScope`; a failure crosses the boundary in exactly one shape (`CommandError` → `ChannelResult`).

---

## 2. Change Scope

| Area | Action | What / Why |
| :--- | :--- | :--- |
| Repo root | **Add** | `Cargo.toml` workspace with `[workspace.dependencies]`, `package.json`, Vite / Vitest / ESLint / tsconfig, `rust-toolchain`-free (uses installed stable) |
| `crates/domain` | **Add** | `WorkspaceName`, `ArticleFileName`, `ImageFileName` (parse-don't-validate single path segments), `VaultScope` (the only way to turn names into vault paths), `VaultPathError`, `Settings` + `SettingsRepository` trait |
| `crates/application` | **Add (empty)** | Crate exists so the dependency direction is enforced from day one; no use case belongs to this slice |
| `crates/infrastructure` | **Add** | `ResolvedVaultScope` (symlink-aware containment check on top of `VaultScope`), `FileSystemSettingsRepository` (reads/writes `.rustle/settings.json`, keeps unknown keys, atomic write) |
| `src-tauri` | **Add** | Assembly root: `Channel` contract, `ChannelRegistry`, one not-implemented command per channel, `CommandError`, `ContentSecurityPolicy`, `NavigationPolicy`, `ProtocolRegistry` with the `rustle` scheme, window creation, capability file |
| `src/` | **Add** | `ipc/` (typed channel wrappers + `ChannelResult`), `shared/composition/` (`CompositionState`, `CompositionProvider`, `CompositionAwareDebouncer`), `features/editor/` (`MarkdownEditor`, sample body), `app/App.tsx` |
| `docs/ime-regression-checklist.md` | **Add** | T-1 ~ T-12 manual runbook + release checklist |
| `.sdd/PROJECT.md` | **Add** | Project map and seam guide |
| Vault scanning, front matter, autosave, preview rendering, paste image, layout, real settings channels | **Not touched** | Owned by later slices (BRIEF §4). Their channels answer `notImplemented` |

---

## 3. New Types / Modules

### Rust

| Name | Crate · file | Responsibility | Satisfies |
| :--- | :--- | :--- | :--- |
| `WorkspaceName`, `ArticleFileName`, `ImageFileName` | domain · `vault_name.rs` | A name that is guaranteed to be one plain path segment (not empty/blank, not `.`/`..`, no `/` `\` NUL, not absolute). Built only via `parse` | TC-04, TC-06~TC-09 |
| `VaultPathError` | domain · `vault_name.rs` | `OutsideVault { rejected }` — message quotes the rejected name | TC-06~TC-10 |
| `VaultScope` | domain · `vault_scope.rs` | Holds the vault root; `workspace_path`, `article_path`, `image_path` (under `images/`), `settings_file_path`, `at_default_location(home)` → `~/Rustle`. Pure path joining, no I/O | TC-01~TC-05 |
| `Settings`, `SettingsRepository`, `SettingsError` | domain · `settings.rs` | Settings shape (fields added by later slices) and its persistence trait | seam (A-5) |
| `ResolvedVaultScope` | infrastructure · `resolved_vault_scope.rs` | Same three questions as `VaultScope`, plus resolves symlinks of the nearest existing ancestor and rejects anything that lands outside the canonical vault root. This is what I/O code must use | persistence.md "symlinks resolved" |
| `FileSystemSettingsRepository` | infrastructure · `file_system_settings_repository.rs` | Load/save `.rustle/settings.json`; missing file → defaults; unknown keys preserved; atomic write (temp → fsync → rename) | seam |
| `Channel` | src-tauri · `channel.rs` | The channel contract: every channel, its frontend name (`listWorkspaces`) and command name (`list_workspaces`) | TC-11~TC-14 |
| `ChannelRegistry<H>` | src-tauri · `channel_registry.rs` | Built from handlers that each declare their channel; rejects duplicates and missing channels at assembly; looks a handler up by command name and errors on unknown names. It *is* the runtime invoke handler | TC-11, TC-12, TC-14, TC-15 |
| `channel_handlers()` | src-tauri · `channels.rs` | **The single registration list**: one line per channel | TC-11 |
| `commands::*` | src-tauri · `commands/<channel>.rs` | One file per channel; today each returns `CommandError::not_implemented` | TC-13 |
| `CommandError`, `FailureReason` | src-tauri · `command_error.rs` | The one serializable failure shape `{ reason, message }`; `From<VaultPathError>`, `From<ChannelRegistryError>` | TC-40 |
| `ContentSecurityPolicy` | src-tauri · `content_security_policy.rs` | Production / development policy as a header string; a test pins `tauri.conf.json` to it | TC-24~TC-27 |
| `NavigationPolicy` | src-tauri · `navigation_policy.rs` | Decides allow / deny for a navigation target relative to the app page, and whether a denied target goes to the browser | TC-34~TC-36 |
| `ProtocolRegistry`, `SchemeHandler`, `VaultAssetScheme` | src-tauri · `protocol_registry.rs` | Registers custom schemes on the Tauri builder; rejects duplicates; `rustle` answers 501 naming the scheme until the preview/paste slices implement it | TC-42~TC-46 |
| `run()` / `configure()` | src-tauri · `lib.rs` | Assembly: builder + registries + window with navigation guard | TC-28, TC-37 |

### TypeScript

| Name | File | Responsibility | Satisfies |
| :--- | :--- | :--- | :--- |
| `ChannelResult<T>`, `callChannel` | `src/ipc/channelResult.ts`, `src/ipc/callChannel.ts` | The only place `invoke` is called; turns resolve/reject into `{ ok: true, payload } \| { ok: false, reason, message }` | TC-38~TC-41 |
| `channels` | `src/ipc/channels.ts` | One typed wrapper per channel (`channels.listWorkspaces()`…) | TC-11 (frontend half), TC-28 |
| `CompositionState` | `src/shared/composition/CompositionState.ts` | Observable "is composing" flag with `start()` / `end()` / `subscribe()` | TC-23, TC-48~TC-50 |
| `CompositionProvider`, `useCompositionState` | `src/shared/composition/CompositionContext.tsx` | One state per app; the hook throws when there is no provider | TC-51 |
| `CompositionAwareDebouncer` | `src/shared/composition/CompositionAwareDebouncer.ts` | Debounce that pauses while composing and resumes with the remaining time | TC-16~TC-22 |
| `MarkdownEditor` | `src/features/editor/MarkdownEditor.tsx` | CodeMirror 6 view: markdown language + highlight, line wrapping, reports composition to the shared state, mounted once | TC-29~TC-31, TC-47~TC-50 |
| `SAMPLE_BODY` | `src/features/editor/sampleBody.ts` | In-memory demo body with headings, bold, list, code block, long Chinese line | TC-29, TC-30 |

---

## 4. Modified Components

None — the repository only contained documents.

---

## 5. Component Relationships

```mermaid
flowchart LR
  subgraph webview[Webview · no fs capability]
    Editor[MarkdownEditor] --> CS[CompositionState]
    Debouncer[CompositionAwareDebouncer] --> CS
    Features[features/*] --> Channels[ipc/channels]
    Channels --> Call[callChannel → ChannelResult]
  end
  Call -- invoke --> Registry[ChannelRegistry]
  subgraph tauri[src-tauri]
    Registry --> Commands[commands/*]
    Commands --> CommandError
    Nav[NavigationPolicy] -.guards.-> webview
    CSP[ContentSecurityPolicy] -.tauri.conf.json.-> webview
    Protocols[ProtocolRegistry · rustle://]
  end
  Commands --> App[rustle-application]
  App --> Domain[rustle-domain · VaultScope, names]
  Infra[rustle-infrastructure · ResolvedVaultScope, settings] --> Domain
```

---

## 6. Extensibility & Handoff Notes

- **Most likely next requirement:** a slice implements one channel (e.g. `listWorkspaces`).
- **Where it lands / how to add it:**
  1. Replace the body of `src-tauri/src/commands/list_workspaces.rs` (own request/response types live in that file or in `rustle-application`).
  2. Adjust the one wrapper line in `src/ipc/channels.ts` to the real request/payload types.
  3. A brand-new channel additionally adds one `Channel` variant (+ its two names) and one line in `src-tauri/src/channels.rs`; the registry test then fails until the line exists.
- **Paths:** I/O code calls `ResolvedVaultScope`; it never joins strings itself. Names arrive from the webview as strings and are parsed into `WorkspaceName` / `ArticleFileName` / `ImageFileName` in the command.
- **Errors:** library crates define `thiserror` enums; the command maps them into `CommandError` via `From`. A new failure kind = one `FailureReason` variant + one `From` impl + the same string in `src/ipc/channelResult.ts`.
- **Custom protocol:** the preview / paste slice replaces `VaultAssetScheme::respond`; registration and CSP already exist.
- **Composition-aware timing:** autosave and preview create a `CompositionAwareDebouncer` with the shared `CompositionState` from `useCompositionState()`.
- **Do not hardcode:** command names in components (use `channels`), paths in the webview, CSP outside `ContentSecurityPolicy` (the config test enforces it).
- **Known debt:** channel request/response types are placeholders (no arguments, `void` payload) until the owning slice defines them; the symlink check of a not-yet-existing file resolves its nearest existing ancestor.

---

## 7. Traceability

| PRD Scenario | Fulfilled by |
| :--- | :--- |
| TC-01 workspace path | `VaultScope::workspace_path` |
| TC-02 article path | `VaultScope::article_path` |
| TC-03 image path under `images/` | `VaultScope::image_path` |
| TC-04 non-ASCII workspace | `WorkspaceName::parse` |
| TC-05 missing file still resolves | `VaultScope` (pure) and `ResolvedVaultScope` (nearest existing ancestor) |
| TC-06 invalid workspace names | `WorkspaceName::parse` |
| TC-07 invalid article names | `ArticleFileName::parse` |
| TC-08 invalid image name | `ImageFileName::parse` |
| TC-09 valid workspace + invalid article | `VaultScope::article_path` takes parsed names; the command parses both |
| TC-10 error names the rejected input | `VaultPathError::OutsideVault` display |
| TC-11 every channel has a handler | `ChannelRegistry::new` completeness check + `channel_handlers()` |
| TC-12 handler declares its own channel | `ChannelHandler::channel` + registry lookup |
| TC-13 unimplemented channels say so | `commands/*` → `CommandError::not_implemented` (tested through Tauri's mock IPC) |
| TC-14 unknown channel errors | `ChannelRegistry::handler_named` → `unknownChannel` |
| TC-15 duplicate handlers rejected at assembly | `ChannelRegistry::new` |
| TC-16~TC-22 debounce timing | `CompositionAwareDebouncer` |
| TC-23 composition state readable | `CompositionState.isComposing` |
| TC-24~TC-27 CSP | `ContentSecurityPolicy` + `tauri.conf.json` pin test |
| TC-28 webview isolation (manual) | Tauri webview + `capabilities/default.json` without fs permissions + registry whitelist |
| TC-29~TC-31 editor (manual) | `MarkdownEditor` + `SAMPLE_BODY` |
| TC-32, TC-33 runbook + release checklist | `docs/ime-regression-checklist.md`, exact versions in `Cargo.lock` / `pnpm-lock.yaml` |
| TC-34~TC-36 navigation | `NavigationPolicy` |
| TC-37 (manual) | `on_navigation` wiring in `lib.rs` |
| TC-38~TC-41 structured result | `CommandError` (Rust) + `callChannel` (TS) |
| TC-42~TC-46 protocol registry | `ProtocolRegistry`, `VaultAssetScheme` |
| TC-47~TC-51 editor reports composition | `MarkdownEditor` + `useCompositionState` |

---

## 8. Risks & Open Decisions (decided)

| # | Decision | Why |
| :--- | :--- | :--- |
| D1 | Each channel is a real `#[tauri::command]`; the PRD's channel registry is the app's invoke handler (`ChannelRegistry`), keyed by the snake_case command name | Idiomatic Tauri, still a single runtime whitelist that rejects unknown names and is checked complete/unique at startup |
| D2 | Placeholder signatures: every channel takes no arguments and returns no payload today | Payload shapes belong to the owning slices; guessing them now would force those slices to edit shared lines anyway |
| D3 | Symlinks **are** resolved (BRIEF A-2 said no): containment is checked on the canonicalised nearest existing ancestor, so a not-yet-existing file still resolves (TC-05) | The project rules (`persistence.md`) and the task require symlink resolution; the nearest-ancestor trick removes the reason A-2 gave |
| D4 | Production CSP `connect-src` is `ipc: http://ipc.localhost`, not `'none'` | Tauri 2's IPC travels over that in-process scheme; it is not network access, so NFR-2 (offline) still holds |
| D5 | `style-src 'self' 'unsafe-inline'` and Tauri's style nonce injection disabled | CodeMirror injects its theme as runtime style elements; a nonce would silently void `'unsafe-inline'` |
| D6 | Image sources: `'self' data: rustle: http://rustle.localhost` | Tauri serves custom schemes as `rustle://` on macOS/Linux and `http://rustle.localhost` on Windows |
| D7 | Tauri has no per-scheme "privileges" API (an Electron concept). TC-43/TC-44 map to: the scheme is registered on the builder before the app runs; no scheme can bypass CSP because Tauri applies CSP uniformly and `connect-src` does not list `rustle:` | Closest faithful translation |
| D8 | The app page URL is `tauri://localhost/` (macOS/Linux), `http://tauri.localhost/` (Windows) or the dev URL; "same page" = same scheme, host, port and path, any query/fragment | Tauri equivalent of the PRD's `file://…/index.html` |
| D9 | Denied http/https navigations open in the system browser via `tauri-plugin-opener` (backend only; no frontend permission) | TC-36 |
| D10 | React `StrictMode` is not used | BRIEF A-7: no double-mounting the editor |
| D11 | Settings read/write is implemented as an infrastructure seam, but `readSettings` / `writeSettings` still answer `notImplemented` | TC-13 requires it; the vault slice wires them |
| D12 | `src-tauri/build.rs` creates `../dist` when missing | `generate_context!` needs `frontendDist` to exist, so `cargo clippy/test` work without a frontend build |
