/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Moon, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState, useRef } from 'react';

// 固定时段：6:00-18:00 为浅色模式，18:00-6:00 为暗色模式
const LIGHT_MODE_START = 6; // 早上6点
const LIGHT_MODE_END = 18; // 晚上6点

export function ThemeToggleButton() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const pathname = usePathname();
  const hasAutoSwitchedRef = useRef<{ light: boolean; dark: boolean }>({
    light: false,
    dark: false,
  });

  const setThemeColor = (theme?: string) => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = theme === 'dark' ? '#0c111c' : '#f9fbfe';
      document.head.appendChild(meta);
    } else {
      meta.setAttribute('content', theme === 'dark' ? '#0c111c' : '#f9fbfe');
    }
  };

  // 检查是否有手动切换记录
  const hasManualOverride = () => {
    if (typeof window === 'undefined') return false;
    const manualTheme = localStorage.getItem('manualThemeOverride');
    if (!manualTheme) return false;

    try {
      const { theme, timestamp } = JSON.parse(manualTheme);
      const now = Date.now();
      // 手动切换记录在下一个时间段切换前有效
      const hour = new Date().getHours();
      const currentPeriod =
        hour >= LIGHT_MODE_START && hour < LIGHT_MODE_END ? 'light' : 'dark';
      const savedPeriod = localStorage.getItem('manualThemePeriod');

      // 如果时间段改变了，清除手动记录
      if (savedPeriod && savedPeriod !== currentPeriod) {
        localStorage.removeItem('manualThemeOverride');
        localStorage.removeItem('manualThemePeriod');
        return false;
      }

      return true;
    } catch {
      return false;
    }
  };

  // 获取手动设置的主题
  const getManualTheme = () => {
    if (typeof window === 'undefined') return null;
    const manualTheme = localStorage.getItem('manualThemeOverride');
    if (!manualTheme) return null;

    try {
      const { theme } = JSON.parse(manualTheme);
      return theme;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // 根据时间自动切换主题
  useEffect(() => {
    if (!mounted) return;

    const updateThemeByTime = () => {
      // 如果有手动切换记录，跳过自动切换
      if (hasManualOverride()) {
        const manualTheme = getManualTheme();
        if (manualTheme && resolvedTheme !== manualTheme) {
          setThemeColor(manualTheme);
          setTheme(manualTheme);
        }
        return;
      }

      const hour = new Date().getHours();
      const shouldBeLightMode =
        hour >= LIGHT_MODE_START && hour < LIGHT_MODE_END;
      const targetTheme = shouldBeLightMode ? 'light' : 'dark';

      // 检查是否需要切换
      if (resolvedTheme !== targetTheme) {
        // 检查这个模式是否已经自动切换过
        if (shouldBeLightMode && hasAutoSwitchedRef.current.light) {
          return; // 浅色模式已经自动切换过，跳过
        }
        if (!shouldBeLightMode && hasAutoSwitchedRef.current.dark) {
          return; // 暗色模式已经自动切换过，跳过
        }

        // 执行切换
        setThemeColor(targetTheme);
        setTheme(targetTheme);

        // 标记已切换
        if (shouldBeLightMode) {
          hasAutoSwitchedRef.current.light = true;
          hasAutoSwitchedRef.current.dark = false; // 重置暗色标记
        } else {
          hasAutoSwitchedRef.current.dark = true;
          hasAutoSwitchedRef.current.light = false; // 重置浅色标记
        }
      }
    };

    // 立即执行一次（页面加载时）
    updateThemeByTime();

    // 每分钟检查一次
    const interval = setInterval(updateThemeByTime, 60000);

    return () => clearInterval(interval);
  }, [mounted, resolvedTheme, setTheme]);

  useEffect(() => {
    if (mounted) {
      setThemeColor(resolvedTheme);
    }
  }, [mounted, resolvedTheme, pathname]);

  if (!mounted) {
    return (
      <button
        className='group w-10 h-10 rounded-lg flex items-center justify-center text-gray-700 hover:bg-gray-300/70 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-700/80 dark:hover:text-blue-400 font-medium transition-colors duration-200 flex-shrink-0'
        aria-label='Toggle theme'
        disabled
      >
        <Moon className='w-4 h-4 text-gray-500 group-hover:text-blue-600 dark:text-gray-400 dark:group-hover:text-blue-400' />
      </button>
    );
  }

  const toggleTheme = () => {
    const targetTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

    // 记录手动切换
    const hour = new Date().getHours();
    const currentPeriod =
      hour >= LIGHT_MODE_START && hour < LIGHT_MODE_END ? 'light' : 'dark';

    localStorage.setItem(
      'manualThemeOverride',
      JSON.stringify({
        theme: targetTheme,
        timestamp: Date.now(),
      })
    );
    localStorage.setItem('manualThemePeriod', currentPeriod);

    setThemeColor(targetTheme);
    if (!(document as any).startViewTransition) {
      setTheme(targetTheme);
      return;
    }

    (document as any).startViewTransition(() => {
      setTheme(targetTheme);
    });
  };

  return (
    <button
      onClick={toggleTheme}
      className='group w-10 h-10 rounded-lg flex items-center justify-center text-gray-700 hover:bg-gray-300/70 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-700/80 dark:hover:text-blue-400 font-medium transition-colors duration-200 flex-shrink-0'
      aria-label='Toggle theme'
      title={resolvedTheme === 'dark' ? '切换到浅色模式' : '切换到暗色模式'}
    >
      {resolvedTheme === 'dark' ? (
        <Sun className='w-4 h-4 text-gray-500 group-hover:text-blue-600 dark:text-gray-400 dark:group-hover:text-blue-400' />
      ) : (
        <Moon className='w-4 h-4 text-gray-500 group-hover:text-blue-600 dark:text-gray-400 dark:group-hover:text-blue-400' />
      )}
    </button>
  );
}
