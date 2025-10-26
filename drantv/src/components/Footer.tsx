'use client';

import { ExternalLink } from 'lucide-react';

export function Footer() {
  return (
    <footer className='w-full py-4 text-center border-t border-gray-200/50 dark:border-gray-700/50 bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm'>
      <div className='text-xs text-gray-500 dark:text-gray-400 px-4'>
        <span>本项目基于 </span>
        <button
          onClick={() => window.open('https://github.com/MoonTechLab/LunaTV', '_blank')}
          className='text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors inline-flex items-center gap-1'
        >
          MoonTV
          <ExternalLink className='h-3 w-3 inline' />
        </button>
        <span> 的二次开发</span>
      </div>
    </footer>
  );
}
