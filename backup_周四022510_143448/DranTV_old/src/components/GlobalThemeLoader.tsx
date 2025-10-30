'use client';

import { useEffect } from 'react';

// 全局主题加载器组件 - 从API同步最新配置，确保缓存与服务端一致
const GlobalThemeLoader = () => {
  useEffect(() => {
    const syncThemeWithAPI = async () => {
      try {
        const response = await fetch('/api/admin/config');

        // 如果是 400 错误（localstorage 模式），直接使用缓存或默认主题
        if (response.status === 400) {
          const cachedTheme = getCachedTheme();
          if (!cachedTheme) {
            applyAndCacheTheme('default', '');
          }
          return;
        }

        const result = await response.json();

        if (result?.Config?.ThemeConfig) {
          const themeConfig = result.Config.ThemeConfig;
          const { defaultTheme, customCSS, allowUserCustomization } =
            themeConfig;

          // 获取当前缓存的主题配置
          const cachedTheme = getCachedTheme();

          // 比较API配置与缓存配置
          const configChanged =
            !cachedTheme ||
            cachedTheme.defaultTheme !== defaultTheme ||
            cachedTheme.customCSS !== customCSS;

          if (configChanged) {
            applyAndCacheTheme(defaultTheme, customCSS);
          }

          // 将配置存储到运行时配置中，供ThemeManager使用
          const runtimeConfig = (window as any).RUNTIME_CONFIG;
          if (runtimeConfig) {
            runtimeConfig.THEME_CONFIG = themeConfig;
          }
        } else {
          // API失败时，如果有缓存就保持，没有缓存就用默认
          const cachedTheme = getCachedTheme();
          if (!cachedTheme) {
            applyAndCacheTheme('default', '');
          }
        }
      } catch (error) {
        // 错误时如果有缓存就保持，没有缓存就用默认
        const cachedTheme = getCachedTheme();
        if (!cachedTheme) {
          applyAndCacheTheme('default', '');
        }
      }
    };

    // 获取缓存的主题配置
    const getCachedTheme = () => {
      try {
        const cached = localStorage.getItem('theme-cache');
        return cached ? JSON.parse(cached) : null;
      } catch (error) {
        localStorage.removeItem('theme-cache');
        return null;
      }
    };

    // 应用主题并缓存
    const applyAndCacheTheme = (themeId: string, css: string = '') => {
      applyTheme(themeId, css);

      // 缓存主题配置
      const themeConfig = { defaultTheme: themeId, customCSS: css };
      try {
        localStorage.setItem('theme-cache', JSON.stringify(themeConfig));
      } catch (error) {
        // 静默失败
      }
    };

    // 应用主题函数
    const applyTheme = (themeId: string, css: string = '') => {
      const html = document.documentElement;

      // 移除所有主题class
      html.removeAttribute('data-theme');

      // 应用新主题
      if (themeId !== 'default') {
        html.setAttribute('data-theme', themeId);
      }

      // 应用自定义CSS
      let customStyleEl = document.getElementById('custom-theme-css');
      if (!customStyleEl) {
        customStyleEl = document.createElement('style');
        customStyleEl.id = 'custom-theme-css';
        document.head.appendChild(customStyleEl);
      }
      customStyleEl.textContent = css;
    };

    // 延迟一点时间，确保页面缓存主题已应用，然后同步API配置
    const timer = setTimeout(() => {
      syncThemeWithAPI();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return null; // 这是一个逻辑组件，不渲染任何内容
};

export default GlobalThemeLoader;
