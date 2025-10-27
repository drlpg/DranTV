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
  Star,
  Tv,
} from 'lucide-react';
import Image from 'next/image';
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

import { useSite } from './SiteProvider';
import { ThemeToggleButton } from './ThemeToggleButton';

interface SidebarContextType {
  isCollapsed: boolean;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
});

export const useSidebar = () => useContext(SidebarContext);

// Logo 组件，仅用于首页跳转
interface LogoProps {
  isCollapsed: boolean;
}

const Logo = ({ isCollapsed }: LogoProps) => {
  const { siteName } = useSite();

  if (isCollapsed) {
    return (
      <Link
        href='/'
        className='flex items-center justify-center hover:opacity-80 transition-opacity duration-200'
        title='返回首页'
      >
        <Image
          src='/logo.png'
          alt={siteName}
          width={32}
          height={32}
          className='rounded-lg'
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            if (!img.dataset.retried) {
              img.dataset.retried = 'true';
              setTimeout(() => {
                img.src = '/logo.png';
              }, 2000);
            }
          }}
        />
      </Link>
    );
  }

  return (
    <Link
      href='/'
      className='flex flex-col items-center justify-center select-none hover:opacity-80 transition-opacity duration-200'
    >
      <Image
        src='/logo.png'
        alt={siteName}
        width={40}
        height={40}
        className='rounded-lg'
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          if (!img.dataset.retried) {
            img.dataset.retried = 'true';
            setTimeout(() => {
              img.src = '/logo.png';
            }, 2000);
          }
        }}
      />
      <span className='text-lg font-bold text-gray-700 dark:text-gray-300 tracking-tight mt-2'>
        {siteName}
      </span>
    </Link>
  );
};

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
  // 若同一次 SPA 会话中已经读取过折叠状态，则直接复用，避免闪烁
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (
      typeof window !== 'undefined' &&
      typeof window.__sidebarCollapsed === 'boolean'
    ) {
      return window.__sidebarCollapsed;
    }
    return false; // 默认展开
  });

  // 首次挂载时读取 localStorage，以便刷新后仍保持上次的折叠状态
  useLayoutEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) {
      const val = JSON.parse(saved);
      setIsCollapsed(val);
      window.__sidebarCollapsed = val;
    }
  }, []);

  // 当折叠状态变化时，同步到 <html> data 属性，供首屏 CSS 使用
  useLayoutEffect(() => {
    if (typeof document !== 'undefined') {
      if (isCollapsed) {
        document.documentElement.dataset.sidebarCollapsed = 'true';
      } else {
        delete document.documentElement.dataset.sidebarCollapsed;
      }
    }
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
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
    if (typeof window !== 'undefined') {
      window.__sidebarCollapsed = newState;
    }
    onToggle?.(newState);
  }, [isCollapsed, onToggle]);

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
          className={`fixed top-0 left-0 h-screen bg-white/40 backdrop-blur-xl transition-all duration-300 border-r border-gray-200/50 z-10 shadow-lg dark:bg-gray-900/70 dark:border-gray-700/50 ${
            isCollapsed ? 'w-16' : 'w-32'
          }`}
          style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <div className='flex h-full flex-col'>
            {/* 顶部 Logo 区域 */}
            <div className='relative pt-4 pb-4'>
              <div className='flex flex-col items-center justify-center transition-all duration-200'>
                <Logo isCollapsed={isCollapsed} />
              </div>
            </div>

            {/* 首页导航 */}
            <nav className='px-2'>
              <Link
                href='/'
                onClick={() => setActive('/')}
                data-active={active === '/'}
                className={`group flex ${
                  isCollapsed
                    ? 'items-center justify-center'
                    : 'flex-col items-center justify-center'
                } rounded-lg px-2 py-2 text-gray-700 hover:bg-gray-200/80 hover:text-blue-600 data-[active=true]:bg-blue-500/20 data-[active=true]:text-blue-700 font-medium transition-colors duration-200 min-h-[40px] dark:text-gray-300 dark:hover:bg-gray-700/80 dark:hover:text-blue-400 dark:data-[active=true]:bg-blue-500/10 dark:data-[active=true]:text-blue-400 ${
                  isCollapsed ? 'w-full' : ''
                } gap-1`}
                title={isCollapsed ? '首页' : undefined}
              >
                <Home className='h-4 w-4 text-gray-500 group-hover:text-blue-600 group-data-[active=true]:text-blue-700 dark:text-gray-400 dark:group-hover:text-blue-400 dark:group-data-[active=true]:text-blue-400' />
                {!isCollapsed && (
                  <span className='text-xs whitespace-nowrap transition-opacity duration-200 opacity-100'>
                    首页
                  </span>
                )}
              </Link>
            </nav>

            {/* 菜单项 */}
            <div className='flex-1 overflow-y-auto p-2'>
              <div
                className={`${
                  isCollapsed ? 'space-y-1' : 'grid grid-cols-2 gap-1'
                }`}
              >
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
                      className={`group flex ${
                        isCollapsed
                          ? 'items-center justify-center'
                          : 'flex-col items-center justify-center'
                      } rounded-lg px-2 py-2 text-gray-700 hover:bg-gray-200/80 hover:text-blue-600 data-[active=true]:bg-blue-500/20 data-[active=true]:text-blue-700 font-medium transition-colors duration-200 min-h-[40px] dark:text-gray-300 dark:hover:bg-gray-700/80 dark:hover:text-blue-400 dark:data-[active=true]:bg-blue-500/10 dark:data-[active=true]:text-blue-400 ${
                        isCollapsed ? 'w-full' : ''
                      } gap-1`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <Icon className='h-4 w-4 text-gray-500 group-hover:text-blue-600 group-data-[active=true]:text-blue-700 dark:text-gray-400 dark:group-hover:text-blue-400 dark:group-data-[active=true]:text-blue-400' />
                      {!isCollapsed && (
                        <span className='text-xs whitespace-nowrap transition-opacity duration-200 opacity-100'>
                          {item.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* 底部按钮区域 */}
            <div className='mt-auto px-2 pb-4'>
              <div
                className={`flex items-center justify-center pt-3 ${
                  isCollapsed ? 'flex-col gap-3' : 'flex-row gap-4'
                }`}
              >
                <ThemeToggleButton />
                <button
                  onClick={handleToggle}
                  className='w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
                  title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
                >
                  {isCollapsed ? (
                    <PanelLeftOpen className='w-4 h-4' />
                  ) : (
                    <PanelLeftClose className='w-4 h-4' />
                  )}
                </button>
              </div>
            </div>
          </div>
        </aside>
        <div
          className={`transition-all duration-300 sidebar-offset ${
            isCollapsed ? 'w-16' : 'w-32'
          }`}
        ></div>
      </div>
    </SidebarContext.Provider>
  );
};

export default Sidebar;
