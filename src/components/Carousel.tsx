'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

interface CarouselItem {
  id: string;
  title: string;
  image: string;
  link?: string;
}

interface CarouselProps {
  items: CarouselItem[];
  autoPlayInterval?: number;
}

export default function Carousel({
  items,
  autoPlayInterval = 5000,
}: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const [imageLoaded, setImageLoaded] = useState<Set<number>>(new Set());

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

  if (items.length === 0) return null;

  return (
    <div
      className='relative w-full overflow-hidden rounded-lg'
      style={{ height: '50vh' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 轮播图片 */}
      <div className='relative w-full h-full'>
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* 加载中状态 */}
            {!imageLoaded.has(index) && !imageErrors.has(index) && (
              <div className='absolute inset-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center'>
                <div className='w-[60%] max-w-[120px]'>
                  <Image
                    src='/img/loading.svg'
                    alt='加载中'
                    width={120}
                    height={30}
                    className='w-full h-auto opacity-80'
                  />
                </div>
              </div>
            )}

            {imageErrors.has(index) ? (
              // 图片加载失败时显示占位符
              <div className='absolute inset-0 bg-gray-100 dark:bg-gray-800'>
                <Image
                  src='/img/placeholder-minimal.svg'
                  alt='图片加载失败'
                  fill
                  className='object-cover opacity-40'
                />
              </div>
            ) : (
              <Image
                src={item.image}
                alt={item.title}
                fill
                className='object-cover'
                priority={index === 0}
                unoptimized
                onLoad={() => handleImageLoad(index)}
                onError={() => handleImageError(index)}
              />
            )}
            {/* 渐变遮罩 */}
            <div className='absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent' />
            {/* 标题 */}
            <div className='absolute bottom-0 left-0 right-0 p-6 sm:p-8'>
              <h3 className='text-2xl sm:text-4xl font-bold text-white drop-shadow-lg'>
                {item.title}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* 左右切换按钮 */}
      {items.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className={`absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-white/90 dark:bg-gray-800/90 rounded-full shadow-lg flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 transition-all hover:scale-105 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <ChevronLeft className='w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-300' />
          </button>
          <button
            onClick={goToNext}
            className={`absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-white/90 dark:bg-gray-800/90 rounded-full shadow-lg flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 transition-all hover:scale-105 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <ChevronRight className='w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-300' />
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
