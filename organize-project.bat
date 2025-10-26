@echo off
chcp 65001 >nul
echo ========================================
echo   DranTV 项目文件整理脚本（覆盖模式）
echo ========================================
echo.
echo 说明：此脚本将以覆盖方式更新 drantv 文件夹
echo       保留 .git 等未被覆盖的文件和文件夹
echo       排除 git-auto.sh（仅保留在 drantv 中）
echo.

REM 检查是否在项目根目录
if not exist "package.json" (
    echo 错误: 请在项目根目录运行此脚本
    pause
    exit /b 1
)

REM 创建备份
set "backupFolder=backup_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "backupFolder=%backupFolder: =0%"
echo 1. 创建备份文件夹: %backupFolder%
mkdir "%backupFolder%" 2>nul

REM 备份现有 drantv 文件夹
if exist "drantv" (
    echo    备份现有 drantv 文件夹...
    xcopy /E /I /Y "drantv" "%backupFolder%\drantv_old" >nul
)

echo.
echo 2. 准备 drantv 文件夹（覆盖模式）

REM 如果 drantv 文件夹不存在则创建
if not exist "drantv" (
    echo    创建 drantv 文件夹...
    mkdir "drantv"
) else (
    echo    drantv 文件夹已存在，将覆盖更新文件...
)

echo.
echo 3. 复制核心应用文件（覆盖模式）...
echo    注意：排除 git-auto.sh（仅保留在 drantv 文件夹中）

REM 复制目录
if exist "src" (
    echo    复制 src/
    xcopy /E /I /Y "src" "drantv\src" >nul
)

if exist "public" (
    echo    复制 public/
    xcopy /E /I /Y "public" "drantv\public" >nul
)

if exist "scripts" (
    echo    复制 scripts/
    xcopy /E /I /Y "scripts" "drantv\scripts" >nul
)

echo.
echo 4. 复制配置文件...

REM 复制配置文件
for %%f in (
    package.json
    pnpm-lock.yaml
    tsconfig.json
    next.config.js
    tailwind.config.ts
    postcss.config.js
) do (
    if exist "%%f" (
        echo    复制 %%f
        copy /Y "%%f" "drantv\%%f" >nul
    )
)

echo.
echo 5. 复制生产环境配置...

REM 复制生产环境配置
for %%f in (
    Dockerfile
    .dockerignore
    nginx.conf
    nginx.conf.example
    config.json
) do (
    if exist "%%f" (
        echo    复制 %%f
        copy /Y "%%f" "drantv\%%f" >nul
    )
)

echo.
echo 6. 复制服务器脚本...

REM 复制服务器脚本
for %%f in (
    server.js
    production.js
    production-final.js
    start.js
    websocket.js
    standalone-websocket.js
    proxy.worker.js
) do (
    if exist "%%f" (
        echo    复制 %%f
        copy /Y "%%f" "drantv\%%f" >nul
    )
)

echo.
echo 7. 复制部署相关文件...

REM 复制部署相关文件
for %%f in (
    vercel.json
    VERSION.txt
    CHANGELOG
    LICENSE
) do (
    if exist "%%f" (
        echo    复制 %%f
        copy /Y "%%f" "drantv\%%f" >nul
    )
)

echo.
echo 8. 创建生产环境 .gitignore...

REM 创建 .gitignore
(
echo # 依赖
echo node_modules/
echo .pnp
echo .pnp.js
echo.
echo # 构建产物
echo .next/
echo out/
echo build/
echo dist/
echo.
echo # 环境变量
echo .env
echo .env.local
echo .env.production.local
echo .env.development.local
echo .env.test.local
echo.
echo # 日志
echo npm-debug.log*
echo yarn-debug.log*
echo yarn-error.log*
echo pnpm-debug.log*
echo.
echo # 系统文件
echo .DS_Store
echo Thumbs.db
echo.
echo # IDE
echo .vscode/
echo .idea/
echo.
echo # 测试
echo coverage/
echo .nyc_output/
echo.
echo # 临时文件
echo *.log
echo *.tmp
echo *.temp
) > "drantv\.gitignore"

echo    创建 drantv\.gitignore

echo.
echo 9. 创建 README...

REM 创建 README
(
echo # DranTV 生产部署包
echo.
echo 这是 DranTV 项目的生产部署包，包含运行应用所需的所有文件。
echo.
echo ## 📦 包含内容
echo.
echo - 完整的源代码 ^(src/^)
echo - 静态资源文件 ^(public/^)
echo - 配置文件
echo - 服务器脚本
echo - Docker 配置
echo - 部署配置
echo.
echo ## 🚀 快速开始
echo.
echo ### 使用 pnpm
echo.
echo ```bash
echo # 安装依赖
echo pnpm install
echo.
echo # 构建应用
echo pnpm build
echo.
echo # 启动生产服务器
echo pnpm start
echo ```
echo.
echo ### 使用 Docker
echo.
echo ```bash
echo # 构建镜像
echo docker build -t drantv .
echo.
echo # 运行容器
echo docker run -p 3000:3000 drantv
echo ```
echo.
echo ## 📝 环境变量
echo.
echo 请根据实际需求配置环境变量。
echo.
echo ## 📄 许可证
echo.
echo 详见 LICENSE 文件
) > "drantv\README.md"

echo    创建 drantv\README.md

echo.
echo 10. 验证关键文件...

REM 验证关键文件是否存在
set "allFilesExist=1"

if not exist "drantv\package.json" (
    echo    ❌ 缺少: package.json
    set "allFilesExist=0"
)

if not exist "drantv\src" (
    echo    ❌ 缺少: src 文件夹
    set "allFilesExist=0"
)

if not exist "drantv\public" (
    echo    ❌ 缺少: public 文件夹
    set "allFilesExist=0"
)

if not exist "drantv\public\img\loading.svg" (
    echo    ❌ 缺少: public\img\loading.svg
    set "allFilesExist=0"
)

if not exist "drantv\public\img\placeholder-minimal.svg" (
    echo    ❌ 缺少: public\img\placeholder-minimal.svg
    set "allFilesExist=0"
)

if "%allFilesExist%"=="1" (
    echo    ✅ 所有关键文件验证通过
) else (
    echo    ⚠️  部分文件缺失，请检查
)

echo.
echo ========================================
echo   ✅ 文件整理完成！
echo ========================================
echo.
echo 模式：覆盖更新（保留 .git 等未覆盖的文件）
echo 目标文件夹: drantv\
echo 备份文件夹: %backupFolder%\
echo.
echo 下一步操作：
echo 1. 进入 drantv 文件夹: cd drantv
echo 2. 检查更改: git status
echo 3. 提交更新: git add . ^&^& git commit -m "更新"
echo 4. 推送远程: git push
echo.
echo 注意：.git 文件夹和其他未被覆盖的文件已保留
echo.
pause
