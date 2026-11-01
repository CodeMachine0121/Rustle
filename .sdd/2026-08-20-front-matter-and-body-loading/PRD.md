# 需求規格 — Front matter 剝離／接回

- **切片**：Wave 1，`feature/front-matter-and-body-loading`
- **上游文件**：[BRIEF.md](BRIEF.md)、需求文件 §3.2、§3.3、§7.3、§7.4
- **覆蓋需求 ID**：**R-6、R-7、R-8、R-9、FR-4.1**、FR-2.3（載入半段）、§7.3 分層原則與安全基線（符號連結缺口）
- **詞彙**：一律依通用語言地圖（本切片新增 `ArticleDocument`、`ArticleFileNameSlug` 兩列）
- **輸入法回歸項目**：本切片不碰編輯器擴充、不碰對話框、不碰計時器，因此不新增輸入法風險。交付後仍應重跑 **T-4**（在正文中打中文與程式碼區塊）與 **T-11**（組字中切換文章，待 Wave 2 的清單交付後才驗得到），因為編輯區的內容自此改為來自真實檔案

---

## 1. 目標

讓一個 `.md` 檔案與編輯區之間有一條**只交出正文、接回時一位元都不多改**的翻譯，並且把「這篇文章的 metadata 是什麼」用寬容的方式讀出來給後續切片用。

## 2. User Stories

| ID | 故事 |
| :--- | :--- |
| **US-1** | 作為使用者，我要打開一篇文章時眼前只有正文，`---` 區塊與 YAML 永遠不出現在編輯區，這樣我寫作時不會被 metadata 語法干擾 |
| **US-2** | 作為使用者，我要 Rustle 存檔之後，我自己加的 front matter 欄位、我排的鍵順序、我寫的註解都還在原位，這樣 Rustle 只是「編輯我的檔案」而不是「接管我的檔案」 |
| **US-3** | 作為使用者，我要 `category` 與 `tags` 永遠是同一種格式（YAML 清單），這樣同一個 vault 不會出現兩種寫法 |
| **US-4** | 作為使用者，我要別的工具（或我自己）手寫的 front matter 也讀得懂——單一字串的 `category`、沒有 `title` 的檔案都不能讓 Rustle 打不開，但要讓我看得出這篇的 metadata 不完整 |
| **US-5** | 作為使用者，我要新文章的檔名由標題產生，中文標題保留中文，撞名時自動編號，這樣我不必為檔名做決定 |
| **US-6** | 作為使用者，我要 Rustle 只讀得到我 vault 裡的東西——連「vault 裡有一個符號連結指向外面」都不行 |
| **US-7** | 作為 Wave 2 自動儲存切片的開發者，我要一個「把正文接回 front matter」的物件，這樣我只需要處理時機與原子寫檔，不必自己碰 YAML |

## 3. 業務流程

### 3.1 載入一篇文章的正文（FR-2.3 的載入半段、FR-4.1）

```
畫面層指名一篇文章（workspace 名稱 + 檔名，不是路徑）
   → 負責檔案存取的那一層把名稱換成 vault 內的位置（逃出 vault 一律拒絕）
   → 透過檔案系統把該位置的符號連結解析掉，再確認它仍落在 vault 內
        └─ 解析後落在 vault 外 → 拒絕，不讀任何內容
   → 讀出檔案內容與檔案修改時間
   → 把檔案拆成「front matter 區塊」與「正文」
        ├─ 檔頭有成對的 --- → 區塊留在負責檔案存取的那一層，正文往外送
        └─ 沒有成對的 ---   → 整個檔案就是正文
   → 畫面層拿到：正文、它問的那篇文章的指名、檔案修改時間
   → 編輯區顯示正文（永遠沒有機會看到 --- 區塊）
```

### 3.2 讀出一篇文章的 metadata（R-7，供 Wave 2 的文章清單）

```
拆出 front matter 區塊
   → 逐一取出 Rustle 認識的欄位
        ├─ title 是非空字串        → 用它
        └─ 其他情況（缺、空、非字串、區塊壞掉） → 用檔名去掉 .md，並標記「metadata 不完整」
   → category / tags
        ├─ 是清單 → 取其中的字串項目
        ├─ 是單一字串 → 一個元素的清單
        └─ 缺 → 空清單
   → created_at / updated_at 缺失 → 空字串
```

### 3.3 接回 front matter（R-6／R-8，供 Wave 2 的自動儲存與 Wave 3／4 的 metadata 寫入）

```
給定「這個檔案原本的內容」與「要改什麼」
   → 只被要求換正文
        → front matter 區塊逐字保留，正文換掉                    ← 最強的 R-8 保證
   → 被要求改 Rustle 認識的欄位（updated_at / title / category / tags / created_at）
        ├─ 區塊解析得動 → 在 YAML 文件上改那幾個鍵，其餘（未知欄位、鍵順序、註解）原樣輸出
        │                  category / tags 一律輸出成清單形式；空清單則移除該鍵
        ├─ 區塊解析不動 → 逐字保留整個區塊，不重寫（正文照換，存檔不被阻擋）
        └─ 本來沒有區塊 → 建立一個，只放被要求寫入的欄位，正文不動
   → 原本用 CRLF 的區塊，輸出也用 CRLF；原本有 BOM，輸出也有 BOM
```

### 3.4 由標題產生檔名（R-9，供 Wave 3 的建立文章）

```
給定標題與該 workspace 已存在的檔名
   → 轉小寫 → 空白收斂成 "-" → 移除檔名不合法字元 → "-" 收斂、去頭尾
   → 什麼都不剩 → "untitled"
   → 加上 ".md"
   → 與已存在的檔名比對（不分大小寫）
        ├─ 沒撞 → 就用它
        └─ 撞了 → 依序試 "-2"、"-3"… 直到不撞
```

---

## 4. 驗收標準（Gherkin）

### Feature：編輯區永遠看不到 front matter（FR-4.1）

```gherkin
# TC-01
場景: 有 front matter 的檔案只交出正文
  假設 一個檔案的內容是
    """
    ---
    title: Zen of Writing
    ---

    正文的第一行。
    """
  當 讀出這個檔案的正文
  那麼 正文是 "\n正文的第一行。\n"
  並且 正文裡不含 "---"
  並且 正文裡不含 "title:"

# TC-02
場景: 正文裡本來就有的 --- 留在正文裡
  假設 一個檔案在 front matter 之後的正文含有一行 "---"（Markdown 的分隔線）
  當 讀出這個檔案的正文
  那麼 那一行 "---" 還在正文裡

# TC-03
場景: 沒有 front matter 的檔案，整個檔案都是正文
  假設 一個檔案的內容是 "# 只有正文\n\n第二段。\n"
  當 讀出這個檔案的正文
  那麼 正文與檔案內容完全相同

# TC-04
場景: 只有開頭的 --- 沒有結尾的 ---，整個檔案都是正文
  假設 一個檔案以 "---" 開頭，但後面沒有任何一行是 "---"
  當 讀出這個檔案的正文
  那麼 正文與檔案內容完全相同
  （寧可讓使用者看到那一行，也不能吃掉整個檔案）

# TC-05
場景: --- 不在第一行就不算 front matter
  假設 一個檔案的第一行是空行，第二行才是 "---"
  當 讀出這個檔案的正文
  那麼 正文與檔案內容完全相同

# TC-06
場景: 空的 front matter 區塊照樣被剝掉
  假設 一個檔案的內容是 "---\n---\n正文。\n"
  當 讀出這個檔案的正文
  那麼 正文是 "正文。\n"

# TC-07
場景: 檔案以 BOM 開頭時照樣認得 front matter
  假設 一個檔案以 BOM 開頭，接著才是 "---" 的 front matter 區塊
  當 讀出這個檔案的正文
  那麼 正文不含 "---"
  並且 正文不含 BOM

# TC-08
場景: CRLF 檔案的正文保留 CRLF
  假設 一個檔案的 front matter 與正文都用 CRLF 換行
  當 讀出這個檔案的正文
  那麼 正文裡的換行仍然是 CRLF
  並且 正文不含 "---"

# TC-09
場景: front matter 是壞的 YAML 也照樣剝掉
  假設 一個檔案的 front matter 區塊縮排錯誤而無法解析
  當 讀出這個檔案的正文
  那麼 正文不含那個區塊的任何一行
  （FR-4.1 是硬性需求，不因為 YAML 壞掉而例外）

# TC-10
場景: 正文逐字保留
  假設 一個檔案的正文以空行開頭、以換行結尾、中間含連續空行與行尾空白
  當 讀出這個檔案的正文
  那麼 正文與檔案中 front matter 之後的部分逐字相同
```

### Feature：寬容解析 metadata（R-7）

```gherkin
# TC-11
場景: 五個欄位齊全時照實讀出
  假設 一個檔案的 front matter 有 title、created_at、updated_at、category 清單與 tags 清單
  當 讀出這個檔案的 metadata
  那麼 五個欄位的值都與檔案裡的一致
  並且 沒有被標記為 metadata 不完整

# TC-12
場景大綱: 單一字串的分類或標籤讀成一個元素的清單
  假設 一個檔案的 front matter 寫的是 "<鍵>: <值>"
  當 讀出這個檔案的 metadata
  那麼 對應的欄位是只有 "<值>" 一個元素的清單

  例子:
    | 鍵       | 值       |
    | category | 技術筆記  |
    | tags     | electron |

# TC-13
場景: 沒有分類與標籤時讀成空清單
  假設 一個檔案的 front matter 只有 title
  當 讀出這個檔案的 metadata
  那麼 分類是空清單
  並且 標籤是空清單

# TC-14
場景: 清單裡的非字串項目略過
  假設 一個檔案的 tags 清單是 "- electron"、"- 12"、"- true"
  當 讀出這個檔案的 metadata
  那麼 標籤只有 "electron"

# TC-15
場景大綱: 沒有可用的 title 時以檔名代替並標記不完整
  假設 檔名是 "zen-of-writing.md"
  並且 front matter 的 title 是 "<情況>"
  當 讀出這個檔案的 metadata
  那麼 標題是 "zen-of-writing"
  並且 這篇文章被標記為 metadata 不完整

  例子:
    | 情況            |
    | （沒有這個鍵）    |
    | （空值）         |
    | "   "           |
    | 2026（不是字串）  |

# TC-16
場景: 以檔名代替標題時只去掉 .md，且保留非 ASCII 字元
  假設 檔名是 "台積電-法說會.md"
  並且 front matter 沒有 title
  當 讀出這個檔案的 metadata
  那麼 標題是 "台積電-法說會"

# TC-17
場景: 有 title 時不標記不完整
  假設 一個檔案的 front matter 有 title "Zen of Writing"
  當 讀出這個檔案的 metadata
  那麼 標題是 "Zen of Writing"
  並且 沒有被標記為 metadata 不完整

# TC-18
場景: 缺少時間欄位時讀成空字串
  假設 一個檔案的 front matter 只有 title
  當 讀出這個檔案的 metadata
  那麼 建立時間是空字串
  並且 更新時間是空字串
  並且 沒有被標記為 metadata 不完整
  （「不完整」這個標記依通用語言地圖只代表 title 走了 fallback）

# TC-19
場景: front matter 壞掉時走 fallback 並標記不完整
  假設 一個檔案的 front matter 區塊無法解析
  當 讀出這個檔案的 metadata
  那麼 標題是檔名去掉 .md 的結果
  並且 這篇文章被標記為 metadata 不完整
```

### Feature：接回 front matter 時一位元都不多改（R-8）

```gherkin
背景:
  假設 一個檔案的 front matter 是
    """
    # 這個檔案是什麼
    title: Tauri 與 Electron 的取捨
    created_at: 2026-08-20T14:32:05+08:00
    updated_at: 2026-08-20T16:04:11+08:00
    draft: true
    category:
      - 技術筆記 # 這一項的註解
      - 桌面開發
    tags:
      - electron

    # 區塊最後的註解
    """

# TC-20
場景: 只換正文時 front matter 區塊逐字不動
  當 把正文換成 "新的正文。\n"
  那麼 新檔案內容中 front matter 區塊與原本逐字相同
  並且 新檔案的正文是 "新的正文。\n"

# TC-21
場景: 換正文並更新 updated_at 時，只有那個值改變
  當 把正文換成 "新的正文。\n" 並把 updated_at 改成 "2026-09-01T09:00:00+08:00"
  那麼 新檔案的 updated_at 是 "2026-09-01T09:00:00+08:00"
  並且 title、created_at 與 draft 的值都沒有改變
  並且 draft 這個 Rustle 不認識的鍵還在
  並且 鍵的順序仍然是 title、created_at、updated_at、draft、category、tags

# TC-22
場景: 三個位置的註解都留著
  當 把 updated_at 改成新的時間
  那麼 區塊開頭的註解 "# 這個檔案是什麼" 還在原位
  並且 清單項目後面的註解 "# 這一項的註解" 還跟著那個項目
  並且 區塊最後的註解 "# 區塊最後的註解" 還在最後

# TC-23
場景: 原本的正文沒有被要求改時保持不動
  當 只把 updated_at 改成新的時間
  那麼 新檔案的正文與原本逐字相同

# TC-24
場景: 長值不會被折行
  假設 一個檔案的 title 是一段超過 80 字元、含空白的長句
  當 把 updated_at 改成新的時間
  那麼 新檔案的 title 仍然在同一行上
```

### Feature：分類與標籤一律寫成清單（R-6）

```gherkin
# TC-25
場景大綱: 只有一個元素也寫成清單形式
  假設 一個檔案的 front matter 有 title
  當 把 <欄位> 寫成只有一個元素 "<值>"
  那麼 新檔案裡出現 "<鍵>:" 後面接一行 "  - <值>"
  並且 新檔案裡不出現 "<鍵>: <值>"

  例子:
    | 欄位  | 鍵       | 值       |
    | 分類  | category | 技術筆記  |
    | 標籤  | tags     | electron |

# TC-26
場景: 寫入空的分類時移除該鍵
  假設 一個檔案的 front matter 有 category 清單
  當 把分類寫成空清單
  那麼 新檔案裡不再有 category 這個鍵
  並且 其他鍵都還在

# TC-27
場景: 改 metadata 時未知欄位、鍵順序與註解都保留
  當 把 title、分類與標籤一起換掉
  那麼 title、category、tags 是新的值
  並且 draft 這個未知欄位與它的位置沒有改變
  並且 註解都還在

# TC-28
場景: 原本沒有 front matter 的檔案被寫入欄位時，建立一個區塊
  假設 一個檔案只有正文 "# 只有正文\n"
  當 寫入 title 與只有一個元素的分類
  那麼 新檔案以 "---" 開頭、以 "---" 結束一個 front matter 區塊
  並且 區塊裡有 title 與清單形式的 category
  並且 區塊之後的正文是 "# 只有正文\n"

# TC-29
場景: CRLF 檔案接回去的區塊也用 CRLF
  假設 一個檔案的 front matter 與正文都用 CRLF 換行
  當 把 updated_at 改成新的時間
  那麼 新檔案的 front matter 區塊裡的換行是 CRLF

# TC-30
場景: 以 BOM 開頭的檔案接回去仍以 BOM 開頭
  假設 一個檔案以 BOM 開頭
  當 把 updated_at 改成新的時間
  那麼 新檔案仍以 BOM 開頭，接著才是 "---"

# TC-31
場景: front matter 壞掉時正文照存、區塊逐字保留
  假設 一個檔案的 front matter 區塊無法解析
  當 把正文換掉並要求把 updated_at 改成新的時間
  那麼 新檔案的正文是新的正文
  並且 front matter 區塊與原本逐字相同
  （寧可存不到 updated_at，也不能弄壞使用者的檔案或擋掉存檔）
```

### Feature：由標題產生檔名（R-9）

```gherkin
# TC-32
場景大綱: 由標題產生檔名
  當 用標題 "<標題>" 產生檔名，且該 workspace 沒有任何檔案
  那麼 檔名是 "<檔名>"

  例子:
    | 標題                          | 檔名                             | 為什麼 |
    | Zen of Writing                | zen-of-writing.md               | 轉小寫、空白轉 - |
    | Tauri 與 Electron 的取捨       | tauri-與-electron-的取捨.md      | 非 ASCII 保留原字元 |
    | A/B 測試: 第一輪               | ab-測試-第一輪.md                | 檔名不合法字元移除 |
    |   好多   空白                  | 好多-空白.md                     | 空白收斂、頭尾不留 - |
    | 前後 -- 破折號 --              | 前後-破折號.md                   | 連續 - 收斂、頭尾去掉 |
    | ///                           | untitled.md                     | 什麼都不剩時的最後防線 |
    | （空字串）                     | untitled.md                     | 同上 |

# TC-33
場景: 撞名時加上 -2
  假設 該 workspace 已經有 "zen-of-writing.md"
  當 用標題 "Zen of Writing" 產生檔名
  那麼 檔名是 "zen-of-writing-2.md"

# TC-34
場景: 再撞名時繼續往下編號
  假設 該 workspace 已經有 "zen-of-writing.md" 與 "zen-of-writing-2.md"
  當 用標題 "Zen of Writing" 產生檔名
  那麼 檔名是 "zen-of-writing-3.md"

# TC-35
場景: 撞名的比對不分大小寫
  假設 該 workspace 已經有 "ZEN-OF-WRITING.md"
  當 用標題 "Zen of Writing" 產生檔名
  那麼 檔名是 "zen-of-writing-2.md"
  （檔案系統不分大小寫，分大小寫比對會產生「檢查說沒撞、建立時撞了」）
```

### Feature：讀檔只在 vault 之內（§7.3 安全基線）

```gherkin
# TC-36
場景: 讀出 vault 內一篇文章的內容與修改時間
  假設 vault 裡有 workspace "Blog"，其中有檔案 "zen-of-writing.md"
  當 讀出這個檔案
  那麼 得到它的內容
  並且 得到它的檔案修改時間

# TC-37
場景: vault 自己位在符號連結之後也讀得到
  假設 vault 的路徑本身經過一條符號連結（例如 macOS 的 /var 指向 /private/var）
  當 讀出 vault 內一篇文章
  那麼 照樣讀得到，不被誤判成逃出 vault

# TC-38
場景: 檔案是指向 vault 外面的符號連結時拒絕
  假設 workspace "Blog" 裡的 "escape.md" 是一條指向 vault 外面某個檔案的符號連結
  當 讀出 "escape.md"
  那麼 拒絕並回報逃出 vault
  並且 沒有讀到那個檔案的任何內容

# TC-39
場景: workspace 資料夾是指向 vault 外面的符號連結時拒絕
  假設 vault 底下的 "Escaped" 是一條指向 vault 外面某個資料夾的符號連結
  當 讀出 "Escaped" 裡的一篇文章
  那麼 拒絕並回報逃出 vault

# TC-40
場景: 名稱本身會逃出 vault 時拒絕，且不碰檔案系統
  當 讀出 workspace "Blog" 裡的 "../secret.md"
  那麼 拒絕並回報逃出 vault

# TC-41
場景: 檔案不存在時明確失敗
  當 讀出 workspace "Blog" 裡不存在的 "missing.md"
  那麼 明確失敗
  並且 不會回傳空字串當作正文
```

### Feature：`readBody` 這個通道（FR-2.3 的載入半段）

```gherkin
# TC-42
場景: 通道交出的是正文與它被問的那一篇
  假設 workspace "Blog" 的 "zen-of-writing.md" 有 front matter 與正文
  當 畫面層透過 readBody 指名這一篇
  那麼 回覆裡的正文不含 front matter 的任何一行
  並且 回覆裡的指名就是被問的 workspace 名稱與檔名
  並且 回覆裡帶著檔案修改時間（供之後偵測外部改動）

# TC-43
場景: 沒有 front matter 的文章也回得出正文
  假設 workspace "Blog" 的 "plain.md" 沒有 front matter
  當 畫面層透過 readBody 指名這一篇
  那麼 回覆裡的正文就是整個檔案內容

# TC-44
場景: 指名會逃出 vault 時，通道以「逃出 vault」失敗
  當 畫面層透過 readBody 指名 workspace "Blog" 裡的 "../../etc/passwd"
  那麼 這次呼叫失敗，原因是逃出 vault
```

---

## 5. 不在本切片的範圍

| 事情 | 誰做 |
| :--- | :--- |
| `saveBody` 通道（自動儲存時機、原子寫檔、外部改動偵測） | Wave 2 `autosave-and-atomic-write`。本切片交付它要用的文件物件與 R-6／R-8 的行為 |
| `listArticles` 通道（掃資料夾、組出每一列） | Wave 2 `vault-workspace-and-article-listing`。本切片交付它要用的寬容 metadata 解析 |
| `createArticle` 通道（真的建立檔案） | Wave 3 `create-article-dialog`。本切片交付 R-9 的檔名產生與 R-6 的欄位寫入 |
| `updateMetadata` 通道 | Wave 4 `metadata-editing-and-destructive-operations` |
| 建立路徑上的符號連結檢查（檔案還不存在，`realpath` 用不上） | Wave 2／Wave 3（見 BRIEF §9 的 D-1） |
| 編輯區「點選文章就載入」的 UI 互動 | Wave 2（版面與清單） |
