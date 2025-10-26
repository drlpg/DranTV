import Image from 'next/image';

// 图片占位符组件 - 使用SVG占位图
const ImagePlaceholder = ({ aspectRatio }: { aspectRatio: string }) => (
  <div
    className={`w-full ${aspectRatio} rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden`}
  >
    <Image
      src='/img/placeholder-minimal.svg'
      alt='加载中'
      fill
      className='object-cover opacity-60'
    />
  </div>
);

export { ImagePlaceholder };
