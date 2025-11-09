/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const maxDuration = 15; // 设置最大执行时间为15秒

export async function GET(request: NextRequest) {
  try {
    // 添加10秒超时控制
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('配置获取超时')), 10000);
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
      return NextResponse.json(
        {
          success: false,
          error: '无法获取配置',
          data: [],
        },
        {
          status: 500,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    // 检查是否使用了降级配置
    if (!config.LiveConfig || config.LiveConfig.length === 0) {
      console.warn('[Live Sources API] LiveConfig 为空，可能使用了降级配置');
      console.warn('[Live Sources API] 请检查数据库连接是否正常');
    }

    // 过滤出所有非 disabled 的直播源
    const allLiveSources = config.LiveConfig || [];
    console.log(
      `[Live Sources API] 配置中共有 ${allLiveSources.length} 个直播源`
    );

    const liveSources = allLiveSources.filter((source) => !source.disabled);

    console.log(
      `[Live Sources API] 过滤后返回 ${liveSources.length} 个启用的直播源`
    );
    if (allLiveSources.length > 0) {
      console.log(
        '[Live Sources API] 所有直播源状态:',
        allLiveSources.map((s) => ({
          key: s.key,
          name: s.name,
          disabled: s.disabled || false,
        }))
      );
    }

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
