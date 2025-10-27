// 此文件由 scripts/convert-changelog.js 自动生成
// 请勿手动编辑

export interface ChangelogEntry {
  version: string;
  date: string;
  added: string[];
  changed: string[];
  fixed: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: "1.0.0",
    date: "2025-10-27",
    added: [
    "基于 Semantic Versioning 的版本号机制",
    "版本信息面板，展示本地变更日志和远程更新日志"
    ],
    changed: [
    "调整首页横向滚动列表封面间距：桌面端从 24px 改为 20px",
    "优化 Docker 多架构构建配置"
    ],
    fixed: [
    "修复用户菜单交互问题：解决 Portal 渲染导致的点击外部关闭逻辑错误",
    "修复横向滚动按钮 z-index 过高导致的交互问题"
    ]
  }
];

export default changelog;
