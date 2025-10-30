'use client';

import { useEffect, useState } from 'react';

import type { PlayRecord } from '@/lib/db.client';
import {
  clearAllPlayRecords,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';

import ScrollableRow from '@/components/ScrollableRow';
import VideoCard from '@/components/VideoCard';

interface ContinueWatchingProps {
  className?: string;
}

export default function ContinueWatching({ className }: ContinueWatchingProps) {
  const [playRecords, setPlayRecords] = useState<
    (PlayRecord & { key: string })[]
  >([]);
  const [initialized, setInitialized] = useState(false);

  // 处理播放记录数据更新的函数
  const updatePlayRecords = (allRecords: Record<string, PlayRecord>) => {
    // 将记录转换为数组并根据 save_time 由近到远排序
    const recordsArray = Object.entries(allRecords).map(([key, record]) => ({
      ...record,
      key,
    }));

    // 按 save_time 降序排序（最新的在前面）
    const sortedRecords = recordsArray.sort(
      (a, b) => b.save_time - a.save_time
    );

    setPlayRecords(sortedRecords);
  };

  useEffect(() => {
    const fetchPlayRecords = async () => {
      try {
        // 从缓存或API获取所有播放记录
        const allRecords = await getAllPlayRecords();
        updatePlayRecords(allRecords);
      } catch (error) {
        // 静默失败
        setPlayRecords([]);
      } finally {
        setInitialized(true);
      }
    };

    fetchPlayRecords();

    // 监听播放记录更新事件
    const unsubscribe = subscribeToDataUpdates(
      'playRecordsUpdated',
      (newRecords: Record<string, PlayRecord>) => {
        updatePlayRecords(newRecords);
      }
    );

    return unsubscribe;
  }, []);

  // 如果未初始化或没有播放记录，则不渲染组件
  if (!initialized || playRecords.length === 0) {
    return null;
  }

  // 计算播放进度百分比
  const getProgress = (record: PlayRecord) => {
    if (record.total_time === 0) return 0;
    return (record.play_time / record.total_time) * 100;
  };

  // 从 key 中解析 source 和 id
  const parseKey = (key: string) => {
    const [source, id] = key.split('+');
    return { source, id };
  };

  return (
    <section className={`mb-6 sm:mb-8 ${className || ''}`}>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
          继续观看
        </h2>
        {playRecords.length > 0 && (
          <button
            className='text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            onClick={async () => {
              await clearAllPlayRecords();
              setPlayRecords([]);
            }}
          >
            清空
          </button>
        )}
      </div>
      <ScrollableRow>
        {playRecords.map((record) => {
          const { source, id } = parseKey(record.key);
          return (
            <div
              key={record.key}
              className='min-w-[calc((100vw-2rem-1.5rem)/3)] w-[calc((100vw-2rem-1.5rem)/3)] sm:min-w-[180px] sm:w-44 snap-start'
            >
              <VideoCard
                id={id}
                title={record.title}
                poster={record.cover}
                year={record.year}
                source={source}
                source_name={record.source_name}
                progress={getProgress(record)}
                episodes={record.total_episodes}
                currentEpisode={record.index}
                query={record.search_title}
                from='playrecord'
                onDelete={() =>
                  setPlayRecords((prev) =>
                    prev.filter((r) => r.key !== record.key)
                  )
                }
                type={record.total_episodes > 1 ? 'tv' : ''}
              />
            </div>
          );
        })}
      </ScrollableRow>
    </section>
  );
}
