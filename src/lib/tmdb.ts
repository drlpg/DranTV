// TMDB API 工具函数

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_API_PROXY =
  process.env.TMDB_API_PROXY || 'https://api.themoviedb.org/3';
const TMDB_ENABLED = process.env.TMDB_ENABLED === 'true';

interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
}

interface TMDBSearchResponse {
  results: TMDBSearchResult[];
}

/**
 * 搜索TMDB（单次尝试）
 */
async function searchTMDB(
  query: string,
  year: string | undefined,
  type: 'movie' | 'tv',
  language: string
): Promise<TMDBSearchResponse | null> {
  try {
    const searchType = type === 'movie' ? 'movie' : 'tv';
    const url = `${TMDB_API_PROXY}/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
      query
    )}&language=${language}${year ? `&year=${year}` : ''}`;

    const response = await fetch(url, {
      next: { revalidate: 86400 }, // 缓存24小时
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    return null;
  }
}

/**
 * 根据电影/剧集标题和年份搜索TMDB，获取横版海报
 * 使用混合搜索策略：先中文，再英文，最后不限年份
 */
export async function getTMDBBackdrop(
  title: string,
  year?: string,
  type: 'movie' | 'tv' = 'movie'
): Promise<string | null> {
  if (!TMDB_ENABLED || !TMDB_API_KEY) {
    return null;
  }

  try {
    let data: TMDBSearchResponse | null = null;

    // 策略1: 使用原标题 + 中文语言 + 年份
    data = await searchTMDB(title, year, type, 'zh-CN');
    if (data?.results && data.results.length > 0) {
      const result = data.results[0];
      if (result.backdrop_path) {
        return `https://image.tmdb.org/t/p/original${result.backdrop_path}`;
      }
    }

    // 策略2: 使用原标题 + 英文语言 + 年份
    data = await searchTMDB(title, year, type, 'en-US');
    if (data?.results && data.results.length > 0) {
      const result = data.results[0];
      if (result.backdrop_path) {
        return `https://image.tmdb.org/t/p/original${result.backdrop_path}`;
      }
    }

    // 策略3: 如果有年份，尝试不限年份搜索（中文）
    if (year) {
      data = await searchTMDB(title, undefined, type, 'zh-CN');
      if (data?.results && data.results.length > 0) {
        const result = data.results[0];
        if (result.backdrop_path) {
          return `https://image.tmdb.org/t/p/original${result.backdrop_path}`;
        }
      }
    }

    // 策略4: 如果有年份，尝试不限年份搜索（英文）
    if (year) {
      data = await searchTMDB(title, undefined, type, 'en-US');
      if (data?.results && data.results.length > 0) {
        const result = data.results[0];
        if (result.backdrop_path) {
          return `https://image.tmdb.org/t/p/original${result.backdrop_path}`;
        }
      }
    }

    return null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('TMDB API error:', error);
    return null;
  }
}

/**
 * 批量获取多个电影/剧集的横版海报
 */
export async function getTMDBBackdrops(
  items: Array<{ title: string; year?: string; type?: 'movie' | 'tv' }>
): Promise<Array<string | null>> {
  if (!TMDB_ENABLED || !TMDB_API_KEY) {
    return items.map(() => null);
  }

  const promises = items.map((item) =>
    getTMDBBackdrop(item.title, item.year, item.type || 'movie')
  );

  return Promise.all(promises);
}
