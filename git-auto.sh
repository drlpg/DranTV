# /usr/bin/env bash
# 用法: git-auto "提交信息"

set -e
START_TIME=$(date +%s)

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# 日志文件目录
LOG_DIR=".git/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"

function step() { echo -e "${CYAN}[$(date '+%H:%M:%S')] ➜ $1${NC}"; }
function success() { echo -e "${GREEN}✅ $1${NC}"; }
function warning() { echo -e "${YELLOW}⚠️ $1${NC}"; }
function error() { echo -e "${RED}❌ $1${NC}"; }

# 检查 Git 仓库
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    error "当前目录不是 Git 仓库"
    exit 1
fi

# 在仓库根目录运行
cd "$(git rev-parse --show-toplevel)" || {
    error "无法切换到仓库根目录"
    exit 1
}

# 检查提交信息
if [ -z "$1" ]; then
    error "请输入提交信息"
    echo "用法: git-auto \"提交信息\""
    exit 1
fi

branch=$(git rev-parse --abbrev-ref HEAD)

# 记录日志函数
function log_append() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# 写入日志开头
echo "------------------------------------------------------------" >> "$LOG_FILE"
echo "🚀 开始运行脚本 [$(date '+%Y-%m-%d %H:%M:%S')] 分支: $branch" >> "$LOG_FILE"

# 拉取远程更新（添加超时和错误处理）
step "检测远程更新..."
timeout 10 git fetch origin "$branch" 2>&1 || {
    warning "远程检查超时或失败，跳过同步"
    log_append "⚠️ 远程检查失败，跳过同步"
}

LOCAL=$(git rev-parse "$branch" 2>/dev/null || echo "")
REMOTE=$(git rev-parse "origin/$branch" 2>/dev/null || echo "")
BASE=$(git merge-base "$branch" "origin/$branch" 2>/dev/null || echo "")

if [ -n "$LOCAL" ] && [ -n "$REMOTE" ] && [ -n "$BASE" ] && [ "$LOCAL" != "$REMOTE" ]; then
    if [ "$LOCAL" = "$BASE" ]; then
        # 本地落后于远程，需要选择性合并
        step "远程有更新，检查变更文件..."
        
        # 获取远程相对于本地的变更文件
        changed_files=$(git diff --name-only "$LOCAL" "$REMOTE" 2>/dev/null || echo "")
        
        if [ -n "$changed_files" ]; then
            step "开始合并..."
            log_append "检测到远程变更，开始合并"
            
            # 先暂存本地未提交的修改
            if ! git diff --quiet || ! git diff --cached --quiet; then
                step "暂存本地修改..."
                git stash push -m "Auto-stash before merge" 2>/dev/null || true
                STASHED=true
            else
                STASHED=false
            fi
            
            # 尝试执行 merge
            MERGE_RESULT=0
            timeout 10 git merge --no-commit --no-ff "origin/$branch" 2>&1 || MERGE_RESULT=$?
            
            if [ $MERGE_RESULT -eq 0 ]; then
                # 合并成功，无冲突
                step "合并成功，应用本地优先规则..."
                log_append "合并成功，应用本地优先规则"
            else
                # 合并失败（可能有冲突）
                warning "合并有冲突，按规则自动处理..."
                log_append "⚠️ [分支: $branch] 检测到合并冲突，应用本地优先规则"
            fi
            
            # 应用合并规则：本地优先
            for file in $changed_files; do
                # 所有文件：使用本地版本
                if git cat-file -e "HEAD:$file" 2>/dev/null; then
                    git checkout --ours -- "$file" 2>/dev/null || true
                    step "保留本地版本: $file"
                    log_append "文件: $file → 采用本地版本(ours)"
                else
                    # 本地不存在的文件，拒绝远程新增
                    git rm --cached "$file" 2>/dev/null || true
                    rm -f "$file" 2>/dev/null || true
                    step "拒绝远程新文件: $file"
                    log_append "文件: $file → 拒绝远程新增文件"
                fi
                git add "$file" 2>/dev/null || true
            done
            
            # 提交合并结果
            if git commit -m "自动合并: 保留本地版本" 2>/dev/null; then
                success "合并完成"
                log_append "✅ 合并完成"
            else
                warning "没有需要提交的合并更改"
                log_append "⚠️ 没有需要提交的合并更改"
            fi
            
            # 恢复暂存的修改
            if [ "$STASHED" = true ]; then
                step "恢复本地修改..."
                git stash pop 2>/dev/null || {
                    warning "恢复暂存修改时有冲突，请手动处理"
                    log_append "⚠️ stash pop 有冲突"
                }
            fi
        else
            # 没有文件变更，直接 fast-forward
            timeout 10 git merge --no-edit "origin/$branch" 2>&1 || true
            success "远程更新已合并"
            log_append "远程更新已合并"
        fi
    else
        warning "本地和远程都有新提交，需要手动处理"
        log_append "⚠️ 本地和远程都有新提交"
    fi
else
    success "远程已是最新"
    log_append "远程已是最新，无需合并"
fi

# 检测未跟踪文件并添加
if [ -n "$(git ls-files --others --exclude-standard)" ]; then
    step "检测到未跟踪文件，自动添加..."
    git add -A
    log_append "已添加未跟踪文件"
else
    step "没有新文件，检查已跟踪文件变更..."
    git add -u
    log_append "已添加修改的文件"
fi

# 检查是否有改动
if git diff --cached --quiet; then
    warning "没有可提交的更改"
    log_append "没有可提交的更改"
else
    step "提交更改..."
    git commit -m "$1"
    log_append "提交信息: $1"

    step "推送到 $branch ..."
    if ! git push origin "$branch" 2>&1; then
        warning "推送失败，可能远程有新提交，尝试重新同步..."
        log_append "⚠️ 推送失败，重新同步"
        
        # 重新拉取并合并
        git fetch origin "$branch"
        if git merge --no-edit "origin/$branch" 2>&1; then
            step "重新推送..."
            git push origin "$branch"
            success "推送完成"
            log_append "✅ 已推送到远程分支 $branch"
        else
            error "合并失败"
            log_append "❌ 合并失败"
            
            # 询问是否强制推送
            echo -e "${YELLOW}是否强制推送覆盖远程分支？这将丢失远程的提交！${NC}"
            echo -e "${YELLOW}输入 'yes' 确认强制推送，或 'no' 取消：${NC}"
            read -r FORCE_PUSH
            
            if [ "$FORCE_PUSH" = "yes" ]; then
                warning "执行强制推送..."
                log_append "⚠️ 确认强制推送"
                if git push origin "$branch" --force 2>&1; then
                    success "强制推送完成"
                    log_append "✅ 强制推送成功"
                else
                    error "强制推送失败"
                    log_append "❌ 强制推送失败"
                    exit 1
                fi
            else
                error "已取消推送，请手动处理冲突"
                log_append "❌ 用户取消强制推送"
                exit 1
            fi
        fi
    else
        success "推送完成"
        log_append "✅ 已推送到远程分支 $branch"
    fi
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
success "全部完成 🎉 (耗时 ${DURATION} 秒)"
log_append "🎉 全部完成 (耗时 ${DURATION} 秒)"