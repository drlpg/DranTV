import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/lib/config';

// 转换外部API数据格式到内部格式
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

    // 使用 /vod/recommend 端点
    const apiUrl = `${API_CONFIG.shortdrama.baseUrl}/vod/recommend?page=${page}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: API_CONFIG.shortdrama.headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
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

    throw new Error('Invalid response format from external API');
  } catch (error) {
    console.error('Short drama latest API error:', error);

    // 返回空数据作为备用
    const mockDataRaw = Array.from({ length: 25 }, (_, index) => {
      return {
        id: `mock_id_${index + 100}`,
        vod_id: index + 100,
        vod_name: '',
        vod_pic: '',
        vod_time: '',
        vod_score: 0,
        vod_total: '',
        vod_class: '',
        vod_tag: '',
      };
    });

    const mockData = mockDataRaw.map(transformExternalData);
    return NextResponse.json(mockData);
  }
}
