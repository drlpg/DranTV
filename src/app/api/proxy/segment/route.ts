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
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    const decodedUrl = decodeURIComponent(url);

    // 透传 Range 请求头
    const fetchHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    };

    const range = request.headers.get('Range');
    if (range) {
      fetchHeaders['Range'] = range;
    }

    try {
      const urlObj = new URL(decodedUrl);
      fetchHeaders['Referer'] = urlObj.origin;
      fetchHeaders['Origin'] = urlObj.origin;
    } catch {
      // ignore
    }

    response = await fetch(decodedUrl, {
      headers: fetchHeaders,
      cache: 'no-store',
    });

    if (!response.ok && response.status !== 206) {
      console.error('[Segment Proxy] Fetch failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch segment' },
        { status: 500 }
      );
    }

    const headers = new Headers();
    headers.set(
      'Content-Type',
      response.headers.get('Content-Type') || 'video/mp2t'
    );
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Range, Origin, Accept'
    );
    headers.set('Accept-Ranges', 'bytes');
    headers.set(
      'Access-Control-Expose-Headers',
      'Content-Length, Content-Range, Accept-Ranges'
    );

    const contentLength = response.headers.get('Content-Length');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    const contentRange = response.headers.get('Content-Range');
    if (contentRange) {
      headers.set('Content-Range', contentRange);
    }

    // 使用流式传输
    const stream = new ReadableStream({
      start(controller) {
        if (!response?.body) {
          controller.close();
          return;
        }

        reader = response.body.getReader();
        let isCancelled = false;

        function pump(): void {
          if (isCancelled || !reader) {
            return;
          }

          reader
            .read()
            .then(({ done, value }) => {
              if (isCancelled) {
                return;
              }

              if (done) {
                controller.close();
                cleanup();
                return;
              }

              controller.enqueue(value);
              pump();
            })
            .catch((error) => {
              if (!isCancelled) {
                controller.error(error);
                cleanup();
              }
            });
        }

        function cleanup() {
          if (reader) {
            try {
              (reader as ReadableStreamDefaultReader<Uint8Array>).releaseLock();
            } catch {
              // ignore
            }
            reader = null;
          }
        }

        pump();
      },
      cancel() {
        if (reader) {
          try {
            (reader as ReadableStreamDefaultReader<Uint8Array>).releaseLock();
          } catch {
            // ignore
          }
          reader = null;
        }

        if (response?.body) {
          try {
            response.body.cancel();
          } catch {
            // ignore
          }
        }
      },
    });

    const status = response.status === 206 ? 206 : 200;
    return new Response(stream, { status, headers });
  } catch (error) {
    console.error('[Segment Proxy] Error:', error);

    if (reader) {
      try {
        (reader as ReadableStreamDefaultReader<Uint8Array>).releaseLock();
      } catch {
        // ignore
      }
    }

    if (response?.body) {
      try {
        response.body.cancel();
      } catch {
        // ignore
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch segment' },
      { status: 500 }
    );
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
