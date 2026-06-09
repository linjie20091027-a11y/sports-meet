# 运动会管理系统 — 后续优化规划

> 版本: v4.0.1 | 状态: 生产可用 | 更新时间: 2026-06-09

---

## 一、已完成事项回顾

| 类别 | 内容 |
|------|------|
| AI 审核 | DeepSeek V4 Pro 文字审核 + 豆包图片审核（双引擎） |
| 精彩瞬间 | 6 格轮播 + 最多 9 张一键上传 |
| 论坛系统 | 发帖/回帖/图片/附件/审核/举报 |
| 数据库清理 | 保留 4 管理员 + 28 高一11班 + 87 照片 + 20 赛事 |
| 安全 | JWT、bcrypt、Helmet、限流、验证码、账号锁定 |
| 部署 | Docker、PM2、Nginx、Railway 支持 |

---

## 二、P0 — 立即修复

| # | 问题 | 方案 | 预估 |
|---|------|------|------|
| 1 | admin.js 360KB 单文件不可维护 | 正确拆分：所有辅助方法先挂 Admin 全局，面板只留 { render }。**上次失败教训：this. → Admin. 替换破坏引用** | 4h |
| 2 | app.js 109KB 单文件 | 同策略拆分路由/首页/赛事/搜索/通知 | 3h |
| 3 | 版本号混乱 (1.0.0 ↔ 4.0.0) | 统一 package.json + git tag，后续严格 semantic versioning | 1h |
| 4 | 数据库反复因 git 冲突丢失 | .gitignore 加入 `*.db`，数据库不再入库，改由 seed 脚本生成 | 1h |

---

## 三、P1 — 本周完成

| # | 问题 | 方案 |
|---|------|------|
| 5 | 零 TypeScript | 渐进引入：先 `routes/` + `utils/` 转 `.ts`，前端保持 JS |
| 6 | 零测试 | 添加 Jest + supertest，覆盖率目标 ≥ 60% |
| 7 | CSP unsafe-inline/unsafe-eval | 内联样式迁至 CSS 类，Chart.js 用 hash 放行 |
| 8 | 前端无构建工具 | 引入 Vite 打包，CDN 依赖收归 npm |
| 9 | npm scripts 不完整 | 补全：`build`, `dev`, `lint`, `test`, `deploy` |
| 10 | CI/CD 空壳 | 基于 .github/workflows/ci.yml 补充 e2e 测试 + 自动部署 |

---

## 四、P2 — 本月完成

| # | 问题 | 方案 |
|---|------|------|
| 11 | 前端无框架 | 选型 React + Vite，先迁移管理后台（收益最大），学生端逐步跟进 |
| 12 | Prisma 未实际接入 | 完善 Prisma schema → 生成客户端 → routes 逐步迁移 |
| 13 | 移动端体验差 | 响应式优化，表格卡片化，底部导航栏 |
| 14 | 无暗色模式 | CSS 变量切换，localStorage 记忆 |
| 15 | 无国际化 | i18n 中/英文，语言包 JSON |
| 16 | 无 PWA | Service Worker 离线缓存 |

---

## 五、P3 — 长期规划

| # | 内容 |
|---|------|
| 17 | 数据库迁移至 PostgreSQL（已有 schema，改一行 ds provider） |
| 18 | Redis 缓存层（赛事列表、公告列表、统计数据） |
| 19 | WebSocket 实时推送（成绩更新、赛程变更即时通知） |
| 20 | 数据分析大屏（ECharts 全屏仪表盘） |
| 21 | 移动端 App（React Native / Flutter） |
| 22 | 微服务拆分（报名服务、审核服务、通知服务） |

---

## 六、本次会话建议优先执行

按投入产出比排序：

1. **#4 数据库不入库** → 杜绝 git 冲突，改 .gitignore + seed 脚本（10min）
2. **#3 版本号统一** → package.json + git tag v4.0.1（5min）
3. **#1 admin.js 拆分** → 正确做法：辅助方法全部挂 Admin 全局（2h）
4. **#5 TypeScript 渐进** → routes/ 先转（3h）

---

需要我从哪一条开始执行？
