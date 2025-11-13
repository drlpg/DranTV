import { NextRequest, NextResponse } from 'next/server';

import { API_CONFIG } from '@/lib/config';

export async function GET(_request: NextRequest) {
  try {
    const apiUrl = `${API_CONFIG.shortdrama.baseUrl}/vod/categories`;
    console.log(`[短剧分类API] 请求地址: ${apiUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 增加到15秒

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: API_CONFIG.shortdrama.headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log(`[短剧分类API] 响应状态: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`[短剧分类API] 成功返回数据`);
      return NextResponse.json(data);
    } else {
      const errorText = await response.text();
      console.error(
        `[短剧分类API] 请求失败: ${response.status} - ${errorText}`
      );
      throw new Error(`External API failed: ${response.status}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[短剧分类API] 错误:', errorMessage);

    // 如果外部API失败，返回默认分类数据作为备用
    return NextResponse.json({
      categories: [
        { type_id: 1, type_name: '古装' },
        { type_id: 2, type_name: '现代' },
        { type_id: 3, type_name: '都市' },
        { type_id: 4, type_name: '言情' },
        { type_id: 5, type_name: '悬疑' },
        { type_id: 6, type_name: '喜剧' },
        { type_id: 7, type_name: '其他' },
      ],
      total: 7,
    });
  }
}
