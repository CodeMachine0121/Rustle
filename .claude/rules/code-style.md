# Code Style

## 工具說了算

- `cargo fmt` 決定排版。
- `cargo clippy --workspace --all-targets -- -D warnings` 必須乾淨。
- 前端：`tsc --noEmit` 與 ESLint 必須乾淨。

## 可讀性優先，少寫註解

- **程式碼本身要能讀**：好名字、短函式、早返回、用型別說話。
- **不寫解釋「做了什麼」的註解**。名字講不清楚，就改名或拆出有名字的函式／型別。
- 只在「為什麼」不明顯時寫一行註解（例如繞過某個平台 bug）。
- 只有用法不直覺時才寫 doc comment。
- 不留被註解掉的程式碼、不留 TODO 清單。

## 錯誤處理

- library crate 用 `thiserror` 定義具名錯誤 enum。
- `src-tauri` 把錯誤轉成可序列化的形狀回給前端。
- **production code 禁用 `unwrap()`**；真的不可能失敗時用 `expect("原因")`。測試裡可以用。
- 用 `?` 往上傳，不吞錯誤。
- 可預期的業務結果（例如「檔案在你編輯時被外部改了」）用回傳值表達，不用錯誤。

## 型別

- 內部不用 `Box<dyn Any>` 或 `serde_json::Value` 傳資料；只在對接外部格式時於 infrastructure 內短暫使用。
- 能借用就借用（`&str`、`&[T]`）。
- 優先用 iterator 與 pattern matching。
- 不用 `unsafe`。

## 結構

- 函式只做一件事；太長是該拆型別或拆用例的訊號。
- 沒有 `utils.rs` / `helpers.rs` 雜物櫃；行為放進它操作的型別。
- 可見性從最小開始：預設私有，需要才 `pub(crate)`，再需要才 `pub`。

## TypeScript

- `strict: true`，禁止 `any`、禁止 `@ts-ignore`。
- 元件保持小，狀態集中管理。
- 同樣不寫解釋「做了什麼」的註解。
