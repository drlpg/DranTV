/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
// 支持自定义 TMDB API 代理地址
const TMDB_BASE_URL =
  process.env.TMDB_API_PROXY || 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  backdrop_path?: string;
  poster_path?: string;
  release_date?: string;
  first_air_date?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const title = searchParams.get('title');
  const year = searchParams.get('year');

  if (!title) {
    return NextResponse.json({ error: '缺少标题参数' }, { status: 400 });
  }

  // 检查是否启用 TMDB（默认启用）
  const tmdbEnabled = process.env.TMDB_ENABLED !== 'false';

  if (!tmdbEnabled || !TMDB_API_KEY) {
    return NextResponse.json({ backdrop: null, poster: null }, { status: 200 });
  }

  try {
    // 添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // 尝试多种语言搜索，提高匹配率
    const languages = ['zh-CN', 'en-US'];
    let allResults: TMDBSearchResult[] = [];

    for (const lang of languages) {
      const searchUrl = `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
        title
      )}&language=${lang}`;

      try {
        const response = await fetch(searchUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          next: { revalidate: 86400 },
        });

        if (response.ok) {
          const data = await response.json();
          const results: TMDBSearchResult[] = data.results || [];
          allResults = [...allResults, ...results];

          // 如果找到有横版海报的结果，优先使用
          if (results.some((r) => r.backdrop_path)) {
            break;
          }
        }
      } catch (err) {
        // 继续尝试下一个语言
        continue;
      }
    }

    clearTimeout(timeoutId);

    // 去重（基于 id）
    const uniqueResults = Array.from(
      new Map(allResults.map((item) => [item.id, item])).values()
    );

    if (uniqueResults.length === 0) {
      return NextResponse.json(
        { backdrop: null, poster: null },
        { status: 200 }
      );
    }

    // 优先选择有横版海报的结果
    let matchedResult =
      uniqueResults.find((r) => r.backdrop_path) || uniqueResults[0];

    // 如果提供了年份，尝试匹配年份（同时要有横版海报）
    if (year) {
      const yearMatch = uniqueResults.find((result) => {
        const releaseYear =
          result.release_date?.substring(0, 4) ||
          result.first_air_date?.substring(0, 4);
        return releaseYear === year && result.backdrop_path;
      });
      if (yearMatch) {
        matchedResult = yearMatch;
      }
    }

    // 返回图片URL
    const backdrop = matchedResult.backdrop_path
      ? `${TMDB_IMAGE_BASE_URL}/original${matchedResult.backdrop_path}`
      : null;

    const poster = matchedResult.poster_path
      ? `${TMDB_IMAGE_BASE_URL}/original${matchedResult.poster_path}`
      : null;

    return NextResponse.json(
      { backdrop, poster },
      {
        headers: {
          'Cache-Control':
            'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch (error) {
    // 返回null而不是错误，让前端使用备用方案（豆瓣海报）
    return NextResponse.json(
      {
        backdrop: null,
        poster: null,
        error: error instanceof Error ? error.message : '网络错误',
      },
      { status: 200 }
    );
  }
}
