/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const maxDuration = 15; // 设置最大执行时间为15秒
export const dynamic = 'force-dynamic'; // 强制动态渲染，禁用缓存
export const revalidate = 0; // 禁用重新验证缓存

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 直接获取配置（getConfig内部已有超时和降级策略）
    const config = await getConfig();

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: '无法获取配置',
          data: [],
          debug: {
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            step: 'config_null',
          },
        },
        {
          status: 500,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    // 过滤出所有非 disabled 的直播源
    const allLiveSources = config.LiveConfig || [];
    const liveSources = allLiveSources.filter((source) => !source.disabled);

    return NextResponse.json(
      {
        success: true,
        data: liveSources,
        debug: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          totalSources: allLiveSources.length,
          enabledSources: liveSources.length,
          step: 'success',
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '获取直播源失败';

    // 即使出错也返回空数组，避免前端崩溃
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        data: [], // 提供空数组作为降级
        debug: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          errorStack: error instanceof Error ? error.stack : undefined,
          step: 'error',
        },
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
