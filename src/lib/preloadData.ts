/**
 * 数据预加载工具
 * 在用户可能访问的页面之前预加载数据
 */

import { getCachedDoubanCategories } from './cachedDoubanApi';

/**
 * 预加载常用页面数据
 */
export async function preloadCommonPages() {
  if (typeof window === 'undefined') return;

  // 预加载热门电影
  getCachedDoubanCategories({
    kind: 'movie',
    category: '热门',
    type: '全部',
  }).catch(() => {
    // 静默失败
  });

  // 预加载热门剧集
  getCachedDoubanCategories({
    kind: 'tv',
    category: 'tv',
    type: 'tv',
  }).catch(() => {
    // 静默失败
  });
}

/**
 * 在空闲时预加载数据
 */
export function preloadOnIdle() {
  if (typeof window === 'undefined') return;

  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      preloadCommonPages();
    });
  } else {
    // 降级方案：延迟2秒后加载
    setTimeout(() => {
      preloadCommonPages();
    }, 2000);
  }
}
