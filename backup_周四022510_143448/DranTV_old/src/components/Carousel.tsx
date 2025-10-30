'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
}

export default function Carousel({
  items,
  autoPlayInterval = 5000,
}: CarouselProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const [imageLoaded, setImageLoaded] = useState<Set<number>>(new Set());
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  useEffect(() => {
    if (items.length <= 1 || isHovered) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [items.length, autoPlayInterval, isHovered]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const handleImageError = (index: number) => {
    setImageErrors((prev) => new Set(prev).add(index));
  };

  const handleImageLoad = (index: number) => {
    setImageLoaded((prev) => new Set(prev).add(index));
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

  // 如果没有数据，显示骨架屏
  if (items.length === 0) {
    return (
      <div className='relative w-full overflow-hidden rounded-lg aspect-[16/9] md:aspect-auto md:h-[60dvh] bg-gray-100 dark:bg-gray-800'>
        <div className='absolute inset-0 flex items-center justify-center'>
          <div className='relative w-[20%] h-[20%] min-w-[50px] min-h-[50px] max-w-[100px] max-h-[100px]'>
            <Image
              src='/img/loading.svg'
              alt='加载中'
              fill
              sizes='(max-width: 768px) 50px, 100px'
              className='object-contain opacity-80'
              priority
            />
          </div>
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
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            } ${item.link ? 'cursor-pointer' : ''}`}
            onClick={() => handleItemClick(item)}
          >
            {imageErrors.has(index) ? (
              // 图片加载失败时显示占位符
              <div className='absolute inset-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center'>
                <Image
                  src='/img/placeholder-minimal.svg'
                  alt='图片加载失败'
                  fill
                  sizes='100vw'
                  className='object-cover opacity-40'
                />
              </div>
            ) : (
              <>
                {/* 加载中状态 - 在图片加载完成前显示 */}
                {!imageLoaded.has(index) && (
                  <div className='absolute inset-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center z-10'>
                    <div className='relative w-[20%] h-[20%] min-w-[50px] min-h-[50px] max-w-[100px] max-h-[100px]'>
                      <Image
                        src='/img/loading.svg'
                        alt='加载中'
                        fill
                        sizes='(max-width: 768px) 50px, 100px'
                        className='object-contain opacity-80'
                        priority
                      />
                    </div>
                  </div>
                )}
                {/* 实际图片 */}
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes='100vw'
                  className='object-cover'
                  priority={index === 0}
                  unoptimized
                  onLoad={() => handleImageLoad(index)}
                  onError={() => handleImageError(index)}
                />
              </>
            )}
            {/* 推荐徽章 */}
            {item.rate && (
              <div className='absolute top-2 left-2 md:top-4 md:left-4 bg-blue-500/80 backdrop-blur-md text-white text-xs md:text-sm font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-md transition-all duration-300 ease-out hover:scale-110'>
                推荐
              </div>
            )}
            {/* 渐变遮罩 */}
            <div className='absolute bottom-0 left-0 right-0 h-[30%] bg-gradient-to-t from-black/60 to-transparent' />
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
      {items.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className={`hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/50 hover:bg-blue-500/80 backdrop-blur-md rounded-full shadow-lg items-center justify-center transition-all hover:scale-105 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <ChevronLeft className='w-5 h-5 sm:w-6 sm:h-6 text-white' />
          </button>
          <button
            onClick={goToNext}
            className={`hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/50 hover:bg-blue-500/80 backdrop-blur-md rounded-full shadow-lg items-center justify-center transition-all hover:scale-105 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <ChevronRight className='w-5 h-5 sm:w-6 sm:h-6 text-white' />
          </button>
        </>
      )}

      {/* 指示器 */}
      {items.length > 1 && (
        <div className='absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2'>
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'w-8 bg-white'
                  : 'w-2 bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`跳转到第 ${index + 1} 张`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
