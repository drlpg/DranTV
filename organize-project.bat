@echo off
chcp 65001 >nul
echo ========================================
echo   DranTV 项目文件整理脚本（重建模式）
echo ========================================
echo.
echo 说明：此脚本将完全重建 drantv 文件夹
echo       删除旧的 drantv 文件夹并创建新的
echo       根据最新项目结构组织文件
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
    echo    删除旧的 drantv 文件夹...
    rmdir /S /Q "drantv"
)

echo.
echo 2. 创建新的 drantv 文件夹结构（重建模式）

REM 创建 drantv 根文件夹
mkdir "drantv"

echo.
echo 3. 复制文件夹结构...

REM 复制文件夹
if exist ".github" (
    echo    复制 .github/
    xcopy /E /I /Y ".github" "drantv\.github" >nul
)

if exist ".husky" (
    echo    复制 .husky/
    xcopy /E /I /Y ".husky" "drantv\.husky" >nul
)

if exist ".vscode" (
    echo    复制 .vscode/
    xcopy /E /I /Y ".vscode" "drantv\.vscode" >nul
)

if exist "public" (
    echo    复制 public/
    xcopy /E /I /Y "public" "drantv\public" >nul
)

if exist "scripts" (
    echo    复制 scripts/
    xcopy /E /I /Y "scripts" "drantv\scripts" >nul
)

if exist "src" (
    echo    复制 src/
    xcopy /E /I /Y "src" "drantv\src" >nul
)

echo.
echo 4. 复制配置文件...

REM 复制所有配置文件
for %%f in (
    .dockerignore
    .eslintrc.js
    .gitignore
    .npmrc
    .nvmrc
    .prettierignore
    .prettierrc.js
    CHANGELOG
    commitlint.config.js
    config.json
    Dockerfile
    jest.config.js
    jest.setup.js
    LICENSE
    next-env.d.ts
    next.config.js
    nginx.conf
    nginx.conf.example
    package.json
    pnpm-lock.yaml
    postcss.config.js
    production-final.js
    production.js
    proxy.worker.js
    server.js
    simple-dev.js
    standalone-websocket.js
    start.js
    tailwind.config.ts
    tsconfig.json
    vercel.json
    VERSION.txt
    websocket.js
) do (
    if exist "%%f" (
        echo    复制 %%f
        copy /Y "%%f" "drantv\%%f" >nul
    )
)

echo.
echo 5. 复制 Shell 脚本...

REM 复制 git-auto.sh
if exist "git-auto.sh" (
    echo    复制 git-auto.sh
    copy /Y "git-auto.sh" "drantv\git-auto.sh" >nul
)

echo.
echo 6. 验证关键文件...

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

if not exist "drantv\next.config.js" (
    echo    ❌ 缺少: next.config.js
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
echo 模式：完全重建（删除旧文件夹并创建新的）
echo 目标文件夹: drantv\
echo 备份文件夹: %backupFolder%\
echo.
echo 下一步操作：
echo 1. 进入 drantv 文件夹: cd drantv
echo 2. 初始化 Git（如需要）: git init
echo 3. 添加文件: git add .
echo 4. 提交更改: git commit -m "重建项目结构"
echo 5. 推送远程: git push
echo.
echo 注意：这是完全重建，旧的 drantv 文件夹已被删除
echo       如需恢复，请查看备份文件夹: %backupFolder%
echo.
pause
