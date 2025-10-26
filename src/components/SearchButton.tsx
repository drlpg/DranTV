'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export function SearchButton() {
  const router = useRouter();

  const handleSearchClick = useCallback(() => {
    router.push('/search');
  }, [router]);

  return (
    <button
      onClick={handleSearchClick}
      className='w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors'
      aria-label='Search'
      title='搜索'
    >
      <Search className='w-full h-full' />
    </button>
  );
}
