# 五十音図 学習アプリ

聊天驱动开发的五十音学习 webapp，部署在 Cloudflare Workers + D1。

## 架构

- **前端**：单文件 React 18（CDN）+ Tailwind（CDN）+ Babel standalone，零构建步骤
- **后端**：Cloudflare Worker（`src/index.js`），HTML 内联在 Worker 里
- **数据库**：Cloudflare D1 `gojuon-progress`
  - `kana_progress(romaji PK, correct_count, wrong_count, last_reviewed)` — 注：`romaji` 列实际存的是假名字符本身（如 `じ`/`ぢ`），用来避开罗马音碰撞
  - `quiz_sessions(id, date, total, correct)`
- **部署**：push 到 main → Cloudflare Workers Builds 自动构建

## API

| 路由 | 方法 | 作用 |
|---|---|---|
| `/` | GET | 返回前端 HTML |
| `/api/progress` | GET | 列出所有假名进度 |
| `/api/answer` | POST | `{kana, correct}` upsert 计数 |
| `/api/session` | POST | `{total, correct}` 写入一次测验 |
| `/api/sessions?limit=30` | GET | 最近 N 次测验 |

## 一次性 Cloudflare 配置

1. CF Dashboard → Workers & Pages → Create → Import a repository
2. 授权 GitHub → 选 `Japanese-learning`
3. Build 配置全部留空
4. Bindings → Add → D1 → 变量名 `DB`，数据库选 `gojuon-progress`
5. Deploy

之后每次 push 自动重新部署。
