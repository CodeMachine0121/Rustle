# Architecture

Rustle 是 **Tauri 2 桌面 App**：Rust 後端 + TypeScript 前端（webview）。
後端照 Rust 社群慣例分層，**用 crate 邊界讓編譯器守依賴方向**，不靠人記。

## 依賴方向

```
 src-tauri (組裝根 + Tauri command) ──▶ application ──▶ domain ◀── infrastructure
                                                         ▲
                                            trait 定義在 domain，實作在 infrastructure
```

- **domain** 不依賴其他 crate 的程式碼，也不依賴 Tauri、`std::fs`、任何 I/O 套件。只允許純資料／演算法類依賴（`serde`、`thiserror`、`time`…）。
- **application** 只依賴 domain。編排用例，回傳給呼叫端的形狀。
- **infrastructure** 依賴 domain，實作 domain 定義的 trait（檔案系統、剪貼簿、垃圾桶、時鐘…）。
- **src-tauri** 是唯一認得所有具體型別的地方：組裝依賴、註冊 Tauri command、設定視窗與安全政策。Tauri command 只做參數轉換與錯誤對映，不放業務邏輯。

## Cargo workspace 配置

```
Cargo.toml                 workspace
crates/
├── domain/                純領域：型別、規則、trait
├── application/           用例
└── infrastructure/        trait 的實作（I/O）
src-tauri/                 Tauri App：main.rs、commands、組裝
src/                       前端（TypeScript）
```

- crate 名稱：`rustle-domain`、`rustle-application`、`rustle-infrastructure`。
- 依賴版本統一寫在 `[workspace.dependencies]`，各 crate 用 `xxx.workspace = true`。
- 模組用 `foo.rs` + `foo/` 的寫法，不用 `mod.rs`。

## Domain：行為跟著資料走

- Rust 慣例：**資料與行為放在同一個型別的 `impl` 裡**。
- **用型別表達規則**（parse, don't validate）：不合法的狀態建不出來。例：`WorkspaceName::parse(&str) -> Result<WorkspaceName, _>`，拿到 `WorkspaceName` 就一定合法。
- 有意義的原始值用 newtype 包起來（`ArticleFileName(String)`），不讓 `String` 到處跑。
- 有限狀態用 `enum`，不用字串或布林旗標。
- 只服務某個型別的函式，放進那個型別的 `impl`。
- 跨多個型別的編排才放進 application 的用例。

## Application：用例

- 一個用例一個 struct，名稱是動詞片語：`ListArticles`、`SaveArticleBody`。
- 依賴**預設用泛型**注入；需要執行期替換時才用 `Arc<dyn Trait>`。
- 回給 Tauri command 的資料是 `#[derive(Serialize)]` struct，欄位 `#[serde(rename_all = "camelCase")]` 對應前端。

## Infrastructure

- 每個外部資源一個實作型別：檔案系統、剪貼簿、垃圾桶、時鐘、亂數。
- 原生錯誤（`std::io::Error` 等）在這層轉成 domain 的錯誤，不往內漏。

## 前端（`src/`）

- TypeScript `strict`，禁止 `any`。
- 只透過一個集中的 command 包裝模組呼叫 Rust；元件裡不直接寫 `invoke("...")`。
- 前端只負責畫面與編輯器互動；檔案、路徑、front matter 一律在 Rust 端。
- 編輯器用 CodeMirror 6。

## 安全（Tauri）

- 用 Tauri 2 capability 只開放需要的 command 與權限。
- CSP 寫在 `tauri.conf.json`，不允許遠端連線。
- 前端只傳名稱（workspace 名、檔名），不傳路徑；路徑在 Rust 端解析並檢查不能逃出 vault。
