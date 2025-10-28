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
    version: "1.0.3",
    date: "2025-10-29",
    added: [
      // 无新增内容
    ],
    changed: [
    "优化服务器优雅关闭处理",
    "改进 Upstash Redis 配置和连接"
    ],
    fixed: [
    "修复服务器关闭时 WebSocket 端口未释放问题",
    "修复环境变量优先级，确保配置正确加载",
    "修复机器码绑定选项显示逻辑"
    ]
  },
  {
    version: "1.0.2",
    date: "2025-10-28",
    added: [
    "添加页面滚动条显示"
    ],
    changed: [
    "优化徽章和按钮样式"
    ],
    fixed: [
    "修复侧边栏状态记忆和布局问题",
    "修复继续观看板块显示逻辑",
    "优化代码质量和性能"
    ]
  },
  {
    version: "1.0.1",
    date: "2025-10-28",
    added: [
      // 无新增内容
    ],
    changed: [
      // 无变更内容
    ],
    fixed: [
    "修复封面悬停时滚动按钮被遮盖的层级问题"
    ]
  },
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
