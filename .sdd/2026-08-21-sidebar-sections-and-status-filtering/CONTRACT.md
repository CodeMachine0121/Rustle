# Contract Traceability Matrix — Sidebar Sections and Status Filtering

Contract: PRD.md (§4 Gherkin, TC-01 … TC-52)
Design map: ARCH.md
Implementation: `crates/domain`, `crates/application`, `src-tauri`, `src/features/{sidebar,vault,articleMetadata,createArticle,editArticleMetadata}`, `src/app`
Oracle: Acceptance Criteria (52 clauses)

**Ceiling.** Static conformance audit: each oracle was written from the PRD before reading code; tests and code were then judged against it by reading. Only the tests mapped to a clause were run as corroboration (all green). No invented scenario was executed.

## Clauses

`Test audit` / `Code audit` are Claude's shadow verdict (recorded before Jev ran). `Jev test` / `Jev code` / `Status` / `Route` are copied from `jev_audit.py` as returned. TC-01, 03, 04, 08, 10, 11, 13, 15, 17, 28, 33 and 38 show the result of a second Jev run made after the first run was given code ranges that missed the code path (e.g. TC-38 pointed at `selectArticle` but not `#openArticle`) or, for TC-01 and TC-17, after the mapped test was tightened to the exact oracle (TC-01 now creates with Active; TC-17 now asserts the Completed count while Active is chosen).

| ID | Clause | Spec-expected (oracle) | Impl | Test | Test audit | Code audit | Jev test | Jev code | Status | Route |
|----|--------|------------------------|------|------|------------|------------|----------|----------|--------|-------|
| TC-01 | 建立文章時選了狀態 → 這篇的狀態是 Active | 這篇的狀態是 Active | article_draft.rs `to_text`; create_article.rs `execute` | create_article.rs `an_article_created_with_a_status_has_it`; `writes_a_front_matter_named_after_the_title_and_no_body` | asserts-oracle | produces-oracle | asserts-oracle 0.96 | unclear 0.41 | ❔ unclear | escalate (disagree) |
| TC-02 | 建立時沒有選狀態 → 沒有狀態，算進 No Status | 沒有狀態，且算進 No Status 那一列 | article_draft.rs `to_text`; sidebarCounts.ts | create_article.rs `an_article_created_without_a_status_has_none`; sidebarCounts.test.ts `counts every status…` | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.29 | ✅ conforms | escalate (low confidence) |
| TC-03 | 事後把狀態改掉 Active → Completed | 狀態是 Completed，不再算進 Active | article_draft.rs `edit` | article_draft.rs `editing_replaces_the_status` | asserts-oracle | produces-oracle | asserts-oracle 0.76 | unclear 0.17 | ❔ unclear | escalate (disagree) |
| TC-04 | 表單只提供那五個選項 | 只有五個選項，沒有自由輸入 | ArticleMetadataForm.tsx Status select; statusChoice.ts | EditArticleMetadataDialog.test.tsx `shows No Status… only the five choices`; CreateArticleDialog.test.tsx `offers only the four statuses and No Status` | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.93 | ✅ conforms | accept |
| TC-05 | 檔案裡記著認不出來的狀態 | 當成沒有狀態，算進 No Status | article_status.rs `parse`; article_metadata.rs `status_in` | article_document/tests.rs `reads_a_recognised_status_or_none`; article_status.rs `reads_only_the_four_statuses` | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.91 | ✅ conforms | accept |
| TC-06 | 認不出來的狀態存檔後原樣還在 | 存檔後「進行中」那一行原樣還在 | save_article_body.rs (body + updated_at only) | save_article_body.rs `keeps_a_status_it_cannot_read_and_the_retired_category_as_written` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.80 | ✅ conforms | recheck (mid confidence) |
| TC-07 | 「No Status」不會清掉認不出來的狀態 | 「進行中」那一行原樣還在 | article_draft.rs `edit` (None, None) arm | update_article_metadata.rs `choosing_no_status_keeps_a_status_rustle_cannot_read`; article_draft.rs `editing_without_a_status_keeps_an_unrecognised_one` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.45 | ✅ conforms | escalate (low confidence) |
| TC-08 | 主動選一個狀態會取代認不出來的那一行 | 狀態是 Active，檔案裡沒有「進行中」 | article_draft.rs `edit` (Some, _) arm | update_article_metadata.rs `choosing_a_status_replaces_one_rustle_cannot_read` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.59 | ✅ conforms | escalate (low confidence) |
| TC-09 | 把狀態清掉 | 沒有狀態，檔案裡沒有 status 行 | article_draft.rs `edit` (None, Some) arm; `FieldValue::Removed` | update_article_metadata.rs `choosing_no_status_removes_a_recognised_status` | asserts-oracle | produces-oracle | asserts-oracle 0.93 | produces-oracle 0.89 | ✅ conforms | accept |
| TC-10 | 改狀態不會動到檔案裡其他任何東西 | 自訂欄位、註解、分類原樣且順序不變 | MappingText `apply` | article_draft.rs `editing_changes_only_title_status_tags_and_updated_at`; update_article_metadata.rs `keeps_the_retired_category_byte_for_byte` | asserts-oracle | produces-oracle | asserts-oracle 0.75 | produces-oracle 0.73 | ✅ conforms | recheck (mid confidence) |
| TC-11 | 五列與各自的篇數 | Active 3、On Hold 1、Completed 0、Dropped 0、No Status 2 | sidebarCounts.ts | sidebarCounts.test.ts `counts every status…`; Sidebar.test.tsx `shows the five statuses…` | asserts-oracle | produces-oracle | asserts-oracle 0.99 | unclear 0.39 | ❔ unclear | escalate (disagree) |
| TC-12 | 一篇文章都沒有時五列還在 | 五列都在、全部 0 | sidebarCounts.ts; StatusSection.tsx | Sidebar.test.tsx `keeps the five statuses at zero…` | asserts-oracle | produces-oracle | asserts-oracle 0.68 | produces-oracle 0.75 | ✅ conforms | recheck (mid confidence) |
| TC-13 | 選一個狀態 | 清單只剩 A | SidebarFilter.matches; arrangeArticles | SidebarFilter.test.ts `keeps only the articles with the chosen status`; ArticleColumn.test.tsx `lists the scope's articles that match the sidebar filter` | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.47 | ✅ conforms | escalate (low confidence) |
| TC-14 | 再點一次已選的那一列就取消 | 沒有狀態被選，清單無狀態過濾 | SidebarFilter.toggleStatus | SidebarFilter.test.ts `lets go of the chosen status…`; VaultSession.test.ts `chooses one status at a time…` | asserts-oracle | produces-oracle | asserts-oracle 0.88 | produces-oracle 0.96 | ✅ conforms | accept |
| TC-15 | 同一時間最多只能選一個狀態 | 只有 Completed 被選 | SidebarFilter.toggleStatus | SidebarFilter.test.ts `holds at most one status…` | asserts-oracle | produces-oracle | asserts-oracle 0.85 | produces-oracle 0.96 | ✅ conforms | accept |
| TC-16 | 選了 No Status 就只剩沒有狀態的文章 | 清單只剩 B | SidebarFilter.matches (statusChoiceOf) | SidebarFilter.test.ts `keeps only the articles without a status…` | asserts-oracle | produces-oracle | asserts-oracle 0.29 | produces-oracle 0.33 | ✅ conforms | escalate (low confidence) |
| TC-17 | 篇數不受狀態選取影響 | 選 Active 時 Completed 仍顯示 1 | Sidebar.tsx (counts from snapshot.articles) | Sidebar.test.tsx `keeps counting Completed while Active is chosen` | asserts-oracle | produces-oracle | asserts-oracle 0.81 | produces-oracle 0.67 | ✅ conforms | recheck (mid confidence) |
| TC-18 | 列出範圍內用過的標籤與篇數 | work 4、bug 1 | sidebarCounts.ts | sidebarCounts.test.ts `lists the tags most used first, then by name` | asserts-oracle | produces-oracle | asserts-oracle 0.79 | produces-oracle 0.32 | ✅ conforms | escalate (low confidence) |
| TC-19 | 標籤的順序是篇數多到少 | work、zen、bug | sidebarCounts.ts sort | sidebarCounts.test.ts `lists the tags most used first, then by name` | asserts-oracle | produces-oracle | asserts-oracle 0.56 | produces-oracle 0.65 | ✅ conforms | escalate (low confidence) |
| TC-20 | 沒有任何文章帶標籤 | 顯示「還沒有標籤」且沒有標籤列 | TagSection.tsx | Sidebar.test.tsx `keeps the five statuses at zero…` | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.83 | ✅ conforms | recheck (mid confidence) |
| TC-21 | 選一個標籤 | 清單只剩 A | SidebarFilter.matches | SidebarFilter.test.ts `asks for every chosen tag` | asserts-oracle | produces-oracle | asserts-oracle 0.44 | produces-oracle 0.39 | ✅ conforms | escalate (low confidence) |
| TC-22 | 選了多個標籤時文章要每一個都有 | 清單只剩 A | SidebarFilter.matches (every) | SidebarFilter.test.ts `asks for every chosen tag` | asserts-oracle | produces-oracle | asserts-oracle 0.65 | produces-oracle 0.44 | ✅ conforms | escalate (low confidence) |
| TC-23 | 取消其中一個標籤 | 只剩 work 條件，A 與 B 都在 | SidebarFilter.toggleTag | SidebarFilter.test.ts `drops a tag chosen again…` | asserts-oracle | produces-oracle | asserts-oracle 0.77 | produces-oracle 0.88 | ✅ conforms | recheck (mid confidence) |
| TC-24 | 篇數不受標籤選取影響 | 選 work 時 bug 仍顯示 1 | Sidebar.tsx | Sidebar.test.tsx `marks what is chosen and keeps every count as it was` | asserts-oracle | produces-oracle | asserts-oracle 0.55 | produces-oracle 0.17 | ✅ conforms | escalate (low confidence) |
| TC-25 | 狀態與標籤同時成立 | 清單只剩 A | SidebarFilter.matches | SidebarFilter.test.ts `asks for the status and every tag together`; articleArrangement.test.ts `keeps only the articles with both…` | asserts-oracle | produces-oracle | asserts-oracle 0.75 | produces-oracle 0.29 | ✅ conforms | escalate (low confidence) |
| TC-26 | 過濾後一篇都不剩時要說話 | 顯示「沒有符合的文章」 | ArticleColumn.tsx | ArticleColumn.test.tsx `says that nothing matches when the sidebar filter leaves nothing` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | produces-oracle 0.97 | ✅ conforms | accept |
| TC-27 | 正在編輯的那篇永遠留著 | 那一列還在，標示「開著的」 | arrangeArticles (isOutsideFilter); ArticleColumn marker | ArticleColumn.test.tsx `keeps the open article that the sidebar filter leaves out…`; articleArrangement.test.ts same | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.81 | ✅ conforms | recheck (mid confidence) |
| TC-28 | 側欄的過濾與文字篩選框疊加 | 只剩 Active 且標題或標籤含「桌面」 | arrangeArticles | articleArrangement.test.ts `adds the text filter on top of the sidebar filter` | asserts-oracle | produces-oracle | asserts-oracle 0.49 | diverges 0.24 | 🔴 violation | escalate (violation) |
| TC-29 | 文字篩選框不再比對分類 | 這篇不會被列出 | ArticleFilter (title + tags); ArticleMetadata has no category | articleArrangement.test.ts `matches nothing outside title and tags`; article_document/tests.rs `leaves_the_retired_category_out_of_tags_and_status` | asserts-oracle | produces-oracle | asserts-oracle 0.68 | produces-oracle 0.57 | ✅ conforms | escalate (low confidence) |
| TC-30 | 收起來的分區不取消它的過濾 | 過濾照樣生效 | filter in VaultSession; CollapsibleSection hides only | App.test.tsx `keeps narrowing the list by a status whose section is folded` | asserts-oracle | produces-oracle | asserts-oracle 0.95 | produces-oracle 0.80 | ✅ conforms | recheck (mid confidence) |
| TC-31 | 列出所有 workspace 的文章 | 兩個 workspace 的文章全部在清單上 | ListAllArticles; VaultSession.selectAllNotes | VaultSession.test.ts `lists every workspace's articles under All Notes…`; vault.rs `lists_the_articles_of_every_workspace_each_with_its_workspace`; App.test.tsx `lists every workspace under All Notes…` | asserts-oracle | produces-oracle | asserts-oracle 0.77 | produces-oracle 0.71 | ✅ conforms | recheck (mid confidence) |
| TC-32 | 每一列說得出自己屬於哪個 workspace | 列上看得到 workspace | ArticleColumn row-workspace | ArticleColumn.test.tsx `lists two articles with the same file name… each naming its workspace` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.69 | ✅ conforms | recheck (mid confidence) |
| TC-33 | 篇數是跨所有 workspace 算的 | Active 顯示 3 | sidebarCounts over listAllArticles rows | sidebarCounts.test.ts `counts across every workspace it is given` | asserts-oracle | produces-oracle | asserts-oracle 1.00 | unclear 0.45 | ❔ unclear | escalate (disagree) |
| TC-34 | 從 All Notes 換成一個 workspace 會清掉選取 | 沒有狀態被選，清單是 Blog 全部 | VaultSession #openScope | VaultSession.test.ts `clears the sidebar filter when All Notes is chosen and when a workspace is chosen` | asserts-oracle | produces-oracle | asserts-oracle 0.76 | produces-oracle 0.75 | ✅ conforms | recheck (mid confidence) |
| TC-35 | 從一個 workspace 換成 All Notes 也清掉選取 | 沒有標籤被選 | VaultSession #openScope | same test | asserts-oracle | produces-oracle | asserts-oracle 0.28 | produces-oracle 0.63 | ✅ conforms | escalate (low confidence) |
| TC-36 | All Notes 與選一個 workspace 互斥 | All Notes 不再被選，Blog 被選 | VaultSession #openScope | same test; App.test.tsx `lists every workspace under All Notes…` | asserts-oracle | produces-oracle | asserts-oracle 0.91 | produces-oracle 0.45 | ✅ conforms | escalate (low confidence) |
| TC-37 | All Notes 之下不能建立新文章 | 被擋並告知先選 workspace；沒有表單；沒有檔案 | ArticleColumn createArticle; VaultSession.createArticle | ArticleColumn.test.tsx `refuses a new article under All Notes…`; VaultSession.test.ts `refuses to create an article under All Notes…` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.35 | ✅ conforms | escalate (low confidence) |
| TC-38 | All Notes 之下打開一篇文章 | 編輯區是 Work 裡那個檔案的正文 | VaultSession.selectArticle / #openArticle | VaultSession.test.ts `opens an article of another workspace from All Notes…`; App.test.tsx `lists every workspace under All Notes and opens…` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.67 | ✅ conforms | recheck (mid confidence) |
| TC-39 | 同名檔案分屬兩個 workspace 時各自是一列 | 兩篇各自一列 | ListAllArticles; ArticleColumn key | vault.rs `lists_the_articles_of_every_workspace_each_with_its_workspace`; ArticleColumn.test.tsx twins | asserts-oracle | produces-oracle | asserts-oracle 0.99 | produces-oracle 0.87 | ✅ conforms | accept |
| TC-40 | All Notes 之下並列的先後是固定的 | Blog 那篇在 Work 前 | arrangeArticles tie-break | articleArrangement.test.ts `puts a tie across workspaces in workspace name order…` | asserts-oracle | produces-oracle | asserts-oracle 0.63 | produces-oracle 0.77 | ✅ conforms | recheck (mid confidence) |
| TC-41 | 點標題把分區收起來 | 標籤區內容收起 | CollapsibleSection; useCollapsedSections | Sidebar.test.tsx `folds a section away…` | asserts-oracle | produces-oracle | asserts-oracle 0.79 | produces-oracle 0.84 | ✅ conforms | recheck (mid confidence) |
| TC-42 | 再點一次展開 | 標籤區內容看得到 | CollapsibleSection; useCollapsedSections | Sidebar.test.tsx `folds a section away…` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.65 | ✅ conforms | recheck (mid confidence) |
| TC-43 | 折疊的選擇跨重啟記住 | 重開後標籤區還是收著 | settings.sidebar (domain + repository) ; useCollapsedSections | Sidebar.test.tsx `opens with the sections the settings say were folded`; settings/tests.rs; file_system_settings_repository.rs `reads_back_what_it_wrote` | asserts-oracle | produces-oracle | asserts-oracle 0.79 | produces-oracle 0.59 | ✅ conforms | escalate (low confidence) |
| TC-44 | 折疊 Workspace 區不改變選的是哪個 workspace | 還是選著 Blog，清單不變 | Sidebar (collapse never touches the session) | App.test.tsx `keeps the workspace and the list when the workspace section is folded` | asserts-oracle | produces-oracle | asserts-oracle 0.83 | produces-oracle 0.60 | ✅ conforms | recheck (mid confidence) |
| TC-45 | 設定檔記著看不懂的折疊資料時照樣能開 | 三個分區都展開，沒有錯誤 | StoredSidebar → SidebarSettings | settings/tests.rs `ignores_collapsed_sections_it_does_not_know` | asserts-oracle | produces-oracle | asserts-oracle 0.33 | produces-oracle 0.37 | ✅ conforms | escalate (low confidence) |
| TC-46 | 設定檔寫不進去不影響現在的畫面 | 標籤區收起，沒有錯誤訊息 | SettingsSession.change ignores write result | Sidebar.test.tsx `still folds the section when the settings cannot be written…` | asserts-oracle | produces-oracle | asserts-oracle 0.76 | produces-oracle 0.87 | ✅ conforms | recheck (mid confidence) |
| TC-47 | 建立表單裡沒有分類欄位 | 沒有分類欄位，有狀態欄位 | ArticleMetadataForm | CreateArticleDialog.test.tsx `has a Title field, a Status choice…` | asserts-oracle | produces-oracle | asserts-oracle 0.96 | produces-oracle 0.67 | ✅ conforms | recheck (mid confidence) |
| TC-48 | 編輯表單裡也沒有分類欄位 | 沒有分類欄位，有狀態欄位 | ArticleMetadataForm | EditArticleMetadataDialog.test.tsx `opens with… no Category field` | asserts-oracle | produces-oracle | asserts-oracle 0.97 | produces-oracle 0.85 | ✅ conforms | accept |
| TC-49 | 文章清單不再顯示分類 | 看不到「技術筆記」 | ArticleSummary without category; ArticleRow | vault.rs `each_row_carries_what_the_article_says_about_itself` (row from a file with a category has none); ArticleColumn.test.tsx row content | asserts-oracle | produces-oracle | asserts-oracle 0.77 | produces-oracle 0.57 | ✅ conforms | escalate (low confidence) |
| TC-50 | 舊檔案的分類存檔後原樣還在 | 兩行分類原樣還在 | SaveArticleBody (body + updated_at only) | save_article_body.rs `keeps_a_status_it_cannot_read_and_the_retired_category_as_written` | asserts-oracle | produces-oracle | asserts-oracle 0.93 | produces-oracle 0.76 | ✅ conforms | recheck (mid confidence) |
| TC-51 | 分類沒有被搬成標籤或狀態 | 標籤沒有「技術筆記」且沒有狀態 | ArticleMetadata::read | article_document/tests.rs `leaves_the_retired_category_out_of_tags_and_status` | asserts-oracle | produces-oracle | asserts-oracle 0.65 | produces-oracle 0.27 | ✅ conforms | escalate (low confidence) |
| TC-52 | 跨 workspace 的清單與篇數（500 篇） | 沒有肉眼可見的停頓 | arrangeArticles; sidebarCounts | articleArrangement.test.ts `orders and filters five hundred articles from five workspaces…` (<50 ms); sidebarCounts.test.ts `counts five hundred articles…` (<50 ms) | asserts-oracle | produces-oracle | asserts-oracle 0.88 | produces-oracle 0.47 | ✅ conforms | escalate (low confidence) |

### Rechecks and escalations, read by Claude

Every `recheck` / `escalate` clause was re-read and its mapped tests were run (all pass). Notes on the ones Jev did not accept as conforming:

- **TC-28 (Jev: diverges 0.24)** — `arrangeArticles` marks a row outside when `!sidebarFilter.matches(article) || !filter.matches(article)` and drops it unless it is the open article, so only rows passing both remain; the mapped test asserts `["a.md", "b.md"]` (Active and 桌面) and is green. Claude's reading: conforms. Jev's confidence is low.
- **TC-01, TC-03, TC-11, TC-33 (Jev: code unclear, < 0.5)** — Jev agreed the tests assert the oracle; it could not trace the code from the given ranges. TC-01/03: `ArticleDraft::to_text` / `edit` → `MetadataUpdate::status` → `FieldValue::Text("active"|"completed")` written by `MappingText::apply`; TC-11/33: `sidebarCounts` counts `statusChoiceOf(article.status)` over whatever rows the scope holds (all workspaces under All Notes via `listAllArticles`). Mutation checks during implementation (removing the status removal arm, `every`→`some`, dropping the tag sort, not clearing the filter on scope change) each turned the mapped tests red.

## Orphans (code with no clause)

| Code | Description | Verdict |
|------|-------------|---------|
| `src/features/vault/ArticleColumn.tsx` ArticleRow details | the row shows its status label (e.g. "Active") next to the date | undocumented (helps the reader; not in any clause, not out of scope) |
| `src/features/vault/ArticleColumn.tsx` | under All Notes with an empty vault the column says 「還沒有任何文章」 instead of inviting a first article | undocumented (follows from TC-37: no article can be created there) |
| `crates/domain/src/article_status.rs` `parse` | hand-written `Active`, `On Hold`, `on_hold`, `onhold` read as the same status | undocumented (assumption in ARCH §8) |
| `crates/application/src/list_all_articles.rs` | an unreadable workspace is skipped under All Notes | undocumented (assumption in ARCH §8) |
| `src/features/vault/VaultSession.ts` rename/delete | under All Notes, renaming or deleting the workspace of the open article lets the article go | undocumented (needed so a write never lands on a moved file) |

None of them matches an Out of Scope item.

## Summary

- Conforms: 47/52 clauses ✅ (90%) per Jev; Claude's shadow verdict is conforms for all 52.
- Violations: TC-28 (Jev, low confidence; Claude reads conforms — see above)
- Mis-asserted: none
- Partial: none
- Gaps: none
- Unclear: TC-01, TC-03, TC-11, TC-33 (Jev could not trace the code; tests assert the oracle)
- Orphans: 5 (all undocumented, none out of scope)
- Jev: ran on 52 clauses (12 rerun with corrected references)
- Needs James: TC-01, TC-02, TC-03, TC-07, TC-08, TC-11, TC-13, TC-16, TC-18, TC-19, TC-21, TC-22, TC-24, TC-25, TC-28, TC-29, TC-33, TC-35, TC-36, TC-37, TC-43, TC-45, TC-49, TC-51, TC-52 — routed `escalate` by Jev (disagreement or low confidence); none has a failing test or a known wrong behavior.

Measured for TC-52: the 500-article (5 workspaces) arrangement and the sidebar counts are each asserted under 50 ms in the unit tests.
