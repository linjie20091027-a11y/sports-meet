# 云数据库迁移说明

## 目标

- 保留当前 `sql.js` 本地运行能力，避免一次性重写所有同步 SQL 代码造成回归
- 提供一条可执行的云端 PostgreSQL 迁移路径
- 为迁移过程补齐本地备份、云端连通性校验、云端导出备份

## 环境变量

复制根目录 `.env.example` 为 `.env`，至少配置：

```env
LOCAL_DB_PATH=database/sports_meet.db
DATABASE_URL=postgresql://user:password@host:5432/sports_meet?sslmode=require
CLOUD_DB_SCHEMA=public
CLOUD_DB_SSL=true
```

## 执行顺序

1. 检查云库连通性

```bash
npm run db:cloud:check
```

2. 将本地 SQLite 迁移到云端 PostgreSQL

```bash
npm run db:cloud:migrate
```

3. 完成迁移后导出一份云端 JSON 备份

```bash
npm run db:cloud:backup
```

## 备份机制

- 服务启动时会自动把 `database/sports_meet.db` 复制到 `database/backups/`
- 默认最多保留 `10` 份本地快照，可通过 `DB_BACKUP_RETENTION` 调整
- 云端备份脚本会把各表数据导出为 `database/backups/cloud/cloud-db-backup-*.json`

## 安全建议

- 生产环境务必更换 `JWT_SECRET`
- `DATABASE_URL` 不要提交到 Git
- 云端数据库建议启用 SSL，并限制允许的来源 IP
- 迁移前先执行一次本地备份，迁移后再执行一次云端备份

## 当前限制

- 当前线上业务路由仍以本地 SQLite 运行时为主，云端 PostgreSQL 已具备迁移、校验和备份能力
- 若要把主运行时完全切到云端，需要继续把同步 SQL 路由逐步改造成异步数据库访问层
