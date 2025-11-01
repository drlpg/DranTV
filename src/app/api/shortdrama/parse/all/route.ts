import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id parameter is required' },
        { status: 400 }
      );
    }

    const apiUrl = new URL(`${API_CONFIG.shortdrama.baseUrl}/vod/parse/all`);
    apiUrl.searchParams.append('id', id);
    apiUrl.searchParams.append('proxy', 'true');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 60000);

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: API_CONFIG.shortdrama.headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} - ${response.statusText}`
      );
    }

    const data = await response.json();

    // 检查API返回的错误格式
    if (data.code && data.code !== 0) {
      console.error(`[短剧解析API] API错误: ${data.msg} (ID: ${id})`);
      throw new Error(data.msg || '获取视频详情失败');
    }

    console.log(`[短剧解析API] 响应数据:`, {
      videoId: data?.videoId,
      videoName: data?.videoName,
      totalEpisodes: data?.totalEpisodes,
      resultsLength: data?.results?.length || 0,
    });

    // 验证返回的数据格式
    if (!data || !data.results || !Array.isArray(data.results)) {
      console.error('[短剧解析API] 数据格式无效');
      throw new Error('外部API返回的数据格式不正确');
    }

    // 过滤有效的播放地址
    const validResults = data.results.filter(
      (item: any) =>
        item.status === 'success' &&
        item.parsedUrl &&
        typeof item.parsedUrl === 'string' &&
        item.parsedUrl.trim().length > 0
    );

    console.log(
      `[短剧解析API] 有效播放源: ${validResults.length}/${data.results.length}`
    );

    if (validResults.length === 0) {
      console.error('[短剧解析API] 没有找到任何有效的播放地址');
      throw new Error('所有播放源都无效');
    }

    // 返回处理后的数据
    const processedData = {
      ...data,
      results: validResults,
      totalEpisodes: validResults.length,
      successfulCount: validResults.length,
      originalTotalEpisodes: data.totalEpisodes,
      originalSuccessfulCount: data.successfulCount,
      filteredCount: data.results.length - validResults.length,
    };

    console.log(
      `[短剧解析API] 成功返回: ${processedData.videoName}, ${processedData.totalEpisodes}集`
    );

    return NextResponse.json(processedData);
  } catch (error) {
    const { searchParams: errorSearchParams } = new URL(request.url);
    const errorId = errorSearchParams.get('id');

    console.error('[短剧解析API] 错误:', {
      id: errorId,
      message: error instanceof Error ? error.message : String(error),
    });

    // 分析错误类型
    let errorCategory = '未知错误';
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorCategory = '请求超时';
      } else if (error.message.includes('fetch')) {
        errorCategory = '网络连接错误';
      } else if (error.message.includes('API request failed')) {
        errorCategory = '外部API错误';
      } else if (error.message.includes('Invalid API response format')) {
        errorCategory = '数据格式错误';
      } else if (error.message.includes('No valid video sources found')) {
        errorCategory = '无有效播放源';
      }
    }

    // 返回错误信息
    return NextResponse.json(
      {
        error: '短剧播放地址获取失败',
        message: error instanceof Error ? error.message : String(error),
        errorCategory: errorCategory,
        videoId: errorId,
      },
      { status: 500 }
    );
  }
}
