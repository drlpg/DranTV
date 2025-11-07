/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const maxDuration = 10; // 设置最大执行时间为10秒

export async function GET(request: NextRequest) {
  try {
    // 添加超时控制
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('请求超时')), 8000);
    });

    const configPromise = getConfig();

    const config = await Promise.race([configPromise, timeoutPromise]);

    if (!config) {
      return NextResponse.json({ error: '配置未找到' }, { status: 404 });
    }

    // 过滤出所有非 disabled 的直播源
    const liveSources = (config.LiveConfig || []).filter(
      (source) => !source.disabled
    );

    return NextResponse.json(
      {
        success: true,
        data: liveSources,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('获取直播源失败:', error);
    const errorMessage =
      error instanceof Error ? error.message : '获取直播源失败';
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage.includes('超时') ? 504 : 500 }
    );
  }
}
