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
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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

const Sidebar = ({ onToggle, activePath = '/' }: SidebarProps) => {
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
  useEffect(() => {
    if (isCollapsed) {
      document.documentElement.dataset.sidebarCollapsed = 'true';
    } else {
      delete document.documentElement.dataset.sidebarCollapsed;
    }
    window.__sidebarCollapsed = isCollapsed;
  }, [isCollapsed]);

  const [active, setActive] = useState(activePath);

  useEffect(() => {
    // 优先使用传入的 activePath
    if (activePath) {
      setActive(activePath);
    } else {
      // 否则使用当前路径
      const getCurrentFullPath = () => {
        const queryString = searchParams.toString();
        return queryString ? `${pathname}?${queryString}` : pathname;
      };
      const fullPath = getCurrentFullPath();
      setActive(fullPath);
    }
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

  const contextValue = {
    isCollapsed,
  };

  const [menuItems, setMenuItems] = useState([
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
  ]);

  useEffect(() => {
    const runtimeConfig = (window as any).RUNTIME_CONFIG;
    if (runtimeConfig?.CUSTOM_CATEGORIES?.length > 0) {
      setMenuItems((prevItems) => [
        ...prevItems,
        {
          icon: Star,
          label: '自定义',
          href: '/douban?type=custom',
        },
      ]);
    }
  }, []);

  return (
    <SidebarContext.Provider value={contextValue}>
      {/* 在移动端隐藏侧边栏 */}
      <div className='hidden md:flex'>
        <aside
          data-sidebar
          suppressHydrationWarning
          className={`fixed top-0 left-0 h-screen bg-white/40 backdrop-blur-xl transition-all duration-300 border-r border-gray-200/50 z-10 shadow-lg dark:bg-gray-900/70 dark:border-gray-700/50 rounded-r-xl ${
            isCollapsed ? 'w-[3.5rem]' : 'w-[6.25rem]'
          }`}
          style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <div className='flex h-full flex-col overflow-hidden'>
            {/* 首页导航 */}
            <nav className='px-2 pt-4'>
              <Link
                href='/'
                onClick={() => setActive('/')}
                data-active={active === '/'}
                suppressHydrationWarning
                className='group relative flex items-center rounded-lg text-gray-700 hover:bg-gray-200/80 hover:text-blue-600 data-[active=true]:bg-blue-500/20 data-[active=true]:text-blue-700 font-medium transition-all duration-300 dark:text-gray-300 dark:hover:bg-gray-700/80 dark:hover:text-blue-400 dark:data-[active=true]:bg-blue-500/10 dark:data-[active=true]:text-blue-400 overflow-hidden'
                style={{
                  width: isCollapsed ? '40px' : '100%',
                  height: '40px',
                }}
                title={isCollapsed ? '首页' : undefined}
              >
                <div
                  className='flex items-center justify-center flex-shrink-0 transition-all duration-300'
                  style={{
                    width: '40px',
                    height: '40px',
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
                    maxWidth: isCollapsed ? '0px' : '60px',
                    height: '40px',
                  }}
                >
                  首页
                </span>
              </Link>
              <Link
                href='/search'
                onClick={() => setActive('/search')}
                data-active={active === '/search'}
                suppressHydrationWarning
                className='group relative flex items-center rounded-lg text-gray-700 hover:bg-gray-200/80 hover:text-blue-600 data-[active=true]:bg-blue-500/20 data-[active=true]:text-blue-700 font-medium transition-all duration-300 dark:text-gray-300 dark:hover:bg-gray-700/80 dark:hover:text-blue-400 dark:data-[active=true]:bg-blue-500/10 dark:data-[active=true]:text-blue-400 overflow-hidden mt-2'
                style={{
                  width: isCollapsed ? '40px' : '100%',
                  height: '40px',
                }}
                title={isCollapsed ? '搜索' : undefined}
              >
                <div
                  className='flex items-center justify-center flex-shrink-0 transition-all duration-300'
                  style={{
                    width: '40px',
                    height: '40px',
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
                    maxWidth: isCollapsed ? '0px' : '60px',
                    height: '40px',
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
                  // 检查当前路径是否匹配这个菜单项
                  const typeMatch = item.href.match(/type=([^&]+)/)?.[1];

                  // 解码URL以进行正确的比较
                  const decodedActive = decodeURIComponent(active);
                  const decodedItemHref = decodeURIComponent(item.href);

                  const isActive =
                    decodedActive === decodedItemHref ||
                    (decodedActive.startsWith('/douban') &&
                      decodedActive.includes(`type=${typeMatch}`)) ||
                    (item.href === '/shortdrama' &&
                      decodedActive.startsWith('/shortdrama'));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setActive(item.href)}
                      data-active={isActive}
                      suppressHydrationWarning
                      className='group relative flex items-center rounded-lg text-gray-700 hover:bg-gray-200/80 hover:text-blue-600 data-[active=true]:bg-blue-500/20 data-[active=true]:text-blue-700 font-medium transition-all duration-300 dark:text-gray-300 dark:hover:bg-gray-700/80 dark:hover:text-blue-400 dark:data-[active=true]:bg-blue-500/10 dark:data-[active=true]:text-blue-400 overflow-hidden'
                      style={{
                        width: isCollapsed ? '40px' : '100%',
                        height: '40px',
                      }}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <div
                        className='flex items-center justify-center flex-shrink-0 transition-all duration-300'
                        style={{
                          width: '40px',
                          height: '40px',
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
                          maxWidth: isCollapsed ? '0px' : '60px',
                          height: '40px',
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
                    className='group w-10 h-10 rounded-lg flex items-center justify-center text-gray-700 hover:bg-gray-300/70 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-700/80 dark:hover:text-blue-400 font-medium transition-colors duration-200 flex-shrink-0'
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
          className={`transition-all duration-300 sidebar-offset ${
            isCollapsed ? 'w-[3.5rem]' : 'w-[6.25rem]'
          }`}
        ></div>
      </div>
    </SidebarContext.Provider>
  );
};

export default Sidebar;
