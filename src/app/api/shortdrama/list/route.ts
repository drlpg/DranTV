import { NextRequest, NextResponse } from 'next/server';

import { API_CONFIG } from '@/lib/config';

// 转换外部API数据格式到内部格式 - 分类热搜API直接使用id作为视频ID
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformExternalData(externalItem: any) {
  return {
    id: externalItem.id ? externalItem.id.toString() : '', // 分类热搜API返回的id就是唯一标识
    vod_id: externalItem.id, // 分类热搜API返回的id就是视频ID，用于获取全集地址
    name: externalItem.name || '未知短剧', // 分类热搜API返回的是name
    cover: externalItem.cover || '', // 分类热搜API返回的是cover，为空时不显示占位图
    update_time: externalItem.update_time || new Date().toISOString(), // 分类热搜API返回的是update_time
    score: externalItem.score || 0, // 分类热搜API返回的是score
    total_episodes: '1', // 分类热搜API通常不返回总集数，设为默认值
    vod_class: externalItem.vod_class || '', // 添加分类字段映射
    vod_tag: externalItem.vod_tag || '', // 添加标签字段映射
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const page = searchParams.get('page') || '1';

    if (!categoryId) {
      return NextResponse.json(
        { error: 'categoryId is required' },
        { status: 400 }
      );
    }

    const baseUrl = 'https://shortdrama-proxy.danranlpg.workers.dev';
    const apiUrl = new URL(`${baseUrl}/vod/list`);
    apiUrl.searchParams.append('categoryId', categoryId);
    apiUrl.searchParams.append('page', page);

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

    // 处理外部API响应格式
    if (externalData && externalData.list && Array.isArray(externalData.list)) {
      const transformedList = externalData.list.map(transformExternalData);
      return NextResponse.json({
        total: externalData.total || 0,
        totalPages: externalData.totalPages || externalData.pagecount || 1,
        currentPage: externalData.currentPage || externalData.page || 1,
        list: transformedList,
      });
    } else {
      throw new Error('Invalid response format from external API');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: '短剧列表加载失败',
        message: errorMessage,
        categoryId: request.nextUrl.searchParams.get('categoryId'),
      },
      { status: 500 }
    );
  }
}
