/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';

import { getConfig } from '@/lib/config';

import { GlobalErrorIndicator } from '../components/GlobalErrorIndicator';
import GlobalThemeLoader from '../components/GlobalThemeLoader';
import { SiteProvider } from '../components/SiteProvider';
import { ThemeProvider } from '../components/ThemeProvider';
import { ToastProvider } from '../components/Toast';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // 优化字体加载
  preload: true,
});

// 开发环境优化配置
const isDev = process.env.NODE_ENV !== 'production';

export const dynamic = 'force-dynamic';
// Next.js 16 要求这些配置必须是静态值
export const fetchCache = 'default-no-store'; // 禁用缓存
export const revalidate = 0; // 不缓存

// 动态生成 metadata，支持配置更新后的标题变化
export async function generateMetadata(): Promise<Metadata> {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  const config = await getConfig();
  let siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'DranTV';
  if (storageType !== 'localstorage') {
    siteName = config.SiteConfig.SiteName;
  }

  return {
    title: siteName,
    description: '影视聚合',
    manifest: '/manifest.json',
    icons: {
      icon: '/icon.ico',
      apple: '/logo.png',
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  let siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'DranTV';
  let announcement =
    process.env.ANNOUNCEMENT ||
    '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。';

  let doubanProxyType =
    process.env.NEXT_PUBLIC_DOUBAN_PROXY_TYPE || 'cmliussss-cdn-tencent';
  let doubanProxy = process.env.NEXT_PUBLIC_DOUBAN_PROXY || '';
  let doubanImageProxyType =
    process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE || 'cmliussss-cdn-tencent';
  let doubanImageProxy = process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY || '';
  let disableYellowFilter =
    process.env.NEXT_PUBLIC_DISABLE_YELLOW_FILTER === 'true';
  let fluidSearch = process.env.NEXT_PUBLIC_FLUID_SEARCH !== 'false';
  let requireDeviceCode =
    process.env.NEXT_PUBLIC_REQUIRE_DEVICE_CODE === 'true';
  let customCategories = [] as {
    name: string;
    type: 'movie' | 'tv';
    query: string;
  }[];
  if (storageType !== 'localstorage') {
    const config = await getConfig();
    siteName = config.SiteConfig.SiteName;
    announcement = config.SiteConfig.Announcement;

    doubanProxyType = config.SiteConfig.DoubanProxyType;
    doubanProxy = config.SiteConfig.DoubanProxy;
    doubanImageProxyType = config.SiteConfig.DoubanImageProxyType;
    doubanImageProxy = config.SiteConfig.DoubanImageProxy;
    disableYellowFilter = config.SiteConfig.DisableYellowFilter;
    customCategories = config.CustomCategories.filter(
      (category) => !category.disabled,
    ).map((category) => ({
      name: category.name || '',
      type: category.type,
      query: category.query,
    }));
    fluidSearch = config.SiteConfig.FluidSearch;
    // 优先使用环境变量，如果未设置则使用数据库配置
    requireDeviceCode =
      process.env.NEXT_PUBLIC_REQUIRE_DEVICE_CODE === 'true'
        ? true
        : process.env.NEXT_PUBLIC_REQUIRE_DEVICE_CODE === 'false'
          ? false
          : config.SiteConfig.RequireDeviceCode;
  }

  // 将运行时配置注入到全局 window 对象，供客户端在运行时读取
  const runtimeConfig = {
    STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage',
    DOUBAN_PROXY_TYPE: doubanProxyType,
    DOUBAN_PROXY: doubanProxy,
    DOUBAN_IMAGE_PROXY_TYPE: doubanImageProxyType,
    DOUBAN_IMAGE_PROXY: doubanImageProxy,
    DISABLE_YELLOW_FILTER: disableYellowFilter,
    CUSTOM_CATEGORIES: customCategories,
    FLUID_SEARCH: fluidSearch,
    REQUIRE_DEVICE_CODE: requireDeviceCode,
    WS_URL: process.env.NEXT_PUBLIC_WS_URL || '',
    TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '',
  };

  return (
    <html lang='zh-CN' suppressHydrationWarning>
      <head>
        <meta
          name='viewport'
          content='width=device-width, initial-scale=1.0, viewport-fit=cover'
        />
        {/* 将配置序列化后直接写入脚本，浏览器端可通过 window.RUNTIME_CONFIG 获取 */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.RUNTIME_CONFIG = ${JSON.stringify(runtimeConfig)};`,
          }}
        />

        {/* 立即从缓存应用主题和侧边栏状态，避免闪烁 */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // 从localStorage立即获取缓存的主题配置
                  const cachedTheme = localStorage.getItem('theme-cache');
                  
                  if (cachedTheme) {
                    try {
                      const themeConfig = JSON.parse(cachedTheme);
                      
                      // 立即应用缓存的主题，避免闪烁
                      const html = document.documentElement;
                      
                      // 清除现有主题
                      html.removeAttribute('data-theme');
                      
                      // 应用缓存的主题
                      if (themeConfig.defaultTheme && themeConfig.defaultTheme !== 'default') {
                        html.setAttribute('data-theme', themeConfig.defaultTheme);
                      }
                      
                      // 应用缓存的自定义CSS
                      if (themeConfig.customCSS) {
                        let customStyleEl = document.getElementById('custom-theme-css');
                        if (!customStyleEl) {
                          customStyleEl = document.createElement('style');
                          customStyleEl.id = 'custom-theme-css';
                          document.head.appendChild(customStyleEl);
                        }
                        customStyleEl.textContent = themeConfig.customCSS;
                      }
                    } catch (parseError) {
                      localStorage.removeItem('theme-cache'); // 清除无效缓存
                    }
                  }
                  
                  // 立即应用侧边栏折叠状态，避免闪烁
                  const sidebarCollapsed = localStorage.getItem('sidebarCollapsed');
                  if (sidebarCollapsed) {
                    try {
                      const isCollapsed = JSON.parse(sidebarCollapsed);
                      window.__sidebarCollapsed = isCollapsed;
                      if (isCollapsed) {
                        document.documentElement.dataset.sidebarCollapsed = 'true';
                      }
                    } catch (parseError) {
                      localStorage.removeItem('sidebarCollapsed');
                    }
                  }
                } catch (error) {
                  // 静默失败
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.className} min-h-screen bg-white text-gray-900 dark:bg-black dark:text-gray-200`}
      >
        <ThemeProvider attribute='class' defaultTheme='system' enableSystem>
          <ToastProvider>
            <SiteProvider siteName={siteName} announcement={announcement}>
              <GlobalThemeLoader />
              {children}
              <GlobalErrorIndicator />
            </SiteProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
