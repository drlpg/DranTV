import { NextRequest, NextResponse } from 'next/server';

import { checkAuth } from '@/lib/auth';
import { getAdminConfig, saveAdminConfig } from '@/lib/config';
import { refreshLiveChannels } from '@/lib/live';

// 解析M3U格式的直播源列表
function parseM3U(
  content: string,
): Array<{ name: string; key: string; url: string; epg?: string }> {
  const sources: Array<{
    name: string;
    key: string;
    url: string;
    epg?: string;
  }> = [];
  const lines = content.split('\n').map((line) => line.trim());

  let currentName = '';
  let currentEpg = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 解析 #EXTINF 行获取名称和EPG
    if (line.startsWith('#EXTINF:')) {
      const match = line.match(/#EXTINF:[^,]*,(.+)/);
      if (match) {
        currentName = match[1].trim();
      }
      // 尝试提取EPG信息
      const epgMatch = line.match(/tvg-url="([^"]+)"/);
      if (epgMatch) {
        currentEpg = epgMatch[1];
      }
    }
    // 解析 URL 行
    else if (line && !line.startsWith('#')) {
      if (currentName) {
        // 生成key（使用名称的简化版本）
        const key = currentName
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
          .substring(0, 20);

        sources.push({
          name: currentName,
          key: key || `live_${sources.length + 1}`,
          url: line,
          epg: currentEpg || undefined,
        });
        currentName = '';
        currentEpg = '';
      } else {
        // 没有名称，使用URL作为名称
        const urlName =
          line.split('/').pop()?.split('?')[0] || `直播源${sources.length + 1}`;
        sources.push({
          name: urlName,
          key: `live_${sources.length + 1}`,
          url: line,
        });
      }
    }
  }

  return sources;
}

// 解析TXT格式的直播源列表
function parseTXT(
  content: string,
): Array<{ name: string; key: string; url: string; epg?: string }> {
  const sources: Array<{
    name: string;
    key: string;
    url: string;
    epg?: string;
  }> = [];
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  for (const line of lines) {
    // 支持多种格式：
    // 1. name=url
    // 2. name,url
    // 3. name,url,epg
    // 4. 直接URL
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
        });
      }
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      // 直接URL，使用URL作为名称
      const urlName =
        line.split('/').pop()?.split('?')[0] || `直播源${sources.length + 1}`;
      sources.push({
        name: urlName,
        key: `live_${sources.length + 1}`,
        url: line,
      });
    }
  }

  return sources;
}

export async function POST(request: NextRequest) {
  try {
    // 权限检查
    const authResult = await checkAuth(request, ['owner', 'admin']);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json();
    const { url, saveSubscription, autoUpdate } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: '导入URL不能为空' }, { status: 400 });
    }

    // 拉取配置内容
    console.log(`[Live Import] 开始从URL拉取直播源配置: ${url}`);

    // 添加60秒超时（增加超时时间以适应慢速网络）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`拉取失败: HTTP ${response.status}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('请求超时（60秒），请检查订阅链接是否可访问');
      }
      // 静默处理网络错误，避免日志噪音
      if (error instanceof Error && error.message.includes('fetch failed')) {
        throw new Error('网络连接失败，请检查订阅链接');
      }
      throw error;
    }

    const configContent = await response.text();
    let format = 'unknown';
    let sources: Array<{
      name: string;
      key: string;
      url: string;
      ua?: string;
      epg?: string;
      disabled?: boolean;
      from: 'config' | 'custom' | 'subscription';
      channelNumber?: number;
    }> = [];

    // 尝试解析为JSON
    try {
      const jsonData = JSON.parse(configContent);
      format = 'json';

      // 支持多种JSON格式
      if (Array.isArray(jsonData)) {
        // 直接是数组
        sources = jsonData.map((item, index) => ({
          name: item.name || `直播源${index + 1}`,
          key: item.key || `live_${index + 1}`,
          url: item.url || '',
          ua: item.ua,
          epg: item.epg,
          disabled: item.disabled || false,
          from: 'subscription' as const,
        }));
      } else if (jsonData.lives) {
        // config.json格式
        sources = Object.entries(jsonData.lives).map(
          ([key, value]: [string, any]) => ({
            name: value.name || key,
            key,
            url: value.url || '',
            ua: value.ua,
            epg: value.epg,
            disabled: value.disabled || false,
            from: 'subscription' as const,
          }),
        );
      } else if (jsonData.sources) {
        // 包含sources字段
        sources = jsonData.sources.map((item: any, index: number) => ({
          name: item.name || `直播源${index + 1}`,
          key: item.key || `live_${index + 1}`,
          url: item.url || '',
          ua: item.ua,
          epg: item.epg,
          disabled: item.disabled || false,
          from: 'subscription' as const,
        }));
      }
    } catch (e) {
      // 不是JSON格式，尝试其他格式
      if (
        configContent.trim().startsWith('#EXTM3U') ||
        configContent.includes('#EXTINF')
      ) {
        // M3U格式 - 整个M3U文件作为一个直播源
        format = 'm3u';

        // 从URL中提取名称
        const urlParts = url.split('/');
        const fileName = urlParts[urlParts.length - 1].split('?')[0];
        const sourceName =
          fileName.replace(/\.(m3u|m3u8)$/i, '') || '导入的直播源';

        // 生成key（基于URL的hash，确保同一URL总是生成相同的key）
        const urlHash = url.split('').reduce((hash, char) => {
          return (hash << 5) - hash + char.charCodeAt(0);
        }, 0);
        const sourceKey =
          sourceName
            .toLowerCase()
            .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
            .substring(0, 15) + `_${Math.abs(urlHash).toString(36)}`;

        // 提取EPG URL（如果有）
        let epgUrl = '';
        const epgMatch = configContent.match(
          /#EXTM3U[^\n]*(?:x-tvg-url|url-tvg)="([^"]+)"/,
        );
        if (epgMatch) {
          epgUrl = epgMatch[1];
        }

        sources = [
          {
            name: sourceName,
            key: sourceKey,
            url: url, // 使用原始URL，不是解析后的内容
            epg: epgUrl || undefined,
            disabled: false,
            from: 'subscription' as const,
            channelNumber: 0, // 初始为0，将在首次访问或后台任务中更新
          },
        ];
      } else {
        // TXT格式 - 也作为一个直播源（包含多个频道）
        format = 'txt';

        // 从URL中提取名称
        const urlParts = url.split('/');
        const fileName = urlParts[urlParts.length - 1].split('?')[0];
        const sourceName =
          fileName.replace(/\.(txt|m3u|m3u8)$/i, '') || '导入的直播源';

        // 生成key（基于URL的hash，确保同一URL总是生成相同的key）
        const urlHash = url.split('').reduce((hash, char) => {
          return (hash << 5) - hash + char.charCodeAt(0);
        }, 0);
        const sourceKey =
          sourceName
            .toLowerCase()
            .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
            .substring(0, 15) + `_${Math.abs(urlHash).toString(36)}`;

        sources = [
          {
            name: sourceName,
            key: sourceKey,
            url: url, // 使用原始URL
            disabled: false,
            from: 'subscription' as const,
            channelNumber: 0, // 初始为0，将在刷新时更新
          },
        ];
      }
    }

    if (sources.length === 0) {
      return NextResponse.json(
        { error: '未能从配置中解析出直播源数据' },
        { status: 400 },
      );
    }

    // 获取当前配置
    const adminConfig = await getAdminConfig();
    const existingSources = adminConfig.LiveConfig || [];

    // 合并直播源（避免重复）
    const existingKeys = new Set(existingSources.map((s) => s.key));
    const newSources = sources.filter((s) => !existingKeys.has(s.key));

    if (newSources.length === 0) {
      return NextResponse.json(
        { error: '所有直播源已存在，没有新增内容' },
        { status: 400 },
      );
    }

    // 更新配置
    adminConfig.LiveConfig = [...existingSources, ...newSources];

    // 如果需要保存订阅配置
    if (saveSubscription) {
      adminConfig.LiveSubscription = {
        URL: url,
        AutoUpdate: autoUpdate || false,
        LastCheck: new Date().toISOString(),
      };
    }

    console.log(`成功导入 ${newSources.length} 个直播源，格式: ${format}`);

    // 同步刷新频道数（M3U格式）
    if (format === 'm3u') {
      console.log('[Live Import] 开始刷新频道数...');
      await Promise.all(
        newSources.map(async (source) => {
          try {
            const channelCount = await refreshLiveChannels(source);
            source.channelNumber = channelCount;
            console.log(
              `刷新频道数成功: ${source.name} (${channelCount} 个频道)`,
            );
          } catch (error) {
            console.warn(`刷新频道数失败: ${source.name}`, error);
            source.channelNumber = 0;
          }
        }),
      );

      // 更新配置中的频道数
      for (const source of newSources) {
        const liveSource = adminConfig.LiveConfig?.find(
          (s) => s.key === source.key,
        );
        if (liveSource) {
          liveSource.channelNumber = source.channelNumber;
        }
      }
    }

    // 保存更新后的配置
    await saveAdminConfig(adminConfig);

    return NextResponse.json({
      success: true,
      message: `成功导入 ${newSources.length} 个直播源`,
      format,
      sources: newSources,
      total: adminConfig.LiveConfig.length,
      config: adminConfig, // 返回更新后的配置，避免前端重新请求
    });
  } catch (error) {
    console.error('导入直播源失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '导入失败',
      },
      { status: 500 },
    );
  }
}
