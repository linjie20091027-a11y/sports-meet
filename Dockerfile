# ==========================================
# 运动会管理系统 - Docker 部署
# ==========================================

# ---- 阶段 1: 构建 ----
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package.json package-lock.json ./
RUN npm ci --production=false

# 复制 Prisma 配置
COPY prisma ./prisma

# 生成 Prisma Client
RUN npx prisma generate

# ---- 阶段 2: 生产运行 ----
FROM node:20-alpine

WORKDIR /app

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 安装生产依赖
COPY package.json package-lock.json ./
RUN npm ci --production && \
    npm cache clean --force

# 复制构建产物
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# 复制应用代码
COPY server.js ./
COPY routes ./routes
COPY utils ./utils
COPY public ./public
COPY Prisma ./Prisma

# 创建数据和上传目录
RUN mkdir -p /app/data /app/uploads && \
    chown -R nodejs:nodejs /app

# 使用 prisma 数据目录
ENV DATABASE_URL="file:./data/dev.db"

# 切换到非 root 用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 启动
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
