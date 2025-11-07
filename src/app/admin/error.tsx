'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin page error:', error);
  }, [error]);

  const isTimeout =
    error.message.includes('超时') || error.message.includes('timeout');
  const isFetchError = error.message.includes('fetch');

  return (
    <div className='flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900'>
      <div className='text-center max-w-md mx-auto px-4'>
        <div className='mb-6'>
          <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-4'>
            <svg
              className='w-8 h-8 text-red-600 dark:text-red-400'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
              />
            </svg>
          </div>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2'>
            {isTimeout ? '连接超时' : isFetchError ? '网络错误' : '加载失败'}
          </h1>
          <p className='text-gray-600 dark:text-gray-400 mb-6'>
            {isTimeout
              ? '数据库连接超时，请稍后重试'
              : isFetchError
              ? '网络连接失败，请检查网络连接'
              : '无法加载管理配置'}
          </p>
        </div>
        <button
          onClick={reset}
          className='px-6 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors'
        >
          重试
        </button>
      </div>
    </div>
  );
}
