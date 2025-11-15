/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getCacheTime, getConfig } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { clearSearchCacheByQuery } from '@/lib/search-cache';
import { yellowWords } from '@/lib/yellow';

// 短剧搜索函数
async function searchShortDrama(
  query: string,
  page = 1,
  limit = 20,
): Promise<any[]> {
  try {
    // 使用 AbortController 实现超时控制，增加到 30 秒
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(
      `https://api.r2afosne.dpdns.org/vod/search?name=${encodeURIComponent(
        query,
      )}&page=${page}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'LunaTV/1.0',
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Short drama API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.list || !Array.isArray(data.list)) {
      return [];
    }

    // 将短剧数据转换为统一的搜索结果格式，限制数量避免卡顿
    const limitedResults = data.list.slice(0, limit);
    return limitedResults.map((item: any) => ({
      id: item.id?.toString() || '',
      title: item.name || '',
      poster: item.cover || '',
      year: item.update_time
        ? new Date(item.update_time).getFullYear().toString()
        : 'unknown',
      episodes: [{ id: '1', name: '第1集' }], // 短剧通常有多集，但这里简化处理
      source: 'shortdrama',
      source_name: '短剧',
      douban_id: 0,
      type_name: '短剧',
      // 短剧特有字段
      score: item.score || 0,
      update_time: item.update_time || '',
      vod_class: '',
      vod_tag: '',
    }));
  } catch (error: any) {
    // 只在非超时错误时打印日志
    if (error?.name !== 'AbortError') {
      console.warn('短剧搜索失败:', error);
    }
    return [];
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const clearCache = searchParams.get('clearCache') === 'true';

  // 如果请求清除缓存，先清除
  if (clearCache && query) {
    clearSearchCacheByQuery(query);
  }

  if (!query) {
    const cacheTime = await getCacheTime();
    return NextResponse.json(
      { results: [] },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Netlify-Vary': 'query',
        },
      },
    );
  }

  const config = await getConfig();
  const apiSites = await getAvailableApiSites(authInfo.username);
  const maxTotalResults = (config.SiteConfig.SearchDownstreamMaxPage || 5) * 20;
  const maxResultsPerSource = 5; // 每个源最多返回5个结果

  // 优先执行视频源搜索，添加超时控制和错误处理
  const searchPromises = apiSites.map((site) =>
    Promise.race([
      searchFromApi(site, query),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${site.name} timeout`)), 20000),
      ),
    ])
      .then((results: unknown) => {
        return Array.isArray(results) ? results : [];
      })
      .catch((err) => {
        console.warn(`搜索失败 ${site.name}:`, err.message);
        return []; // 返回空数组而不是抛出错误
      }),
  );

  try {
    // 先等待主要视频源搜索完成
    const results = await Promise.allSettled(searchPromises);
    const successResults = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<any>).value);

    // 限制每个源的结果数量，然后合并
    const limitedResults = successResults.map((sourceResults) =>
      sourceResults.slice(0, maxResultsPerSource),
    );
    let flattenedResults = limitedResults.flat();

    // 过滤黄色内容
    if (!config.SiteConfig.DisableYellowFilter) {
      flattenedResults = flattenedResults.filter((result) => {
        const typeName = result.type_name || '';
        return !yellowWords.some((word: string) => typeName.includes(word));
      });
    }

    // 如果主要搜索结果不足，且未达到限制，尝试添加短剧搜索结果（低优先级）
    if (flattenedResults.length < maxTotalResults) {
      try {
        // 给短剧搜索更短的超时时间（15秒），避免影响主搜索
        const shortDramaResults = await Promise.race([
          searchShortDrama(query, 1, 20),
          new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 15000)),
        ]);

        if (shortDramaResults.length > 0) {
          // 计算还能添加多少短剧结果
          const remainingSlots = maxTotalResults - flattenedResults.length;
          const shortDramaToAdd = shortDramaResults.slice(0, remainingSlots);
          flattenedResults = [...flattenedResults, ...shortDramaToAdd];
        }
      } catch (error: any) {
        // 短剧搜索失败不影响主搜索结果，静默处理
        if (error?.name !== 'AbortError') {
          console.warn('短剧搜索失败（已跳过）:', error.message);
        }
      }
    }

    // 限制总结果数量
    flattenedResults = flattenedResults.slice(0, maxTotalResults);

    const cacheTime = await getCacheTime();

    if (flattenedResults.length === 0) {
      // no cache if empty
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    return NextResponse.json(
      { results: flattenedResults },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Netlify-Vary': 'query',
        },
      },
    );
  } catch (error) {
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }
}
