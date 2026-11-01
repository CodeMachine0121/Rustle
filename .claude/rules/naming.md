# Naming

一律照 [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/naming.html)；前端照 TypeScript 社群慣例。

## Rust

| 東西 | 規則 | 例 |
| :--- | :--- | :--- |
| 型別、trait、enum variant | `UpperCamelCase` | `ArticleSummary`、`ArticleRepository` |
| 函式、方法、變數、模組、檔名 | `snake_case` | `list_articles`、`article_summary.rs` |
| 常數、static | `SCREAMING_SNAKE_CASE` | `IMAGES_FOLDER_NAME` |
| crate | `kebab-case` | `rustle-domain` |

- **trait 不加 `I` 前綴**。trait 用能力命名（`ArticleRepository`、`Clock`、`Clipboard`）。
- **實作用「怎麼做」區分**：`FileSystemArticleRepository`、`SystemClock`、`TauriClipboard`。
- 轉換方法照慣例：`as_`（便宜借用）、`to_`（昂貴複製）、`into_`（取走所有權）、`from_` / `From`、`try_from` / `TryFrom`、`parse`。
- getter 不加 `get_`：`article.title()`，不是 `article.get_title()`。
- 建構子：`new`；可能失敗的用 `parse` / `try_new` 或回傳 `Result` 的 `new`。
- 錯誤型別用 `XxxError` 結尾。
- **命名用全名**，不自創縮寫（`workspace_name` 不寫 `ws_name`）。慣用縮寫（`id`、`url`、`io`）可以。

## 業務詞彙

- 同一個業務概念只有一個名字：Vault、Workspace、Article、Front matter、Body、Preview panel、Image asset。
- 用 PRD 裡出現的詞，不自創同義詞（例如「文章」一律是 `article`，不寫 `note`、`post`、`document`）。

## TypeScript

- 型別、元件：`PascalCase`；函式、變數：`camelCase`；檔名照專案既有風格（元件 `PascalCase.tsx`，其餘 `camelCase.ts`）。
- interface 不加 `I` 前綴。
