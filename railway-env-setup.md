# Railway 环境变量配置指南

## 🔧 需要在 Railway 上设置的环境变量

### 1. 存储类型（新增 - 重要！）

```
STORAGE_TYPE=upstash
```

**说明：** 服务器端 API 使用此变量（运行时生效）

### 2. 存储类型（前端）

```
NEXT_PUBLIC_STORAGE_TYPE=upstash
```

**说明：** 前端页面使用此变量（构建时注入）

### 3. 站长账号

```
LOGIN_USERNAME=Dran
LOGIN_PASSWORD=Tv43510004lpg
```

### 4. 数据库连接

```
UPSTASH_URL=https://cunning-sponge-18736.upstash.io
UPSTASH_TOKEN=AUkwAAIncDI1NjcyN2E0ZDY4YTU0MTJlOTIxNTQ4OTYxMjEwN2JjNnAyMTg3MzY
```

### 5. TMDB 配置

```
TMDB_ENABLED=true
TMDB_API_KEY=8bad3dd2f5fd422297dd855cab92cb41
TMDB_API_PROXY=https://api.themoviedb.org/3
```

### 6. 生产环境

```
NODE_ENV=production
```

## 📝 操作步骤

1. 登录 Railway 控制台
2. 进入项目 → Settings → Variables
3. 添加新变量：`STORAGE_TYPE=upstash`
4. 确认所有其他变量都已设置
5. 保存后会自动触发重新部署
6. 等待部署完成（约 2-5 分钟）
7. 运行测试：`node test-remote-api.js`

## ✅ 预期结果

API 应该返回：

```json
{
  "StorageType": "upstash",
  "RequireDeviceCode": false,
  "SiteName": "DranTV",
  "Version": "1.0.38"
}
```

## 🔍 为什么需要两个变量？

- `STORAGE_TYPE` - 服务器端 API 在**运行时**读取
- `NEXT_PUBLIC_STORAGE_TYPE` - 前端页面在**构建时**注入

这样可以确保无论何时设置环境变量，都能正确生效。
