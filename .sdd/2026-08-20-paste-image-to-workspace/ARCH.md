# Paste Image to Workspace — Architecture Design

**Status:** Confirmed (decided autonomously; the user was away — every judgement call is listed in §8)
**Source PRD:** `.sdd/2026-08-20-paste-image-to-workspace/PRD.md`
**Tech context:** Tauri 2 · Rust Cargo workspace (`rustle-domain` / `rustle-application` / `rustle-infrastructure` / `src-tauri`) · TypeScript strict + React + CodeMirror 6 · see `.sdd/PROJECT.md`

---

## 1. Design Goal & Guiding Principle

- **In one sentence:** a paste with an image in it becomes `{workspace}/images/{uuid}.{ext}` on disk plus one `![](images/{uuid}.{ext})` line per image inserted in one isolated undo step, and the preview shows it by rewriting the relative path to `rustle://vault/{workspace}/images/{file}` at render time; the `rustle:` scheme serves nothing but an image file directly in some workspace's `images/`.
- **Guiding principle:** *what a pasted image is decides itself; the use case only sequences boundaries.*
  - `PastedImage` (domain, pure) recognises the bytes by their signature and answers how they are stored: kept as they are (PNG, animated GIF, animated WebP, SVG) or converted to PNG (JPEG, BMP, TIFF, still WebP, still GIF). A new format is one variant and one signature, nothing else.
  - `SaveClipboardImages` (application) reads the clipboard, converts only when the image asks for it, names each image with a fresh identifier and creates the files. Every boundary (clipboard, PNG conversion, identifiers, image files) is a domain trait, so tests prove "the image library was never asked" with a mock.
  - `ImageFileName` owns the two image rules that both directions need: its relative path in the body (`images/{name}`) and its media type (which is also "is this an image name at all" for the scheme).
  - In the webview, `ImagePaste` owns the whole paste: whether to take the event, the busy/failure line, and the one-transaction insertion; the editor only plugs its extension in.

---

## 2. Change Scope

| Area | Action | What / Why |
| :--- | :--- | :--- |
| `crates/domain` | **Add** | `PastedImage` + `ImageStorage`, `Clipboard`, `ImageConverter`, `IdentifierGenerator`, `ImageAssetRepository` traits + errors |
| `crates/domain` `vault_name.rs`, `vault_scope.rs` | **Modify** | `ImageFileName::relative_path()` / `media_type()`; `VaultScope::images_folder_path` |
| `crates/application` | **Add** | `SaveClipboardImages` use case → `SavedClipboardImages { images: [{ relativePath }] }` |
| `crates/infrastructure` | **Add** | `SystemClipboard` (`clipboard-rs`, no image feature), `RasterImageConverter` (`image`, decoders + PNG encoder only), `UuidGenerator` (`uuid` v4), `FileSystemImageAssetRepository` |
| `crates/infrastructure` `resolved_vault_scope.rs` | **Modify** | `images_folder_path` (confined like every other path) |
| `src-tauri/src/commands/save_clipboard_image.rs` | **Modify** | real command: `workspace` → use case (async, off the UI thread) |
| `src-tauri/src/vault_asset_scheme.rs`, `protocols.rs`, `lib.rs` | **Modify** | the scheme parses the request into `(WorkspaceName, ImageFileName)` and reads through the repository; the handler list takes the vault |
| `src-tauri/src/command_error.rs` | **Modify** | `From<SaveClipboardImagesError>` |
| `src/ipc/channels.ts` + `savedClipboardImages.ts` | **Modify / Add** | `saveClipboardImage(workspace)` |
| `src/features/imagePaste/` | **Add** | `ImagePaste` (status + CodeMirror extension), `ImagePasteStatusLine` |
| `src/features/editor/MarkdownEditor.tsx` | **Modify** | optional `imagePaste` prop whose extension joins the editor's |
| `src/features/autosave/AutosaveSession.ts` | **Modify** | `workspace` getter (the open article's workspace) |
| `src/features/autosave/AutosavedEditor.tsx`, `vault/EditorColumn.tsx`, `app/App.tsx` | **Modify** | thread `ImagePaste` through; status line above the editor |
| `src/features/preview/` (`renderMarkdown`, `renderPreviewHtml`, `PreviewedBody`, `PreviewPanel`) | **Modify** | the image rule rewrites `images/{one segment}` to `rustle:` with the workspace the body belongs to |
| CSP, `PreviewHtmlPolicy`, capabilities | **Not touched** | `img-src 'self' data: rustle:` and `img[src]` relative/`rustle:` already allow exactly this |
| Deleting images, drag and drop, raw `<img>` rewriting, scroll sync | **Not touched** | BRIEF §4 |

---

## 3. New Classes / Modules

### Rust

| Name | Kind | Responsibility | Collaborators | Satisfies |
| :--- | :--- | :--- | :--- | :--- |
| `PastedImage` | domain value | `recognize(bytes) -> Option<Self>` by signature (PNG, JPEG, GIF, BMP, TIFF, WebP, SVG); `storage()` → `ImageStorage::{Original { extension }, ConvertToPng}` (animation read from the GIF block structure and the WebP `VP8X` flag) | — | TC-06~TC-12 |
| `Clipboard` | domain trait (mockable) | `image_candidates()`: the bytes of every file the clipboard references, in order, or else its bitmap | — | TC-50, TC-51 |
| `ImageConverter` | domain trait (mockable) | `convert_to_png(bytes)` | — | TC-07, TC-10, TC-11 |
| `IdentifierGenerator` | domain trait (mockable) | a fresh unique identifier per call | — | TC-01, TC-05 |
| `ImageAssetRepository` | domain trait | `create` (create-new in `images/`, folder created on demand, never replaces) and `read` | — | TC-02, TC-03, TC-34~TC-38, TC-26~TC-32 |
| `SaveClipboardImages` | application use case | read → recognise → convert all → name → create all; empty answer when nothing is an image; the first failure ends the paste | the four traits | TC-01~TC-12, TC-39, TC-40, TC-50, TC-51 |
| `SystemClipboard` | infrastructure | `clipboard-rs`: file URLs first (each file's bytes), else `public.png`, else `public.tiff` | — | real clipboard |
| `RasterImageConverter` | infrastructure | `image` crate decode → PNG encode | — | TC-07 |
| `UuidGenerator` | infrastructure | UUID v4 | — | TC-01 |
| `FileSystemImageAssetRepository` | infrastructure | confined paths through `ResolvedVaultScope` before every step; NotFound vs. Unreadable kept apart | `ResolvedVaultScope` | TC-02, TC-03, TC-26~TC-38 |
| `VaultAssetRequest` (in `vault_asset_scheme.rs`) | src-tauri | parse `rustle://vault/{workspace}/images/{file}` into names, refusing any other shape | `url`, domain names | TC-29, TC-29a, TC-30 |

### TypeScript

| Name | Kind | Responsibility | Satisfies |
| :--- | :--- | :--- | :--- |
| `ImagePaste` | class | decides whether a paste is its own (not composing, a workspace, an image item of a recognised type); calls `saveClipboardImage`; owns `status` (`idle` / `saving` / `failed`); inserts all lines in one `isolateHistory` transaction at the paste position mapped through edits made meanwhile, cursor inside the last `![]`; drops the answer if the document was replaced; clears a failure on success and on workspace change | TC-04, TC-13~TC-19, TC-39~TC-49 |
| `ImagePasteStatusLine` | component | the one non-blocking line above the editor: "正在存圖片…" (`role=status`) or the failure (`role=alert`) | TC-39, TC-47, TC-49 |

---

## 4. Modified Components

| Component | Current role | Change needed |
| :--- | :--- | :--- |
| `renderMarkdown(body)` | markdown-it, not sanitized | `renderMarkdown(body, { workspace })`: an `image` renderer rule rewrites `images/{one segment}` (already normalized by markdown-it) to `rustle://vault/{encodeURIComponent(workspace)}/images/{segment}`; nothing else is touched |
| `renderPreviewHtml(body)` | the only door | takes the workspace and passes it on |
| `PreviewedBody` | the body the preview shows | also `workspace`, which changes only with the document |
| `VaultAssetScheme` | answers 501 | 200 + `Content-Type` + `nosniff`; 404 when missing; 403 for every refused shape or outside-vault location; 500 otherwise; bodies never carry a path |

---

## 5. Component Relationships

```mermaid
flowchart TD
    Editor[MarkdownEditor] -->|paste extension| Paste[ImagePaste]
    Paste -->|saveClipboardImage(workspace)| Command[save_clipboard_image]
    Command --> UseCase[SaveClipboardImages]
    UseCase --> Clipboard[[Clipboard]]
    UseCase --> Pasted[PastedImage]
    UseCase --> Converter[[ImageConverter]]
    UseCase --> Ids[[IdentifierGenerator]]
    UseCase --> Assets[[ImageAssetRepository]]
    Assets -.impl.-> FsAssets[FileSystemImageAssetRepository] --> Scope[ResolvedVaultScope]
    Preview[PreviewPanel] --> Render[renderPreviewHtml body, workspace] -->|img src rustle://vault/...| Scheme[VaultAssetScheme]
    Scheme --> FsAssets
```

---

## 6. Extensibility & Handoff Notes

- **Most likely next requirement:** drag-and-drop or "insert image from file" (BRIEF §9), or another image format.
- **Where it lands:** a new source of bytes is another `Clipboard`-like input to the same pipeline — the recognise/convert/name/create sequence in `SaveClipboardImages` does not change; a new format is a `PastedImage` signature + `ImageStorage` decision + one `ImageFileName::media_type` line.
- **How to add it:** a drop handler in `ImagePaste` next to `paste`, reusing its status and insertion; on the Rust side a use case that takes bytes instead of reading the clipboard can share `PastedImage` and the repository.
- **Do not hardcode:** the folder name (`IMAGES_FOLDER_NAME`), the scheme name/host (`VAULT_ASSET_SCHEME`, `vault`), the recognised MIME list (one constant in `ImagePaste`).
- **Known debt / deferred:** reading a referenced file reads the whole file even if it then turns out not to be an image; harmless because the webview only asks when it saw an image type.

---

## 7. Traceability

| PRD Scenario | Fulfilled by |
| :--- | :--- |
| TC-01, TC-05 | `SaveClipboardImages` + `IdentifierGenerator`/`UuidGenerator` |
| TC-02, TC-03 | `FileSystemImageAssetRepository::create` |
| TC-04 | `ImagePaste` (no dialog anywhere in the path) |
| TC-06~TC-11 | `PastedImage::storage` + `SaveClipboardImages` (converter only for `ConvertToPng`) + `RasterImageConverter` |
| TC-12, TC-12a | `PastedImage::recognize` (Rust); `ImagePaste` recognised MIME list (webview) |
| TC-13~TC-15 | `ImagePaste` insertion |
| TC-16~TC-19 | `ImagePaste` (`isolateHistory`, one transaction; no delete channel exists) |
| TC-20~TC-24 | `renderMarkdown` image rule + `PreviewedBody.workspace` |
| TC-21 | `ImagePaste` inserts only the relative path; the body is saved by autosave unchanged |
| TC-25, TC-33 | CSP unchanged (`content_security_policy` test); Tauri custom schemes never bypass the CSP |
| TC-26~TC-32 | `VaultAssetScheme` + `VaultAssetRequest` + `ImageFileName::media_type` + `FileSystemImageAssetRepository::read` |
| TC-34~TC-38 | `FileSystemImageAssetRepository::create`, `WorkspaceName`/`ImageFileName` parsing |
| TC-39~TC-41a | `ImagePaste` status + `ImagePasteStatusLine`; use case stops at the first failure |
| TC-42~TC-46 | `ImagePaste` paste handler |
| TC-47~TC-49 | `ImagePaste` status (`saving` while any save is in flight); async command off the UI thread |
| TC-50, TC-51 | `SaveClipboardImages` (order kept, empty answer) |

---

## 8. Risks & Open Decisions

- **Clipboard library.** `clipboard-rs 0.3.5` (default features off): it gives raw pasteboard data (`public.png` bytes as they are, so a screenshot is never re-encoded) and every copied file URL (so several files from Finder really arrive as several images). `arboard` only hands out decoded RGBA, which would force a PNG re-encode on the main path.
- **Conversion library.** `image 0.25.10` with only the PNG/JPEG/BMP/TIFF/GIF/WebP codecs; pure Rust, no native binaries (BRIEF §8 risk does not materialise).
- **Literal `..` vs. encoded `%2e%2e` in a `rustle:` request.** A literal dot segment in the request path is refused outright (TC-29); otherwise the path is read through the WHATWG URL parser, which folds `%2e%2e` away, so TC-29a reads `outside/images/x.png` — still a plain name inside the vault. In practice WebKit normalises both before the request is made.
- **Windows.** Tauri serves custom schemes there as `http://rustle.localhost/…`; the preview rewrite uses `rustle://vault/…` (macOS/Linux). The app targets macOS today.
- **Partial multi-image failure.** Files created before the failing one stay (R-18: images are never deleted); no syntax is inserted (R-19). Conversions all run before the first file is created, so a broken image never leaves files behind.
- **Clipboard read off the main thread.** `NSPasteboard` reads from a worker thread; that is what keeps the UI responsive for large images.
