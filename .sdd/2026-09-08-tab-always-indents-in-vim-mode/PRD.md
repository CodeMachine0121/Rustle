# Vim 模式下 Tab 永遠是縮排 — Product Requirements Document

- **切片**：`feature/tab-always-indents-in-vim-mode`
- **日期**：2026-09-08
- **上游**：[BRIEF.md](BRIEF.md)
- **狀態**：驗收標準已定案，可進 `/architecture`

---

## 1. Background & Goal

### Problem Statement

編輯器把 `Tab` 拿去做縮排，因此欠鍵盤使用者一條離開寫作區的路：**沒有人接手的那一次 `Esc` 之後，緊接著的 `Tab` 交出去、改為移動焦點**（兩秒內、只有一次按鍵的寬度）。

`feature/zen-key-sidebar-fold-and-settings-key` 拿掉了「無條件吃掉 `Esc`」那一層，這條路因此復活——**而且在 Vim 的常態模式也復活了**，因為 Vim 對常態模式的 `Esc` 不接手（已經在常態模式了，`Esc` 照一般方式處理）。

於是 Vim 使用者按 `Esc`（那裡本來就沒事）再按 `Tab`，得到的是焦點跳走而不是縮排。上一個切片把它當成可接受的代價；使用者裁決不接受。

### Expected Outcome

- **Vim 模式開著時，`Tab` 永遠縮排。**
- Vim 模式關著時，那條路一個字都沒變。
- `Esc` 本身不多做任何事。

### Out of Scope

- 不動 Vim 模式關著時的行為。
- 不把「離開專注模式」或任何其他功能加回 `Esc`。
- 不替 Vim 模式另外設計一條離開寫作區的路。真的需要時，那是另一個切片要找一把鍵。

---

## 2. User Stories & Acceptance Criteria

### US-01 — Vim 模式下 Tab 永遠縮排 [priority: P0]

> 身為開著 Vim 的寫作者，我想不論剛才按了什麼，`Tab` 都是縮排，這樣我按 `Esc` 的習慣動作不會害我丟掉游標。

```gherkin
Scenario: 常態模式按過 Esc 之後，Tab 仍然縮排
  Given Vim 模式開著
    And 寫作者在常態模式
  When 寫作者按 "Escape"
    And 寫作者按 "Tab"
  Then 那一行縮排了
    And 焦點仍然在寫作區

Scenario: 從輸入模式退出來之後，Tab 仍然縮排
  Given Vim 模式開著
    And 寫作者在輸入模式
  When 寫作者按 "Escape"
    And 寫作者按 "Tab"
  Then 那一行縮排了

Scenario: 沒按過 Esc 時，Tab 照樣縮排
  Given Vim 模式開著
    And 寫作者在常態模式
  When 寫作者按 "Tab"
  Then 那一行縮排了
```

### US-02 — Vim 模式關著時，離開寫作區的路照舊 [priority: P0]

> 身為不開 Vim、只用鍵盤的寫作者，我需要一條離開寫作區的路，因為 `Tab` 被縮排拿走了。

```gherkin
Scenario: 沒人要的 Esc 之後，Tab 移動焦點
  Given Vim 模式關著
  When 寫作者按 "Escape"
    And 寫作者按 "Tab"
  Then 焦點離開寫作區
    And 那一行沒有縮排

Scenario: 中間按了別的鍵就解除
  Given Vim 模式關著
  When 寫作者按 "Escape"
    And 寫作者按一個字母
    And 寫作者按 "Tab"
  Then 那一行縮排了
```

### US-03 — `Esc` 的其他每一層都不變 [priority: P0]

```gherkin
Scenario: 片語選單照樣關得掉
  Given Vim 模式開著
    And 片語選單開著
  When 寫作者按 "Escape"
  Then 片語選單關掉了

Scenario: 填空照樣停得掉
  Given Vim 模式開著
    And 片語填空進行中
  When 寫作者按 "Escape"
  Then 填空停止了

Scenario: 專注模式照樣不受 Esc 影響
  Given Vim 模式開著
    And 專注模式開著
  When 寫作者按 "Escape"
  Then 專注模式仍然開著

Scenario: 輸入模式照樣退得回常態模式
  Given Vim 模式開著
    And 寫作者在輸入模式
  When 寫作者按 "Escape"
  Then 寫作者在常態模式
```

---

## 3. Business Flow & Logic

`Esc` 的順位一個字都沒改，只是最後多了一句「Vim 開著時就停在這裡」：

```
Esc → 片語選單開著？ ── 是 ──▶ 關掉選單，結束
        │
        否
        ▼
      填空進行中？ ── 是 ──▶ 停止填空，結束
        │
        否
        ▼
      Vim 模式開著？ ── 是 ──▶ Vim 自己決定
        │                       ├─ 輸入模式 → 回常態模式，Vim 收下這個按鍵
        否                       └─ 常態模式 → Vim 不收
        │                            │
        │                            ▼
        │                      **留在編輯器裡**（本切片新增）──▶ Tab 照樣縮排
        ▼
      交還給編輯器本身 ──▶ 武裝「下一次 Tab 移動焦點」
```

### Core Business Rules

| # | 規則 |
| :--- | :--- |
| BR-01 | Vim 模式開著時，沒有人接手的 `Esc` 由編輯器留下，不交出去武裝焦點移動。 |
| BR-02 | 因此 Vim 模式開著時，`Tab` 永遠縮排。 |
| BR-03 | Vim 模式關著時，行為一個字都沒變。 |
| BR-04 | `Esc` 不因為這個切片多做任何事——留下按鍵不是一個功能，是不把它交出去。 |
| BR-05 | 組字中的 `Esc` 照舊屬於輸入法，這個切片不碰。 |

### Edge Cases

| 情況 | 行為 |
| :--- | :--- |
| Vim 開著、選單開著時按 `Esc` | 選單收下這個按鍵，本規則根本不會被問到。 |
| Vim 開著、輸入模式按 `Esc` | Vim 收下，本規則不會被問到。今天就是這樣。 |
| Vim 開著、正在組字時按 `Esc` | 屬於輸入法，不變。 |
| Vim 從開切到關 | 那一層跟著 Vim 一起走，路立刻回來。反之亦然。 |

---

## 4. Non-Functional Requirements

| # | 需求 |
| :--- | :--- |
| NFR-01 | 不重建編輯器。這一層跟著既有的 Vim 開關區塊一起換進換出。 |
| NFR-02 | 不新增第三方依賴。 |
| NFR-03 | 不新增任何設定項。 |

---

## 5. Dependencies & Risks

| 風險 | 影響 | 對策 |
| :--- | :--- | :--- |
| **Vim 模式開著時，只用鍵盤的人沒有 `Tab` 這條路離開寫作區** | 開著 Vim 又完全不用滑鼠的人，離開寫作區要靠點擊或系統層的焦點切換 | **接受，這是使用者的裁決。** Vim 本身就是一套完整的鍵盤語言，開著它的人不靠 `Tab` 走位；而縮排是每一段都會用到的動作。寫進通用語言地圖，不留給下一個人重新發現。 |
| 未來 Vim 引擎改成也接手常態模式的 `Esc` | 這一層會變成沒有作用（但也不會出錯） | 無需對策：它是「留下沒人要的按鍵」，沒人要的按鍵變少只會讓它更少被觸發。 |
