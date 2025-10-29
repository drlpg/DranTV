#!/usr/bin/env pwsh

<#
.SYNOPSIS
    版本更新脚本

.DESCRIPTION
    自动化版本更新流程：
    1. 在 CHANGELOG 顶部添加新版本模板
    2. 更新 VERSION.txt
    3. 运行 convert-changelog.js 生成 changelog.ts
    4. 更新 src/lib/version.ts

.PARAMETER Version
    新版本号 (例如: 1.0.4)

.PARAMETER SkipChangelog
    跳过 CHANGELOG 模板添加（如果已手动编辑）

.EXAMPLE
    .\scripts\update-version.ps1 1.0.4
    .\scripts\update-version.ps1 1.0.4 -SkipChangelog
#>

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$Version,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipChangelog
)

function Test-VersionFormat {
    param([string]$Ver)
    
    if ($Ver -notmatch '^\d+\.\d+\.\d+$') {
        Write-Host "❌ 版本号格式错误，应为 X.Y.Z 格式（例如: 1.0.4）" -ForegroundColor Red
        exit 1
    }
}

function Get-CurrentDate {
    return Get-Date -Format "yyyy-MM-dd"
}

function Add-ChangelogTemplate {
    param([string]$Ver)
    
    $changelogPath = Join-Path $PSScriptRoot "..\CHANGELOG"
    $date = Get-CurrentDate
    
    try {
        $existingContent = Get-Content $changelogPath -Raw -ErrorAction Stop
        
        # 检查版本是否已存在
        if ($existingContent -match "\[${Ver}\]") {
            Write-Host "⚠️  版本 $Ver 已存在于 CHANGELOG 中，跳过模板添加" -ForegroundColor Yellow
            return
        }
        
        $template = @"
## [$Ver] - $date

### Added

- 

### Changed

- 

### Fixed

- 

"@
        
        $newContent = $template + $existingContent
        Set-Content -Path $changelogPath -Value $newContent -NoNewline
        Write-Host "✅ 已在 CHANGELOG 顶部添加版本 $Ver 模板" -ForegroundColor Green
        Write-Host "📝 请编辑 CHANGELOG 文件，填写更新内容后继续" -ForegroundColor Cyan
    }
    catch {
        Write-Host "❌ 无法更新 CHANGELOG: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

function Update-VersionTxt {
    param([string]$Ver)
    
    $versionTxtPath = Join-Path $PSScriptRoot "..\VERSION.txt"
    
    try {
        Set-Content -Path $versionTxtPath -Value $Ver -NoNewline
        Write-Host "✅ 已更新 VERSION.txt: $Ver" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ 无法更新 VERSION.txt: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

function Invoke-ConvertChangelog {
    $scriptPath = Join-Path $PSScriptRoot "convert-changelog.js"
    
    try {
        Write-Host "🔄 正在运行 convert-changelog.js..." -ForegroundColor Cyan
        node $scriptPath
        if ($LASTEXITCODE -ne 0) {
            throw "convert-changelog.js 返回错误代码 $LASTEXITCODE"
        }
    }
    catch {
        Write-Host "❌ 运行 convert-changelog.js 失败: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

function Update-VersionTs {
    param([string]$Ver)
    
    $versionTsPath = Join-Path $PSScriptRoot "..\src\lib\version.ts"
    
    try {
        $content = Get-Content $versionTsPath -Raw
        
        # 替换 CURRENT_VERSION 常量
        $updatedContent = $content -replace "const CURRENT_VERSION = ['`"][^'`"]+['`"];", "const CURRENT_VERSION = '$Ver';"
        
        Set-Content -Path $versionTsPath -Value $updatedContent -NoNewline
        Write-Host "✅ 已更新 src/lib/version.ts: $Ver" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ 无法更新 version.ts: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# 主流程
Write-Host ""
Write-Host "🚀 开始更新版本到 $Version" -ForegroundColor Cyan
Write-Host ""

# 验证版本号
Test-VersionFormat -Ver $Version

# 步骤 1: 添加 CHANGELOG 模板（可选）
if (-not $SkipChangelog) {
    Add-ChangelogTemplate -Ver $Version
    Write-Host ""
    Write-Host "⏸️  请编辑 CHANGELOG 文件，填写更新内容" -ForegroundColor Yellow
    Write-Host "完成后，运行以下命令继续:" -ForegroundColor Yellow
    Write-Host "   .\scripts\update-version.ps1 $Version -SkipChangelog" -ForegroundColor White
    Write-Host ""
    exit 0
}

# 步骤 2: 更新 VERSION.txt
Write-Host "📝 步骤 1/3: 更新 VERSION.txt" -ForegroundColor Cyan
Update-VersionTxt -Ver $Version

# 步骤 3: 运行 convert-changelog.js
Write-Host ""
Write-Host "📝 步骤 2/3: 生成 changelog.ts" -ForegroundColor Cyan
Invoke-ConvertChangelog

# 步骤 4: 更新 version.ts
Write-Host ""
Write-Host "📝 步骤 3/3: 更新 version.ts" -ForegroundColor Cyan
Update-VersionTs -Ver $Version

Write-Host ""
Write-Host "✨ 版本更新完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📋 后续步骤:" -ForegroundColor Cyan
Write-Host "   1. 检查生成的文件是否正确" -ForegroundColor White
Write-Host "   2. 提交更改: git add . && git commit -m `"chore: release v$Version`"" -ForegroundColor White
Write-Host "   3. 创建标签: git tag v$Version" -ForegroundColor White
Write-Host "   4. 推送代码: git push && git push --tags" -ForegroundColor White
Write-Host ""
