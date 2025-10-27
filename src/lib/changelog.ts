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
    "版本管理系统和变更日志面板"
    ],
    changed: [
    "调整首页封面间距",
    "优化 Docker 构建配置"
    ],
    fixed: [
    "用户菜单交互问题",
    "页面布局和样式优化"
    ]
  }
];

export default changelog;
