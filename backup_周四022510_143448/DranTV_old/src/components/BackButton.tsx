import { ArrowLeft } from 'lucide-react';

export function BackButton() {
  return (
    <button
      onClick={() => window.history.back()}
      className='flex items-center justify-center text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors'
      aria-label='Back'
    >
      <ArrowLeft className='w-7 h-7' />
    </button>
  );
}
