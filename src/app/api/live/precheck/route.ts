/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const source = searchParams.get('DranTV-source');

    if (!url) {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    // 直接获取配置（getConfig内部已有超时和降级策略）
    const config = await getConfig();

    const liveSource = config.LiveConfig?.find((s: any) => s.key === source);
    if (!liveSource) {
      console.error(`[Precheck] 直播源不存在: ${source}`);
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const ua = liveSource.ua || 'AptvPlayer/1.4.10';
    const decodedUrl = decodeURIComponent(url);

    // 添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response;
    try {
      response = await fetch(decodedUrl, {
        cache: 'no-cache',
        redirect: 'follow',
        credentials: 'same-origin',
        headers: {
          'User-Agent': ua,
        },
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      // 如果是内网地址或服务器无法访问，返回成功让客户端尝试
      console.warn('[Precheck] 服务器无法访问URL，让客户端尝试:', decodedUrl);
      return NextResponse.json(
        { success: true, type: 'm3u8' },
        { status: 200 },
      );
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      // 服务器无法访问，但客户端可能可以访问（如内网地址）
      console.warn('[Precheck] 服务器返回错误，让客户端尝试:', response.status);
      return NextResponse.json(
        { success: true, type: 'm3u8' },
        { status: 200 },
      );
    }

    const contentType = response.headers.get('Content-Type');
    if (response.body) {
      response.body.cancel();
    }

    if (contentType?.includes('video/mp4')) {
      return NextResponse.json({ success: true, type: 'mp4' }, { status: 200 });
    }
    if (contentType?.includes('video/x-flv')) {
      return NextResponse.json({ success: true, type: 'flv' }, { status: 200 });
    }
    return NextResponse.json({ success: true, type: 'm3u8' }, { status: 200 });
  } catch (error) {
    console.error('[Precheck] 错误:', error);
    // 即使出错也返回成功，让客户端尝试播放
    return NextResponse.json({ success: true, type: 'm3u8' }, { status: 200 });
  }
}
