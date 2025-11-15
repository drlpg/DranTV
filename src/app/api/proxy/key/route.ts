/* eslint-disable no-console */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  try {
    const decodedUrl = decodeURIComponent(url);

    const fetchHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      Accept: '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      Connection: 'keep-alive',
    };

    try {
      const urlObj = new URL(decodedUrl);
      fetchHeaders['Referer'] = urlObj.origin + '/';
      fetchHeaders['Origin'] = urlObj.origin;
    } catch {
      // ignore
    }

    // 添加30秒超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
      response = await fetch(decodedUrl, {
        headers: fetchHeaders,
        cache: 'no-store',
        signal: controller.signal,
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
        console.error('[Key Proxy] Fetch failed:', response.status);
      }
      return NextResponse.json(
        { error: 'Failed to fetch key' },
        { status: 500 },
      );
    }

    const headers = new Headers();
    headers.set(
      'Content-Type',
      response.headers.get('Content-Type') || 'application/octet-stream',
    );
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Range, Origin, Accept',
    );
    headers.set('Cache-Control', 'no-cache');

    return new Response(response.body, { headers });
  } catch (error) {
    // 只记录非网络超时的错误
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      if (
        !errorMsg.includes('timeout') &&
        !errorMsg.includes('connect timeout') &&
        !errorMsg.includes('fetch failed')
      ) {
        console.error('[Key Proxy] Error:', error);
      }
    } else {
      console.error('[Key Proxy] Error:', error);
    }
    return NextResponse.json({ error: 'Failed to fetch key' }, { status: 500 });
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
