# 開發流程

```
/clarify ──▶ /prd ──▶ /architecture ──▶ /implement ──▶ /improve-codebase ──▶ /contract
 BRIEF.md     PRD.md     ARCH.md        程式碼＋測試       重構（有取捨）       追溯矩陣
```

現有切片的 `BRIEF.md`、`PRD.md` 已經定案，直接從 `/architecture` 開始。

| 階段 | 做什麼 | 產出 |
| :--- | :--- | :--- |
| `/architecture` | 讀 PRD，決定改哪些檔、新增哪些型別、放哪個 crate。站在「下一個要擴充的人」的角度設計 | `ARCH.md` |
| `/implement`（code-first） | 照 ARCH 把切片完整做出來，再補測試覆蓋改動的程式碼 | 程式碼＋測試 |
| `/improve-codebase` | 找出可以合併、加深的模組。**建議不一定都對**：每一條都要想過，符合規則且真的讓程式更好讀才做，否則記下不做的理由 | 重構 commit（或不做的理由） |
| `/contract` | 只用 PRD 推出預期結果，再檢查測試與程式碼是否真的做到 | `CONTRACT.md` |

## 規則

- 只有 `/implement` 和 `/improve-codebase` 動程式碼。
- 實作中做的規格決定，寫回該切片的文件；文件與程式碼不漂移。
- 新功能開新資料夾 `.sdd/{YYYY-MM-DD}-{feature-slug}/`，不改舊切片的文件。
- PRD 有歧義時，選最合理的解釋、寫進 PR 說明的「假設」，不停下來等。
- 完成後：push → 開 PR → review → 修正 → 一般 merge commit 合回 `main`。見 [development-standards.md](development-standards.md)。
