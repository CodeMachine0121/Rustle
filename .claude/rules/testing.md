# Testing

## 測業務行為，不測實作細節

- 測「給這個輸入 → 得到這個業務結果」。重構內部時，測試不該跟著壞。
- 不為 Tauri、serde、CodeMirror 本身寫測試。
- 測試名稱用英文描述行為：`rejects_workspace_name_with_slash`，不放任何 SDD 代號。

## 放哪裡（Rust 慣例）

- **單元測試**：同檔 `#[cfg(test)] mod tests`。domain 規則主要在這裡測。
- **整合測試**：crate 的 `tests/` 資料夾，只用公開 API。application 用例、infrastructure 的真實檔案系統行為在這裡測。
- 碰檔案系統的測試用 `tempfile` 建臨時資料夾跑真的 I/O，不 mock 檔案系統。
- 多組輸入輸出用 `rstest` 的 `#[case]` 或表格迴圈。

## Mock

- 只 mock **最外層、不穩定或慢的邊界**：時鐘、亂數、剪貼簿、垃圾桶、系統對話框。
- 用 `mockall`（`#[cfg_attr(test, mockall::automock)]`；跨 crate 用時以 `mocks` feature 開出來）。
- 不手寫 fake 型別。
- application 測試用**真的 domain 型別**，只 mock 邊界。

## 前端

- Vitest + Testing Library 測畫面行為（按鍵、對話框、清單）。
- 輸入法組字無法完全自動化的部分，留人工回歸清單在 `docs/ime-regression-checklist.md`。

## 必須全綠

每顆 commit 前：

```
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
pnpm typecheck && pnpm lint && pnpm test
```
