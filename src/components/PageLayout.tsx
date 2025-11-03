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
    <div className='w-full h-dvh flex flex-col overflow-hidden md:min-h-dvh md:h-auto md:overflow-visible'>
      {/* 顶部头部 - 仅移动端显示，固定定位 */}
      <MobileHeader showBackButton={['/play', '/live'].includes(activePath)} />

      {/* 主要布局容器 */}
      <div className='flex md:grid md:grid-cols-[auto_1fr] w-full flex-1 min-h-0 overflow-hidden md:overflow-visible'>
        {/* 侧边栏 - 桌面端显示，移动端隐藏 */}
        <div className='hidden md:block'>
          <Sidebar activePath={activePath} />
        </div>

        {/* 主内容区域 - 移动端固定高度可滚动，桌面端正常流 */}
        <div
          className='relative min-w-0 flex-1 transition-all duration-300 h-full overflow-x-hidden overflow-y-auto md:h-auto md:overflow-visible'
          style={{
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* 主内容 - 移动端顶部留出header空间，底部留出导航栏空间；桌面端减去Footer高度 */}
          <main className='min-h-full pt-12 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:min-h-[calc(100dvh-6rem)] md:pt-0 md:pb-0'>
            {children}
          </main>
        </div>
      </div>

      {/* 桌面端页脚 - 100%宽度，被侧边栏覆盖 */}
      <div className='hidden md:block w-full'>
        <Footer />
      </div>

      {/* 移动端底部导航 - 固定定位 */}
      <div className='md:hidden'>
        <MobileBottomNav activePath={activePath} />
      </div>
    </div>
  );
};

export default PageLayout;
