'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface CarouselItem {
  id: string;
  title: string;
  image: string;
  link?: string;
  rate?: string;
}

interface CarouselProps {
  items: CarouselItem[];
  autoPlayInterval?: number;
  maxItems?: number; // 最多显示的图片数量
}

export default function Carousel({
  items,
  autoPlayInterval = 10000,
  maxItems = 5,
}: CarouselProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [activeItems, setActiveItems] = useState<CarouselItem[]>([]);
  const [isReady, setIsReady] = useState(false);

  // 动态计算有效的轮播项目
  useEffect(() => {
    // 从items中选择maxItems个未失败的项目
    const validItems: CarouselItem[] = [];
    for (let i = 0; i < items.length && validItems.length < maxItems; i++) {
      if (!failedIds.has(items[i].id)) {
        validItems.push(items[i]);
      }
    }

    // 使用函数式更新，避免依赖 activeItems
    setActiveItems((prevActiveItems) => {
      const newIds = validItems.map((i) => i.id).join(',');
      const currentIds = prevActiveItems.map((i) => i.id).join(',');

      // 只有当validItems真的改变时才更新
      if (newIds !== currentIds) {
        // 调整当前索引
        setCurrentIndex((prevIndex) => {
          if (prevIndex >= validItems.length && validItems.length > 0) {
            return 0;
          }
          return prevIndex;
        });

        // 预加载第一张图片
        if (validItems.length > 0 && !isReady) {
          const firstImage = new Image();
          firstImage.onload = () => setIsReady(true);
          firstImage.onerror = () => setIsReady(true); // 即使失败也显示
          firstImage.src = validItems[0].image;
        }

        return validItems;
      }
      return prevActiveItems;
    });
  }, [items, failedIds, maxItems, isReady]);

  useEffect(() => {
    if (activeItems.length <= 1 || isHovered) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeItems.length);
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [activeItems.length, autoPlayInterval, isHovered]);

  const goToPrevious = () => {
    setCurrentIndex(
      (prev) => (prev - 1 + activeItems.length) % activeItems.length
    );
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activeItems.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const handleImageError = (itemId: string) => {
    setFailedIds((prev) => new Set(prev).add(itemId));
  };

  const handleImageLoad = (itemId: string) => {
    setLoadedIds((prev) => new Set(prev).add(itemId));
  };

  const handleItemClick = (item: CarouselItem) => {
    if (item.link) {
      router.push(item.link);
    }
  };

  // 触摸滑动处理
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      goToNext();
    }
    if (isRightSwipe) {
      goToPrevious();
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  // 如果没有数据或第一张图片未加载完成，显示骨架屏
  if (activeItems.length === 0 || !isReady) {
    return (
      <div className='relative w-full overflow-hidden rounded-lg aspect-[16/9] md:aspect-auto md:h-[60dvh] bg-gray-100 dark:bg-gray-800'>
        <div className='absolute inset-0 flex items-center justify-center'>
          <img
            src='/img/loading.svg'
            alt='加载中'
            className='w-12 h-3 sm:w-20 sm:h-5 object-contain opacity-80'
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className='relative w-full overflow-hidden rounded-lg aspect-[16/9] md:aspect-auto md:h-[60dvh]'
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 轮播图片 */}
      <div className='relative w-full h-full'>
        {activeItems.map((item, index) => (
          <div
            key={item.id}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentIndex
                ? 'opacity-100 z-10'
                : 'opacity-0 pointer-events-none'
            } ${item.link ? 'cursor-pointer' : ''}`}
            onClick={() => handleItemClick(item)}
          >
            {/* 加载中状态 - 在图片加载完成前显示 */}
            {!loadedIds.has(item.id) && !failedIds.has(item.id) && (
              <div className='absolute inset-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center z-10'>
                <img
                  src='/img/loading.svg'
                  alt='加载中'
                  className='w-12 h-3 sm:w-20 sm:h-5 object-contain opacity-80'
                />
              </div>
            )}
            {/* 实际图片 - 使用原生img以确保onError正确触发 */}
            <img
              src={item.image}
              alt={item.title}
              className='absolute inset-0 w-full h-full object-cover'
              loading={index === 0 ? 'eager' : 'lazy'}
              onLoad={() => handleImageLoad(item.id)}
              onError={() => handleImageError(item.id)}
            />
            {/* 推荐徽章 */}
            {item.rate && (
              <div className='absolute top-2 left-2 md:top-4 md:left-4 bg-blue-500/80 backdrop-blur-md text-white text-xs md:text-sm font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-md transition-all duration-300 ease-out hover:scale-110'>
                推荐
              </div>
            )}
            {/* 渐变遮罩 */}
            <div className='absolute bottom-0 left-0 right-0 h-[30%] bg-gradient-to-t from-black/40 to-transparent' />
            {/* 标题 */}
            <div className='absolute bottom-0 left-0 right-0 pt-0 pb-7 sm:pb-10 px-6 sm:px-8 text-center sm:text-left'>
              <h3 className='text-xl sm:text-3xl font-bold text-white'>
                {item.title}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* 左右切换按钮 - 仅桌面端显示 */}
      {activeItems.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className={`hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/50 hover:bg-blue-500/80 backdrop-blur-md rounded-full shadow-lg items-center justify-center transition-all hover:scale-105 z-20 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <ChevronLeft className='w-5 h-5 sm:w-6 sm:h-6 text-white' />
          </button>
          <button
            onClick={goToNext}
            className={`hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/50 hover:bg-blue-500/80 backdrop-blur-md rounded-full shadow-lg items-center justify-center transition-all hover:scale-105 z-20 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <ChevronRight className='w-5 h-5 sm:w-6 sm:h-6 text-white' />
          </button>
        </>
      )}

      {/* 指示器 - 只在当前图片加载完成后显示 */}
      {activeItems.length > 1 &&
        loadedIds.has(activeItems[currentIndex]?.id) && (
          <div className='absolute bottom-[10px] md:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 md:gap-2 z-20'>
            {activeItems.map((item, index) => (
              <button
                key={item.id}
                onClick={() => goToSlide(index)}
                className={`h-1.5 md:h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'w-6 md:w-8 bg-white'
                    : 'w-1.5 md:w-2 bg-white/50 hover:bg-white/75'
                }`}
                aria-label={`跳转到第 ${index + 1} 张`}
              />
            ))}
          </div>
        )}
    </div>
  );
}
