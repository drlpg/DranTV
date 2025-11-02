import { NextRequest, NextResponse } from 'next/server';

import { API_CONFIG } from '@/lib/config';

// 转换外部API数据格式到内部格式
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformExternalData(externalItem: any) {
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

    // 使用 Cloudflare Workers 代理
    const baseUrl = 'https://shortdrama-proxy.danranlpg.workers.dev';
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

    if (!response.ok) {
      const errorText = await response.text();
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

    return NextResponse.json(
      { error: '短剧API响应格式无效', data: externalData },
      { status: 500 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: '短剧数据加载失败',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
