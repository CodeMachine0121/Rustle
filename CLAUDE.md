# CLAUDE.md

Rustle：本機 Markdown 寫作 App。Tauri 2（Rust 後端 + TypeScript/CodeMirror 前端）。

## 動工前必讀

- [.claude/rules/workflow.md](.claude/rules/workflow.md) — 現在該做哪個階段
- [.claude/rules/architecture.md](.claude/rules/architecture.md) — 東西放哪個 crate、哪一層
- [.claude/rules/naming.md](.claude/rules/naming.md) — 東西叫什麼
- [.claude/rules/code-style.md](.claude/rules/code-style.md) — 怎麼寫（少註解、高可讀）
- [.claude/rules/development-standards.md](.claude/rules/development-standards.md) — 分支、commit、PR

需求在 `.sdd/{YYYY-MM-DD}-{feature-slug}/BRIEF.md`、`PRD.md`；專案總覽在 `.sdd/PROJECT.md`。

## 不可妥協

1. domain crate 不碰 I/O、不碰 Tauri；依賴方向由 crate 邊界保證。
2. 照 Rust API Guidelines 命名；trait 不加 `I` 前綴。
3. 程式碼要自己會說話，不寫解釋「做了什麼」的註解。
4. production code 不 `unwrap()`；錯誤用 `thiserror` 具名。
5. `cargo fmt`、`cargo clippy -D warnings`、`cargo test`、前端 typecheck/lint/test 全綠才 commit。
6. 開發在 `feature/*`，PR review 後以一般 merge commit 合回 `main`。
7. commit message：英文 Conventional Commits，不出現任何 SDD 代號（TC、US、AC、FR 編號、切片資料夾名）。
8. 每次「接進 App」（組裝、command 註冊、啟動流程、設定）各自一顆 commit。
9. commit 作者：`CodeMachine <CodeMachine0121@gmail.com>`。
