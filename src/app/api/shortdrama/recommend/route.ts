import { NextRequest, NextResponse } from 'next/server';

import { API_CONFIG } from '@/lib/config';

// 转换外部API数据格式到内部格式 - 推荐API通常和分类热搜格式相同
function transformExternalData(externalItem: any) {
  return {
    id: externalItem.vod_id
      ? externalItem.vod_id.toString()
      : externalItem.id?.toString() || '',
    vod_id: externalItem.vod_id, // 推荐API返回的是vod_id
    name: externalItem.vod_name || '未知短剧', // 推荐API返回的是vod_name
    cover: externalItem.vod_pic || 'https://via.placeholder.com/300x400', // 推荐API返回的是vod_pic
    update_time: externalItem.vod_time || new Date().toISOString(), // 推荐API可能不返回时间，使用当前时间
    score: externalItem.vod_score || 0, // 推荐API返回的是vod_score
    total_episodes: externalItem.vod_remarks?.replace(/[^0-9]/g, '') || '1', // 从vod_remarks提取集数
    vod_class: externalItem.vod_class || '', // 添加分类字段映射
    vod_tag: externalItem.vod_tag || '', // 添加标签字段映射
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get('categoryId');
  const size = searchParams.get('size') || '25';

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_SHORTDRAMA_API_URL ||
      'https://shortdrama-proxy.danranlpg.workers.dev';
    const apiUrl = new URL(`${baseUrl}/vod/recommend`);
    if (categoryId) apiUrl.searchParams.append('categoryId', categoryId);
    apiUrl.searchParams.append('size', size);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(apiUrl.toString(), {
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
      throw new Error(`API request failed: ${response.status}`);
    }

    const externalData = await response.json();

    // 处理外部API响应格式 - 推荐API返回的是带有items数组的对象
    if (
      externalData &&
      externalData.items &&
      Array.isArray(externalData.items)
    ) {
      const transformedItems = externalData.items.map(transformExternalData);
      const recommendResponse = {
        mode: externalData.mode || 'random',
        categoryId: externalData.categoryId || 0,
        categoryName: externalData.categoryName || null,
        total: externalData.total || transformedItems.length,
        items: transformedItems,
      };
      return NextResponse.json(recommendResponse);
    } else {
      throw new Error('Invalid response format from external API');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: '短剧推荐加载失败',
        message: errorMessage,
        categoryId: categoryId,
      },
      { status: 500 }
    );
  }
}
