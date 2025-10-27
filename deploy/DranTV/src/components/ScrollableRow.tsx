import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ScrollableRowProps {
  children: React.ReactNode;
}

export default function ScrollableRow({ children }: ScrollableRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const checkScroll = () => {
    if (containerRef.current) {
      const { scrollWidth, clientWidth, scrollLeft } = containerRef.current;

      // 计算是否需要左右滚动按钮
      const threshold = 1; // 容差值，避免浮点误差
      const canScrollRight =
        scrollWidth - (scrollLeft + clientWidth) > threshold;
      const canScrollLeft = scrollLeft > threshold;

      setShowRightScroll(canScrollRight);
      setShowLeftScroll(canScrollLeft);

      // 计算页面数量和当前页
      const maxScroll = scrollWidth - clientWidth;
      if (maxScroll > 0) {
        // 根据可视区域宽度计算页数（每页约为一个可视区域）
        const pages = Math.ceil(scrollWidth / clientWidth);
        setTotalPages(pages);

        // 计算当前在第几页
        const progress = scrollLeft / maxScroll;
        const page = Math.round(progress * (pages - 1));
        setCurrentPage(page);
      } else {
        setTotalPages(1);
        setCurrentPage(0);
      }
    }
  };

  useEffect(() => {
    // 多次延迟检查，确保内容已完全渲染
    checkScroll();

    // 监听窗口大小变化
    window.addEventListener('resize', checkScroll);

    // 创建一个 ResizeObserver 来监听容器大小变化
    const resizeObserver = new ResizeObserver(() => {
      // 延迟执行检查
      checkScroll();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', checkScroll);
      resizeObserver.disconnect();
    };
  }, [children]); // 依赖 children，当子组件变化时重新检查

  // 添加一个额外的效果来监听子组件的变化
  useEffect(() => {
    if (containerRef.current) {
      // 监听 DOM 变化
      const observer = new MutationObserver(() => {
        setTimeout(checkScroll, 100);
      });

      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });

      return () => observer.disconnect();
    }
  }, []);

  const handleScrollRightClick = () => {
    if (containerRef.current) {
      const container = containerRef.current;
      const children = Array.from(container.children) as HTMLElement[];
      const containerRect = container.getBoundingClientRect();
      const scrollLeft = container.scrollLeft;

      // 找到第一个右边缘超出可视区域的元素
      let targetElement: HTMLElement | null = null;

      for (const child of children) {
        const childRightRelativeToScroll = child.offsetLeft + child.offsetWidth;
        const visibleRight = scrollLeft + containerRect.width;

        // 如果元素的右边缘超出可视区域，这就是我们要滚动到的目标
        if (childRightRelativeToScroll > visibleRight + 1) {
          targetElement = child;
          break;
        }
      }

      if (targetElement) {
        // 滚动到目标元素的左边缘
        container.scrollTo({
          left: targetElement.offsetLeft,
          behavior: 'smooth',
        });
      }
    }
  };

  const handleScrollLeftClick = () => {
    if (containerRef.current) {
      const container = containerRef.current;
      const children = Array.from(container.children) as HTMLElement[];
      const scrollLeft = container.scrollLeft;

      // 找到第一个左边缘在可视区域左侧的元素（从右向左查找）
      let targetElement: HTMLElement | null = null;

      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];
        const childLeft = child.offsetLeft;

        // 如果元素的左边缘在当前滚动位置的左侧
        if (childLeft < scrollLeft - 1) {
          targetElement = child;
          break;
        }
      }

      if (targetElement) {
        const container = containerRef.current;
        const containerWidth = container.clientWidth;
        const targetWidth = targetElement.offsetWidth;

        // 计算目标位置：让该元素的右边缘对齐可视区域右边缘
        const targetScroll = Math.max(
          0,
          targetElement.offsetLeft + targetWidth - containerWidth
        );

        container.scrollTo({
          left: targetScroll,
          behavior: 'smooth',
        });
      } else {
        // 如果没找到，就滚动到开头
        container.scrollTo({
          left: 0,
          behavior: 'smooth',
        });
      }
    }
  };

  return (
    <div
      className='relative'
      onMouseEnter={() => {
        setIsHovered(true);
        // 当鼠标进入时重新检查一次
        checkScroll();
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        ref={containerRef}
        className='flex gap-3 sm:gap-6 overflow-x-auto scrollbar-hide py-1 sm:py-2 pb-6 sm:pb-10 snap-x snap-mandatory'
        onScroll={checkScroll}
        style={{
          scrollPaddingLeft: '0px',
          scrollSnapType: 'x mandatory',
        }}
      >
        {children}
      </div>

      {/* 胶囊形状滚动指示器 */}
      {totalPages > 1 && (
        <div className='absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5'>
          {Array.from({ length: totalPages }).map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === currentPage
                  ? 'w-6 bg-blue-500 dark:bg-blue-400 scale-110'
                  : 'w-1.5 bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
      )}
      {showLeftScroll && (
        <button
          onClick={handleScrollLeftClick}
          className={`hidden sm:flex absolute left-0 w-12 h-12 bg-blue-500/50 hover:bg-blue-500/80 backdrop-blur-md rounded-full shadow-lg items-center justify-center border-0 transition-all hover:scale-105 dark:bg-blue-500/50 dark:hover:bg-blue-500/80 z-[600] ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            top: 'calc(0.5rem + min(11rem, 24vw) * 0.75)',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <ChevronLeft className='w-6 h-6 text-white' />
        </button>
      )}

      {showRightScroll && (
        <button
          onClick={handleScrollRightClick}
          className={`hidden sm:flex absolute right-0 w-12 h-12 bg-blue-500/50 hover:bg-blue-500/80 backdrop-blur-md rounded-full shadow-lg items-center justify-center border-0 transition-all hover:scale-105 dark:bg-blue-500/50 dark:hover:bg-blue-500/80 z-[600] ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            top: 'calc(0.5rem + min(11rem, 24vw) * 0.75)',
            transform: 'translate(50%, -50%)',
          }}
        >
          <ChevronRight className='w-6 h-6 text-white' />
        </button>
      )}
    </div>
  );
}
