'use client';

import Link from 'next/link';
import { memo } from 'react';

import { BackButton } from './BackButton';
import { useSite } from './SiteProvider';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

interface MobileHeaderProps {
  showBackButton?: boolean;
}

const MobileHeader = memo(({ showBackButton = false }: MobileHeaderProps) => {
  const { siteName } = useSite();
  return (
    <header className='md:hidden fixed top-0 left-0 right-0 z-[999] w-full bg-white/70 backdrop-blur-xl border-b border-gray-200/50 shadow-sm dark:bg-gray-900/70 dark:border-gray-700/50 rounded-b-xl'>
      <div className='h-12 flex items-center justify-between px-4'>
        {/* 左侧：Logo + 标题 */}
        <Link
          href='/'
          className='flex items-center gap-2 h-6 hover:opacity-80 transition-opacity'
        >
          <img
            src='/logo.png'
            alt='Logo'
            className='w-6 h-6 object-contain rounded-lg'
          />
          <span className='text-xl font-bold text-gray-600 dark:text-gray-300 tracking-tight leading-none'>
            {siteName}
          </span>
        </Link>

        {/* 右侧按钮 */}
        <div className='flex items-center gap-1'>
          <Link
            href='/search'
            className='w-9 h-9 p-2 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors'
          >
            <svg
              className='w-full h-full'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
              />
            </svg>
          </Link>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
});

MobileHeader.displayName = 'MobileHeader';

export default MobileHeader;
