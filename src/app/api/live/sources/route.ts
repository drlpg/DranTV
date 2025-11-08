/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const maxDuration = 10; // 设置最大执行时间为10秒

export async function GET(request: NextRequest) {
  try {
    // 添加5秒超时控制（缩短超时时间）
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('请求超时')), 5000);
    });

    const configPromise = getConfig();

    let config;
    try {
      config = await Promise.race([configPromise, timeoutPromise]);
    } catch (timeoutError) {
      // 超时时尝试直接获取配置（getConfig内部有降级策略）
      console.warn('[Live Sources API] 配置获取超时，尝试直接获取');
      config = await getConfig();
    }

    if (!config) {
      console.error('[Live Sources API] 配置为空');
      // 返回空数组而不是错误，避免前端崩溃
      return NextResponse.json(
        {
          success: true,
          data: [],
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    // 过滤出所有非 disabled 的直播源
    const liveSources = (config.LiveConfig || []).filter(
      (source) => !source.disabled
    );

    console.log(`[Live Sources API] 返回 ${liveSources.length} 个直播源`);

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
    console.error('[Live Sources API] 获取直播源失败:', error);
    const errorMessage =
      error instanceof Error ? error.message : '获取直播源失败';

    // 即使出错也返回空数组，避免前端崩溃
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        data: [], // 提供空数组作为降级
      },
      {
        status: 200, // 使用200状态码，避免前端报错
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}
