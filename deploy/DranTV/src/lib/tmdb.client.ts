/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

/**
 * 根据豆瓣电影标题搜索TMDB获取横版海报
 * 使用自建API代理，无需暴露API Key
 */
export async function getTMDBBackdrop(
  title: string,
  year?: string
): Promise<string | null> {
  try {
    const params = new URLSearchParams({ title });
    if (year) {
      params.append('year', year);
    }

    const response = await fetch(`/api/tmdb?${params.toString()}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.backdrop || null;
  } catch (error) {
    return null;
  }
}

/**
 * 批量获取TMDB横版海报
 */
export async function getTMDBBackdrops(
  items: Array<{ title: string; year?: string }>
): Promise<Array<string | null>> {
  return Promise.all(
    items.map((item) => getTMDBBackdrop(item.title, item.year))
  );
}
