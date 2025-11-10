import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: '缺少key参数' }, { status: 400 });
    }

    console.log(`[M3U API] 从数据库读取: ${key}`);
    const content = await db.get(`live_m3u_${key}`);

    if (!content) {
      return NextResponse.json({ error: 'M3U内容不存在' }, { status: 404 });
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[M3U API] 读取失败:', error);
    return NextResponse.json({ error: '读取失败' }, { status: 500 });
  }
}
