import { BackButton } from './BackButton';
import { Footer } from './Footer';
import MobileBottomNav from './MobileBottomNav';
import MobileHeader from './MobileHeader';
import Sidebar from './Sidebar';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
}

const PageLayout = ({ children, activePath = '/' }: PageLayoutProps) => {
  return (
    <div className='w-full min-h-screen'>
      {/* 移动端头部 */}
      <MobileHeader showBackButton={['/play', '/live'].includes(activePath)} />

      {/* 主要布局容器 */}
      <div className='flex md:grid md:grid-cols-[auto_1fr] w-full min-h-screen md:min-h-auto'>
        {/* 侧边栏 - 桌面端显示，移动端隐藏 */}
        <div className='hidden md:block'>
          <Sidebar activePath={activePath} />
        </div>

        {/* 主内容区域 */}
        <div className='relative min-w-0 flex-1 transition-all duration-300 flex flex-col'>
          {/* 桌面端左上角返回按钮 - 仅播放页面显示 */}
          {activePath === '/play' && (
            <div className='absolute top-3 left-1 z-20 hidden md:flex'>
              <BackButton />
            </div>
          )}

          {/* 主内容 */}
          <main className='flex-1 md:min-h-[calc(100vh-4rem)] mb-14 md:mb-0 md:mt-0 mt-12'>
            {children}
          </main>

          {/* 桌面端页脚 */}
          <div className='hidden md:block mt-auto'>
            <Footer />
          </div>
        </div>
      </div>

      {/* 移动端底部导航 */}
      <div className='md:hidden'>
        <MobileBottomNav activePath={activePath} />
      </div>
    </div>
  );
};

export default PageLayout;
