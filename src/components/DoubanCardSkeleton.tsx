import { ImagePlaceholder } from '@/components/ImagePlaceholder';

const DoubanCardSkeleton = () => {
  return (
    <div className='w-full'>
      <div className='group relative w-full rounded-lg bg-transparent shadow-none flex flex-col'>
        {/* 图片占位符 - 骨架屏效果 */}
        <ImagePlaceholder aspectRatio='aspect-[2/3]' />

        {/* 信息层骨架 - 与实际VideoCard保持一致的高度和宽度 */}
        <div className='mt-2 text-center'>
          <div className='h-5 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse'></div>
        </div>
      </div>
    </div>
  );
};

export default DoubanCardSkeleton;
