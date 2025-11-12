/* eslint-disable @next/next/no-img-element */

import { useRouter } from 'next/navigation';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { SearchResult } from '@/lib/types';
import { getVideoResolutionFromM3u8, processImageUrl } from '@/lib/utils';

// 定义视频信息类型
interface VideoInfo {
  quality: string;
  loadSpeed: string;
  pingTime: number;
  hasError?: boolean; // 添加错误状态标识
}

interface EpisodeSelectorProps {
  /** 总集数 */
  totalEpisodes: number;
  /** 剧集标题 */
  episodes_titles: string[];
  /** 每页显示多少集，默认 50 */
  episodesPerPage?: number;
  /** 当前选中的集数（1 开始） */
  value?: number;
  /** 用户点击选集后的回调 */
  onChange?: (episodeNumber: number) => void;
  /** 换源相关 */
  onSourceChange?: (source: string, id: string, title: string) => void;
  currentSource?: string;
  currentId?: string;
  videoTitle?: string;
  videoYear?: string;
  availableSources?: SearchResult[];
  sourceSearchLoading?: boolean;
  sourceSearchError?: string | null;
  /** 预计算的测速结果，避免重复测速 */
  precomputedVideoInfo?: Map<string, VideoInfo>;
}

/**
 * 选集组件，支持分页、自动滚动聚焦当前分页标签，以及换源功能。
 */
const EpisodeSelector: React.FC<EpisodeSelectorProps> = ({
  totalEpisodes,
  episodes_titles,
  episodesPerPage = 50,
  value = 1,
  onChange,
  onSourceChange,
  currentSource,
  currentId,
  videoTitle,
  availableSources = [],
  sourceSearchLoading = false,
  sourceSearchError = null,
  precomputedVideoInfo,
}) => {
  const router = useRouter();
  const pageCount = Math.ceil(totalEpisodes / episodesPerPage);

  // 存储每个源的视频信息
  const [videoInfoMap, setVideoInfoMap] = useState<Map<string, VideoInfo>>(
    new Map()
  );
  const [attemptedSources, setAttemptedSources] = useState<Set<string>>(
    new Set()
  );

  // 使用 ref 来避免闭包问题
  const attemptedSourcesRef = useRef<Set<string>>(new Set());
  const videoInfoMapRef = useRef<Map<string, VideoInfo>>(new Map());

  // 同步状态到 ref
  useEffect(() => {
    attemptedSourcesRef.current = attemptedSources;
  }, [attemptedSources]);

  useEffect(() => {
    videoInfoMapRef.current = videoInfoMap;
  }, [videoInfoMap]);

  // 主要的 tab 状态：'episodes' 或 'sources'
  // 当只有一集时默认展示 "换源"，并隐藏 "选集" 标签
  const [activeTab, setActiveTab] = useState<'episodes' | 'sources'>(
    totalEpisodes > 1 ? 'episodes' : 'sources'
  );

  // 当前分页索引（0 开始）
  const initialPage = Math.floor((value - 1) / episodesPerPage);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);

  // 是否倒序显示
  const [descending, setDescending] = useState<boolean>(false);

  // 根据 descending 状态计算实际显示的分页索引
  const displayPage = useMemo(() => {
    if (descending) {
      return pageCount - 1 - currentPage;
    }
    return currentPage;
  }, [currentPage, descending, pageCount]);

  // 获取视频信息的函数 - 移除 attemptedSources 依赖避免不必要的重新创建
  const getVideoInfo = useCallback(async (source: SearchResult) => {
    const sourceKey = `${source.source}-${source.id}`;

    // 使用 ref 获取最新的状态，避免闭包问题
    if (attemptedSourcesRef.current.has(sourceKey)) {
      return;
    }

    // 获取第一集的URL
    if (!source.episodes || source.episodes.length === 0) {
      return;
    }
    const episodeUrl =
      source.episodes.length > 1 ? source.episodes[1] : source.episodes[0];

    // 标记为已尝试
    setAttemptedSources((prev) => new Set(prev).add(sourceKey));

    try {
      const info = await getVideoResolutionFromM3u8(episodeUrl);
      setVideoInfoMap((prev) => new Map(prev).set(sourceKey, info));
    } catch (error) {
      // 失败时保存错误状态，区分不同的错误类型
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isNetworkRestricted =
        errorMessage.includes('Network access restricted') ||
        errorMessage.includes('CORS') ||
        errorMessage.includes('Forbidden');

      // 只在开发环境下打印详细错误
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Video info fetch failed for ${sourceKey}:`, errorMessage);
      }

      setVideoInfoMap((prev) =>
        new Map(prev).set(sourceKey, {
          quality: isNetworkRestricted ? '受限' : '未知',
          loadSpeed: '未知',
          pingTime: 0,
          hasError: true,
        })
      );
    }
  }, []);

  // 当有预计算结果时，先合并到videoInfoMap中
  useEffect(() => {
    if (precomputedVideoInfo && precomputedVideoInfo.size > 0) {
      // 原子性地更新两个状态，避免时序问题
      setVideoInfoMap((prev) => {
        const newMap = new Map(prev);
        precomputedVideoInfo.forEach((value, key) => {
          newMap.set(key, value);
        });
        return newMap;
      });

      setAttemptedSources((prev) => {
        const newSet = new Set(prev);
        precomputedVideoInfo.forEach((info, key) => {
          if (!info.hasError) {
            newSet.add(key);
          }
        });
        return newSet;
      });

      // 同步更新 ref，确保 getVideoInfo 能立即看到更新
      precomputedVideoInfo.forEach((info, key) => {
        if (!info.hasError) {
          attemptedSourcesRef.current.add(key);
        }
      });
    }
  }, [precomputedVideoInfo]);

  // 读取本地"优选和测速"开关，默认开启
  const [optimizationEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('enableOptimization');
      if (saved !== null) {
        try {
          return JSON.parse(saved);
        } catch {
          /* ignore */
        }
      }
    }
    return true;
  });

  // 添加标志防止重复测速
  const isFetchingRef = useRef(false);

  // 当切换到换源tab并且有源数据时，异步获取视频信息 - 移除 attemptedSources 依赖避免循环触发
  useEffect(() => {
    const fetchVideoInfosInBatches = async () => {
      if (
        !optimizationEnabled || // 若关闭测速则直接退出
        activeTab !== 'sources' ||
        availableSources.length === 0 ||
        isFetchingRef.current // 防止重复执行
      )
        return;

      // 筛选出尚未测速的播放源
      const pendingSources = availableSources.filter((source) => {
        const sourceKey = `${source.source}-${source.id}`;
        return !attemptedSourcesRef.current.has(sourceKey);
      });

      if (pendingSources.length === 0) return;

      isFetchingRef.current = true;

      try {
        const batchSize = Math.ceil(pendingSources.length / 2);

        for (let start = 0; start < pendingSources.length; start += batchSize) {
          const batch = pendingSources.slice(start, start + batchSize);
          await Promise.all(batch.map(getVideoInfo));
        }
      } finally {
        isFetchingRef.current = false;
      }
    };

    fetchVideoInfosInBatches();
    // 依赖项保持与之前一致
  }, [activeTab, availableSources, getVideoInfo, optimizationEnabled]);

  // 升序分页标签
  const categoriesAsc = useMemo(() => {
    return Array.from({ length: pageCount }, (_, i) => {
      const start = i * episodesPerPage + 1;
      const end = Math.min(start + episodesPerPage - 1, totalEpisodes);
      return { start, end };
    });
  }, [pageCount, episodesPerPage, totalEpisodes]);

  // 根据 descending 状态决定分页标签的排序和内容
  const categories = useMemo(() => {
    if (descending) {
      // 倒序时，label 也倒序显示
      return [...categoriesAsc]
        .reverse()
        .map(({ start, end }) => `${end}-${start}`);
    }
    return categoriesAsc.map(({ start, end }) => `${start}-${end}`);
  }, [categoriesAsc, descending]);

  // 处理换源tab点击，只在点击时才搜索
  const handleSourceTabClick = () => {
    setActiveTab('sources');
  };

  const handleCategoryClick = useCallback(
    (index: number) => {
      if (descending) {
        // 在倒序时，需要将显示索引转换为实际索引
        setCurrentPage(pageCount - 1 - index);
      } else {
        setCurrentPage(index);
      }
    },
    [descending, pageCount]
  );

  const handleEpisodeClick = useCallback(
    (episodeNumber: number) => {
      onChange?.(episodeNumber);
    },
    [onChange]
  );

  const handleSourceClick = useCallback(
    (source: SearchResult) => {
      onSourceChange?.(source.source, source.id, source.title);
    },
    [onSourceChange]
  );

  const currentStart = currentPage * episodesPerPage + 1;
  const currentEnd = Math.min(
    currentStart + episodesPerPage - 1,
    totalEpisodes
  );

  return (
    <div className='pr-0 h-full rounded-xl bg-black/5 dark:bg-white/3 flex flex-col border border-gray-300 dark:border-white/30 overflow-x-hidden overflow-y-hidden'>
      {/* 主要的 Tab 切换 - 无缝融入设计 */}
      <div className='flex flex-shrink-0 border-b border-dashed border-gray-300 dark:border-gray-600'>
        {totalEpisodes > 1 && (
          <div
            onClick={() => setActiveTab('episodes')}
            className={`flex-1 py-3 px-4 text-center cursor-pointer transition-all duration-200 font-medium
              ${
                activeTab === 'episodes'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-700 hover:text-blue-600 bg-black/5 dark:bg-white/5 dark:text-gray-300 dark:hover:text-blue-400 hover:bg-black/3 dark:hover:bg-white/3'
              }
            `.trim()}
          >
            选集
          </div>
        )}
        <div
          onClick={handleSourceTabClick}
          className={`flex-1 py-3 px-4 text-center cursor-pointer transition-all duration-200 font-medium
            ${
              activeTab === 'sources'
                ? 'text-gray-900 dark:text-gray-100'
                : 'text-gray-700 hover:text-gray-900 bg-black/5 dark:bg-white/5 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-black/3 dark:hover:bg-white/3'
            }
          `.trim()}
        >
          换源
        </div>
      </div>

      {/* 选集 Tab 内容 */}
      {activeTab === 'episodes' && (
        <>
          {/* 当前选集范围显示 */}
          <div className='grid grid-cols-2 border-b border-dashed border-gray-300 dark:border-gray-600 flex-shrink-0'>
            <div className='flex justify-center items-center'>
              <div className='relative py-2 text-sm font-medium text-blue-500 dark:text-blue-400'>
                {categories[displayPage]}
                <div className='absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 dark:bg-blue-400' />
              </div>
            </div>
            {/* 向上/向下按钮 */}
            <div className='flex items-center justify-center'>
              <button
                className='flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors'
                onClick={() => {
                  // 切换集数排序（正序/倒序）
                  setDescending((prev) => !prev);
                }}
              >
                <svg
                  className='w-4 h-4 rotate-90'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4'
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* 集数网格 */}
          <div className='grid grid-cols-3 gap-3 overflow-y-auto flex-1 content-start pt-4 pb-4 pl-4 pr-4 auto-rows-min'>
            {(() => {
              const len = currentEnd - currentStart + 1;
              const episodes = Array.from({ length: len }, (_, i) =>
                descending ? currentEnd - i : currentStart + i
              );
              return episodes;
            })().map((episodeNumber) => {
              const isActive = episodeNumber === value;
              return (
                <button
                  key={episodeNumber}
                  onClick={() => handleEpisodeClick(episodeNumber - 1)}
                  className={`h-8 px-2 py-1 flex items-center justify-center text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap
                    ${
                      isActive
                        ? 'bg-blue-500 text-white dark:bg-blue-600'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:scale-105 border border-gray-300 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20 dark:border-white/20'
                    }`.trim()}
                >
                  {`第${episodeNumber.toString().padStart(2, '0')}集`}
                </button>
              );
            })}
          </div>

          {/* 底部翻页按钮 - 仅在有多页时显示 */}
          {pageCount > 1 && (
            <div className='flex-shrink-0 border-t border-dashed border-gray-300 dark:border-gray-600 py-3'>
              <div className='flex items-center gap-4 px-4'>
                {/* 上一页按钮 */}
                <button
                  onClick={() => {
                    if (descending) {
                      setCurrentPage((prev) =>
                        Math.min(prev + 1, pageCount - 1)
                      );
                    } else {
                      setCurrentPage((prev) => Math.max(prev - 1, 0));
                    }
                  }}
                  disabled={
                    descending
                      ? displayPage === pageCount - 1
                      : displayPage === 0
                  }
                  className='flex-1 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-200 text-gray-700 hover:bg-blue-500 hover:text-white dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20'
                >
                  上一页
                </button>

                {/* 下一页按钮 */}
                <button
                  onClick={() => {
                    if (descending) {
                      setCurrentPage((prev) => Math.max(prev - 1, 0));
                    } else {
                      setCurrentPage((prev) =>
                        Math.min(prev + 1, pageCount - 1)
                      );
                    }
                  }}
                  disabled={
                    descending
                      ? displayPage === 0
                      : displayPage === pageCount - 1
                  }
                  className='flex-1 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-200 text-gray-700 hover:bg-blue-500 hover:text-white dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20'
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 换源 Tab 内容 */}
      {activeTab === 'sources' && (
        <div className='flex flex-col flex-1 min-h-0'>
          {sourceSearchLoading && (
            <div className='flex items-center justify-center py-8'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500'></div>
              <span className='ml-2 text-sm text-gray-600 dark:text-gray-300'>
                搜索中...
              </span>
            </div>
          )}

          {sourceSearchError && (
            <div className='flex items-center justify-center py-8'>
              <div className='text-center'>
                <div className='text-red-500 text-2xl mb-2'>⚠️</div>
                <p className='text-sm text-red-600 dark:text-red-400'>
                  {sourceSearchError}
                </p>
              </div>
            </div>
          )}

          {!sourceSearchLoading &&
            !sourceSearchError &&
            availableSources.length === 0 && (
              <div className='flex items-center justify-center py-8'>
                <div className='text-center'>
                  <div className='text-gray-400 text-2xl mb-2'>📺</div>
                  <p className='text-sm text-gray-600 dark:text-gray-300'>
                    暂无可用的换源
                  </p>
                </div>
              </div>
            )}

          {!sourceSearchLoading &&
            !sourceSearchError &&
            availableSources.length > 0 && (
              <>
                <div className='flex-1 overflow-y-auto space-y-2 pr-4 py-3 scrollbar-auto-hide'>
                  {availableSources
                    .sort((a, b) => {
                      const aIsCurrent =
                        a.source?.toString() === currentSource?.toString() &&
                        a.id?.toString() === currentId?.toString();
                      const bIsCurrent =
                        b.source?.toString() === currentSource?.toString() &&
                        b.id?.toString() === currentId?.toString();

                      // 当前源始终排在最前面
                      if (aIsCurrent && !bIsCurrent) return -1;
                      if (!aIsCurrent && bIsCurrent) return 1;

                      // 其他源按延迟从低到高排序
                      const aKey = `${a.source}-${a.id}`;
                      const bKey = `${b.source}-${b.id}`;
                      const aInfo = videoInfoMap.get(aKey);
                      const bInfo = videoInfoMap.get(bKey);

                      // 如果都有延迟信息，按延迟排序
                      if (
                        aInfo &&
                        bInfo &&
                        aInfo.pingTime > 0 &&
                        bInfo.pingTime > 0
                      ) {
                        return aInfo.pingTime - bInfo.pingTime;
                      }

                      // 有延迟信息的排在没有的前面
                      if (
                        aInfo &&
                        aInfo.pingTime > 0 &&
                        (!bInfo || bInfo.pingTime <= 0)
                      )
                        return -1;
                      if (
                        bInfo &&
                        bInfo.pingTime > 0 &&
                        (!aInfo || aInfo.pingTime <= 0)
                      )
                        return 1;

                      // 都没有延迟信息，保持原顺序
                      return 0;
                    })
                    .map((source, index) => {
                      const isCurrentSource =
                        source.source?.toString() ===
                          currentSource?.toString() &&
                        source.id?.toString() === currentId?.toString();
                      return (
                        <div
                          key={`${source.source}-${source.id}`}
                          onClick={() =>
                            !isCurrentSource && handleSourceClick(source)
                          }
                          className={`flex items-start gap-3 px-3 py-3 rounded-lg transition-colors select-none duration-200 relative
                      ${
                        isCurrentSource
                          ? 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30 border'
                          : 'hover:bg-gray-300/60 dark:hover:bg-white/10 cursor-pointer'
                      }`.trim()}
                        >
                          {/* 封面 */}
                          <div className='flex-shrink-0 w-12 h-20 bg-gray-300 dark:bg-gray-600 rounded overflow-hidden'>
                            {source.episodes && source.episodes.length > 0 && (
                              <img
                                src={processImageUrl(source.poster)}
                                alt={source.title}
                                className='w-full h-full object-cover'
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            )}
                          </div>

                          {/* 信息区域 */}
                          <div className='flex-1 min-w-0 flex flex-col justify-between h-20'>
                            {/* 标题和分辨率 - 顶部 */}
                            <div className='flex items-start justify-between gap-3 h-6'>
                              <div className='flex-1 min-w-0 relative group/title'>
                                <h3 className='font-medium text-base truncate text-gray-900 dark:text-gray-100 leading-none'>
                                  {source.title}
                                </h3>
                                {/* 标题级别的 tooltip - 第一个元素不显示 */}
                                {index !== 0 && (
                                  <div className='absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded-md shadow-lg opacity-0 invisible group-hover/title:opacity-100 group-hover/title:visible transition-all duration-200 ease-out delay-100 whitespace-nowrap z-[500] pointer-events-none'>
                                    {source.title}
                                    <div className='absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800'></div>
                                  </div>
                                )}
                              </div>
                              {(() => {
                                const sourceKey = `${source.source}-${source.id}`;
                                const videoInfo = videoInfoMap.get(sourceKey);

                                if (videoInfo && videoInfo.quality !== '未知') {
                                  if (videoInfo.hasError) {
                                    return (
                                      <div className='bg-gray-500/10 dark:bg-gray-400/20 text-red-600 dark:text-red-400 px-[3px] py-0 rounded text-xs flex-shrink-0 text-center'>
                                        检测失败
                                      </div>
                                    );
                                  } else {
                                    // 根据分辨率设置不同颜色：2K、4K为紫色，1080p、720p为绿色，其他为黄色
                                    const isUltraHigh = ['4K', '2K'].includes(
                                      videoInfo.quality
                                    );
                                    const isHigh = ['1080p', '720p'].includes(
                                      videoInfo.quality
                                    );
                                    const textColorClasses = isUltraHigh
                                      ? 'text-purple-600 dark:text-purple-400'
                                      : isHigh
                                      ? 'text-blue-600 dark:text-blue-400'
                                      : 'text-yellow-600 dark:text-yellow-400';

                                    return (
                                      <div
                                        className={`bg-gray-500/10 dark:bg-gray-400/20 ${textColorClasses} px-[3px] py-0 rounded text-xs flex-shrink-0 text-center`}
                                      >
                                        {videoInfo.quality}
                                      </div>
                                    );
                                  }
                                }

                                return null;
                              })()}
                            </div>

                            {/* 源名称和集数信息 - 垂直居中 */}
                            <div className='flex items-center justify-between'>
                              <span className='text-xs px-2 py-1 border border-gray-500/60 rounded text-gray-700 dark:text-gray-300'>
                                {source.source_name}
                              </span>
                              {source.episodes.length > 1 && (
                                <span className='text-xs text-gray-500 dark:text-gray-400 font-medium'>
                                  {source.episodes.length} 集
                                </span>
                              )}
                            </div>

                            {/* 网络信息 - 底部 */}
                            <div className='flex items-end h-6'>
                              {(() => {
                                const sourceKey = `${source.source}-${source.id}`;
                                const videoInfo = videoInfoMap.get(sourceKey);
                                if (videoInfo) {
                                  if (!videoInfo.hasError) {
                                    return (
                                      <div className='flex items-end gap-3 text-xs whitespace-nowrap'>
                                        <div className='text-blue-600 dark:text-blue-400 font-medium text-xs whitespace-nowrap'>
                                          {videoInfo.loadSpeed}
                                        </div>
                                        <div className='text-orange-600 dark:text-orange-400 font-medium text-xs whitespace-nowrap'>
                                          {videoInfo.pingTime}ms
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    return (
                                      <div className='text-red-500/90 dark:text-red-400 font-medium text-xs whitespace-nowrap'>
                                        无测速数据
                                      </div>
                                    ); // 占位div
                                  }
                                }
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
                <div className='flex-shrink-0 pt-2 border-t border-dashed border-gray-300 dark:border-gray-600 px-4'>
                  <button
                    onClick={() => {
                      if (videoTitle) {
                        router.push(
                          `/search?q=${encodeURIComponent(videoTitle)}`
                        );
                      }
                    }}
                    className='w-full text-center text-xs text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors pt-2 pb-3'
                  >
                    影片匹配有误？点击去搜索
                  </button>
                </div>
              </>
            )}
        </div>
      )}
    </div>
  );
};

export default EpisodeSelector;
