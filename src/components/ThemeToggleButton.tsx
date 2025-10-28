/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Moon, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggleButton() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const pathname = usePathname();

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

  useEffect(() => {
    setMounted(true);
  }, []);

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
