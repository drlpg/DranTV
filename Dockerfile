# 多架构构建 Dockerfile
# 使用 Docker Buildx 进行多架构构建：
# docker buildx build --platform linux/amd64,linux/arm64 -t your-image:tag --push .
# 或单一架构构建：
# docker buildx build --platform linux/amd64 -t your-image:tag --load .

# 声明构建参数，用于多架构构建
ARG BUILDPLATFORM
ARG TARGETPLATFORM

# ---- 第 1 阶段：安装依赖 ----
FROM --platform=$BUILDPLATFORM node:20-alpine AS deps

# 启用 corepack 并激活 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 复制 package.json 和 pnpm-lock.yaml
COPY package.json pnpm-lock.yaml* ./

# 安装依赖（如果 lockfile 不存在或不匹配，使用 --no-frozen-lockfile）
RUN pnpm install --no-frozen-lockfile

# 复制其余文件
COPY . .

# ---- 第 2 阶段：构建项目 ----
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# 从 deps 阶段复制 node_modules 和所有文件
COPY --from=deps /app ./

ENV DOCKER_ENV=true
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 生成生产构建（添加详细日志）
RUN echo "=== 开始构建 ===" && \
    echo "Node 版本:" && node --version && \
    echo "pnpm 版本:" && pnpm --version && \
    echo "当前目录:" && pwd && \
    echo "目录内容:" && ls -la && \
    echo "package.json scripts:" && cat package.json | grep -A 10 "scripts" && \
    echo "=== 执行构建命令 ===" && \
    pnpm run build 2>&1 || (echo "=== 构建失败 ===" && exit 1)

# ---- 第 3 阶段：生成运行时镜像 ----
FROM node:20-alpine AS runner

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DOCKER_ENV=true

# 从构建器中复制所有必要文件
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/production-final.js ./production-final.js
COPY --from=builder --chown=nextjs:nodejs /app/universal-start.js ./universal-start.js
COPY --from=builder --chown=nextjs:nodejs /app/standalone-websocket.js ./standalone-websocket.js
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# 创建健康检查脚本（在切换用户之前以root权限创建）
RUN echo '#!/usr/bin/env node\n\
const http = require("http");\n\
const options = {\n\
  hostname: "localhost",\n\
  port: 3000,\n\
  path: "/api/health",\n\
  method: "GET",\n\
  timeout: 5000\n\
};\n\
\n\
const req = http.request(options, (res) => {\n\
  if (res.statusCode === 200) {\n\
    console.log("Health check passed");\n\
    process.exit(0);\n\
  } else {\n\
    console.log(`Health check failed with status: ${res.statusCode}`);\n\
    process.exit(1);\n\
  }\n\
});\n\
\n\
req.on("error", (err) => {\n\
  console.log(`Health check error: ${err.message}`);\n\
  process.exit(1);\n\
});\n\
\n\
req.on("timeout", () => {\n\
  console.log("Health check timeout");\n\
  req.destroy();\n\
  process.exit(1);\n\
});\n\
\n\
req.setTimeout(5000);\n\
req.end();' > /app/healthcheck.js && \
    chmod +x /app/healthcheck.js && \
    chown nextjs:nodejs /app/healthcheck.js

# 切回非特权用户
USER nextjs

# 暴露HTTP和WebSocket端口
EXPOSE 3000 3001

# 添加健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node /app/healthcheck.js

# 设置WebSocket端口环境变量
ENV WS_PORT=3001

# 使用通用启动脚本，支持共享端口模式
CMD ["node", "universal-start.js"]