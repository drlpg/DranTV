/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  let response: Response | null = null;

  try {
    const decodedUrl = decodeURIComponent(url);
    console.log('[Segment Proxy] Request:', decodedUrl.substring(0, 100));

    // 使用极简请求头
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0',
    };

    // 透传 Range 请求头
    const range = request.headers.get('Range');
    if (range) {
      fetchHeaders['Range'] = range;
    }

    // 添加30秒超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      response = await fetch(decodedUrl, {
        headers: fetchHeaders,
        cache: 'no-store',
        signal: controller.signal,
        // @ts-expect-error - undici specific options
        connectTimeout: 30000, // 30秒连接超时
        bodyTimeout: 60000, // 60秒响应体超时
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      // 静默处理超时和连接错误，避免日志噪音
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (
          error.name === 'AbortError' ||
          errorMsg.includes('timeout') ||
          errorMsg.includes('connect timeout') ||
          errorMsg.includes('fetch failed')
        ) {
          // 不记录日志，直接返回504
          return NextResponse.json(
            { error: 'Request timeout' },
            { status: 504 },
          );
        }
      }
      throw error;
    }

    if (!response.ok && response.status !== 206) {
      console.error(
        '[Segment Proxy] Fetch failed:',
        response.status,
        decodedUrl.substring(0, 100),
      );
      return NextResponse.json(
        { error: `Failed to fetch segment: ${response.status}` },
        { status: response.status },
      );
    }

    const headers = new Headers();
    headers.set(
      'Content-Type',
      response.headers.get('Content-Type') || 'video/mp2t',
    );
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Range, Origin, Accept',
    );
    headers.set('Accept-Ranges', 'bytes');
    headers.set(
      'Access-Control-Expose-Headers',
      'Content-Length, Content-Range, Accept-Ranges',
    );

    const contentLength = response.headers.get('Content-Length');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    const contentRange = response.headers.get('Content-Range');
    if (contentRange) {
      headers.set('Content-Range', contentRange);
    }

    const status = response.status === 206 ? 206 : 200;
    // 直接传递 response.body，让浏览器处理流式传输
    return new Response(response.body, { status, headers });
  } catch (error) {
    console.error('[Segment Proxy] Error:', error);

    if (response?.body) {
      try {
        response.body.cancel();
      } catch {
        // ignore
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to fetch segment',
      },
      { status: 500 },
    );
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
