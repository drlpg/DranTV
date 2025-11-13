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
    };

    try {
      const urlObj = new URL(decodedUrl);
      fetchHeaders['Referer'] = urlObj.origin;
      fetchHeaders['Origin'] = urlObj.origin;
    } catch {
      // ignore
    }

    const response = await fetch(decodedUrl, {
      headers: fetchHeaders,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('[Key Proxy] Fetch failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch key' },
        { status: 500 }
      );
    }

    const headers = new Headers();
    headers.set(
      'Content-Type',
      response.headers.get('Content-Type') || 'application/octet-stream'
    );
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Range, Origin, Accept'
    );
    headers.set('Cache-Control', 'no-cache');

    return new Response(response.body, { headers });
  } catch (error) {
    console.error('[Key Proxy] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch key' }, { status: 500 });
  }
}

export async function OPTIONS() {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Range, Origin, Accept'
  );
  return new Response(null, { status: 204, headers });
}
