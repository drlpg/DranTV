'use client';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const yearRange = currentYear > 2025 ? `2025-${currentYear}` : '2025';

  return (
    <footer className='w-full h-12 flex items-center justify-center text-center border-t border-gray-200/50 dark:border-gray-700/50 bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm'>
      <div className='text-xs text-gray-500 dark:text-gray-400 px-4'>
        Copyright © {yearRange} DranTV. All Rights Reserved.
      </div>
    </footer>
  );
}
