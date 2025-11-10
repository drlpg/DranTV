/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const maxDuration = 15; // 设置最大执行时间为15秒

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('[Live Sources API] ========== 开始处理请求 ==========');
  console.log('[Live Sources API] 请求时间:', new Date().toISOString());
  console.log('[Live Sources API] 请求URL:', request.url);

  try {
    // 添加10秒超时控制
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('配置获取超时')), 10000);
    });

    const configPromise = getConfig();

    let config;
    try {
      console.log('[Live Sources API] 开始获取配置...');
      config = await Promise.race([configPromise, timeoutPromise]);
      console.log(
        '[Live Sources API] 配置获取成功，耗时:',
        Date.now() - startTime,
        'ms'
      );
    } catch (timeoutError) {
      // 超时时尝试直接获取配置（getConfig内部有降级策略）
      console.warn('[Live Sources API] 配置获取超时，尝试直接获取');
      console.warn('[Live Sources API] 超时错误:', timeoutError);
      config = await getConfig();
      console.log(
        '[Live Sources API] 降级配置获取成功，总耗时:',
        Date.now() - startTime,
        'ms'
      );
    }

    if (!config) {
      console.error('[Live Sources API] 配置为空');
      console.error('[Live Sources API] 总耗时:', Date.now() - startTime, 'ms');
      return NextResponse.json(
        {
          success: false,
          error: '无法获取配置',
          data: [],
          debug: {
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
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

    // 检查是否使用了降级配置
    if (!config.LiveConfig || config.LiveConfig.length === 0) {
      console.warn('[Live Sources API] LiveConfig 为空，可能使用了降级配置');
      console.warn('[Live Sources API] 请检查数据库连接是否正常');
      console.warn(
        '[Live Sources API] 配置对象:',
        JSON.stringify(config, null, 2)
      );
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

    console.log(
      '[Live Sources API] 请求处理完成，总耗时:',
      Date.now() - startTime,
      'ms'
    );
    console.log('[Live Sources API] ========== 请求处理结束 ==========');

    return NextResponse.json(
      {
        success: true,
        data: liveSources,
        debug: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          totalSources: allLiveSources.length,
          enabledSources: liveSources.length,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('[Live Sources API] ========== 发生错误 ==========');
    console.error('[Live Sources API] 获取直播源失败:', error);
    console.error(
      '[Live Sources API] 错误堆栈:',
      error instanceof Error ? error.stack : 'N/A'
    );
    console.error('[Live Sources API] 总耗时:', Date.now() - startTime, 'ms');
    console.error('[Live Sources API] ========== 错误处理结束 ==========');

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
