import { NextRequest, NextResponse } from 'next/server';

import { API_CONFIG } from '@/lib/config';

// 转换外部API数据格式到内部格式
function transformExternalData(externalItem: unknown) {
  return {
    id: externalItem.id
      ? externalItem.id.toString()
      : externalItem.vod_id?.toString() || '',
    vod_id: externalItem.vod_id || externalItem.id,
    name: externalItem.vod_name || externalItem.name || '',
    cover: externalItem.vod_pic || externalItem.cover || '',
    update_time: externalItem.vod_time || externalItem.update_time || '',
    score: externalItem.vod_score || externalItem.score || 0,
    total_episodes: externalItem.vod_total || externalItem.total_episodes || '',
    vod_class: externalItem.vod_class || '',
    vod_tag: externalItem.vod_tag || '',
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';

    // 使用 /vod/recommend 端点，请求更多数据
    const baseUrl = API_CONFIG.shortdrama.baseUrl;
    console.log('[短剧最新API] 使用的baseUrl:', baseUrl);
    const apiUrl = `${baseUrl}/vod/recommend?page=${page}&size=25`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        ...API_CONFIG.shortdrama.headers,
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 403) {
      console.error('[短剧最新API] 403错误 - 可能被防火墙阻止');
      throw new Error('访问被拒绝，请检查服务器网络配置');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[短剧API] 请求失败: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `API请求失败: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const externalData = await response.json();

    // 处理 items 格式的响应
    if (
      externalData &&
      externalData.items &&
      Array.isArray(externalData.items)
    ) {
      const transformedData = externalData.items.map(transformExternalData);
      return NextResponse.json(transformedData);
    }

    console.error('[短剧最新API] 响应格式无效');
    return NextResponse.json(
      { error: '短剧API响应格式无效', data: externalData },
      { status: 500 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[短剧最新API] 错误:', errorMessage);

    return NextResponse.json(
      {
        error: '短剧数据加载失败',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
