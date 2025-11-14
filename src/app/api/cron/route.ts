/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig, refineConfig, setCachedConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { fetchVideoDetail } from '@/lib/fetchVideoDetail';
import { refreshLiveChannels } from '@/lib/live';
import { SearchResult } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  console.log(request.url);
  try {
    console.log('Cron job triggered:', new Date().toISOString());

    cronJob();

    return NextResponse.json({
      success: true,
      message: 'Cron job executed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron job failed:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Cron job failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

async function cronJob() {
  await refreshConfig();
  await refreshSourceSubscription();
  await refreshLiveSubscription();
  await refreshAllLiveChannels();
  await refreshRecordAndFavorites();
}

async function refreshAllLiveChannels() {
  const config = await getConfig();

  // 并发刷新所有启用的直播源
  const refreshPromises = (config.LiveConfig || [])
    .filter((liveInfo) => !liveInfo.disabled)
    .map(async (liveInfo) => {
      try {
        const nums = await refreshLiveChannels(liveInfo);
        liveInfo.channelNumber = nums;
      } catch (error) {
        // 只记录非网络超时的错误，减少日志噪音
        if (
          !(error instanceof Error) ||
          (!error.message.includes('fetch failed') &&
            !error.message.includes('Connect Timeout'))
        ) {
          console.error(
            `刷新直播源失败 [${liveInfo.name || liveInfo.key}]:`,
            error,
          );
        }
        liveInfo.channelNumber = 0;
      }
    });

  // 等待所有刷新任务完成
  await Promise.all(refreshPromises);

  // 保存配置
  await db.saveAdminConfig(config);
}

async function refreshConfig() {
  let config = await getConfig();
  if (
    config &&
    config.ConfigSubscribtion &&
    config.ConfigSubscribtion.URL &&
    config.ConfigSubscribtion.AutoUpdate
  ) {
    try {
      const response = await fetch(config.ConfigSubscribtion.URL);

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status} ${response.statusText}`);
      }

      const configContent = await response.text();

      // 尝试解析配置内容
      let decodedContent;

      // 1. 尝试直接解析为JSON
      try {
        JSON.parse(configContent);
        decodedContent = configContent;
        console.log('配置格式: JSON');
      } catch {
        // 2. 尝试Base58解码
        try {
          const bs58 = (await import('bs58')).default;
          const decodedBytes = bs58.decode(configContent);
          decodedContent = new TextDecoder().decode(decodedBytes);
          JSON.parse(decodedContent); // 验证解码后是否为有效JSON
          console.log('配置格式: Base58');
        } catch {
          // 3. 检查是否为M3U或TXT格式
          if (
            configContent.trim().startsWith('#EXTM3U') ||
            configContent.includes('#EXTINF')
          ) {
            decodedContent = configContent;
            console.log('配置格式: M3U');
          } else if (
            configContent.includes('=') ||
            configContent.split('\n').length > 1
          ) {
            decodedContent = configContent;
            console.log('配置格式: TXT');
          } else {
            throw new Error('无法识别的配置格式');
          }
        }
      }
      config.ConfigFile = decodedContent;
      config.ConfigSubscribtion.LastCheck = new Date().toISOString();
      config = refineConfig(config);
      await db.saveAdminConfig(config);

      // 更新内存缓存
      await setCachedConfig(config);
      console.log('配置文件订阅刷新成功');
    } catch (e) {
      console.error('刷新配置文件订阅失败:', e);
    }
  } else {
    console.log('跳过配置文件订阅刷新：未配置订阅地址或自动更新');
  }
}

// 刷新视频源订阅
async function refreshSourceSubscription() {
  const config = await getConfig();
  if (
    config &&
    config.SourceSubscription &&
    config.SourceSubscription.URL &&
    config.SourceSubscription.AutoUpdate
  ) {
    try {
      console.log(`开始刷新视频源订阅: ${config.SourceSubscription.URL}`);
      const response = await fetch(config.SourceSubscription.URL, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`拉取失败: HTTP ${response.status}`);
      }

      const configContent = await response.text();
      let sources: Array<{
        name: string;
        key: string;
        api: string;
        detail?: string;
        disabled?: boolean;
        from: 'config' | 'custom';
      }> = [];

      // 解析配置内容
      try {
        const jsonData = JSON.parse(configContent);

        if (Array.isArray(jsonData)) {
          sources = jsonData.map((item, index) => ({
            name: item.name || `视频源${index + 1}`,
            key: item.key || `source_${index + 1}`,
            api: item.api || item.url || '',
            detail: item.detail,
            disabled: item.disabled || false,
            from: 'config' as const,
          }));
        } else if (jsonData.api_site) {
          sources = Object.entries(jsonData.api_site).map(
            ([key, value]: [string, any]) => ({
              name: (value as any).name || key,
              key,
              api: (value as any).api || (value as any).url || '',
              detail: (value as any).detail,
              disabled: (value as any).disabled || false,
              from: 'config' as const,
            }),
          );
        } else if (jsonData.sources) {
          sources = jsonData.sources.map((item: any, index: number) => ({
            name: item.name || `视频源${index + 1}`,
            key: item.key || `source_${index + 1}`,
            api: item.api || item.url || '',
            detail: item.detail,
            disabled: item.disabled || false,
            from: 'config' as const,
          }));
        }
      } catch (e) {
        // 非JSON格式，尝试M3U或TXT
        if (
          configContent.trim().startsWith('#EXTM3U') ||
          configContent.includes('#EXTINF')
        ) {
          // M3U格式 - 简化解析
          const lines = configContent.split('\n').map((line) => line.trim());
          let currentName = '';
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('#EXTINF:')) {
              const match = line.match(/#EXTINF:[^,]*,(.+)/);
              if (match) currentName = match[1].trim();
            } else if (line && !line.startsWith('#')) {
              if (currentName) {
                const key = currentName
                  .toLowerCase()
                  .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
                  .substring(0, 20);
                sources.push({
                  name: currentName,
                  key: key || `source_${sources.length + 1}`,
                  api: line,
                  disabled: false,
                  from: 'config',
                });
                currentName = '';
              }
            }
          }
        } else {
          // TXT格式
          const lines = configContent
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#'));
          lines.forEach((line) => {
            if (line.includes('=')) {
              const [name, api] = line.split('=').map((s) => s.trim());
              if (name && api) {
                const key = name
                  .toLowerCase()
                  .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
                  .substring(0, 20);
                sources.push({
                  name,
                  key: key || `source_${sources.length + 1}`,
                  api,
                  disabled: false,
                  from: 'config',
                });
              }
            }
          });
        }
      }

      if (sources.length > 0) {
        const existingSources = config.SourceConfig || [];
        const existingKeys = new Set(existingSources.map((s) => s.key));
        const newSources = sources.filter((s) => !existingKeys.has(s.key));

        if (newSources.length > 0) {
          config.SourceConfig = [...existingSources, ...newSources];
          config.SourceSubscription.LastCheck = new Date().toISOString();
          await db.saveAdminConfig(config);

          await setCachedConfig(config);
          console.log(`视频源订阅刷新成功，新增 ${newSources.length} 个视频源`);
        } else {
          config.SourceSubscription.LastCheck = new Date().toISOString();
          await db.saveAdminConfig(config);
          console.log('视频源订阅刷新完成，无新增内容');
        }
      } else {
        console.log('视频源订阅刷新失败：未解析到视频源数据');
      }
    } catch (e) {
      console.error('刷新视频源订阅失败:', e);
    }
  } else {
    console.log('跳过视频源订阅刷新：未配置订阅地址或自动更新');
  }
}

// 刷新直播源订阅
async function refreshLiveSubscription() {
  const config = await getConfig();
  if (
    config &&
    config.LiveSubscription &&
    config.LiveSubscription.URL &&
    config.LiveSubscription.AutoUpdate
  ) {
    try {
      console.log(`开始刷新直播源订阅: ${config.LiveSubscription.URL}`);
      const response = await fetch(config.LiveSubscription.URL, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`拉取失败: HTTP ${response.status}`);
      }

      const configContent = await response.text();
      let sources: Array<{
        name: string;
        key: string;
        url: string;
        ua?: string;
        epg?: string;
        disabled?: boolean;
        from: 'config' | 'custom';
      }> = [];

      // 解析配置内容
      try {
        const jsonData = JSON.parse(configContent);

        if (Array.isArray(jsonData)) {
          sources = jsonData.map((item, index) => ({
            name: item.name || `直播源${index + 1}`,
            key: item.key || `live_${index + 1}`,
            url: item.url || '',
            ua: item.ua,
            epg: item.epg,
            disabled: item.disabled || false,
            from: 'config' as const,
          }));
        } else if (jsonData.lives) {
          sources = Object.entries(jsonData.lives).map(
            ([key, value]: [string, any]) => ({
              name: (value as any).name || key,
              key,
              url: (value as any).url || '',
              ua: (value as any).ua,
              epg: (value as any).epg,
              disabled: (value as any).disabled || false,
              from: 'config' as const,
            }),
          );
        } else if (jsonData.sources) {
          sources = jsonData.sources.map((item: any, index: number) => ({
            name: item.name || `直播源${index + 1}`,
            key: item.key || `live_${index + 1}`,
            url: item.url || '',
            ua: item.ua,
            epg: item.epg,
            disabled: item.disabled || false,
            from: 'config' as const,
          }));
        }
      } catch (e) {
        // 非JSON格式，尝试M3U或TXT
        if (
          configContent.trim().startsWith('#EXTM3U') ||
          configContent.includes('#EXTINF')
        ) {
          // M3U格式
          const lines = configContent.split('\n').map((line) => line.trim());
          let currentName = '';
          let currentEpg = '';
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('#EXTINF:')) {
              const match = line.match(/#EXTINF:[^,]*,(.+)/);
              if (match) currentName = match[1].trim();
              const epgMatch = line.match(/tvg-url="([^"]+)"/);
              if (epgMatch) currentEpg = epgMatch[1];
            } else if (line && !line.startsWith('#')) {
              if (currentName) {
                const key = currentName
                  .toLowerCase()
                  .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
                  .substring(0, 20);
                sources.push({
                  name: currentName,
                  key: key || `live_${sources.length + 1}`,
                  url: line,
                  epg: currentEpg || undefined,
                  disabled: false,
                  from: 'config',
                });
                currentName = '';
                currentEpg = '';
              }
            }
          }
        } else {
          // TXT格式
          const lines = configContent
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#'));
          lines.forEach((line) => {
            if (line.includes('=')) {
              const parts = line.split('=').map((s) => s.trim());
              const name = parts[0];
              const url = parts[1];
              const epg = parts[2];
              if (name && url) {
                const key = name
                  .toLowerCase()
                  .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
                  .substring(0, 20);
                sources.push({
                  name,
                  key: key || `live_${sources.length + 1}`,
                  url,
                  epg: epg || undefined,
                  disabled: false,
                  from: 'config',
                });
              }
            } else if (line.includes(',')) {
              const parts = line.split(',').map((s) => s.trim());
              const name = parts[0];
              const url = parts[1];
              const epg = parts[2];
              if (name && url) {
                const key = name
                  .toLowerCase()
                  .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
                  .substring(0, 20);
                sources.push({
                  name,
                  key: key || `live_${sources.length + 1}`,
                  url,
                  epg: epg || undefined,
                  disabled: false,
                  from: 'config',
                });
              }
            }
          });
        }
      }

      if (sources.length > 0) {
        const existingSources = config.LiveConfig || [];
        const existingKeys = new Set(existingSources.map((s) => s.key));
        const newSources = sources.filter((s) => !existingKeys.has(s.key));

        if (newSources.length > 0) {
          config.LiveConfig = [
            ...existingSources,
            ...newSources.map((s) => ({ ...s, channelNumber: 0 })),
          ];
          config.LiveSubscription.LastCheck = new Date().toISOString();
          await db.saveAdminConfig(config);

          await setCachedConfig(config);
          console.log(`直播源订阅刷新成功，新增 ${newSources.length} 个直播源`);
        } else {
          config.LiveSubscription.LastCheck = new Date().toISOString();
          await db.saveAdminConfig(config);
          console.log('直播源订阅刷新完成，无新增内容');
        }
      } else {
        console.log('直播源订阅刷新失败：未解析到直播源数据');
      }
    } catch (e) {
      console.error('刷新直播源订阅失败:', e);
    }
  } else {
    console.log('跳过直播源订阅刷新：未配置订阅地址或自动更新');
  }
}

async function refreshRecordAndFavorites() {
  try {
    const users = await db.getAllUsers();
    if (
      process.env.LOGIN_USERNAME &&
      !users.includes(process.env.LOGIN_USERNAME)
    ) {
      users.push(process.env.LOGIN_USERNAME);
    }
    // 函数级缓存：key 为 `${source}+${id}`，值为 Promise<VideoDetail | null>
    const detailCache = new Map<string, Promise<SearchResult | null>>();

    // 获取详情 Promise（带缓存和错误处理）
    const getDetail = async (
      source: string,
      id: string,
      fallbackTitle: string,
    ): Promise<SearchResult | null> => {
      const key = `${source}+${id}`;
      let promise = detailCache.get(key);
      if (!promise) {
        promise = fetchVideoDetail({
          source,
          id,
          fallbackTitle: fallbackTitle.trim(),
        })
          .then((detail) => {
            // 成功时才缓存结果
            const successPromise = Promise.resolve(detail);
            detailCache.set(key, successPromise);
            return detail;
          })
          .catch((err) => {
            console.error(`获取视频详情失败 (${source}+${id}):`, err);
            return null;
          });
      }
      return promise;
    };

    for (const user of users) {
      console.log(`开始处理用户: ${user}`);

      // 播放记录
      try {
        const playRecords = await db.getAllPlayRecords(user);
        const totalRecords = Object.keys(playRecords).length;
        let processedRecords = 0;

        for (const [key, record] of Object.entries(playRecords)) {
          try {
            const [source, id] = key.split('+');
            if (!source || !id) {
              console.warn(`跳过无效的播放记录键: ${key}`);
              continue;
            }

            const detail = await getDetail(source, id, record.title);
            if (!detail) {
              console.warn(`跳过无法获取详情的播放记录: ${key}`);
              continue;
            }

            const episodeCount = detail.episodes?.length || 0;
            if (episodeCount > 0 && episodeCount !== record.total_episodes) {
              await db.savePlayRecord(user, source, id, {
                title: detail.title || record.title,
                source_name: record.source_name,
                cover: detail.poster || record.cover,
                index: record.index,
                total_episodes: episodeCount,
                play_time: record.play_time,
                year: detail.year || record.year,
                total_time: record.total_time,
                save_time: record.save_time,
                search_title: record.search_title,
              });
              console.log(
                `更新播放记录: ${record.title} (${record.total_episodes} -> ${episodeCount})`,
              );
            }

            processedRecords++;
          } catch (err) {
            console.error(`处理播放记录失败 (${key}):`, err);
            // 继续处理下一个记录
          }
        }

        console.log(`播放记录处理完成: ${processedRecords}/${totalRecords}`);
      } catch (err) {
        console.error(`获取用户播放记录失败 (${user}):`, err);
      }

      // 收藏
      try {
        let favorites = await db.getAllFavorites(user);
        favorites = Object.fromEntries(
          Object.entries(favorites).filter(([_, fav]) => fav.origin !== 'live'),
        );
        const totalFavorites = Object.keys(favorites).length;
        let processedFavorites = 0;

        for (const [key, fav] of Object.entries(favorites)) {
          try {
            const [source, id] = key.split('+');
            if (!source || !id) {
              console.warn(`跳过无效的收藏键: ${key}`);
              continue;
            }

            const favDetail = await getDetail(source, id, fav.title);
            if (!favDetail) {
              console.warn(`跳过无法获取详情的收藏: ${key}`);
              continue;
            }

            const favEpisodeCount = favDetail.episodes?.length || 0;
            if (favEpisodeCount > 0 && favEpisodeCount !== fav.total_episodes) {
              await db.saveFavorite(user, source, id, {
                title: favDetail.title || fav.title,
                source_name: fav.source_name,
                cover: favDetail.poster || fav.cover,
                year: favDetail.year || fav.year,
                total_episodes: favEpisodeCount,
                save_time: fav.save_time,
                search_title: fav.search_title,
              });
              console.log(
                `更新收藏: ${fav.title} (${fav.total_episodes} -> ${favEpisodeCount})`,
              );
            }

            processedFavorites++;
          } catch (err) {
            console.error(`处理收藏失败 (${key}):`, err);
            // 继续处理下一个收藏
          }
        }

        console.log(`收藏处理完成: ${processedFavorites}/${totalFavorites}`);
      } catch (err) {
        console.error(`获取用户收藏失败 (${user}):`, err);
      }
    }

    console.log('刷新播放记录/收藏任务完成');
  } catch (err) {
    console.error('刷新播放记录/收藏任务启动失败', err);
  }
}
