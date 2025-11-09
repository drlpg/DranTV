/* eslint-disable @typescript-eslint/no-explicit-any,react-hooks/exhaustive-deps */

'use client';

import { MessageCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ChatModal } from './ChatModal';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  const handleMessageCountFromModal = useCallback((totalCount: number) => {
    setMessageCount(totalCount);
  }, []);

  const handleChatCountReset = useCallback(() => {
    // 聊天计数重置
  }, []);

  const handleFriendRequestCountReset = useCallback(() => {
    // 好友请求计数重置
  }, []);

  useEffect(() => {
    setMounted(true);

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const isLoginPage = pathname === '/login';

  if (!mounted) {
    return isLoginPage ? null : (
      <button
        className='w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:bg-blue-500/10 dark:text-gray-300 dark:hover:bg-blue-500/10 transition-colors relative'
        aria-label='Open chat'
        disabled
      >
        <MessageCircle className='w-full h-full' />
      </button>
    );
  }

  return (
    <>
      {/* 聊天按钮 */}
      {!isLoginPage && (
        <button
          onClick={() => setIsChatModalOpen(true)}
          className={`${
            isMobile ? 'w-9 h-9 p-2' : 'w-10 h-10 p-2'
          } rounded-full flex items-center justify-center text-gray-600 hover:bg-blue-500/10 dark:text-gray-300 dark:hover:bg-blue-500/10 transition-colors relative`}
          aria-label='Open chat'
        >
          <MessageCircle className='w-full h-full' />
          {messageCount > 0 && (
            <span
              className={`absolute ${
                isMobile
                  ? '-top-0.5 -right-0.5 w-4 h-4 text-xs'
                  : '-top-1 -right-1 w-5 h-5 text-xs'
              } bg-red-500 text-white rounded-full flex items-center justify-center`}
            >
              {messageCount > 99 ? '99+' : messageCount}
            </span>
          )}
        </button>
      )}

      {/* 聊天模态框 */}
      {!isLoginPage && (
        <ChatModal
          isOpen={isChatModalOpen}
          onClose={() => setIsChatModalOpen(false)}
          onMessageCountChange={handleMessageCountFromModal}
          onChatCountReset={handleChatCountReset}
          onFriendRequestCountReset={handleFriendRequestCountReset}
        />
      )}
    </>
  );
}
