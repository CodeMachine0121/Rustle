# Persistence

Rustle 不用資料庫。資料就是 vault 裡的檔案：一篇文章一個 `.md`（front matter + 正文），設定在 `.rustle/settings.json`，圖片在各 workspace 的 `images/`。

- **檔案格式由程式碼定義**：設定檔用 `serde` struct；front matter 由 domain 型別定義。
- **讀寫集中在 repository**：一種資料一個 trait（`ArticleRepository`、`SettingsRepository`…），trait 在 domain，實作在 infrastructure。domain 與 application 不直接碰 `std::fs`。
- **寫檔要原子**：寫到同目錄暫存檔 → `fsync` → `rename`。
- **不丟使用者的資料**：讀到看不懂的欄位（front matter 未知鍵、設定檔未知鍵），寫回時原樣保留。
- **路徑一律經過 vault 範圍檢查**（含符號連結解析），逃出 vault 就拒絕。
- 刪除走系統垃圾桶，不直接永久刪除。
