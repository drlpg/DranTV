import Image from 'next/image';

// 图片占位符组件 - 使用SVG占位图
// type: 'loading' 显示加载动画, 'error' 显示错误占位符
const ImagePlaceholder = ({
  aspectRatio,
  type = 'loading',
}: {
  aspectRatio: string;
  type?: 'loading' | 'error';
}) => (
  <div
    className={`w-full ${aspectRatio} rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden relative`}
  >
    {type === 'loading' ? (
      // 加载动画 - 缩小70%并自适应视口
      <div className='absolute inset-0 flex items-center justify-center'>
        <div className='relative w-[30%] h-[30%] min-w-[40px] min-h-[40px] max-w-[80px] max-h-[80px]'>
          <Image
            src='/img/loading.svg'
            alt='加载中'
            fill
            sizes='(max-width: 768px) 40px, 80px'
            className='object-contain opacity-60'
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              if (!img.dataset.retried) {
                img.dataset.retried = 'true';
                setTimeout(() => {
                  img.src = '/img/loading.svg';
                }, 2000);
              }
            }}
          />
        </div>
      </div>
    ) : (
      // 错误占位符 - 填充整个容器
      <Image
        src='/img/placeholder-minimal.svg'
        alt='加载失败'
        fill
        className='object-cover opacity-60'
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          if (!img.dataset.retried) {
            img.dataset.retried = 'true';
            setTimeout(() => {
              img.src = '/img/placeholder-minimal.svg';
            }, 2000);
          }
        }}
      />
    )}
  </div>
);

export { ImagePlaceholder };
