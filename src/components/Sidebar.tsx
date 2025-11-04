/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import {
  Cat,
  Clover,
  Film,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  PlayCircle,
  Radio,
  Search,
  Star,
  Tv,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import { ThemeToggleButton } from './ThemeToggleButton';

interface SidebarContextType {
  isCollapsed: boolean;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
});

export const useSidebar = () => useContext(SidebarContext);

interface SidebarProps {
  onToggle?: (collapsed: boolean) => void;
  activePath?: string;
}

// 在浏览器环境下通过全局变量缓存折叠状态，避免组件重新挂载时出现初始值闪烁
declare global {
  interface Window {
    __sidebarCollapsed?: boolean;
  }
}

const SidebarComponent = ({ onToggle, activePath = '/' }: SidebarProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  // 使用 lazy initialization 从全局变量读取初始状态
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    // 这个函数只在客户端首次渲染时执行一次
    if (
      typeof window !== 'undefined' &&
      typeof window.__sidebarCollapsed !== 'undefined'
    ) {
      return window.__sidebarCollapsed;
    }
    return false; // 默认展开
  });

  // 客户端挂载后标记为已挂载
  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  // 当折叠状态变化时，同步到 <html> data 属性和全局变量
  // 使用 useLayoutEffect 确保在浏览器绘制前完成，避免闪烁
  useLayoutEffect(() => {
    if (isCollapsed) {
      document.documentElement.dataset.sidebarCollapsed = 'true';
    } else {
      delete document.documentElement.dataset.sidebarCollapsed;
    }
    window.__sidebarCollapsed = isCollapsed;
  }, [isCollapsed]);

  // 使用 useMemo 代替 useState + useEffect，减少重渲染
  const active = useMemo(() => {
    if (activePath) return activePath;
    const queryString = searchParams.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }, [activePath, pathname, searchParams]);

  const handleToggle = useCallback(() => {
    setIsCollapsed((prev) => {
      const newState = !prev;
      // 立即保存到 localStorage 和全局变量
      try {
        localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
        window.__sidebarCollapsed = newState;
      } catch (e) {
        // 静默失败
      }
      // 通知父组件
      onToggle?.(newState);
      return newState;
    });
  }, [onToggle]);

  // 使用 useMemo 缓存 context value，避免不必要的 context 更新
  const contextValue = useMemo(
    () => ({
      isCollapsed,
    }),
    [isCollapsed]
  );

  // 使用 useMemo 缓存菜单项，避免不必要的重渲染
  const menuItems = useMemo(() => {
    const baseItems = [
      {
        icon: Film,
        label: '电影',
        href: '/douban?type=movie',
      },
      {
        icon: PlayCircle,
        label: '短剧',
        href: '/shortdrama',
      },
      {
        icon: Tv,
        label: '剧集',
        href: '/douban?type=tv',
      },
      {
        icon: Cat,
        label: '动漫',
        href: '/douban?type=anime',
      },
      {
        icon: Clover,
        label: '综艺',
        href: '/douban?type=show',
      },
      {
        icon: Radio,
        label: '直播',
        href: '/live',
      },
    ];

    // 延迟检查自定义分类，避免阻塞初始渲染
    if (mounted && typeof window !== 'undefined') {
      const runtimeConfig = (window as any).RUNTIME_CONFIG;
      if (runtimeConfig?.CUSTOM_CATEGORIES?.length > 0) {
        baseItems.push({
          icon: Star,
          label: '自定义',
          href: '/douban?type=custom',
        });
      }
    }

    return baseItems;
  }, [mounted]);

  return (
    <SidebarContext.Provider value={contextValue}>
      {/* 在移动端隐藏侧边栏 */}
      <div className='hidden md:flex'>
        <aside
          data-sidebar
          suppressHydrationWarning
          className={`fixed top-0 left-0 h-screen bg-white/40 backdrop-blur-xl border-r border-gray-200/50 z-10 shadow-lg dark:bg-gray-900/70 dark:border-gray-700/50 rounded-r-xl ${
            isCollapsed ? 'w-[3rem]' : 'w-[5.4375rem]'
          }`}
          style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            transition: 'width 300ms ease-out',
          }}
        >
          <div className='flex h-full flex-col overflow-hidden'>
            {/* 首页导航 */}
            <nav className='px-2 pt-4'>
              {/* Logo - 仅在收起状态显示 */}
              {isCollapsed && (
                <Link
                  href='/'
                  className='flex items-center justify-center w-8 h-8 mb-2'
                  title='首页'
                >
                  <Image
                    src='/logo.png'
                    alt='Logo'
                    width={32}
                    height={32}
                    className='object-contain rounded-lg'
                    priority
                  />
                </Link>
              )}
              <Link
                href='/'
                data-active={active === '/'}
                suppressHydrationWarning
                className='group relative flex items-center rounded-lg text-gray-700 hover:bg-gray-200/80 hover:text-blue-600 data-[active=true]:bg-blue-500/20 data-[active=true]:text-blue-700 font-medium transition-colors duration-150 dark:text-gray-300 dark:hover:bg-gray-700/80 dark:hover:text-blue-400 dark:data-[active=true]:bg-blue-500/10 dark:data-[active=true]:text-blue-400 overflow-hidden'
                style={{
                  width: isCollapsed ? '32px' : '100%',
                  height: '32px',
                }}
                title={isCollapsed ? '首页' : undefined}
                prefetch={true}
              >
                <div
                  className='flex items-center justify-center flex-shrink-0 transition-all duration-300'
                  style={{
                    width: '32px',
                    height: '32px',
                  }}
                >
                  <Home className='h-[0.9375rem] w-auto leading-none text-gray-500 group-hover:text-blue-600 group-data-[active=true]:text-blue-700 dark:text-gray-400 dark:group-hover:text-blue-400 dark:group-data-[active=true]:text-blue-400 flex-shrink-0 block' />
                </div>
                <span
                  suppressHydrationWarning
                  className='text-sm leading-none whitespace-nowrap transition-all duration-300 overflow-hidden flex items-center'
                  style={{
                    width: isCollapsed ? '0px' : 'auto',
                    opacity: isCollapsed ? 0 : 1,
                    maxWidth: isCollapsed ? '0px' : '32px',
                    height: '32px',
                  }}
                >
                  首页
                </span>
              </Link>
              <Link
                href='/search'
                data-active={active === '/search'}
                suppressHydrationWarning
                className='group relative flex items-center rounded-lg text-gray-700 hover:bg-gray-200/80 hover:text-blue-600 data-[active=true]:bg-blue-500/20 data-[active=true]:text-blue-700 font-medium transition-colors duration-150 dark:text-gray-300 dark:hover:bg-gray-700/80 dark:hover:text-blue-400 dark:data-[active=true]:bg-blue-500/10 dark:data-[active=true]:text-blue-400 overflow-hidden mt-2'
                style={{
                  width: isCollapsed ? '32px' : '100%',
                  height: '32px',
                }}
                title={isCollapsed ? '搜索' : undefined}
                prefetch={true}
              >
                <div
                  className='flex items-center justify-center flex-shrink-0 transition-all duration-300'
                  style={{
                    width: '32px',
                    height: '32px',
                  }}
                >
                  <Search className='h-[0.9375rem] w-auto leading-none text-gray-500 group-hover:text-blue-600 group-data-[active=true]:text-blue-700 dark:text-gray-400 dark:group-hover:text-blue-400 dark:group-data-[active=true]:text-blue-400 flex-shrink-0 block' />
                </div>
                <span
                  suppressHydrationWarning
                  className='text-sm leading-none whitespace-nowrap transition-all duration-300 overflow-hidden flex items-center'
                  style={{
                    width: isCollapsed ? '0px' : 'auto',
                    opacity: isCollapsed ? 0 : 1,
                    maxWidth: isCollapsed ? '0px' : '32px',
                    height: '32px',
                  }}
                >
                  搜索
                </span>
              </Link>
            </nav>

            {/* 菜单项 */}
            <div className='flex-1 overflow-y-auto p-2'>
              <div className='space-y-2'>
                {menuItems.map((item) => {
                  const Icon = item.icon;

                  // 优化：简化 active 状态判断，减少字符串操作
                  let isActive = false;
                  if (item.href === active) {
                    isActive = true;
                  } else if (item.href.includes('type=')) {
                    const typeMatch = item.href.match(/type=([^&]+)/)?.[1];
                    isActive = active.includes(`type=${typeMatch}`);
                  } else if (item.href === '/shortdrama') {
                    isActive = active.startsWith('/shortdrama');
                  }
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      data-active={isActive}
                      suppressHydrationWarning
                      className='group relative flex items-center rounded-lg text-gray-700 hover:bg-gray-200/80 hover:text-blue-600 data-[active=true]:bg-blue-500/20 data-[active=true]:text-blue-700 font-medium transition-colors duration-150 dark:text-gray-300 dark:hover:bg-gray-700/80 dark:hover:text-blue-400 dark:data-[active=true]:bg-blue-500/10 dark:data-[active=true]:text-blue-400 overflow-hidden'
                      style={{
                        width: isCollapsed ? '32px' : '100%',
                        height: '32px',
                      }}
                      title={isCollapsed ? item.label : undefined}
                      prefetch={true}
                    >
                      <div
                        className='flex items-center justify-center flex-shrink-0 transition-all duration-300'
                        style={{
                          width: '32px',
                          height: '32px',
                        }}
                      >
                        <Icon className='h-[0.9375rem] w-auto leading-none text-gray-500 group-hover:text-blue-600 group-data-[active=true]:text-blue-700 dark:text-gray-400 dark:group-hover:text-blue-400 dark:group-data-[active=true]:text-blue-400 flex-shrink-0 block' />
                      </div>
                      <span
                        suppressHydrationWarning
                        className='text-sm leading-none whitespace-nowrap transition-all duration-300 overflow-hidden flex items-center'
                        style={{
                          width: isCollapsed ? '0px' : 'auto',
                          opacity: isCollapsed ? 0 : 1,
                          maxWidth: isCollapsed ? '0px' : '32px',
                          height: '32px',
                        }}
                      >
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* 底部按钮区域 */}
            <div className='mt-auto px-2 pb-4'>
              <div
                suppressHydrationWarning
                className={`sidebar-bottom-buttons flex items-center justify-center w-full ${
                  isCollapsed ? 'flex-col' : 'flex-row'
                }`}
                style={{
                  gap: '0.15625rem',
                }}
              >
                <ThemeToggleButton />
                {mounted && (
                  <button
                    onClick={handleToggle}
                    className='group w-8 h-8 rounded-lg flex items-center justify-center text-gray-700 hover:bg-gray-300/70 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-700/80 dark:hover:text-blue-400 font-medium transition-colors duration-200 flex-shrink-0'
                    title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
                  >
                    {isCollapsed ? (
                      <PanelLeftOpen className='w-4 h-4 text-gray-500 group-hover:text-blue-600 dark:text-gray-400 dark:group-hover:text-blue-400' />
                    ) : (
                      <PanelLeftClose className='w-4 h-4 text-gray-500 group-hover:text-blue-600 dark:text-gray-400 dark:group-hover:text-blue-400' />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </aside>
        <div
          suppressHydrationWarning
          className={`sidebar-offset ${
            isCollapsed ? 'w-[3rem]' : 'w-[5.4375rem]'
          }`}
          style={{
            transition: 'width 300ms ease-out',
          }}
        ></div>
      </div>
    </SidebarContext.Provider>
  );
};

// 使用 memo 优化，避免不必要的重渲染
const Sidebar = memo(SidebarComponent);

export default Sidebar;
