/* eslint-disable no-constant-condition */

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

const defaultUA = 'AptvPlayer/1.4.10';

export interface LiveChannels {
  channelNumber: number;
  channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
    resolution?: string;
  }[];
  epgUrl: string;
  epgs: {
    [key: string]: {
      start: string;
      end: string;
      title: string;
    }[];
  };
}

const cachedLiveChannels: { [key: string]: LiveChannels } = {};

export function deleteCachedLiveChannels(key: string) {
  delete cachedLiveChannels[key];
}

export function clearAllCachedLiveChannels() {
  const keys = Object.keys(cachedLiveChannels);
  keys.forEach((key) => delete cachedLiveChannels[key]);
}

export async function getCachedLiveChannels(
  key: string
): Promise<LiveChannels | null> {
  const startTime = Date.now();
  console.log('[Live] ========== 开始获取频道缓存 ==========');
  console.log('[Live] 时间:', new Date().toISOString());
  console.log('[Live] 直播源Key:', key);

  // 如果没有缓存，先从M3U加载
  if (!cachedLiveChannels[key]) {
    console.log('[Live] 内存中无缓存，需要加载M3U');
    let config;
    try {
      console.log('[Live] 开始获取配置...');
      config = await getConfig();
      console.log('[Live] 配置获取成功');
    } catch (configError) {
      console.error('[Live] 获取配置失败:', configError);
      throw new Error(
        `无法获取配置: ${
          configError instanceof Error ? configError.message : '未知错误'
        }`
      );
    }

    console.log('[Live] 查找直播源配置...');
    const liveInfo = config.LiveConfig?.find((live) => live.key === key);
    if (!liveInfo) {
      console.error('[Live] 直播源不存在:', key);
      console.error(
        '[Live] 可用的直播源:',
        config.LiveConfig?.map((l) => l.key).join(', ')
      );
      throw new Error(`直播源 "${key}" 不存在`);
    }
    console.log('[Live] 找到直播源配置:', liveInfo.name);

    try {
      console.log('[Live] 开始刷新直播频道...');
      const channelNum = await refreshLiveChannels(liveInfo);
      console.log('[Live] 刷新完成，频道数:', channelNum);
      if (channelNum === 0) {
        console.warn('[Live] 频道数为0');
        console.log(
          '[Live] 获取频道缓存完成（空），总耗时:',
          Date.now() - startTime,
          'ms'
        );
        console.log('[Live] ========== 获取频道缓存结束 ==========');
        return null;
      }
    } catch (error) {
      console.error('[Live] 刷新直播源失败:', error);
      console.error(
        '[Live] 错误堆栈:',
        error instanceof Error ? error.stack : 'N/A'
      );
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      throw new Error(`刷新直播源失败: ${errorMsg}`);
    }
  } else {
    console.log('[Live] 使用内存缓存');
  }

  // 每次都检查数据库中是否有保存的修改版本（优先使用）
  console.log('[Live] 检查数据库中的保存版本...');
  const dbKey = `live_channels_${key}`;
  const savedChannels = await db.get(dbKey);

  if (savedChannels) {
    console.log('[Live] 找到数据库保存的频道数据');
    try {
      const parsedChannels = JSON.parse(savedChannels);
      console.log(
        '[Live] 解析保存的频道数据成功，频道数:',
        parsedChannels.length
      );
      // 使用保存的频道列表替换缓存中的频道列表
      if (cachedLiveChannels[key]) {
        cachedLiveChannels[key] = {
          ...cachedLiveChannels[key],
          channels: parsedChannels,
          channelNumber: parsedChannels.filter((ch: any) => !ch.disabled)
            .length,
        };
        console.log('[Live] 已更新缓存为保存的版本');
      }
    } catch (error) {
      // 如果解析失败，使用原始缓存
      console.error('[Live] 解析保存的频道数据失败:', error);
    }
  } else {
    console.log('[Live] 数据库中无保存的频道数据');
  }

  const result = cachedLiveChannels[key] || null;
  console.log(
    '[Live] 返回频道数据:',
    result ? `${result.channels.length}个频道` : 'null'
  );
  console.log('[Live] 获取频道缓存完成，总耗时:', Date.now() - startTime, 'ms');
  console.log('[Live] ========== 获取频道缓存结束 ==========');
  return result;
}

export async function refreshLiveChannels(liveInfo: {
  key: string;
  name: string;
  url: string;
  ua?: string;
  epg?: string;
  from: 'config' | 'custom' | 'subscription';
  channelNumber?: number;
  disabled?: boolean;
}): Promise<number> {
  const startTime = Date.now();
  console.log('[Live Refresh] ========== 开始刷新直播频道 ==========');
  console.log('[Live Refresh] 时间:', new Date().toISOString());
  console.log(
    '[Live Refresh] 直播源:',
    liveInfo.name,
    '(' + liveInfo.key + ')'
  );
  console.log('[Live Refresh] M3U URL:', liveInfo.url);

  // 不删除现有缓存，如果刷新失败可以继续使用旧数据
  const hasCache = !!cachedLiveChannels[liveInfo.key];
  console.log('[Live Refresh] 是否有缓存:', hasCache);

  const ua = liveInfo.ua || defaultUA;
  console.log('[Live Refresh] User-Agent:', ua);

  try {
    let data: string;

    // 1. 检查是否是数据库API端点
    if (liveInfo.url.includes('/api/live/m3u?key=')) {
      console.log('[Live Refresh] 从数据库获取M3U内容');
      const key = liveInfo.url.split('key=')[1];
      const content = await db.get(`live_m3u_${key}`);
      if (!content) {
        console.error('[Live Refresh] 数据库中没有M3U内容:', key);
        throw new Error(`数据库中没有M3U内容: ${key}`);
      }
      console.log('[Live Refresh] M3U内容长度:', content.length);
      data = content;
    }
    // 2. 检查是否是相对路径（以/开头但不是完整URL）
    else if (liveInfo.url.startsWith('/') && !liveInfo.url.startsWith('//')) {
      console.log('[Live Refresh] 使用相对路径');
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}${liveInfo.url}`;
      console.log('[Live Refresh] 完整URL:', fullUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        console.log('[Live Refresh] 开始请求M3U文件...');
        const response = await fetch(fullUrl, {
          headers: { 'User-Agent': ua },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        console.log(
          '[Live Refresh] 响应状态:',
          response.status,
          response.statusText
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        data = await response.text();
        console.log('[Live Refresh] M3U内容长度:', data.length);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.error('[Live Refresh] 请求失败:', fetchError);
        if (hasCache) {
          console.warn('[Live Refresh] 使用缓存数据');
          return cachedLiveChannels[liveInfo.key].channelNumber;
        }
        throw fetchError;
      }
    }
    // 3. 网络URL
    else {
      console.log('[Live Refresh] 使用网络URL');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      let response;
      try {
        console.log('[Live Refresh] 开始请求M3U文件...');
        response = await fetch(liveInfo.url, {
          headers: {
            'User-Agent': ua,
          },
          signal: controller.signal,
        });
        console.log(
          '[Live Refresh] 响应状态:',
          response.status,
          response.statusText
        );
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.error('[Live Refresh] 请求失败:', fetchError);
        const errorMsg =
          fetchError instanceof Error ? fetchError.message : '网络请求失败';

        if (hasCache) {
          console.warn('[Live Refresh] 使用缓存数据');
          return cachedLiveChannels[liveInfo.key].channelNumber;
        }

        throw new Error(`无法访问M3U文件: ${errorMsg}`);
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        console.error('[Live Refresh] 响应错误:', errorMsg);

        if (hasCache) {
          console.warn('[Live Refresh] 使用缓存数据');
          return cachedLiveChannels[liveInfo.key].channelNumber;
        }

        throw new Error(errorMsg);
      }

      data = await response.text();
      console.log('[Live Refresh] M3U内容长度:', data.length);
    }

    console.log('[Live Refresh] 开始解析M3U内容...');
    const result = parseM3U(liveInfo.key, data);
    console.log('[Live Refresh] M3U解析完成，频道数:', result.channels.length);

    // 跳过EPG解析以加快刷新速度
    const epgUrl = liveInfo.epg || result.tvgUrl;
    const epgs = {};

    // EPG可以在后台异步加载，不阻塞刷新
    if (epgUrl) {
      console.log('[Live Refresh] EPG URL:', epgUrl);
      parseEpg(
        epgUrl,
        liveInfo.ua || defaultUA,
        result.channels.map((channel) => channel.tvgId).filter((tvgId) => tvgId)
      ).catch(() => {
        // 静默处理EPG解析失败
        console.warn('[Live Refresh] EPG解析失败（静默处理）');
      });
    } else {
      console.log('[Live Refresh] 无EPG URL');
    }

    cachedLiveChannels[liveInfo.key] = {
      channelNumber: result.channels.length,
      channels: result.channels,
      epgUrl: epgUrl,
      epgs: epgs,
    };
    console.log('[Live Refresh] 频道数据已缓存');

    console.log(
      '[Live Refresh] 刷新完成，总耗时:',
      Date.now() - startTime,
      'ms'
    );
    console.log('[Live Refresh] ========== 刷新直播频道结束 ==========');
    return result.channels.length;
  } catch (error) {
    console.error('[Live Refresh] ========== 发生错误 ==========');
    console.error('[Live Refresh] 刷新失败:', error);
    console.error(
      '[Live Refresh] 错误堆栈:',
      error instanceof Error ? error.stack : 'N/A'
    );
    console.error('[Live Refresh] 总耗时:', Date.now() - startTime, 'ms');

    // 如果有缓存，返回缓存的频道数，不抛出错误
    if (hasCache && cachedLiveChannels[liveInfo.key]) {
      console.warn('[Live Refresh] 使用缓存数据');
      console.warn(
        '[Live Refresh] ========== 刷新直播频道结束（使用缓存） =========='
      );
      return cachedLiveChannels[liveInfo.key].channelNumber;
    }

    // 没有缓存时才抛出错误
    console.error(
      '[Live Refresh] ========== 刷新直播频道结束（失败） =========='
    );
    throw error;
  }
}

async function parseEpg(
  epgUrl: string,
  ua: string,
  tvgIds: string[]
): Promise<{
  [key: string]: {
    start: string;
    end: string;
    title: string;
  }[];
}> {
  if (!epgUrl) {
    return {};
  }

  const tvgs = new Set(tvgIds);
  const result: {
    [key: string]: { start: string; end: string; title: string }[];
  } = {};

  try {
    const response = await fetch(epgUrl, {
      headers: {
        'User-Agent': ua,
      },
    });
    if (!response.ok) {
      return {};
    }

    // 使用 ReadableStream 逐行处理，避免将整个文件加载到内存
    const reader = response.body?.getReader();
    if (!reader) {
      return {};
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let currentTvgId = '';
    let currentProgram: { start: string; end: string; title: string } | null =
      null;
    let shouldSkipCurrentProgram = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // 保留最后一行（可能不完整）
      buffer = lines.pop() || '';

      // 处理完整的行
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // 解析 <programme> 标签
        if (trimmedLine.startsWith('<programme')) {
          // 提取 tvg-id
          const tvgIdMatch = trimmedLine.match(/channel="([^"]*)"/);
          currentTvgId = tvgIdMatch ? tvgIdMatch[1] : '';

          // 提取开始时间
          const startMatch = trimmedLine.match(/start="([^"]*)"/);
          const start = startMatch ? startMatch[1] : '';

          // 提取结束时间
          const endMatch = trimmedLine.match(/stop="([^"]*)"/);
          const end = endMatch ? endMatch[1] : '';

          if (currentTvgId && start && end) {
            currentProgram = { start, end, title: '' };
            // 优化：如果当前频道不在我们关注的列表中，标记为跳过
            shouldSkipCurrentProgram = !tvgs.has(currentTvgId);
          }
        }
        // 解析 <title> 标签 - 只有在需要解析当前节目时才处理
        else if (
          trimmedLine.startsWith('<title') &&
          currentProgram &&
          !shouldSkipCurrentProgram
        ) {
          // 处理带有语言属性的title标签，如 <title lang="zh">远方的家2025-60</title>
          const titleMatch = trimmedLine.match(
            /<title(?:\s+[^>]*)?>(.*?)<\/title>/
          );
          if (titleMatch && currentProgram) {
            currentProgram.title = titleMatch[1];

            // 保存节目信息（这里不需要再检查tvgs.has，因为shouldSkipCurrentProgram已经确保了相关性）
            if (!result[currentTvgId]) {
              result[currentTvgId] = [];
            }
            result[currentTvgId].push({ ...currentProgram });

            currentProgram = null;
          }
        }
        // 处理 </programme> 标签
        else if (trimmedLine === '</programme>') {
          currentProgram = null;
          currentTvgId = '';
          shouldSkipCurrentProgram = false; // 重置跳过标志
        }
      }
    }
  } catch (error) {
    // ignore
  }

  return result;
}

/**
 * 解析M3U文件内容，提取频道信息
 * @param m3uContent M3U文件的内容字符串
 * @returns 频道信息数组
 */
function parseM3U(
  sourceKey: string,
  m3uContent: string
): {
  tvgUrl: string;
  channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
    resolution?: string;
  }[];
} {
  const channels: {
    id: string;
    tvgId: string;
    name: string;
    logo: string;
    group: string;
    url: string;
    resolution?: string;
  }[] = [];

  // 提取分辨率的辅助函数
  const extractResolution = (text: string): string | undefined => {
    const resolutionMatch = text.match(/(\d{3,4}[pP]|4K|8K|HD|FHD|UHD)/i);
    if (resolutionMatch) {
      return resolutionMatch[1].toUpperCase();
    }
    return undefined;
  };

  const lines = m3uContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let tvgUrl = '';
  let channelIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检查是否是 #EXTM3U 行，提取 tvg-url
    if (line.startsWith('#EXTM3U')) {
      // 支持两种格式：x-tvg-url 和 url-tvg
      const tvgUrlMatch = line.match(/(?:x-tvg-url|url-tvg)="([^"]*)"/);
      tvgUrl = tvgUrlMatch ? tvgUrlMatch[1].split(',')[0].trim() : '';
      continue;
    }

    // 检查是否是 #EXTINF 行
    if (line.startsWith('#EXTINF:')) {
      // 提取 tvg-id
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
      const tvgId = tvgIdMatch ? tvgIdMatch[1] : '';

      // 提取 tvg-name
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
      const tvgName = tvgNameMatch ? tvgNameMatch[1] : '';

      // 提取 tvg-logo
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
      const logo = tvgLogoMatch ? tvgLogoMatch[1] : '';

      // 提取 group-title
      const groupTitleMatch = line.match(/group-title="([^"]*)"/);
      const group = groupTitleMatch ? groupTitleMatch[1] : '无分组';

      // 提取标题（#EXTINF 行最后的逗号后面的内容）
      const titleMatch = line.match(/,([^,]*)$/);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // 优先使用 tvg-name，如果没有则使用标题
      const name = title || tvgName || '';

      // 检查下一行是否是URL
      if (i + 1 < lines.length && !lines[i + 1].startsWith('#')) {
        const url = lines[i + 1];

        // 只有当有名称和URL时才添加到结果中
        if (name && url) {
          // 尝试从名称或URL中提取分辨率
          const resolution = extractResolution(name) || extractResolution(url);

          channels.push({
            id: `${sourceKey}-${channelIndex}`,
            tvgId,
            name,
            logo,
            group,
            url,
            resolution,
          });
          channelIndex++;
        }

        // 跳过下一行，因为已经处理了
        i++;
      }
    }
  }

  return { tvgUrl, channels };
}

// utils/urlResolver.js
export function resolveUrl(baseUrl: string, relativePath: string) {
  try {
    // 如果已经是完整的 URL，直接返回
    if (
      relativePath.startsWith('http://') ||
      relativePath.startsWith('https://')
    ) {
      return relativePath;
    }

    // 如果是协议相对路径 (//example.com/path)
    if (relativePath.startsWith('//')) {
      const baseUrlObj = new URL(baseUrl);
      return `${baseUrlObj.protocol}${relativePath}`;
    }

    // 使用 URL 构造函数处理相对路径
    const baseUrlObj = new URL(baseUrl);
    const resolvedUrl = new URL(relativePath, baseUrlObj);
    return resolvedUrl.href;
  } catch (error) {
    // 降级处理
    return fallbackUrlResolve(baseUrl, relativePath);
  }
}

function fallbackUrlResolve(baseUrl: string, relativePath: string) {
  // 移除 baseUrl 末尾的文件名，保留目录路径
  let base = baseUrl;
  if (!base.endsWith('/')) {
    base = base.substring(0, base.lastIndexOf('/') + 1);
  }

  // 处理不同类型的相对路径
  if (relativePath.startsWith('/')) {
    // 绝对路径 (/path/to/file)
    const urlObj = new URL(base);
    return `${urlObj.protocol}//${urlObj.host}${relativePath}`;
  } else if (relativePath.startsWith('../')) {
    // 上级目录相对路径 (../path/to/file)
    const segments = base.split('/').filter((s) => s);
    const relativeSegments = relativePath.split('/').filter((s) => s);

    for (const segment of relativeSegments) {
      if (segment === '..') {
        segments.pop();
      } else if (segment !== '.') {
        segments.push(segment);
      }
    }

    const urlObj = new URL(base);
    return `${urlObj.protocol}//${urlObj.host}/${segments.join('/')}`;
  } else {
    // 当前目录相对路径 (file.ts 或 ./file.ts)
    const cleanRelative = relativePath.startsWith('./')
      ? relativePath.slice(2)
      : relativePath;
    return base + cleanRelative;
  }
}

// 获取 M3U8 的基础 URL
export function getBaseUrl(m3u8Url: string) {
  try {
    const url = new URL(m3u8Url);
    // 如果 URL 以 .m3u8 结尾，移除文件名
    if (url.pathname.endsWith('.m3u8')) {
      url.pathname = url.pathname.substring(
        0,
        url.pathname.lastIndexOf('/') + 1
      );
    } else if (!url.pathname.endsWith('/')) {
      url.pathname += '/';
    }
    return url.protocol + '//' + url.host + url.pathname;
  } catch (error) {
    return m3u8Url.endsWith('/') ? m3u8Url : m3u8Url + '/';
  }
}
