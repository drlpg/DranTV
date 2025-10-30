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
    version: "1.0.8",
    date: "2025-10-30",
    added: [
      // 无新增内容
    ],
    changed: [
    "优化聊天界面样式，调整气泡圆角、间距和颜色",
    "移除聊天气泡和头像阴影效果",
    "优化输入框样式和聚焦状态"
    ],
    fixed: [
    "修复管理页面 HTML 结构错误",
    "移除调试日志输出"
    ]
  },
  {
    version: "1.0.7",
    date: "2025-10-29",
    added: [
      // 无新增内容
    ],
    changed: [
    "将所有视口高度单位从 vh 改为 dvh 以适配移动端动态视口"
    ],
    fixed: [
    "修复移动端页面高度未适配浏览器地址栏和控制栏问题",
    "修复移动端弹窗和页面内容显示不完整问题"
    ]
  },
  {
    version: "1.0.6",
    date: "2025-10-29",
    added: [
      // 无新增内容
    ],
    changed: [
    "优化移动端用户菜单弹窗响应式布局，添加左右间距",
    "移动端全面禁用弹窗滚动条显示",
    "统一三个弹窗内所有分割线为虚线样式",
    "移动端头像裁剪改为固定全尺寸裁剪"
    ],
    fixed: [
      // 无修复内容
    ]
  },
  {
    version: "1.0.5",
    date: "2025-10-29",
    added: [
      // 无新增内容
    ],
    changed: [
    "优化选集侧边栏容器和分割线颜色",
    "调整侧边栏圆角为 12px",
    "优化视频源容器悬停效果"
    ],
    fixed: [
    "修复重启服务器后管理面板数据丢失问题",
    "修复滚动条在暗色模式下无法自动隐藏问题"
    ]
  },
  {
    version: "1.0.4",
    date: "2025-10-29",
    added: [
    "添加版本更新自动化脚本"
    ],
    changed: [
    "优化版本信息弹窗界面"
    ],
    fixed: [
    "修复 TypeScript 类型错误"
    ]
  },
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
