/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getBaseUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    pathParts.pop();
    return `${urlObj.origin}${pathParts.join('/')}/`;
  } catch {
    return url;
  }
}

function resolveUrl(baseUrl: string, relativeUrl: string): string {
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch {
    return relativeUrl;
  }
}

function rewriteM3U8Content(
  content: string,
  baseUrl: string,
  req: Request,
): string {
  const referer = req.headers.get('referer');
  let protocol = 'https';
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      protocol = refererUrl.protocol.replace(':', '');
    } catch {
      // ignore
    }
  }

  const host = req.headers.get('host');
  const proxyBase = `${protocol}://${host}/api/proxy`;

  const lines = content.split('\n');
  const rewrittenLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // 处理 TS 片段 URL 和其他媒体文件
    if (line && !line.startsWith('#')) {
      const resolvedUrl = resolveUrl(baseUrl, line);
      const proxyUrl = `${proxyBase}/segment?url=${encodeURIComponent(
        resolvedUrl,
      )}`;
      rewrittenLines.push(proxyUrl);
      continue;
    }

    // 处理 EXT-X-MAP 标签中的 URI
    if (line.startsWith('#EXT-X-MAP:')) {
      const uriMatch = line.match(/URI="([^"]+)"/);
      if (uriMatch) {
        const originalUri = uriMatch[1];
        const resolvedUrl = resolveUrl(baseUrl, originalUri);
        const proxyUrl = `${proxyBase}/segment?url=${encodeURIComponent(
          resolvedUrl,
        )}`;
        line = line.replace(uriMatch[0], `URI="${proxyUrl}"`);
      }
    }

    // 处理 EXT-X-KEY 标签中的 URI
    if (line.startsWith('#EXT-X-KEY:')) {
      const uriMatch = line.match(/URI="([^"]+)"/);
      if (uriMatch) {
        const originalUri = uriMatch[1];
        const resolvedUrl = resolveUrl(baseUrl, originalUri);
        const proxyUrl = `${proxyBase}/key?url=${encodeURIComponent(
          resolvedUrl,
        )}`;
        line = line.replace(uriMatch[0], `URI="${proxyUrl}"`);
      }
    }

    // 处理嵌套的 M3U8 文件 (EXT-X-STREAM-INF)
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      rewrittenLines.push(line);
      if (i + 1 < lines.length) {
        i++;
        const nextLine = lines[i].trim();
        if (nextLine && !nextLine.startsWith('#')) {
          const resolvedUrl = resolveUrl(baseUrl, nextLine);
          const proxyUrl = `${proxyBase}/m3u8?url=${encodeURIComponent(
            resolvedUrl,
          )}`;
          rewrittenLines.push(proxyUrl);
        } else {
          rewrittenLines.push(nextLine);
        }
      }
      continue;
    }

    rewrittenLines.push(line);
  }

  return rewrittenLines.join('\n');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  let response: Response | null = null;
  let responseUsed = false;

  try {
    const decodedUrl = decodeURIComponent(url);

    // 添加30秒超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const urlObj = new URL(decodedUrl);
      response = await fetch(decodedUrl, {
        cache: 'no-cache',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Accept: '*/*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'identity',
          Referer: urlObj.origin + '/',
          Origin: urlObj.origin,
          Connection: 'keep-alive',
        },
        // @ts-expect-error - undici specific options
        connectTimeout: 30000,
        bodyTimeout: 60000,
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      // 静默处理超时和连接错误
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (
          error.name === 'AbortError' ||
          errorMsg.includes('timeout') ||
          errorMsg.includes('connect timeout') ||
          errorMsg.includes('fetch failed')
        ) {
          return NextResponse.json(
            { error: 'Request timeout' },
            { status: 504 },
          );
        }
      }
      throw error;
    }

    if (!response.ok) {
      // 只记录非超时的错误
      if (response.status !== 504 && response.status !== 403) {
        console.error('[M3U8 Proxy] Fetch failed:', response.status);
      }
      return NextResponse.json(
        { error: 'Failed to fetch m3u8' },
        { status: 500 },
      );
    }

    const contentType = response.headers.get('Content-Type') || '';
    if (
      contentType.toLowerCase().includes('mpegurl') ||
      contentType.toLowerCase().includes('octet-stream')
    ) {
      const finalUrl = response.url;
      const m3u8Content = await response.text();
      responseUsed = true;

      const baseUrl = getBaseUrl(finalUrl);
      const modifiedContent = rewriteM3U8Content(m3u8Content, baseUrl, request);

      const headers = new Headers();
      headers.set('Content-Type', contentType);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Range, Origin, Accept',
      );
      headers.set('Cache-Control', 'no-cache');
      headers.set(
        'Access-Control-Expose-Headers',
        'Content-Length, Content-Range',
      );
      return new Response(modifiedContent, { headers });
    }

    const headers = new Headers();
    headers.set(
      'Content-Type',
      response.headers.get('Content-Type') || 'application/vnd.apple.mpegurl',
    );
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Range, Origin, Accept',
    );
    headers.set('Cache-Control', 'no-cache');
    headers.set(
      'Access-Control-Expose-Headers',
      'Content-Length, Content-Range',
    );

    return new Response(response.body, { status: 200, headers });
  } catch (error) {
    // 只记录非网络超时的错误
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      if (
        !errorMsg.includes('timeout') &&
        !errorMsg.includes('connect timeout') &&
        !errorMsg.includes('fetch failed')
      ) {
        console.error('[M3U8 Proxy] Error:', error);
      }
    } else {
      console.error('[M3U8 Proxy] Error:', error);
    }
    return NextResponse.json(
      { error: 'Failed to fetch m3u8' },
      { status: 500 },
    );
  } finally {
    if (response && !responseUsed) {
      try {
        response.body?.cancel();
      } catch {
        // ignore
      }
    }
  }
}

export async function OPTIONS() {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Range, Origin, Accept',
  );
  return new Response(null, { status: 204, headers });
}
