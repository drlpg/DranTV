/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console, @next/next/no-img-element */

'use client';

// Artplayer 和 Hls 以及弹幕插件将动态加载
import { Heart } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import {
  deleteFavorite,
  deletePlayRecord,
  deleteSkipConfig,
  generateStorageKey,
  getAllPlayRecords,
  getSkipConfig,
  isFavorited,
  saveFavorite,
  savePlayRecord,
  saveSkipConfig,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { SearchResult } from '@/lib/types';
import { getVideoResolutionFromM3u8, processImageUrl } from '@/lib/utils';

import { BackButton } from '@/components/BackButton';
import EpisodeSelector from '@/components/EpisodeSelector';
import PageLayout from '@/components/PageLayout';

// 扩展 HTMLVideoElement 类型以支持 hls 属性
declare global {
  interface HTMLVideoElement {
    hls?: any;
  }
}

// Wake Lock API 类型声明
interface WakeLockSentinel {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
  removeEventListener(type: 'release', listener: () => void): void;
}

function PlayPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // -----------------------------------------------------------------------------
  // 状态变量（State）
  // -----------------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<
    'searching' | 'preferring' | 'fetching' | 'ready'
  >('searching');
  const [loadingMessage, setLoadingMessage] = useState('正在搜索播放源...');
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SearchResult | null>(null);

  // 收藏状态
  const [favorited, setFavorited] = useState(false);

  // 跳过片头片尾配置
  const [skipConfig, setSkipConfig] = useState<{
    enable: boolean;
    intro_time: number;
    outro_time: number;
  }>({
    enable: false,
    intro_time: 0,
    outro_time: 0,
  });
  const skipConfigRef = useRef(skipConfig);
  useEffect(() => {
    skipConfigRef.current = skipConfig;
  }, [
    skipConfig,
    skipConfig.enable,
    skipConfig.intro_time,
    skipConfig.outro_time,
  ]);

  // 跳过检查的时间间隔控制
  const lastSkipCheckRef = useRef(0);

  // 去广告开关（从 localStorage 继承，默认 true）
  const [blockAdEnabled, setBlockAdEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('enable_blockad');
      if (v !== null) return v === 'true';
    }
    return true;
  });
  const blockAdEnabledRef = useRef(blockAdEnabled);
  useEffect(() => {
    blockAdEnabledRef.current = blockAdEnabled;
  }, [blockAdEnabled]);

  // 视频基本信息
  const [videoTitle, setVideoTitle] = useState(searchParams.get('title') || '');
  const [videoYear, setVideoYear] = useState(searchParams.get('year') || '');
  const [videoCover, setVideoCover] = useState('');
  const [videoDoubanId, setVideoDoubanId] = useState(0);
  // 当前源和ID
  const [currentSource, setCurrentSource] = useState(
    searchParams.get('source') || '',
  );
  const [currentId, setCurrentId] = useState(searchParams.get('id') || '');

  // 短剧相关参数
  const [shortdramaId, setShortdramaId] = useState(
    searchParams.get('shortdrama_id') || '',
  );
  const [vodClass, setVodClass] = useState(searchParams.get('vod_class') || '');
  const [vodTag, setVodTag] = useState(searchParams.get('vod_tag') || '');

  // 搜索所需信息
  const [searchTitle] = useState(searchParams.get('stitle') || '');
  const [searchType] = useState(searchParams.get('stype') || '');

  // 是否需要优选
  const [needPrefer, setNeedPrefer] = useState(
    searchParams.get('prefer') === 'true',
  );

  // 动态加载的依赖
  const [dynamicDeps, setDynamicDeps] = useState<{
    Artplayer: any;
    Hls: any;
    artplayerPluginDanmuku: any;
  } | null>(null);

  // 弹幕相关状态
  const [danmuEnabled, setDanmuEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('enableDanmu');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });
  const needPreferRef = useRef(needPrefer);
  useEffect(() => {
    needPreferRef.current = needPrefer;
  }, [needPrefer]);

  // 动态加载 Artplayer、Hls 和弹幕插件
  useEffect(() => {
    let mounted = true;

    const loadDynamicDeps = async () => {
      try {
        const [ArtplayerModule, HlsModule, DanmakuModule] = await Promise.all([
          import('artplayer'),
          import('hls.js'),
          import('artplayer-plugin-danmuku'),
        ]);

        if (mounted) {
          setDynamicDeps({
            Artplayer: ArtplayerModule.default,
            Hls: HlsModule.default,
            artplayerPluginDanmuku: DanmakuModule.default,
          });
        }
      } catch (error) {
        console.error('加载播放器依赖失败:', error);
        if (mounted) {
          setError('播放器加载失败');
        }
      }
    };

    loadDynamicDeps();

    return () => {
      mounted = false;
    };
  }, []);
  // 集数相关
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);

  const currentSourceRef = useRef(currentSource);
  const currentIdRef = useRef(currentId);
  const videoTitleRef = useRef(videoTitle);
  const videoYearRef = useRef(videoYear);
  const detailRef = useRef<SearchResult | null>(detail);
  const currentEpisodeIndexRef = useRef(currentEpisodeIndex);
  const shortdramaIdRef = useRef(shortdramaId);
  const vodClassRef = useRef(vodClass);
  const vodTagRef = useRef(vodTag);

  // 同步最新值到 refs
  useEffect(() => {
    currentSourceRef.current = currentSource;
    currentIdRef.current = currentId;
    detailRef.current = detail;
    currentEpisodeIndexRef.current = currentEpisodeIndex;
    videoTitleRef.current = videoTitle;
    videoYearRef.current = videoYear;
    shortdramaIdRef.current = shortdramaId;
    vodClassRef.current = vodClass;
    vodTagRef.current = vodTag;
  }, [
    currentSource,
    currentId,
    detail,
    currentEpisodeIndex,
    videoTitle,
    videoYear,
    shortdramaId,
    vodClass,
    vodTag,
  ]);

  // 视频播放地址
  const [videoUrl, setVideoUrl] = useState('');

  // 总集数
  const totalEpisodes = detail?.episodes?.length || 0;

  // 用于记录是否需要在播放器 ready 后跳转到指定进度
  const resumeTimeRef = useRef<number | null>(null);
  // 上次使用的音量，默认 0.7
  const lastVolumeRef = useRef<number>(0.7);
  // 上次使用的播放速率，默认 1.0
  const lastPlaybackRateRef = useRef<number>(1.0);

  // 换源相关状态
  const [availableSources, setAvailableSources] = useState<SearchResult[]>([]);
  const [sourceSearchLoading, setSourceSearchLoading] = useState(false);
  const [sourceSearchError, setSourceSearchError] = useState<string | null>(
    null,
  );

  // 优选和测速开关
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

  // 保存优选时的测速结果，避免EpisodeSelector重复测速
  const [precomputedVideoInfo, setPrecomputedVideoInfo] = useState<
    Map<string, { quality: string; loadSpeed: string; pingTime: number }>
  >(new Map());

  // 折叠状态（仅在 lg 及以上屏幕有效）
  const [isEpisodeSelectorCollapsed, setIsEpisodeSelectorCollapsed] =
    useState(false);

  // 换源加载状态
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoLoadingStage, setVideoLoadingStage] = useState<
    'initing' | 'sourceChanging'
  >('initing');

  // 播放进度保存相关
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  const artPlayerRef = useRef<any>(null);
  const artRef = useRef<HTMLDivElement | null>(null);

  // Wake Lock 相关
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // -----------------------------------------------------------------------------
  // 工具函数（Utils）
  // -----------------------------------------------------------------------------

  // 播放源优选函数
  const preferBestSource = async (
    sources: SearchResult[],
  ): Promise<SearchResult> => {
    if (sources.length === 1) return sources[0];

    // 将播放源均分为两批，并发测速各批，避免一次性过多请求
    const batchSize = Math.ceil(sources.length / 2);
    const allResults: Array<{
      source: SearchResult;
      testResult: {
        quality: string;
        loadSpeed: string;
        pingTime: number;
      } | null;
      sourceKey: string;
    }> = [];

    for (let start = 0; start < sources.length; start += batchSize) {
      const batchSources = sources.slice(start, start + batchSize);
      const batchResults = await Promise.all(
        batchSources.map(async (source) => {
          const sourceKey = `${source.source}-${source.id}`;
          try {
            // 检查是否有第一集的播放地址
            if (!source.episodes || source.episodes.length === 0) {
              return { source, testResult: null, sourceKey };
            }

            // 始终测试第一集（索引0），确保测速的是用户最可能播放的集数
            let episodeUrl = source.episodes[0];
            if (!episodeUrl) {
              return { source, testResult: null, sourceKey };
            }

            // 如果是相对路径的代理 URL，转换为完整 URL
            if (episodeUrl.startsWith('/api/proxy/')) {
              episodeUrl = `${window.location.origin}${episodeUrl}`;
            }

            const testResult = await getVideoResolutionFromM3u8(episodeUrl);

            return {
              source,
              testResult,
              sourceKey,
            };
          } catch (error) {
            // 测速失败，返回失败标记
            return { source, testResult: null, sourceKey };
          }
        }),
      );
      allResults.push(...batchResults);
    }

    // 等待所有测速完成，包含成功和失败的结果
    // 保存所有测速结果到 precomputedVideoInfo，供 EpisodeSelector 使用（包含错误结果）
    const newVideoInfoMap = new Map<
      string,
      {
        quality: string;
        loadSpeed: string;
        pingTime: number;
        hasError?: boolean;
      }
    >();
    allResults.forEach((result) => {
      if (result.testResult) {
        // 成功的结果
        newVideoInfoMap.set(result.sourceKey, result.testResult);
      } else {
        // 失败的结果，标记为错误
        newVideoInfoMap.set(result.sourceKey, {
          quality: '未知',
          loadSpeed: '未知',
          pingTime: 0,
          hasError: true,
        });
      }
    });

    // 过滤出成功的结果用于优选计算
    const successfulResults = allResults.filter(
      (result) => result.testResult !== null,
    ) as Array<{
      source: SearchResult;
      testResult: { quality: string; loadSpeed: string; pingTime: number };
      sourceKey: string;
    }>;

    setPrecomputedVideoInfo(newVideoInfoMap);

    if (successfulResults.length === 0) {
      // 按源名称优先级排序（优先选择知名源）
      const prioritySources = [
        '电影天堂',
        '如意',
        '暴风',
        '量子',
        '非凡',
        '光速',
      ];
      const sortedSources = [...sources].sort((a, b) => {
        const aPriority = prioritySources.findIndex((name) =>
          a.source_name?.includes(name),
        );
        const bPriority = prioritySources.findIndex((name) =>
          b.source_name?.includes(name),
        );

        // 如果都在优先列表中，按优先级排序
        if (aPriority !== -1 && bPriority !== -1) {
          return aPriority - bPriority;
        }
        // 如果只有一个在优先列表中，优先选择它
        if (aPriority !== -1) return -1;
        if (bPriority !== -1) return 1;
        // 都不在优先列表中，保持原顺序
        return 0;
      });

      // 返回第一个有有效剧集的源
      const validSource = sortedSources.find(
        (s) => s.episodes && s.episodes.length > 0 && s.episodes[0],
      );
      return validSource || sources[0];
    }

    // 找出所有有效速度的最大值，用于线性映射
    const validSpeeds = successfulResults
      .map((result) => {
        const speedStr = result.testResult.loadSpeed;
        if (speedStr === '未知' || speedStr === '测量中...') return 0;

        const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
        if (!match) return 0;

        const value = parseFloat(match[1]);
        const unit = match[2];
        return unit === 'MB/s' ? value * 1024 : value; // 统一转换为 KB/s
      })
      .filter((speed) => speed > 0);

    const maxSpeed = validSpeeds.length > 0 ? Math.max(...validSpeeds) : 1024; // 默认1MB/s作为基准

    // 找出所有有效延迟的最小值和最大值，用于线性映射
    const validPings = successfulResults
      .map((result) => result.testResult.pingTime)
      .filter((ping) => ping > 0);

    const minPing = validPings.length > 0 ? Math.min(...validPings) : 50;
    const maxPing = validPings.length > 0 ? Math.max(...validPings) : 1000;

    // 计算每个结果的评分
    const resultsWithScore = successfulResults.map((result) => ({
      ...result,
      score: calculateSourceScore(
        result.testResult,
        maxSpeed,
        minPing,
        maxPing,
      ),
    }));

    // 按综合评分排序，选择最佳播放源
    resultsWithScore.sort((a, b) => b.score - a.score);

    return resultsWithScore[0].source;
  };

  // 计算播放源综合评分
  const calculateSourceScore = (
    testResult: {
      quality: string;
      loadSpeed: string;
      pingTime: number;
    },
    maxSpeed: number,
    minPing: number,
    maxPing: number,
  ): number => {
    let score = 0;

    // 分辨率评分 (50% 权重)
    const qualityScore = (() => {
      switch (testResult.quality) {
        case '4K':
          return 100;
        case '2K':
          return 90;
        case '1080p':
          return 80;
        case '720p':
          return 65;
        case '480p':
          return 45;
        case 'SD':
          return 25;
        default:
          return 0;
      }
    })();
    score += qualityScore * 0.5;

    // 下载速度评分 (20% 权重)
    const speedScore = (() => {
      const speedStr = testResult.loadSpeed;
      if (speedStr === '未知' || speedStr === '测量中...') return 30;

      // 解析速度值
      const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
      if (!match) return 30;

      const value = parseFloat(match[1]);
      const unit = match[2];
      const speedKBps = unit === 'MB/s' ? value * 1024 : value;

      // 基于最大速度线性映射，最高100分
      const speedRatio = speedKBps / maxSpeed;
      return Math.min(100, Math.max(0, speedRatio * 100));
    })();
    score += speedScore * 0.2;

    // 网络延迟评分 (30% 权重)
    const pingScore = (() => {
      const ping = testResult.pingTime;
      if (ping <= 0) return 0; // 无效延迟给0分

      // 如果所有延迟都相同，给满分
      if (maxPing === minPing) return 100;

      // 使用非线性映射，对低延迟更敏感
      // 延迟越低，分数越高，使用指数衰减
      const pingRange = maxPing - minPing;
      const normalizedPing = (ping - minPing) / pingRange; // 0-1之间

      // 使用平方根函数，使得低延迟区域的差异更明显
      const pingRatio = 1 - Math.sqrt(normalizedPing);
      return Math.min(100, Math.max(0, pingRatio * 100));
    })();
    score += pingScore * 0.3;

    return Math.round(score * 100) / 100; // 保留两位小数
  };

  // 更新视频地址
  const updateVideoUrl = (
    detailData: SearchResult | null,
    episodeIndex: number,
  ) => {
    if (
      !detailData ||
      !detailData.episodes ||
      episodeIndex >= detailData.episodes.length
    ) {
      setVideoUrl('');
      return;
    }

    let newUrl = detailData?.episodes[episodeIndex] || '';

    // 确保所有 M3U8 URL 都通过代理（不仅仅是短剧）
    if (newUrl && !newUrl.includes('/api/proxy/')) {
      // 如果是短剧，使用短剧处理函数
      if (detailData.source === 'shortdrama') {
        newUrl = processShortDramaUrl(newUrl);
      }
      // 如果是 M3U8 格式，使用 M3U8 代理
      else if (newUrl.includes('.m3u8') || newUrl.includes('m3u8')) {
        newUrl = `/api/proxy/m3u8?url=${encodeURIComponent(newUrl)}`;
      }
    }

    if (newUrl !== videoUrl) {
      setVideoUrl(newUrl);
    }
  };

  const ensureVideoSource = (video: HTMLVideoElement | null, url: string) => {
    if (!video || !url) return;
    const sources = Array.from(video.getElementsByTagName('source'));
    const existed = sources.some((s) => s.src === url);
    if (!existed) {
      // 移除旧的 source，保持唯一
      sources.forEach((s) => s.remove());
      const sourceEl = document.createElement('source');
      sourceEl.src = url;
      video.appendChild(sourceEl);
    }

    // 始终允许远程播放（AirPlay / Cast）
    video.disableRemotePlayback = false;
    // 如果曾经有禁用属性，移除之
    if (video.hasAttribute('disableRemotePlayback')) {
      video.removeAttribute('disableRemotePlayback');
    }
  };

  // Wake Lock 相关函数
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request(
          'screen',
        );
      }
    } catch (err) {
      console.warn('Wake Lock 请求失败:', err);
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (err) {
      console.warn('Wake Lock 释放失败:', err);
    }
  };

  // 清理播放器资源的统一函数
  const cleanupPlayer = () => {
    if (artPlayerRef.current) {
      try {
        // 销毁 HLS 实例
        if (artPlayerRef.current.video && artPlayerRef.current.video.hls) {
          artPlayerRef.current.video.hls.destroy();
        }

        // 销毁 ArtPlayer 实例
        artPlayerRef.current.destroy();
        artPlayerRef.current = null;
      } catch (err) {
        console.warn('清理播放器资源时出错:', err);
        artPlayerRef.current = null;
      }
    }
  };

  // 去广告相关函数
  function filterAdsFromM3U8(m3u8Content: string): string {
    if (!m3u8Content) return '';

    // 按行分割M3U8内容
    const lines = m3u8Content.split('\n');
    const filteredLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 只过滤#EXT-X-DISCONTINUITY标识
      if (!line.includes('#EXT-X-DISCONTINUITY')) {
        filteredLines.push(line);
      }
    }

    return filteredLines.join('\n');
  }

  // 跳过片头片尾配置相关函数
  const handleSkipConfigChange = async (newConfig: {
    enable: boolean;
    intro_time: number;
    outro_time: number;
  }) => {
    if (!currentSourceRef.current || !currentIdRef.current) return;

    try {
      setSkipConfig(newConfig);
      if (!newConfig.enable && !newConfig.intro_time && !newConfig.outro_time) {
        await deleteSkipConfig(currentSourceRef.current, currentIdRef.current);
        artPlayerRef.current.setting.update({
          name: '跳过片头片尾',
          html: '跳过片头片尾',
          switch: skipConfigRef.current.enable,
          onSwitch: function (item: any) {
            const newConfig = {
              ...skipConfigRef.current,
              enable: !item.switch,
            };
            handleSkipConfigChange(newConfig);
            return !item.switch;
          },
        });
        artPlayerRef.current.setting.update({
          name: '设置片头',
          html: '设置片头',
          icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="2" fill="#ffffff"/><path d="M9 12L17 12" stroke="#ffffff" stroke-width="2"/><path d="M17 6L17 18" stroke="#ffffff" stroke-width="2"/></svg>',
          tooltip:
            skipConfigRef.current.intro_time === 0
              ? '设置片头时间'
              : `${formatTime(skipConfigRef.current.intro_time)}`,
          onClick: function () {
            const currentTime = artPlayerRef.current?.currentTime || 0;
            if (currentTime > 0) {
              const newConfig = {
                ...skipConfigRef.current,
                intro_time: currentTime,
              };
              handleSkipConfigChange(newConfig);
              return `${formatTime(currentTime)}`;
            }
          },
        });
        artPlayerRef.current.setting.update({
          name: '设置片尾',
          html: '设置片尾',
          icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 6L7 18" stroke="#ffffff" stroke-width="2"/><path d="M7 12L15 12" stroke="#ffffff" stroke-width="2"/><circle cx="19" cy="12" r="2" fill="#ffffff"/></svg>',
          tooltip:
            skipConfigRef.current.outro_time >= 0
              ? '设置片尾时间'
              : `-${formatTime(-skipConfigRef.current.outro_time)}`,
          onClick: function () {
            const outroTime =
              -(
                artPlayerRef.current?.duration -
                artPlayerRef.current?.currentTime
              ) || 0;
            if (outroTime < 0) {
              const newConfig = {
                ...skipConfigRef.current,
                outro_time: outroTime,
              };
              handleSkipConfigChange(newConfig);
              return `-${formatTime(-outroTime)}`;
            }
          },
        });
      } else {
        await saveSkipConfig(
          currentSourceRef.current,
          currentIdRef.current,
          newConfig,
        );
      }
    } catch (err) {
      console.error('保存跳过片头片尾配置失败:', err);
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds === 0) return '00:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.round(seconds % 60);

    if (hours === 0) {
      // 不到一小时，格式为 00:00
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
        .toString()
        .padStart(2, '0')}`;
    } else {
      // 超过一小时，格式为 00:00:00
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  };

  // 弹幕相关函数
  const generateVideoId = (
    source: string,
    id: string,
    episode: number,
  ): string => {
    return `${source}_${id}_${episode}`;
  };

  // 短剧标签处理函数
  const parseVodTags = (vodTagString: string): string[] => {
    if (!vodTagString) return [];
    return vodTagString
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  };

  // 为标签生成颜色的函数
  const getTagColor = (tag: string, isClass = false) => {
    if (isClass) {
      // vod_class 使用更显眼的颜色
      const classColors = [
        'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
        'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
        'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
      ];
      const hash = tag.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      return classColors[hash % classColors.length];
    } else {
      // vod_tag 使用较为柔和的颜色
      const tagColors = [
        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
        'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
        'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
        'bg-amber-100 text-amber-700 dark:bg-amber-800 dark:text-amber-300',
        'bg-orange-100 text-orange-700 dark:bg-orange-800 dark:text-orange-300',
        'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-300',
        'bg-pink-100 text-pink-700 dark:bg-pink-800 dark:text-pink-300',
        'bg-rose-100 text-rose-700 dark:bg-rose-800 dark:text-rose-300',
      ];
      const hash = tag.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      return tagColors[hash % tagColors.length];
    }
  };

  // 短剧播放地址处理函数
  const processShortDramaUrl = (originalUrl: string): string => {
    if (!originalUrl) {
      return originalUrl;
    }

    // 检查是否是 m3u8 流媒体
    const isM3u8 =
      originalUrl.includes('.m3u8') || originalUrl.includes('m3u8');

    // 检查是否需要使用代理
    const proxyChecks = {
      'quark.cn': originalUrl.includes('quark.cn'),
      'drive.quark.cn': originalUrl.includes('drive.quark.cn'),
      'dl-c-zb-': originalUrl.includes('dl-c-zb-'),
      'dl-c-': originalUrl.includes('dl-c-'),
      'drive pattern': !!originalUrl.match(/https?:\/\/[^/]*\.drive\./),
      'ffzy-online': originalUrl.includes('ffzy-online'),
      'bfikuncdn.com': originalUrl.includes('bfikuncdn.com'),
      'vip.': originalUrl.includes('vip.'),
      m3u8: isM3u8,
      'not localhost':
        !originalUrl.includes('localhost') &&
        !originalUrl.includes('127.0.0.1'),
    };

    const needsProxy = Object.values(proxyChecks).some((check) => check);

    if (needsProxy) {
      // 对于 m3u8 流媒体，使用 m3u8 代理
      if (isM3u8) {
        const proxyUrl = `/api/proxy/m3u8?url=${encodeURIComponent(
          originalUrl,
        )}`;
        return proxyUrl;
      }
      // 对于其他视频文件，使用 video 代理
      const proxyUrl = `/api/proxy/video?url=${encodeURIComponent(
        originalUrl,
      )}`;
      return proxyUrl;
    }

    return originalUrl;
  };

  // 短剧数据获取和转换函数
  const fetchShortDramaData = async (
    shortdramaId: string,
  ): Promise<SearchResult> => {
    try {
      const response = await fetch(
        `/api/shortdrama/parse/all?id=${encodeURIComponent(shortdramaId)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [短剧API] 响应错误:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
          url: `/api/shortdrama/parse/all?id=${encodeURIComponent(
            shortdramaId,
          )}`,
        });
        throw new Error(
          `获取短剧数据失败: ${response.status} - ${response.statusText}`,
        );
      }

      const data = await response.json();

      // 检查数据有效性
      if (!data) {
        throw new Error('短剧数据为空');
      }

      // 将短剧数据转换为SearchResult格式
      const episodes: string[] = [];
      const episodesTitles: string[] = [];
      if (data.results && Array.isArray(data.results)) {
        // 按index排序确保集数顺序正确
        const sortedResults = data.results.sort((a: any, b: any) => {
          const indexA = parseInt(a.index) || 0;
          const indexB = parseInt(b.index) || 0;
          return indexA - indexB;
        });

        sortedResults.forEach((item: any, arrayIndex: number) => {
          if (item.status === 'success' && item.parsedUrl) {
            // 处理播放地址，添加代理支持
            const processedUrl = processShortDramaUrl(item.parsedUrl);
            episodes.push(processedUrl);

            // 使用API提供的label，如果没有则根据索引生成
            const episodeTitle =
              item.label ||
              `第${
                item.index !== undefined ? item.index + 1 : arrayIndex + 1
              }集`;
            episodesTitles.push(episodeTitle);
          }
        });
      }

      if (episodes.length === 0) {
        throw new Error('未找到可播放的视频源，请稍后重试');
      }

      const searchResult: SearchResult = {
        source: 'shortdrama',
        id: shortdramaId,
        title: data.videoName || videoTitle || '短剧播放',
        poster: data.cover || '',
        year: videoYear || new Date().getFullYear().toString(),
        source_name: '短剧',
        type_name: '短剧',
        class: '短剧',
        episodes: episodes,
        episodes_titles: episodesTitles,
        desc: data.description || '精彩短剧，为您呈现优质内容',
        douban_id: 0,
      };

      return searchResult;
    } catch (error) {
      console.error('❌ [短剧处理] 获取短剧数据失败:', {
        error: error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        shortdramaId: shortdramaId,
        timestamp: new Date().toISOString(),
      });

      // 提供更详细的错误信息
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('网络连接失败，请检查网络设置后重试');
      } else if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('短剧数据加载失败，请稍后重试');
      }
    }
  };

  const loadDanmuData = async (videoId: string) => {
    try {
      const response = await fetch(
        `/api/danmu?videoId=${encodeURIComponent(videoId)}`,
      );
      if (!response.ok) {
        throw new Error('获取弹幕数据失败');
      }
      return await response.json();
    } catch (error) {
      console.error('加载弹幕失败:', error);
      return [];
    }
  };

  const sendDanmu = async (videoId: string, danmuData: any) => {
    try {
      const response = await fetch('/api/danmu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
          ...danmuData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '发送弹幕失败');
      }

      return await response.json();
    } catch (error) {
      console.error('发送弹幕失败:', error);
      throw error;
    }
  };

  // 去广告过滤器 - 仅在 HLS 加载时使用
  const createCustomHlsJsLoader = (Hls: any) => {
    return class extends Hls.DefaultConfig.loader {
      constructor(config: any) {
        super(config);
        const load = this.load.bind(this);
        this.load = function (context: any, config: any, callbacks: any) {
          // 拦截 manifest 和 level 请求进行广告过滤
          if (
            blockAdEnabledRef.current &&
            ((context as any).type === 'manifest' ||
              (context as any).type === 'level')
          ) {
            const onSuccess = callbacks.onSuccess;
            callbacks.onSuccess = function (
              response: any,
              stats: any,
              context: any,
            ) {
              // 如果是 m3u8 文件，过滤掉广告段
              if (response.data && typeof response.data === 'string') {
                response.data = filterAdsFromM3U8(response.data);
              }
              return onSuccess(response, stats, context, null);
            };
          }
          // 执行原始 load 方法
          load(context, config, callbacks);
        };
      }
    };
  };

  // 添加初始化标志，防止重复执行
  const hasInitializedRef = useRef(false);

  // 当集数索引变化时自动更新视频地址
  useEffect(() => {
    updateVideoUrl(detail, currentEpisodeIndex);
  }, [detail, currentEpisodeIndex]);

  // 进入页面时直接获取全部源信息
  useEffect(() => {
    // 防止重复初始化
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    const fetchSourceDetail = async (
      source: string,
      id: string,
    ): Promise<SearchResult[]> => {
      try {
        const detailResponse = await fetch(
          `/api/detail?source=${encodeURIComponent(
            source,
          )}&id=${encodeURIComponent(id)}`,
        );
        if (!detailResponse.ok) {
          throw new Error('获取视频详情失败');
        }
        const detailData = (await detailResponse.json()) as SearchResult;
        // 不要在这里设置 availableSources，让调用者决定如何处理
        return [detailData];
      } catch (err) {
        console.error('获取视频详情失败:', err);
        return [];
      }
    };
    const fetchSourcesData = async (query: string): Promise<SearchResult[]> => {
      // 根据搜索词获取全部源信息
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`,
        );
        if (!response.ok) {
          throw new Error('搜索失败');
        }
        const data = await response.json();

        // 标准化标题：移除空格、特殊字符，转小写
        const normalizeTitle = (title: string) => {
          return title
            .replaceAll(' ', '')
            .replace(/[：:·•\-—]/g, '')
            .toLowerCase();
        };

        const normalizedSearchTitle = normalizeTitle(videoTitleRef.current);

        // 处理搜索结果，使用更宽松的匹配规则
        const exactMatches: SearchResult[] = [];
        const partialMatches: SearchResult[] = [];
        const looseMatches: SearchResult[] = [];

        data.results.forEach((result: SearchResult) => {
          const normalizedResultTitle = normalizeTitle(result.title);

          // 检查年份匹配（宽松匹配：允许年份为空或相差1年）
          const yearMatch = videoYearRef.current
            ? !result.year ||
              result.year.toLowerCase() ===
                videoYearRef.current.toLowerCase() ||
              Math.abs(
                parseInt(result.year) - parseInt(videoYearRef.current),
              ) <= 1
            : true;

          // 检查类型匹配
          const typeMatch = searchType
            ? (searchType === 'tv' && result.episodes.length > 1) ||
              (searchType === 'movie' && result.episodes.length === 1)
            : true;

          // 完全匹配：标题完全相同
          if (
            normalizedResultTitle === normalizedSearchTitle &&
            yearMatch &&
            typeMatch
          ) {
            exactMatches.push(result);
          }
          // 部分匹配：标题包含搜索词或搜索词包含标题
          else if (
            (normalizedResultTitle.includes(normalizedSearchTitle) ||
              normalizedSearchTitle.includes(normalizedResultTitle)) &&
            yearMatch &&
            typeMatch
          ) {
            partialMatches.push(result);
          }
          // 宽松匹配：忽略年份，只匹配标题
          else if (
            (normalizedResultTitle.includes(normalizedSearchTitle) ||
              normalizedSearchTitle.includes(normalizedResultTitle)) &&
            typeMatch
          ) {
            looseMatches.push(result);
          }
        });

        // 选择匹配级别：完全匹配 > 部分匹配 > 宽松匹配
        const matchedResults =
          exactMatches.length > 0
            ? exactMatches
            : partialMatches.length > 0
              ? partialMatches
              : looseMatches;

        // 按标题和年份分组，统计每组的源数量
        const groupMap = new Map<string, SearchResult[]>();
        matchedResults.forEach((result) => {
          const key = `${normalizeTitle(result.title)}_${result.year}`;
          if (!groupMap.has(key)) {
            groupMap.set(key, []);
          }
          const group = groupMap.get(key);
          if (group) {
            group.push(result);
          }
        });

        // 将分组转换为数组并按源数量排序（源多的在前）
        const sortedGroups = Array.from(groupMap.values()).sort(
          (a, b) => b.length - a.length,
        );

        // 智能提取最多10个视频源
        let results: SearchResult[] = [];
        const MAX_SOURCES = 10;

        if (sortedGroups.length > 0) {
          const firstGroup = sortedGroups[0];

          if (firstGroup.length >= MAX_SOURCES) {
            // 第一组有≥10个源，只取前10个
            results = firstGroup.slice(0, MAX_SOURCES);
          } else {
            // 第一组<10个源，从其他组补充
            results = [...firstGroup];

            for (
              let i = 1;
              i < sortedGroups.length && results.length < MAX_SOURCES;
              i++
            ) {
              const group = sortedGroups[i];
              const remaining = MAX_SOURCES - results.length;
              results.push(...group.slice(0, remaining));
            }
          }
        }

        // 不在这里设置 availableSources，让调用者统一处理
        return results;
      } catch (err) {
        setSourceSearchError(err instanceof Error ? err.message : '搜索失败');
        setAvailableSources([]);
        return [];
      } finally {
        setSourceSearchLoading(false);
      }
    };

    const initAll = async () => {
      // 检查是否为短剧播放
      if (shortdramaId) {
        try {
          setLoading(true);
          setLoadingStage('fetching');
          setLoadingMessage('🎬 正在获取短剧播放信息...');

          const shortDramaData = await fetchShortDramaData(shortdramaId);

          setCurrentSource(shortDramaData.source);
          setCurrentId(shortDramaData.id);
          setVideoTitle(shortDramaData.title);
          setVideoYear(shortDramaData.year);
          setVideoCover(shortDramaData.poster);
          setVideoDoubanId(shortDramaData.douban_id || 0);
          setDetail(shortDramaData);
          setAvailableSources([shortDramaData]);

          if (currentEpisodeIndex >= shortDramaData.episodes.length) {
            setCurrentEpisodeIndex(0);
          }

          // 规范URL参数
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('source', shortDramaData.source);
          newUrl.searchParams.set('id', shortDramaData.id);
          newUrl.searchParams.set('title', shortDramaData.title);
          newUrl.searchParams.set('year', shortDramaData.year);
          window.history.replaceState({}, '', newUrl.toString());

          setLoadingStage('ready');
          setLoadingMessage('✨ 短剧准备就绪，即将开始播放...');

          // 立即开始播放，无需延迟
          setLoading(false);

          return;
        } catch (error) {
          console.error('短剧初始化失败:', error);

          // 提供更详细和用户友好的错误信息
          let errorMessage = '短剧加载失败';

          if (error instanceof Error) {
            if (error.message.includes('网络')) {
              errorMessage = '网络连接失败，请检查网络设置后重试';
            } else if (error.message.includes('未找到')) {
              errorMessage = '未找到该短剧的播放资源，可能已被移除';
            } else if (error.message.includes('数据为空')) {
              errorMessage = '短剧数据异常，请稍后重试';
            } else if (error.message.includes('超时')) {
              errorMessage = '请求超时，请检查网络后重试';
            } else {
              errorMessage = error.message;
            }
          }

          setError(errorMessage);
          setLoading(false);
          return;
        }
      }

      if (!currentSource && !currentId && !videoTitle && !searchTitle) {
        setError('缺少必要参数');
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadingStage(currentSource && currentId ? 'fetching' : 'searching');
      setLoadingMessage(
        currentSource && currentId
          ? '🎬 正在获取视频详情...'
          : '🔍 正在搜索播放源...',
      );

      let sourcesInfo = await fetchSourcesData(searchTitle || videoTitle);

      // 如果指定了源和ID，需要获取该源的详细信息
      if (currentSource && currentId) {
        const existingSource = sourcesInfo.find(
          (source) =>
            source.source === currentSource && source.id === currentId,
        );

        // 如果搜索结果中没有该源，或者该源的episodes数据不完整，则获取详情
        if (
          !existingSource ||
          !existingSource.episodes ||
          existingSource.episodes.length <= 1
        ) {
          console.log('获取指定源的详细信息:', currentSource, currentId);
          const detailInfo = await fetchSourceDetail(currentSource, currentId);
          if (detailInfo.length > 0) {
            // 替换或添加详细信息到源列表
            const detailData = detailInfo[0];
            const index = sourcesInfo.findIndex(
              (s) => s.source === currentSource && s.id === currentId,
            );
            if (index >= 0) {
              sourcesInfo[index] = detailData;
            } else {
              sourcesInfo.unshift(detailData);
              // 确保不超过10个源
              if (sourcesInfo.length > 10) {
                sourcesInfo = sourcesInfo.slice(0, 10);
              }
            }
          }
        }
      }

      if (sourcesInfo.length === 0) {
        setError('未找到匹配结果');
        setLoading(false);
        return;
      }

      let detailData: SearchResult = sourcesInfo[0];

      // 指定源和id且无需优选
      if (currentSource && currentId && !needPreferRef.current) {
        const target = sourcesInfo.find(
          (source) =>
            source.source === currentSource && source.id === currentId,
        );
        if (target) {
          detailData = target;
        } else {
          setError('未找到匹配结果');
          setLoading(false);
          return;
        }
      }
      // 未指定源和id，使用第一个源，但需要确保有完整数据
      else if (!currentSource || !currentId) {
        if (!detailData.episodes || detailData.episodes.length <= 1) {
          console.log('获取第一个源的详细信息');
          const detailInfo = await fetchSourceDetail(
            detailData.source,
            detailData.id,
          );
          if (detailInfo.length > 0) {
            detailData = detailInfo[0];
            sourcesInfo[0] = detailData;
          }
        }
      }

      // 未指定源和 id 或需要优选，且开启优选开关
      if (
        (!currentSource || !currentId || needPreferRef.current) &&
        optimizationEnabled
      ) {
        setLoadingStage('preferring');
        setLoadingMessage('⚡ 正在优选最佳播放源...');

        // 在优选前，确保所有源都有完整的详情数据（最多10个）
        const sourcesWithDetails = await Promise.all(
          sourcesInfo.slice(0, 10).map(async (source) => {
            // 如果episodes数据不完整，获取详情
            if (!source.episodes || source.episodes.length <= 1) {
              try {
                const detailInfo = await fetchSourceDetail(
                  source.source,
                  source.id,
                );
                return detailInfo.length > 0 ? detailInfo[0] : source;
              } catch (err) {
                console.warn(`获取源 ${source.source} 详情失败:`, err);
                return source;
              }
            }
            return source;
          }),
        );

        detailData = await preferBestSource(sourcesWithDetails);

        // 将优选的源移到列表最前面
        const reorderedSources = [
          detailData,
          ...sourcesWithDetails.filter(
            (s) => !(s.source === detailData.source && s.id === detailData.id),
          ),
        ];
        setAvailableSources(reorderedSources);
      }

      // 无论是否优选，都要确保 availableSources 包含所有搜索到的源
      // 如果上面的优选逻辑没有执行，这里会设置 availableSources
      if (
        !optimizationEnabled ||
        (currentSource && currentId && !needPreferRef.current)
      ) {
        // 确保不超过10个源
        setAvailableSources(sourcesInfo.slice(0, 10));
      }

      setNeedPrefer(false);
      setCurrentSource(detailData.source);
      setCurrentId(detailData.id);
      setVideoYear(detailData.year);
      setVideoTitle(detailData.title || videoTitleRef.current);
      setVideoCover(detailData.poster);
      setVideoDoubanId(detailData.douban_id || 0);
      setDetail(detailData);
      if (currentEpisodeIndex >= detailData.episodes.length) {
        setCurrentEpisodeIndex(0);
      }

      // 规范URL参数
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('source', detailData.source);
      newUrl.searchParams.set('id', detailData.id);
      newUrl.searchParams.set('year', detailData.year);
      newUrl.searchParams.set('title', detailData.title);
      newUrl.searchParams.delete('prefer');
      window.history.replaceState({}, '', newUrl.toString());

      setLoadingStage('ready');
      setLoadingMessage('✨ 准备就绪，即将开始播放...');

      // 立即开始播放，无需延迟
      setLoading(false);
    };

    initAll();
  }, [shortdramaId]);

  // 播放记录处理
  useEffect(() => {
    // 仅在初次挂载时检查播放记录
    const initFromHistory = async () => {
      if (!currentSource || !currentId) return;

      try {
        const allRecords = await getAllPlayRecords();
        const key = generateStorageKey(currentSource, currentId);
        const record = allRecords[key];

        if (record) {
          const targetIndex = record.index - 1;
          const targetTime = record.play_time;

          // 更新当前选集索引
          if (targetIndex !== currentEpisodeIndex) {
            setCurrentEpisodeIndex(targetIndex);
          }

          // 保存待恢复的播放进度，待播放器就绪后跳转
          resumeTimeRef.current = targetTime;
        }
      } catch (err) {
        console.error('读取播放记录失败:', err);
      }
    };

    initFromHistory();
  }, []);

  // 跳过片头片尾配置处理
  useEffect(() => {
    // 仅在初次挂载时检查跳过片头片尾配置
    const initSkipConfig = async () => {
      if (!currentSource || !currentId) return;

      try {
        const config = await getSkipConfig(currentSource, currentId);
        if (config) {
          setSkipConfig(config);
        }
      } catch (err) {
        console.error('读取跳过片头片尾配置失败:', err);
      }
    };

    initSkipConfig();
  }, []);

  // 处理换源
  const handleSourceChange = async (
    newSource: string,
    newId: string,
    newTitle: string,
  ) => {
    try {
      // 显示换源加载状态
      setVideoLoadingStage('sourceChanging');
      setIsVideoLoading(true);

      // 记录当前播放进度（仅在同一集数切换时恢复）
      const currentPlayTime = artPlayerRef.current?.currentTime || 0;

      // 清除前一个历史记录
      if (currentSourceRef.current && currentIdRef.current) {
        try {
          await deletePlayRecord(
            currentSourceRef.current,
            currentIdRef.current,
          );
        } catch (err) {
          console.error('清除播放记录失败:', err);
        }
      }

      // 清除并设置下一个跳过片头片尾配置
      if (currentSourceRef.current && currentIdRef.current) {
        try {
          await deleteSkipConfig(
            currentSourceRef.current,
            currentIdRef.current,
          );
          await saveSkipConfig(newSource, newId, skipConfigRef.current);
        } catch (err) {
          console.error('清除跳过片头片尾配置失败:', err);
        }
      }

      let newDetail = availableSources.find(
        (source) => source.source === newSource && source.id === newId,
      );

      if (!newDetail) {
        setError('未找到匹配结果');
        setIsVideoLoading(false);
        return;
      }

      // 如果详情数据不完整，获取完整详情
      if (!newDetail.episodes || newDetail.episodes.length <= 1) {
        console.log('获取换源的详细信息:', newSource, newId);
        try {
          const detailResponse = await fetch(
            `/api/detail?source=${encodeURIComponent(
              newSource,
            )}&id=${encodeURIComponent(newId)}`,
          );
          if (detailResponse.ok) {
            const detailData = (await detailResponse.json()) as SearchResult;
            newDetail = detailData;

            // 更新 availableSources 中的数据
            const index = availableSources.findIndex(
              (s) => s.source === newSource && s.id === newId,
            );
            if (index >= 0) {
              const updatedSources = [...availableSources];
              updatedSources[index] = detailData;
              setAvailableSources(updatedSources);
            }
          }
        } catch (err) {
          console.error('获取详情失败:', err);
          setError('获取播放源详情失败');
          setIsVideoLoading(false);
          return;
        }
      }

      // 尝试跳转到当前正在播放的集数
      let targetIndex = currentEpisodeIndex;

      // 如果当前集数超出新源的范围，则跳转到第一集
      if (!newDetail.episodes || targetIndex >= newDetail.episodes.length) {
        targetIndex = 0;
      }

      // 如果仍然是同一集数且播放进度有效，则在播放器就绪后恢复到原始进度
      if (targetIndex !== currentEpisodeIndex) {
        resumeTimeRef.current = 0;
      } else if (
        (!resumeTimeRef.current || resumeTimeRef.current === 0) &&
        currentPlayTime > 1
      ) {
        resumeTimeRef.current = currentPlayTime;
      }

      // 更新URL参数（不刷新页面）
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('source', newSource);
      newUrl.searchParams.set('id', newId);
      newUrl.searchParams.set('year', newDetail.year);
      window.history.replaceState({}, '', newUrl.toString());

      setVideoTitle(newDetail.title || newTitle);
      setVideoYear(newDetail.year);
      setVideoCover(newDetail.poster);
      setVideoDoubanId(newDetail.douban_id || 0);
      setCurrentSource(newSource);
      setCurrentId(newId);
      setDetail(newDetail);
      setCurrentEpisodeIndex(targetIndex);
    } catch (err) {
      // 隐藏换源加载状态
      setIsVideoLoading(false);
      setError(err instanceof Error ? err.message : '换源失败');
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts);
    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 集数切换
  // ---------------------------------------------------------------------------
  // 处理集数切换
  const handleEpisodeChange = (episodeNumber: number) => {
    if (episodeNumber >= 0 && episodeNumber < totalEpisodes) {
      // 在更换集数前保存当前播放进度
      if (artPlayerRef.current && artPlayerRef.current.paused) {
        saveCurrentPlayProgress();
      }
      setCurrentEpisodeIndex(episodeNumber);
    }
  };

  const handlePreviousEpisode = () => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx > 0) {
      if (artPlayerRef.current && !artPlayerRef.current.paused) {
        saveCurrentPlayProgress();
      }
      setCurrentEpisodeIndex(idx - 1);
    }
  };

  const handleNextEpisode = () => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx < d.episodes.length - 1) {
      if (artPlayerRef.current && !artPlayerRef.current.paused) {
        saveCurrentPlayProgress();
      }
      setCurrentEpisodeIndex(idx + 1);
    }
  };

  // ---------------------------------------------------------------------------
  // 键盘快捷键
  // ---------------------------------------------------------------------------
  // 处理全局快捷键
  const handleKeyboardShortcuts = (e: KeyboardEvent) => {
    // 忽略输入框中的按键事件
    if (
      (e.target as HTMLElement).tagName === 'INPUT' ||
      (e.target as HTMLElement).tagName === 'TEXTAREA'
    )
      return;

    // Alt + 左箭头 = 上一集
    if (e.altKey && e.key === 'ArrowLeft') {
      if (detailRef.current && currentEpisodeIndexRef.current > 0) {
        handlePreviousEpisode();
        e.preventDefault();
      }
    }

    // Alt + 右箭头 = 下一集
    if (e.altKey && e.key === 'ArrowRight') {
      const d = detailRef.current;
      const idx = currentEpisodeIndexRef.current;
      if (d && idx < d.episodes.length - 1) {
        handleNextEpisode();
        e.preventDefault();
      }
    }

    // 左箭头 = 快退
    if (!e.altKey && e.key === 'ArrowLeft') {
      if (artPlayerRef.current && artPlayerRef.current.currentTime > 5) {
        artPlayerRef.current.currentTime -= 10;
        e.preventDefault();
      }
    }

    // 右箭头 = 快进
    if (!e.altKey && e.key === 'ArrowRight') {
      if (
        artPlayerRef.current &&
        artPlayerRef.current.currentTime < artPlayerRef.current.duration - 5
      ) {
        artPlayerRef.current.currentTime += 10;
        e.preventDefault();
      }
    }

    // 上箭头 = 音量+
    if (e.key === 'ArrowUp') {
      if (artPlayerRef.current && artPlayerRef.current.volume < 1) {
        artPlayerRef.current.volume =
          Math.round((artPlayerRef.current.volume + 0.1) * 10) / 10;
        artPlayerRef.current.notice.show = `音量: ${Math.round(
          artPlayerRef.current.volume * 100,
        )}`;
        e.preventDefault();
      }
    }

    // 下箭头 = 音量-
    if (e.key === 'ArrowDown') {
      if (artPlayerRef.current && artPlayerRef.current.volume > 0) {
        artPlayerRef.current.volume =
          Math.round((artPlayerRef.current.volume - 0.1) * 10) / 10;
        artPlayerRef.current.notice.show = `音量: ${Math.round(
          artPlayerRef.current.volume * 100,
        )}`;
        e.preventDefault();
      }
    }

    // 空格 = 播放/暂停
    if (e.key === ' ') {
      if (artPlayerRef.current) {
        artPlayerRef.current.toggle();
        e.preventDefault();
      }
    }

    // f 键 = 切换全屏
    if (e.key === 'f' || e.key === 'F') {
      if (artPlayerRef.current) {
        artPlayerRef.current.fullscreen = !artPlayerRef.current.fullscreen;
        e.preventDefault();
      }
    }
  };

  // ---------------------------------------------------------------------------
  // 播放记录相关
  // ---------------------------------------------------------------------------
  // 保存播放进度
  const saveCurrentPlayProgress = async () => {
    if (
      !artPlayerRef.current ||
      !currentSourceRef.current ||
      !currentIdRef.current ||
      !videoTitleRef.current ||
      !detailRef.current?.source_name
    ) {
      return;
    }

    const player = artPlayerRef.current;
    const currentTime = player.currentTime || 0;
    const duration = player.duration || 0;

    // 如果播放时间太短（少于5秒）或者视频时长无效，不保存
    if (currentTime < 1 || !duration) {
      return;
    }

    try {
      await savePlayRecord(currentSourceRef.current, currentIdRef.current, {
        title: videoTitleRef.current,
        source_name: detailRef.current?.source_name || '',
        year: detailRef.current?.year,
        cover: detailRef.current?.poster || '',
        index: currentEpisodeIndexRef.current + 1, // 转换为1基索引
        total_episodes: detailRef.current?.episodes.length || 1,
        play_time: Math.floor(currentTime),
        total_time: Math.floor(duration),
        save_time: Date.now(),
        search_title: searchTitle,
      });

      lastSaveTimeRef.current = Date.now();
    } catch (err) {
      console.error('保存播放进度失败:', err);
    }
  };

  useEffect(() => {
    // 页面即将卸载时保存播放进度和清理资源
    const handleBeforeUnload = () => {
      saveCurrentPlayProgress();
      releaseWakeLock();
      cleanupPlayer();
    };

    // 页面可见性变化时保存播放进度和释放 Wake Lock
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentPlayProgress();
        releaseWakeLock();
      } else if (document.visibilityState === 'visible') {
        // 页面重新可见时，如果正在播放则重新请求 Wake Lock
        if (artPlayerRef.current && !artPlayerRef.current.paused) {
          requestWakeLock();
        }
      }
    };

    // 添加事件监听器
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // 清理事件监听器
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentEpisodeIndex, detail, artPlayerRef.current]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 收藏相关
  // ---------------------------------------------------------------------------
  // 每当 source 或 id 变化时检查收藏状态
  useEffect(() => {
    if (!currentSource || !currentId) return;
    (async () => {
      try {
        const fav = await isFavorited(currentSource, currentId);
        setFavorited(fav);
      } catch (err) {
        console.error('检查收藏状态失败:', err);
      }
    })();
  }, [currentSource, currentId]);

  // 监听收藏数据更新事件
  useEffect(() => {
    if (!currentSource || !currentId) return;

    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (favorites: Record<string, any>) => {
        const key = generateStorageKey(currentSource, currentId);
        const isFav = !!favorites[key];
        setFavorited(isFav);
      },
    );

    return unsubscribe;
  }, [currentSource, currentId]);

  // 切换收藏
  const handleToggleFavorite = async () => {
    if (
      !videoTitleRef.current ||
      !detailRef.current ||
      !currentSourceRef.current ||
      !currentIdRef.current
    )
      return;

    try {
      if (favorited) {
        // 如果已收藏，删除收藏
        await deleteFavorite(currentSourceRef.current, currentIdRef.current);
        setFavorited(false);
      } else {
        // 如果未收藏，添加收藏
        await saveFavorite(currentSourceRef.current, currentIdRef.current, {
          title: videoTitleRef.current,
          source_name: detailRef.current?.source_name || '',
          year: detailRef.current?.year,
          cover: detailRef.current?.poster || '',
          total_episodes: detailRef.current?.episodes.length || 1,
          save_time: Date.now(),
          search_title: searchTitle,
        });
        setFavorited(true);
      }
    } catch (err) {
      console.error('切换收藏失败:', err);
    }
  };

  useEffect(() => {
    if (
      !dynamicDeps?.Artplayer ||
      !dynamicDeps?.Hls ||
      !dynamicDeps?.artplayerPluginDanmuku ||
      !videoUrl ||
      loading ||
      currentEpisodeIndex === null ||
      !artRef.current
    ) {
      return;
    }

    const { Artplayer, Hls, artplayerPluginDanmuku } = dynamicDeps;

    // 确保选集索引有效
    if (
      !detail ||
      !detail.episodes ||
      currentEpisodeIndex >= detail.episodes.length ||
      currentEpisodeIndex < 0
    ) {
      setError(`选集索引无效，当前共 ${totalEpisodes} 集`);
      return;
    }

    if (!videoUrl) {
      setError('视频地址无效');
      return;
    }

    // 检测是否为WebKit浏览器
    const isWebkit =
      typeof window !== 'undefined' &&
      typeof (window as any).webkitConvertPointFromNodeToPage === 'function';

    // 检测是否为移动端设备
    const isMobile =
      typeof window !== 'undefined' &&
      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      ) ||
        window.innerWidth <= 768);

    // 根据设备类型调整弹幕配置
    const getDanmuConfig = () => {
      if (isMobile) {
        return {
          fontSize: 20, // 移动端字体稍小
          margin: [5, '20%'], // 移动端边距更小
          minWidth: 150, // 移动端最小宽度更小
          maxWidth: 300, // 移动端最大宽度限制
          maxlength: 30, // 移动端字符长度限制
          placeholder: '发弹幕~', // 移动端简化提示文字
        };
      } else {
        return {
          fontSize: 25, // 桌面端正常字体
          margin: [10, '25%'], // 桌面端正常边距
          minWidth: 200, // 桌面端最小宽度
          maxWidth: 500, // 桌面端最大宽度
          maxlength: 50, // 桌面端字符长度
          placeholder: '发个弹幕呗~', // 桌面端完整提示文字
        };
      }
    };

    const danmuConfig = getDanmuConfig();

    // 非WebKit浏览器且播放器已存在，使用switch方法切换
    if (!isWebkit && artPlayerRef.current) {
      artPlayerRef.current.switch = videoUrl;
      artPlayerRef.current.title = `${videoTitle} - 第${
        currentEpisodeIndex + 1
      }集`;
      artPlayerRef.current.poster = videoCover;
      if (artPlayerRef.current?.video) {
        ensureVideoSource(
          artPlayerRef.current.video as HTMLVideoElement,
          videoUrl,
        );
      }
      return;
    }

    // WebKit浏览器或首次创建：销毁之前的播放器实例并创建新的
    if (artPlayerRef.current) {
      cleanupPlayer();
    }

    try {
      // 创建新的播放器实例
      Artplayer.PLAYBACK_RATE = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
      Artplayer.USE_RAF = true;

      // 生成当前视频的唯一ID
      const currentVideoId = generateVideoId(
        currentSourceRef.current,
        currentIdRef.current,
        currentEpisodeIndex,
      );

      artPlayerRef.current = new Artplayer({
        container: artRef.current,
        url: videoUrl,
        poster: videoCover,
        volume: 0.7,
        isLive: false,
        muted: false,
        autoplay: true,
        pip: true,
        autoSize: false,
        autoMini: false,
        screenshot: false,
        setting: true,
        loop: false,
        flip: false,
        playbackRate: true,
        aspectRatio: false,
        fullscreen: true,
        fullscreenWeb: true,
        subtitleOffset: false,
        miniProgressBar: false,
        mutex: true,
        playsInline: true,
        autoPlayback: false,
        airplay: true,
        theme: '#3b82f6',
        lang: 'zh-cn',
        hotkey: false,
        fastForward: true,
        autoOrientation: true,
        lock: true,
        moreVideoAttr: {
          crossOrigin: 'anonymous',
        },
        // HLS 支持配置
        customType: {
          m3u8: function (video: HTMLVideoElement, url: string) {
            if (!Hls) {
              console.error('HLS.js 未加载');
              return;
            }

            if (video.hls) {
              video.hls.destroy();
            }

            // 针对短剧的特殊配置
            const isShortDrama = currentSourceRef.current === 'shortdrama';
            const hlsConfig: any = {
              debug: false,
              enableWorker: true,
              lowLatencyMode: !isShortDrama,

              /* 缓冲/内存相关 */
              maxBufferLength: isShortDrama ? 20 : 30,
              backBufferLength: isShortDrama ? 15 : 30,
              maxBufferSize: isShortDrama ? 40 * 1000 * 1000 : 60 * 1000 * 1000,

              /* 网络相关 */
              manifestLoadingTimeOut: isShortDrama ? 20000 : 10000,
              manifestLoadingMaxRetry: isShortDrama ? 4 : 1,
              levelLoadingTimeOut: isShortDrama ? 20000 : 10000,
              levelLoadingMaxRetry: isShortDrama ? 4 : 3,
              fragLoadingTimeOut: isShortDrama ? 30000 : 20000,
              fragLoadingMaxRetry: isShortDrama ? 6 : 3,
            };

            // 如果开启去广告，使用自定义加载器
            if (blockAdEnabledRef.current) {
              const CustomHlsJsLoader = createCustomHlsJsLoader(Hls);
              hlsConfig.loader = CustomHlsJsLoader;
            }

            const hls = new Hls(hlsConfig);

            hls.loadSource(url);
            hls.attachMedia(video);
            video.hls = hls;

            ensureVideoSource(video, url);

            hls.on(Hls.Events.ERROR, function (event: any, data: any) {
              // 只处理致命错误
              if (data?.fatal) {
                const errorInfo = {
                  type: data.type,
                  details: data.details,
                  fatal: data.fatal,
                  isShortDrama,
                  url: url.includes('/api/proxy/m3u8')
                    ? '代理地址'
                    : '原始地址',
                };
                console.error('HLS致命错误:', errorInfo);

                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    if (isShortDrama && data.details === 'manifestLoadError') {
                      // 短剧清单加载失败，尝试重新加载
                      setTimeout(() => {
                        if (hls && !hls.destroyed) {
                          hls.startLoad();
                        }
                      }, 1000);
                    } else {
                      hls.startLoad();
                    }
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    hls.recoverMediaError();
                    break;
                  default:
                    if (isShortDrama) {
                      // 短剧播放失败时给出更明确的提示
                      artPlayerRef.current?.notice?.show?.(
                        `短剧播放出错: ${data.details || '未知错误'}`,
                      );
                    }
                    hls.destroy();
                    break;
                }
              } else {
                // 非致命错误，记录但继续播放
                console.warn('HLS非致命错误:', errorInfo);
              }
            });
          },
        },
        icons: {
          loading:
            '<img src="/img/loading.svg" style="width: 84px; height: 21px;">',
        },
        plugins: danmuEnabled
          ? [
              artplayerPluginDanmuku({
                danmuku: async () => {
                  try {
                    const danmuData = await loadDanmuData(currentVideoId);
                    return danmuData;
                  } catch (error) {
                    console.error('加载弹幕失败:', error);
                    return [];
                  }
                },
                speed: isMobile ? 4 : 5, // 移动端弹幕速度稍慢
                opacity: 1,
                fontSize: danmuConfig.fontSize,
                color: '#FFFFFF',
                mode: 0,
                margin: danmuConfig.margin,
                antiOverlap: true,
                useWorker: true,
                synchronousPlayback: false,
                filter: (danmu: any) =>
                  danmu.text.length < (isMobile ? 30 : 50),
                lockTime: isMobile ? 3 : 5, // 移动端锁定时间更短
                maxLength: isMobile ? 80 : 100, // 移动端最大长度限制
                minWidth: danmuConfig.minWidth,
                maxWidth: danmuConfig.maxWidth,
                theme: 'dark',
                // 核心配置：启用弹幕发送功能
                panel: true, // 启用弹幕输入面板
                emit: true, // 启用弹幕发送
                placeholder: danmuConfig.placeholder,
                maxlength: danmuConfig.maxlength,
                // 移动端专用配置
                ...(isMobile && {
                  panelStyle: {
                    fontSize: '14px',
                    padding: '8px 12px',
                    borderRadius: '20px',
                    background: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    outline: 'none',
                    width: '100%',
                    maxWidth: '280px',
                    boxSizing: 'border-box',
                  },
                  buttonStyle: {
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '16px',
                    background: 'linear-gradient(45deg, #3b82f6, #1d4ed8)',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    marginLeft: '8px',
                    minWidth: '50px',
                    outline: 'none',
                  },
                }),
                beforeVisible: (danmu: any) => {
                  return !danmu.text.includes('广告');
                },
                beforeEmit: async (danmu: any) => {
                  try {
                    await sendDanmu(currentVideoId, {
                      text: danmu.text,
                      color: danmu.color || '#FFFFFF',
                      mode: danmu.mode || 0,
                      time: artPlayerRef.current?.currentTime || 0,
                    });

                    // 显示成功提示
                    if (artPlayerRef.current?.notice) {
                      artPlayerRef.current.notice.show = '✅ 弹幕发送成功！';
                    }

                    // 创建符合插件要求的弹幕对象
                    const danmuObject = {
                      text: danmu.text,
                      color: danmu.color || '#FFFFFF',
                      mode: danmu.mode || 0,
                      time: (artPlayerRef.current?.currentTime || 0) + 0.5,
                      border: false,
                      size: isMobile ? 18 : 25, // 移动端弹幕字体更小
                    };

                    // 手动触发弹幕显示（如果beforeEmit的返回值不能正常显示）
                    // 这是一个备用方案
                    setTimeout(() => {
                      try {
                        const danmakuPlugin =
                          artPlayerRef.current?.plugins?.artplayerPluginDanmuku;
                        if (danmakuPlugin) {
                          // 确保弹幕未被隐藏
                          try {
                            if (danmakuPlugin.isHide && danmakuPlugin.show) {
                              danmakuPlugin.show();
                            }
                          } catch (e) {
                            // 忽略弹幕显示错误
                          }

                          // 尝试不同的方法来添加弹幕
                          if (danmakuPlugin.emit) {
                            danmakuPlugin.emit(danmuObject);
                          } else if (danmakuPlugin.add) {
                            danmakuPlugin.add(danmuObject);
                          } else if (danmakuPlugin.send) {
                            danmakuPlugin.send(danmuObject);
                          }
                        }
                      } catch (err) {
                        console.error('❌ 手动添加弹幕失败:', err);
                      }
                    }, 200);

                    // 返回弹幕对象让插件自动处理
                    return danmuObject;
                  } catch (error) {
                    console.error('发送弹幕失败:', error);

                    // 显示错误提示
                    if (artPlayerRef.current?.notice) {
                      artPlayerRef.current.notice.show =
                        '❌ 发送弹幕失败：' + (error as any).message;
                    }

                    // 阻止弹幕显示
                    throw error;
                  }
                },
              }),
            ]
          : [],
        settings: [
          {
            html: '去广告',
            icon: '<text x="50%" y="50%" font-size="20" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="#ffffff">AD</text>',
            tooltip: blockAdEnabled ? '已开启' : '已关闭',
            onClick() {
              const newVal = !blockAdEnabled;
              try {
                localStorage.setItem('enable_blockad', String(newVal));
                if (artPlayerRef.current) {
                  resumeTimeRef.current = artPlayerRef.current.currentTime;
                  if (
                    artPlayerRef.current.video &&
                    artPlayerRef.current.video.hls
                  ) {
                    artPlayerRef.current.video.hls.destroy();
                  }
                  artPlayerRef.current.destroy();
                  artPlayerRef.current = null;
                }
                setBlockAdEnabled(newVal);
              } catch (_) {
                // ignore
              }
              return newVal ? '当前开启' : '当前关闭';
            },
          },
          {
            html: '弹幕设置',
            icon: '<text x="50%" y="50%" font-size="18" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="#ffffff">弹</text>',
            tooltip: danmuEnabled ? '弹幕已开启' : '弹幕已关闭',
            onClick() {
              const newVal = !danmuEnabled;
              try {
                localStorage.setItem('enableDanmu', String(newVal));
                if (artPlayerRef.current) {
                  resumeTimeRef.current = artPlayerRef.current.currentTime;
                  if (
                    artPlayerRef.current.video &&
                    artPlayerRef.current.video.hls
                  ) {
                    artPlayerRef.current.video.hls.destroy();
                  }
                  artPlayerRef.current.destroy();
                  artPlayerRef.current = null;
                }
                setDanmuEnabled(newVal);
              } catch (_) {
                // ignore
              }
              return newVal ? '弹幕已开启' : '弹幕已关闭';
            },
          },

          {
            name: '跳过片头片尾',
            html: '跳过片头片尾',
            switch: skipConfigRef.current.enable,
            onSwitch: function (item: any) {
              const newConfig = {
                ...skipConfigRef.current,
                enable: !item.switch,
              };
              handleSkipConfigChange(newConfig);
              return !item.switch;
            },
          },
          {
            html: '删除跳过配置',
            onClick: function () {
              handleSkipConfigChange({
                enable: false,
                intro_time: 0,
                outro_time: 0,
              });
              return '';
            },
          },
          {
            name: '设置片头',
            html: '设置片头',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="2" fill="#ffffff"/><path d="M9 12L17 12" stroke="#ffffff" stroke-width="2"/><path d="M17 6L17 18" stroke="#ffffff" stroke-width="2"/></svg>',
            tooltip:
              skipConfigRef.current.intro_time === 0
                ? '设置片头时间'
                : `${formatTime(skipConfigRef.current.intro_time)}`,
            onClick: function () {
              const currentTime = artPlayerRef.current?.currentTime || 0;
              if (currentTime > 0) {
                const newConfig = {
                  ...skipConfigRef.current,
                  intro_time: currentTime,
                };
                handleSkipConfigChange(newConfig);
                return `${formatTime(currentTime)}`;
              }
            },
          },
          {
            name: '设置片尾',
            html: '设置片尾',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 6L7 18" stroke="#ffffff" stroke-width="2"/><path d="M7 12L15 12" stroke="#ffffff" stroke-width="2"/><circle cx="19" cy="12" r="2" fill="#ffffff"/></svg>',
            tooltip:
              skipConfigRef.current.outro_time >= 0
                ? '设置片尾时间'
                : `-${formatTime(-skipConfigRef.current.outro_time)}`,
            onClick: function () {
              const outroTime =
                -(
                  artPlayerRef.current?.duration -
                  artPlayerRef.current?.currentTime
                ) || 0;
              if (outroTime < 0) {
                const newConfig = {
                  ...skipConfigRef.current,
                  outro_time: outroTime,
                };
                handleSkipConfigChange(newConfig);
                return `-${formatTime(-outroTime)}`;
              }
            },
          },
        ],
        // 控制栏配置
        controls: [
          {
            position: 'left',
            index: 13,
            html: '<i class="art-icon flex"><svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor"/></svg></i>',
            tooltip: '播放下一集',
            click: function () {
              handleNextEpisode();
            },
          },
        ],
      });

      // 监听播放器事件
      artPlayerRef.current.on('ready', () => {
        setError(null);

        // 检查弹幕插件是否正确加载
        if (danmuEnabled) {
          // 弹幕启用，无需调试日志
        }

        // 播放器就绪后，如果正在播放则请求 Wake Lock
        if (artPlayerRef.current && !artPlayerRef.current.paused) {
          requestWakeLock();
        }
      });

      // 监听播放状态变化，控制 Wake Lock
      artPlayerRef.current.on('play', () => {
        requestWakeLock();
      });

      artPlayerRef.current.on('pause', () => {
        releaseWakeLock();
        saveCurrentPlayProgress();
      });

      artPlayerRef.current.on('video:ended', () => {
        releaseWakeLock();
      });

      // 如果播放器初始化时已经在播放状态，则请求 Wake Lock
      if (artPlayerRef.current && !artPlayerRef.current.paused) {
        requestWakeLock();
      }

      artPlayerRef.current.on('video:volumechange', () => {
        lastVolumeRef.current = artPlayerRef.current.volume;
      });
      artPlayerRef.current.on('video:ratechange', () => {
        lastPlaybackRateRef.current = artPlayerRef.current.playbackRate;
      });

      // 监听视频可播放事件，这时恢复播放进度更可靠
      artPlayerRef.current.on('video:canplay', () => {
        // 若存在需要恢复的播放进度，则跳转
        if (resumeTimeRef.current && resumeTimeRef.current > 0) {
          try {
            const duration = artPlayerRef.current.duration || 0;
            let target = resumeTimeRef.current;
            if (duration && target >= duration - 2) {
              target = Math.max(0, duration - 5);
            }
            artPlayerRef.current.currentTime = target;
          } catch (err) {
            console.warn('恢复播放进度失败:', err);
          }
        }
        resumeTimeRef.current = null;

        setTimeout(() => {
          if (
            Math.abs(artPlayerRef.current.volume - lastVolumeRef.current) > 0.01
          ) {
            artPlayerRef.current.volume = lastVolumeRef.current;
          }
          if (
            Math.abs(
              artPlayerRef.current.playbackRate - lastPlaybackRateRef.current,
            ) > 0.01 &&
            isWebkit
          ) {
            artPlayerRef.current.playbackRate = lastPlaybackRateRef.current;
          }
          artPlayerRef.current.notice.show = '';
        }, 0);

        // 隐藏换源加载状态
        setIsVideoLoading(false);
      });

      // 监听视频时间更新事件，实现跳过片头片尾
      artPlayerRef.current.on('video:timeupdate', () => {
        if (!skipConfigRef.current.enable) return;

        const currentTime = artPlayerRef.current.currentTime || 0;
        const duration = artPlayerRef.current.duration || 0;
        const now = Date.now();

        // 限制跳过检查频率为1.5秒一次
        if (now - lastSkipCheckRef.current < 1500) return;
        lastSkipCheckRef.current = now;

        // 跳过片头
        if (
          skipConfigRef.current.intro_time > 0 &&
          currentTime < skipConfigRef.current.intro_time
        ) {
          artPlayerRef.current.currentTime = skipConfigRef.current.intro_time;
          artPlayerRef.current.notice.show = `已跳过片头 (${formatTime(
            skipConfigRef.current.intro_time,
          )})`;
        }

        // 跳过片尾
        if (
          skipConfigRef.current.outro_time < 0 &&
          duration > 0 &&
          currentTime >
            artPlayerRef.current.duration + skipConfigRef.current.outro_time
        ) {
          if (
            currentEpisodeIndexRef.current <
            (detailRef.current?.episodes?.length || 1) - 1
          ) {
            handleNextEpisode();
          } else {
            artPlayerRef.current.pause();
          }
          artPlayerRef.current.notice.show = `已跳过片尾 (${formatTime(
            skipConfigRef.current.outro_time,
          )})`;
        }
      });

      artPlayerRef.current.on('error', (err: any) => {
        const isShortDrama = currentSourceRef.current === 'shortdrama';
        const errorInfo = {
          error: err,
          isShortDrama,
          currentTime: artPlayerRef.current?.currentTime || 0,
          videoUrl: videoUrl.includes('/api/proxy/') ? '代理地址' : '原始地址',
          episode: currentEpisodeIndex + 1,
        };

        console.error('播放器错误:', errorInfo);

        if (isShortDrama) {
          // 短剧播放错误的特殊处理
          console.error('短剧播放错误详情:', {
            source: currentSourceRef.current,
            id: currentIdRef.current,
            episode: currentEpisodeIndex + 1,
            url: videoUrl,
            hasPlayedTime: (artPlayerRef.current?.currentTime || 0) > 0,
          });
        }

        if (artPlayerRef.current.currentTime > 0) {
          return;
        }
      });

      // 监听视频播放结束事件，自动播放下一集
      artPlayerRef.current.on('video:ended', () => {
        const d = detailRef.current;
        const idx = currentEpisodeIndexRef.current;
        if (d && d.episodes && idx < d.episodes.length - 1) {
          setTimeout(() => {
            setCurrentEpisodeIndex(idx + 1);
          }, 1000);
        }
      });

      artPlayerRef.current.on('video:timeupdate', () => {
        const now = Date.now();
        let interval = 5000;
        if (process.env.NEXT_PUBLIC_STORAGE_TYPE === 'upstash') {
          interval = 20000;
        }
        if (now - lastSaveTimeRef.current > interval) {
          saveCurrentPlayProgress();
          lastSaveTimeRef.current = now;
        }
      });

      artPlayerRef.current.on('pause', () => {
        saveCurrentPlayProgress();
      });

      if (artPlayerRef.current?.video) {
        ensureVideoSource(
          artPlayerRef.current.video as HTMLVideoElement,
          videoUrl,
        );
      }
    } catch (err) {
      console.error('创建播放器失败:', err);
      setError('播放器初始化失败');
    }
  }, [
    dynamicDeps,
    videoUrl,
    loading,
    blockAdEnabled,
    danmuEnabled,
    currentEpisodeIndex,
    currentSource,
    currentId,
  ]);

  // 当组件卸载时清理定时器、Wake Lock 和播放器资源
  useEffect(() => {
    return () => {
      // 清理定时器
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }

      // 释放 Wake Lock
      releaseWakeLock();

      // 销毁播放器实例
      cleanupPlayer();
    };
  }, []);

  if (loading) {
    return (
      <PageLayout activePath='/play' disableMobileScroll={true}>
        <div className='fixed inset-0 flex items-center justify-center z-[500] md:static md:min-h-[calc(100vh-3rem)]'>
          <div className='text-center max-w-md mx-auto px-6'>
            {/* 动画加载图标 - 缩小30% */}
            <div className='relative mb-4'>
              <div
                className='relative mx-auto flex items-center justify-center'
                style={{ width: '44.8px', height: '44.8px' }}
              >
                <img
                  src='/img/spinning-circles.svg'
                  alt='Loading'
                  className='w-full h-full'
                />
              </div>
            </div>

            {/* 加载消息 */}
            <div className='mb-2'>
              <p className='text-base font-medium text-gray-800 dark:text-gray-200 animate-pulse'>
                {loadingMessage}
              </p>
            </div>

            {/* 进度指示器 - 移到文字下方，缩小30% */}
            <div>
              <div className='flex justify-center space-x-1.5'>
                <div
                  className={`rounded-full transition-all duration-500 ${
                    loadingStage === 'searching' || loadingStage === 'fetching'
                      ? 'bg-blue-500 scale-125'
                      : loadingStage === 'preferring' ||
                          loadingStage === 'ready'
                        ? 'bg-blue-500'
                        : 'bg-gray-300'
                  }`}
                  style={{ width: '5.6px', height: '5.6px' }}
                ></div>
                <div
                  className={`rounded-full transition-all duration-500 ${
                    loadingStage === 'preferring'
                      ? 'bg-blue-500 scale-125'
                      : loadingStage === 'ready'
                        ? 'bg-blue-500'
                        : 'bg-gray-300'
                  }`}
                  style={{ width: '5.6px', height: '5.6px' }}
                ></div>
                <div
                  className={`rounded-full transition-all duration-500 ${
                    loadingStage === 'ready'
                      ? 'bg-blue-500 scale-125'
                      : 'bg-gray-300'
                  }`}
                  style={{ width: '5.6px', height: '5.6px' }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout activePath='/play' disableMobileScroll={true}>
        <div className='fixed inset-0 flex items-center justify-center z-[500] md:static md:min-h-[calc(100vh-3rem)]'>
          <div className='flex flex-col items-center w-full px-6 md:px-0 md:w-[30vw]'>
            {/* 错误图标 */}
            <div className='relative mb-6'>
              <div className='relative w-16 h-16 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl shadow-lg flex items-center justify-center'>
                <div className='text-white text-3xl'>😵</div>
              </div>
            </div>

            {/* 错误信息 */}
            <div className='space-y-3 mb-6 text-center w-full'>
              <h2 className='text-lg font-bold text-gray-800 dark:text-gray-200'>
                哎呀，出现了一些问题
              </h2>
              <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-5 py-2.5'>
                <p className='text-sm text-red-600 dark:text-red-400 font-medium'>
                  {error}
                </p>
              </div>
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                请检查网络连接或尝试刷新页面
              </p>
            </div>

            {/* 操作按钮 */}
            <div className='flex flex-col md:flex-row gap-2 md:gap-3 w-full'>
              <button
                onClick={() =>
                  videoTitle
                    ? router.push(`/search?q=${encodeURIComponent(videoTitle)}`)
                    : router.back()
                }
                className='flex-1 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-200'
              >
                {videoTitle ? '返回搜索' : '返回上页'}
              </button>

              <button
                onClick={() => window.location.reload()}
                className='flex-1 px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200'
              >
                重新尝试
              </button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activePath='/play'>
      <div className='flex flex-col gap-3 py-6 px-5 lg:px-[3rem] 2xl:px-20'>
        {/* 移动端标题 - 带返回按钮 */}
        <div className='lg:hidden py-1'>
          <div className='flex items-center gap-3'>
            <BackButton />
            <h1 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
              {videoTitle || '影片标题'}
              {totalEpisodes > 1 && (
                <span className='ml-2 font-normal text-gray-500 dark:text-gray-400'>
                  {` ${
                    detail?.episodes_titles?.[currentEpisodeIndex] ||
                    `第 ${currentEpisodeIndex + 1} 集`
                  }`}
                </span>
              )}
            </h1>
          </div>
        </div>

        {/* 播放器和选集 */}
        <div className='space-y-2'>
          {/* 桌面端：返回按钮、标题和折叠控制 - 仅在 lg 及以上屏幕显示 */}
          <div className='hidden lg:flex items-center justify-between py-1'>
            {/* 左侧：返回按钮和标题 */}
            <div className='flex items-center gap-3'>
              <BackButton />
              <h1 className='text-xl font-semibold text-gray-900 dark:text-gray-100 leading-none'>
                {videoTitle || '影片标题'}
                {totalEpisodes > 1 && (
                  <span className='ml-2 font-normal text-gray-500 dark:text-gray-400'>
                    {` ${
                      detail?.episodes_titles?.[currentEpisodeIndex] ||
                      `第 ${currentEpisodeIndex + 1} 集`
                    }`}
                  </span>
                )}
              </h1>
            </div>

            {/* 右侧：折叠控制按钮 */}
            <button
              onClick={() =>
                setIsEpisodeSelectorCollapsed(!isEpisodeSelectorCollapsed)
              }
              className='group flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 transition-all duration-200'
              title={
                isEpisodeSelectorCollapsed ? '显示选集面板' : '隐藏选集面板'
              }
            >
              <svg
                className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all duration-200 ${
                  isEpisodeSelectorCollapsed ? 'rotate-180' : 'rotate-0'
                }`}
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M9 5l7 7-7 7'
                />
              </svg>
              <span className='text-xs font-medium text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 leading-none transition-colors duration-200'>
                {isEpisodeSelectorCollapsed ? '显示' : '隐藏'}
              </span>
            </button>
          </div>

          <div
            className={`grid gap-4 lg:h-[500px] xl:h-[650px] 2xl:h-[750px] transition-all duration-300 ease-in-out ${
              isEpisodeSelectorCollapsed
                ? 'grid-cols-1'
                : 'grid-cols-1 md:grid-cols-4'
            }`}
          >
            {/* 播放器 */}
            <div
              className={`h-full transition-all duration-300 ease-in-out rounded-xl border border-white/0 dark:border-white/30 ${
                isEpisodeSelectorCollapsed ? 'col-span-1' : 'md:col-span-3'
              }`}
            >
              <div className='relative w-full aspect-video lg:aspect-auto lg:h-full'>
                <div
                  ref={artRef}
                  className='bg-black w-full h-full rounded-xl overflow-hidden shadow-lg'
                ></div>

                {/* 换源加载蒙层 */}
                {isVideoLoading && (
                  <div className='absolute inset-0 bg-black/85 backdrop-blur-sm rounded-xl flex items-center justify-center z-[500] transition-all duration-300'>
                    <div className='text-center'>
                      {/* 加载动画 */}
                      <div className='mb-2 flex justify-center'>
                        <img
                          src='/img/loading.svg'
                          alt='Loading'
                          width='60'
                          height='15'
                        />
                      </div>

                      {/* 加载消息 */}
                      <p className='text-base font-medium text-white animate-pulse'>
                        {videoLoadingStage === 'sourceChanging'
                          ? '切换播放源...'
                          : '视频加载中...'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 选集和换源 - 在移动端始终显示，在 lg 及以上可折叠 */}
            <div
              className={`h-[300px] lg:h-full overflow-hidden transition-all duration-300 ease-in-out ${
                isEpisodeSelectorCollapsed
                  ? 'md:col-span-1 lg:hidden lg:opacity-0 lg:scale-95'
                  : 'md:col-span-1 lg:opacity-100 lg:scale-100'
              }`}
            >
              <EpisodeSelector
                totalEpisodes={totalEpisodes}
                episodes_titles={detail?.episodes_titles || []}
                value={currentEpisodeIndex + 1}
                onChange={handleEpisodeChange}
                onSourceChange={handleSourceChange}
                currentSource={currentSource}
                currentId={currentId}
                videoTitle={searchTitle || videoTitle}
                availableSources={availableSources}
                sourceSearchLoading={sourceSearchLoading}
                sourceSearchError={sourceSearchError}
                precomputedVideoInfo={precomputedVideoInfo}
              />
            </div>
          </div>
        </div>

        {/* 详情展示 */}
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
          {/* 文字区 */}
          <div className='md:col-span-3'>
            <div className='p-6 flex flex-col min-h-0'>
              {/* 标题 */}
              <h1 className='text-3xl font-bold mb-2 tracking-wide flex items-center flex-shrink-0 text-center md:text-left w-full'>
                {videoTitle || '影片标题'}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFavorite();
                  }}
                  className='ml-3 flex-shrink-0 hover:opacity-80 transition-opacity'
                >
                  <FavoriteIcon filled={favorited} />
                </button>
              </h1>

              {/* 关键信息行 */}
              <div className='flex flex-wrap items-center gap-3 text-base mb-4 opacity-80 flex-shrink-0'>
                {detail?.class && (
                  <span className='text-blue-600 font-semibold'>
                    {detail.class}
                  </span>
                )}
                {(detail?.year || videoYear) && (
                  <span>{detail?.year || videoYear}</span>
                )}
                {detail?.source_name && (
                  <span className='border border-gray-500/60 px-2 py-[1px] rounded'>
                    {detail.source_name}
                  </span>
                )}
                {detail?.type_name && <span>{detail.type_name}</span>}
              </div>

              {/* 短剧专用标签展示 */}
              {shortdramaId && (vodClass || vodTag) && (
                <div className='mb-4 flex-shrink-0'>
                  <div className='flex flex-wrap items-center gap-2'>
                    {/* vod_class 标签 - 分类标签 */}
                    {vodClass && (
                      <div className='flex items-center gap-1'>
                        <span className='text-xs text-gray-500 dark:text-gray-400 font-medium'>
                          分类:
                        </span>
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getTagColor(
                            vodClass,
                            true,
                          )}`}
                        >
                          📂 {vodClass}
                        </span>
                      </div>
                    )}

                    {/* vod_tag 标签 - 内容标签 */}
                    {vodTag && parseVodTags(vodTag).length > 0 && (
                      <div className='flex items-center gap-1 flex-wrap'>
                        <span className='text-xs text-gray-500 dark:text-gray-400 font-medium'>
                          标签:
                        </span>
                        {parseVodTags(vodTag).map((tag, index) => (
                          <span
                            key={index}
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getTagColor(
                              tag,
                              false,
                            )}`}
                          >
                            🏷️ {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* 剧情简介 */}
              {detail?.desc && (
                <div
                  className='mt-0 text-base leading-relaxed opacity-90 overflow-y-auto flex-1 min-h-0 scrollbar-hide text-justify-multiline'
                  style={{ whiteSpace: 'pre-line' }}
                >
                  {detail.desc}
                </div>
              )}
            </div>
          </div>

          {/* 封面展示 */}
          <div className='hidden md:block md:col-span-1 md:order-first'>
            <div className='pl-0 py-4 pr-6'>
              <div className='relative bg-gray-300 dark:bg-gray-700 aspect-[2/3] flex items-center justify-center rounded-xl overflow-hidden'>
                <img
                  src={
                    videoCover
                      ? processImageUrl(videoCover)
                      : '/img/placeholder-minimal.svg'
                  }
                  alt={videoTitle}
                  className='w-full h-full object-cover'
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== '/img/placeholder-minimal.svg') {
                      target.src = '/img/placeholder-minimal.svg';
                    }
                  }}
                />

                {/* 豆瓣链接按钮 */}
                {videoCover && videoDoubanId !== 0 && (
                  <a
                    href={`https://movie.douban.com/subject/${videoDoubanId.toString()}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='absolute top-3 left-3'
                  >
                    <div className='bg-blue-500 text-white text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-md hover:bg-blue-600 hover:scale-[1.1] transition-all duration-300 ease-out'>
                      <svg
                        width='16'
                        height='16'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      >
                        <path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'></path>
                        <path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'></path>
                      </svg>
                    </div>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

// FavoriteIcon 组件
const FavoriteIcon = ({ filled }: { filled: boolean }) => {
  if (filled) {
    return (
      <svg
        className='h-7 w-7'
        viewBox='0 0 24 24'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path
          d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
          fill='#ef4444' /* Tailwind red-500 */
          stroke='#ef4444'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    );
  }
  return (
    <Heart className='h-7 w-7 stroke-[1] text-gray-600 dark:text-gray-300' />
  );
};

export default function PlayPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PlayPageClient />
    </Suspense>
  );
}
