'use client';

import { User } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import { getUserAvatar } from '../../utils/helpers';

interface UserAvatarProps {
  username: string;
  size?: 'sm' | 'md' | 'lg';
}

export const UserAvatar = ({ username, size = 'sm' }: UserAvatarProps) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAvatar = async () => {
      setLoading(true);
      const avatar = await getUserAvatar(username);
      setAvatarUrl(avatar);
      setLoading(false);
    };

    fetchAvatar();
  }, [username]);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full overflow-hidden relative flex-shrink-0`}
    >
      {loading ? (
        <div className='w-full h-full bg-gray-100 dark:bg-gray-800 animate-pulse' />
      ) : avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={`${username} 的头像`}
          fill
          sizes={size === 'sm' ? '32px' : size === 'md' ? '40px' : '48px'}
          className='object-cover'
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            if (!img.dataset.retried) {
              img.dataset.retried = 'true';
              setTimeout(() => {
                if (avatarUrl) {
                  img.src = avatarUrl;
                }
              }, 2000);
            }
          }}
        />
      ) : (
        <div className='w-full h-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center'>
          <User
            className={`${iconSizeClasses[size]} text-blue-500 dark:text-blue-400`}
          />
        </div>
      )}
    </div>
  );
};
