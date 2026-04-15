# japanese-learning Project Rules

CF Workers + D1 项目特定规则，由 2026-04-15 debug session 归纳。跨项目通用 debug 纪律在 `~/.claude/rules/debug-hygiene.md`。

---

## 项目常量

| 项 | 值 |
|---|---|
| Worker 名 | `japanese-learning` |
| Worker URL | `https://japanese-learning.wuh28893.workers.dev/` |
| D1 database 名 | `gojuon-progress` |
| D1 database UUID | `19296ba2-e99e-4a2f-be8d-01d084720e02` |
| GitHub repo | `git@github.com:hbhggh/Japanese-learning.git` (**SSH only**) |
| Deploy 机制 | CF Workers Git Integration (git push 自动 deploy worker) |
| Schema migration 机制 | **仅** Dashboard D1 Console (wrangler 本机不可用) |

---

## 已知陷阱

### 陷阱 1 (CORE): Schema + Deploy 时间窗陷阱

**症状**：前端 alert `"同步失败: POST /api/learn -> 500"` 或 curl 返回 `{"error":"D1_ERROR: no such column ... SQLITE_ERROR"}`

**根因**：CF Workers Git Integration **只部署 worker code**，不触发 D1 schema migration。每次 schema + worker code 同时改动，必须**先**跑 D1 schema migration，**后** push worker code。

**唯一正确顺序**：
1. 浏览器 → https://dash.cloudflare.com → D1 → `gojuon-progress` → Console → 粘贴 `schema.sql` → Execute
2. `git push origin main`（Git Integration 自动 deploy worker）

**错误顺序**（任何让 worker 先 deploy 的流程都栽）：
- ❌ `git push` 然后"过会儿再跑 schema"
- ❌ `git push` 然后期望"schema 自动更新"
- ❌ CLI `wrangler d1 execute`（wrangler 本机没装，命令会 fail）

**Prevention (IF-THEN)**：
- IF commit 改动 `schema.sql` THEN commit message 第一行必须写 `[SCHEMA MIGRATION REQUIRED]` 作为 reminder
- IF 给用户 deploy 步骤 THEN 必须写成 Step 1=Dashboard SQL / Step 2=git push，**不给 CLI 选项**，不给"哪个先哪个后"的选择
- IF user 报告 `POST /api/learn -> 500` THEN 第一假设是本陷阱，立即 `curl /api/learned` 看 error 确认

### 陷阱 2: wrangler CLI 不可用

**状态** (2026-04-15 verified)：
- 本机**无** wrangler in PATH
- 非 node global package
- **无** `~/.wrangler` config 目录 → 从未 `wrangler login`
- 所有 worker deploy 通过 **CF Workers Git Integration** 自动触发

**Prevention**：
- IF 想推 `wrangler ...` 命令 THEN 先 `which wrangler && test -d ~/.wrangler`，两者都满足才推，否则**禁用 CLI 方案**
- **Default deploy path**：`git push` → Git Integration
- **Default schema migration path**：Dashboard D1 Console → 粘贴 SQL → Execute

### 陷阱 3: Git push HTTPS 失败（credential helper 慢性病）

**症状**：`git push` 报 `gh: error: unrecognized arguments: auth git-credential` + `could not read Username for 'https://github.com'`

**根因**：`~/.gitconfig:4-9` 的 credential helper 指向 cross_omics env 里冒牌的 `gh`（v0.0.4 Python 包，不是 GitHub CLI）。

**本项目级 workaround** (已应用，不需再做)：
```bash
cd ~/japanese-learning
git remote set-url origin git@github.com:hbhggh/Japanese-learning.git
```

**Global 永久 fix** (等用户有空手动执行)：
```bash
git config --global --remove-section credential."https://github.com"
git config --global --remove-section credential."https://gist.github.com"
```

SSH key (`id_rsa` + `id_ecdsa`) 已加 GitHub account，`git ls-remote git@github.com:...` 验证过。

---

## Debug 触发条件（症状 → 第一假设 → 诊断命令）

| 观察 | 第一假设 | 诊断命令 |
|---|---|---|
| `POST /api/learn 500` | 时间窗陷阱 (schema 未 migrate) | `curl https://japanese-learning.wuh28893.workers.dev/api/learned` |
| `GET /api/learned` 500 + "no such column type" | 陷阱 1 | Dashboard 跑 `SELECT sql FROM sqlite_master WHERE name='learned_kana'` |
| `GET /api/learned` 返回 string array `["..."]` | Worker 是老版 (ff9ef25 之前 shared-state) | `git log --oneline -5` 看当前 HEAD |
| `GET /api/learned` 返回 object array `[{kana,type}]` | 系统正常 | 看前端 DevTools Network |
| `wrangler: command not found` | 陷阱 2 | 改走 Dashboard path |

---

## 架构决定记录 (ADR)

### ADR-001: 独立追踪 hiragana/katakana（vs shared state）

**决定**：Schema 用 composite PK `(kana, type)`，不用 single PK。

**理由**：用户需求"平假名会、片假名不会" → 两者必须独立追踪。Shared state 方案在 2026-04-15 session 被用户明确拒绝两次（一次在初始 AskUserQuestion 的 Q3，一次在 あ/ア click 行为的 Q2）。

**成本**：一次性 DB migration（不保留老数据）。

**反对 commit**：`ff9ef25 fix: combine hiragana/katakana into single h/k text label` 曾尝试 revert 到 shared state，被 `93a8aef feat: inline hira/kata cell, independent tracking` supersede。

### ADR-002: KanaCell 用 `あ/ア` inline 格式

**决定**：每个 cell 显示 `あ/ア`，`あ` 和 `ア` 各自是独立 clickable button，`/` 装饰不可点。

**理由**：用户原话"一个网格 + 分开算"看起来有物理矛盾（一个按钮无法产生两个独立 toggle 事件），唯一自洽解是"一个网格内放两个独立 clickable span + 装饰性分隔符"。另两个方案（整格一点同步 toggle / 循环 4 态）被拒。

**Previous approach**：v2 左右并列两 button（在 `792daa6` commit 里），被 user feedback"不够紧凑"而废弃。
