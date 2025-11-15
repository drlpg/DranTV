// 全局主题Hook - 已弃用，主题现在由 GlobalThemeLoader 统一管理
// 保留此文件是为了向后兼容性，但不再使用

export const useThemeInit = () => {
  // 不再执行任何操作，主题由 GlobalThemeLoader 处理
};

export const useTheme = () => {
  // 已弃用：主题现在由 GlobalThemeLoader 和 ThemeManager 统一管理

  return {
    applyTheme: () => {},
    getCurrentTheme: () => 'default',
    getCurrentCustomCSS: () => '',
  };
};
