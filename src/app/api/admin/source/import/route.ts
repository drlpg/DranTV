import { NextRequest, NextResponse } from 'next/server';

import { checkAuth } from '@/lib/auth';
import { getAdminConfig, saveAdminConfig } from '@/lib/config';

// 解析M3U格式的视频源列表
function parseM3U(
  content: string
): Array<{ name: string; key: string; api: string }> {
  const sources: Array<{ name: string; key: string; api: string }> = [];
  const lines = content.split('\n').map((line) => line.trim());

  let currentName = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 解析 #EXTINF 行获取名称
    if (line.startsWith('#EXTINF:')) {
      const match = line.match(/#EXTINF:[^,]*,(.+)/);
      if (match) {
        currentName = match[1].trim();
      }
    }
    // 解析 URL 行
    else if (line && !line.startsWith('#')) {
      if (currentName) {
        // 生成key（使用名称的拼音或简化版本）
        const key = currentName
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
          .substring(0, 20);

        sources.push({
          name: currentName,
          key: key || `source_${sources.length + 1}`,
          api: line,
        });
        currentName = '';
      } else {
        // 没有名称，使用URL作为名称
        const urlName =
          line.split('/').pop()?.split('?')[0] || `视频源${sources.length + 1}`;
        sources.push({
          name: urlName,
          key: `source_${sources.length + 1}`,
          api: line,
        });
      }
    }
  }

  return sources;
}

// 解析TXT格式的视频源列表
function parseTXT(
  content: string
): Array<{ name: string; key: string; api: string }> {
  const sources: Array<{ name: string; key: string; api: string }> = [];
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  for (const line of lines) {
    // 支持多种格式：
    // 1. name=url
    // 2. name,url
    // 3. 直接URL
    if (line.includes('=')) {
      const [name, api] = line.split('=').map((s) => s.trim());
      if (name && api) {
        const key = name
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
          .substring(0, 20);
        sources.push({ name, key: key || `source_${sources.length + 1}`, api });
      }
    } else if (line.includes(',')) {
      const [name, api] = line.split(',').map((s) => s.trim());
      if (name && api) {
        const key = name
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
          .substring(0, 20);
        sources.push({ name, key: key || `source_${sources.length + 1}`, api });
      }
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      // 直接URL，使用URL作为名称
      const urlName =
        line.split('/').pop()?.split('?')[0] || `视频源${sources.length + 1}`;
      sources.push({
        name: urlName,
        key: `source_${sources.length + 1}`,
        api: line,
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
    console.log(`[Source Import] 开始从URL拉取视频源配置: ${url}`);

    // 添加30秒超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

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
        throw new Error('请求超时，请检查订阅链接是否可访问');
      }
      throw error;
    }

    const configContent = await response.text();
    let format = 'unknown';
    let sources: Array<{
      name: string;
      key: string;
      api: string;
      disabled?: boolean;
      from: 'config' | 'custom' | 'subscription';
    }> = [];

    // 尝试解析为JSON
    try {
      const jsonData = JSON.parse(configContent);
      format = 'json';

      // 支持多种JSON格式
      if (Array.isArray(jsonData)) {
        // 直接是数组
        sources = jsonData.map((item, index) => ({
          name: item.name || `视频源${index + 1}`,
          key: item.key || `source_${index + 1}`,
          api: item.api || item.url || '',
          detail: item.detail,
          disabled: item.disabled || false,
          from: 'subscription' as const,
        }));
      } else if (jsonData.api_site) {
        // config.json格式
        sources = Object.entries(jsonData.api_site).map(
          ([key, value]: [string, any]) => ({
            name: value.name || key,
            key,
            api: value.api || value.url || '',
            detail: value.detail,
            disabled: value.disabled || false,
            from: 'subscription' as const,
          })
        );
      } else if (jsonData.sources) {
        // 包含sources字段
        sources = jsonData.sources.map((item: any, index: number) => ({
          name: item.name || `视频源${index + 1}`,
          key: item.key || `source_${index + 1}`,
          api: item.api || item.url || '',
          detail: item.detail,
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
        // M3U格式
        format = 'm3u';
        const parsedSources = parseM3U(configContent);
        sources = parsedSources.map((item) => ({
          ...item,
          disabled: false,
          from: 'subscription' as const,
        }));
      } else {
        // TXT格式
        format = 'txt';
        const parsedSources = parseTXT(configContent);
        sources = parsedSources.map((item) => ({
          ...item,
          disabled: false,
          from: 'subscription' as const,
        }));
      }
    }

    if (sources.length === 0) {
      return NextResponse.json(
        { error: '未能从配置中解析出视频源数据' },
        { status: 400 }
      );
    }

    // 获取当前配置
    const adminConfig = await getAdminConfig();
    const existingSources = adminConfig.SourceConfig || [];

    // 合并视频源（避免重复）
    const existingKeys = new Set(existingSources.map((s) => s.key));
    const newSources = sources.filter((s) => !existingKeys.has(s.key));

    if (newSources.length === 0) {
      return NextResponse.json(
        { error: '所有视频源已存在，没有新增内容' },
        { status: 400 }
      );
    }

    // 更新配置
    adminConfig.SourceConfig = [...existingSources, ...newSources];

    // 如果需要保存订阅配置
    if (saveSubscription) {
      adminConfig.SourceSubscription = {
        URL: url,
        AutoUpdate: autoUpdate || false,
        LastCheck: new Date().toISOString(),
      };
    }

    await saveAdminConfig(adminConfig);

    console.log(`成功导入 ${newSources.length} 个视频源，格式: ${format}`);

    return NextResponse.json({
      success: true,
      message: `成功导入 ${newSources.length} 个视频源`,
      format,
      sources: newSources,
      total: adminConfig.SourceConfig.length,
      config: adminConfig, // 返回更新后的配置，避免前端重新请求
    });
  } catch (error) {
    console.error('导入视频源失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '导入失败',
      },
      { status: 500 }
    );
  }
}
