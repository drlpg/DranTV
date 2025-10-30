/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 带缓存的豆瓣API包装器
 * 减少重复请求，提升页面切换速度
 */

import { apiCache } from './simpleCache';
import {
  getDoubanCategories,
  getDoubanList,
  getDoubanRecommends,
} from './douban.client';
import type { DoubanResult } from './types';

/**
 * 生成缓存键
 */
function generateCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return `${prefix}:${sortedParams}`;
}

/**
 * 带缓存的getDoubanCategories
 */
export async function getCachedDoubanCategories(params: {
  kind: 'tv' | 'movie';
  category: string;
  type: string;
}): Promise<DoubanResult> {
  const cacheKey = generateCacheKey('douban:categories', params);

  return apiCache.getOrFetch(
    cacheKey,
    () => getDoubanCategories(params),
    5 * 60 * 1000 // 5分钟缓存
  );
}

/**
 * 带缓存的getDoubanList
 */
export async function getCachedDoubanList(params: any): Promise<DoubanResult> {
  const cacheKey = generateCacheKey('douban:list', params);

  return apiCache.getOrFetch(
    cacheKey,
    () => getDoubanList(params as any),
    5 * 60 * 1000
  );
}

/**
 * 带缓存的getDoubanRecommends
 */
export async function getCachedDoubanRecommends(
  params: any
): Promise<DoubanResult> {
  const cacheKey = generateCacheKey('douban:recommends', params);

  return apiCache.getOrFetch(
    cacheKey,
    () => getDoubanRecommends(params as any),
    5 * 60 * 1000
  );
}

/**
 * 清除特定类型的缓存
 */
export function clearDoubanCache(type?: 'categories' | 'list' | 'recommends') {
  if (!type) {
    // 清除所有豆瓣缓存
    apiCache.clear();
    return;
  }

  // 这里简化处理，实际应该遍历删除特定前缀的缓存
  apiCache.clear();
}
