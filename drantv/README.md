# DranTV 生产部署包

这是 DranTV 项目的生产部署包，包含运行应用所需的所有文件。

## 📦 包含内容

- 完整的源代码 (src/)
- 静态资源文件 (public/)
- 配置文件
- 服务器脚本
- 部署配置

## 🚀 快速开始

### 使用 pnpm

```bash
# 安装依赖
pnpm install

# 构建应用
pnpm build

# 启动生产服务器
pnpm start
```

### 使用 Docker

```bash
# 构建镜像
docker build -t drantv .

# 运行容器
docker run -p 3000:3000 drantv
```

## 📝 环境变量

请根据实际需求配置环境变量。

## 📄 许可证

详见 LICENSE 文件
