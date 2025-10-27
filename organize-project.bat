@echo off
chcp 65001 >nul
echo ========================================
echo   DranTV 项目文件整理脚本（重建模式）
echo ========================================
echo.
echo 说明：此脚本将完全重建 DranTV 文件夹
echo       删除旧的 DranTV 文件夹并创建新的
echo       根据最新项目结构组织文件
echo       目标路径：D:\Dran\DranTV\Backup\DranTV
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

REM 设置目标路径
set "targetPath=D:\Dran\DranTV\Backup\DranTV"

REM 确保目标文件夹的父目录存在
if not exist "D:\Dran\DranTV\Backup" (
    echo    创建 Backup 文件夹...
    mkdir "D:\Dran\DranTV\Backup"
)

REM 备份现有 DranTV 文件夹
if exist "%targetPath%" (
    echo    备份现有 DranTV 文件夹...
    xcopy /E /I /Y "%targetPath%" "%backupFolder%\DranTV_old" >nul
    echo    删除旧的 DranTV 文件夹...
    rmdir /S /Q "%targetPath%"
)

echo.
echo 2. 创建新的 DranTV 文件夹结构（重建模式）

REM 创建 DranTV 根文件夹
mkdir "%targetPath%"

echo.
echo 3. 复制文件夹结构...

REM 复制文件夹
if exist ".github" (
    echo    复制 .github/
    xcopy /E /I /Y ".github" "%targetPath%\.github" >nul
)

if exist ".husky" (
    echo    复制 .husky/
    xcopy /E /I /Y ".husky" "%targetPath%\.husky" >nul
)

if exist ".vscode" (
    echo    复制 .vscode/
    xcopy /E /I /Y ".vscode" "%targetPath%\.vscode" >nul
)

if exist "public" (
    echo    复制 public/
    xcopy /E /I /Y "public" "%targetPath%\public" >nul
)

if exist "scripts" (
    echo    复制 scripts/
    xcopy /E /I /Y "scripts" "%targetPath%\scripts" >nul
)

if exist "src" (
    echo    复制 src/
    xcopy /E /I /Y "src" "%targetPath%\src" >nul
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
        copy /Y "%%f" "%targetPath%\%%f" >nul
    )
)

echo.
echo 5. 复制 Shell 脚本...

REM 复制 git-auto.sh
if exist "git-auto.sh" (
    echo    复制 git-auto.sh
    copy /Y "git-auto.sh" "%targetPath%\git-auto.sh" >nul
)

echo.
echo 6. 验证关键文件...

REM 验证关键文件是否存在
set "allFilesExist=1"

if not exist "%targetPath%\package.json" (
    echo    ❌ 缺少: package.json
    set "allFilesExist=0"
)

if not exist "%targetPath%\src" (
    echo    ❌ 缺少: src 文件夹
    set "allFilesExist=0"
)

if not exist "%targetPath%\public" (
    echo    ❌ 缺少: public 文件夹
    set "allFilesExist=0"
)

if not exist "%targetPath%\next.config.js" (
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
echo 目标文件夹: %targetPath%
echo 备份文件夹: %backupFolder%\
echo.
echo 下一步操作：
echo 1. 进入 DranTV 文件夹: cd /d %targetPath%
echo 2. 初始化 Git（如需要）: git init
echo 3. 添加文件: git add .
echo 4. 提交更改: git commit -m "重建项目结构"
echo 5. 推送远程: git push
echo.
echo 注意：这是完全重建，旧的 DranTV 文件夹已被删除
echo       如需恢复，请查看备份文件夹: %backupFolder%
echo.
pause
